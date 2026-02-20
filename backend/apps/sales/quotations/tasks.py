from celery import shared_task
from django.core.mail import EmailMessage
from django.template.loader import render_to_string
from django.conf import settings
from weasyprint import HTML
from io import BytesIO
import logging
import base64
import subprocess
import tempfile
import os
import requests
import json

from .models import SalesQuotation, QuotationShare
from printcloudclient.models import PrintJob
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from apps.core.services import CommunicationLogger

User = get_user_model()

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def send_quotation_email_task(self, email_data):
    """
    Celery task to send quotation email with PDF attachment
    """
    try:
        # Extract email data
        quotation_id = email_data['quotation_id']
        from_email = email_data['from_email']
        to_emails = email_data['to_emails']
        cc_emails = email_data.get('cc_emails', [])
        bcc_emails = email_data.get('bcc_emails', [])
        subject = email_data['subject']
        message = email_data['message']
        send_copy_to_sender = email_data.get('send_copy_to_sender', False)
        sender_name = email_data.get('sender_name', '')
        
        # Get the quotation with related data
        try:
            quotation = SalesQuotation.objects.select_related(
                'customer', 'created_by'
            ).prefetch_related('items').get(pk=quotation_id)
        except SalesQuotation.DoesNotExist:
            logger.error(f'Quotation with ID {quotation_id} does not exist')
            return {
                'success': False,
                'error': f'Quotation with ID {quotation_id} not found',
                'quotation_id': quotation_id
            }
        
        # Generate PDF
        pdf_buffer = generate_quotation_pdf(quotation)
        
        # Prepare recipients
        recipients = to_emails.copy()
        
        # Add sender to recipients if requested
        if send_copy_to_sender and from_email not in recipients:
            recipients.append(from_email)
        
        # Generate share link for email
        share_url = None
        try:
            # Set expiration (7 days from now)
            expires_at = timezone.now() + timedelta(days=7)
            
            # Generate unique token
            token = QuotationShare.generate_token()
            while QuotationShare.objects.filter(token=token).exists():
                token = QuotationShare.generate_token()
            
            # Create share record
            share = QuotationShare.objects.create(
                quotation=quotation,
                token=token,
                expires_at=expires_at,
                created_by_id=1  # Default system user, could be improved
            )
            
            # Generate the share URL using environment-specific frontend URL
            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
            share_url = f"{frontend_url}/shared/quotation/{token}"
            
            logger.info(f"Generated share link for quotation {quotation.id}: {share_url}")
        except Exception as e:
            logger.error(f"Failed to generate share link for quotation {quotation.id}: {str(e)}")
            # Continue without share link if generation fails

        # Create email message
        email_subject = subject
        email_body = render_to_string('quotations/quotation_email.html', {
            'quotation': quotation,
            'message': message,
            'sender_name': sender_name,
            'share_url': share_url,
        })
        
        # Create email
        email = EmailMessage(
            subject=email_subject,
            body=email_body,
            from_email=from_email,
            to=recipients,
            cc=cc_emails,
            bcc=bcc_emails,
        )
        
        # Set email content type to HTML
        email.content_subtype = 'html'
        
        # Attach PDF
        pdf_filename = f'Quotation-{quotation.quot_number}.pdf'
        email.attach(pdf_filename, pdf_buffer.getvalue(), 'application/pdf')
        
        # Send email
        email.send()

        logger.info(f'Quotation email sent successfully for quotation {quotation.quot_number} to {len(recipients)} recipients')

        # Log the communication
        try:
            # Get the user who sent the email
            user = User.objects.get(email=from_email)
        except User.DoesNotExist:
            # Try to get the user who created the quotation
            user = quotation.created_by

        # Log email to each recipient
        for recipient in recipients:
            CommunicationLogger.log_email(
                doc_type='quotation',
                doc_id=quotation.id,
                destination=recipient,
                success=True,
                user=user,
                message=f'Subject: {subject}'
            )

        return {
            'success': True,
            'message': f'Email sent to {len(recipients)} recipients',
            'quotation_number': quotation.quot_number
        }
        
    except Exception as exc:
        logger.error(f'Error sending quotation email: {str(exc)}')

        # Retry logic
        if self.request.retries < self.max_retries:
            logger.info(f'Retrying email send task. Retry {self.request.retries + 1}/{self.max_retries}')
            raise self.retry(countdown=60 * (self.request.retries + 1), exc=exc)
        else:
            logger.error(f'Max retries exceeded for quotation email task')

            # Log the failed communication after max retries
            try:
                quotation_id = email_data.get('quotation_id')
                to_emails = email_data.get('to_emails', [])
                from_email = email_data.get('from_email')
                subject = email_data.get('subject')

                # Get the user
                try:
                    user = User.objects.get(email=from_email)
                except User.DoesNotExist:
                    try:
                        quotation = SalesQuotation.objects.get(pk=quotation_id)
                        user = quotation.created_by
                    except SalesQuotation.DoesNotExist:
                        user = None

                # Log failure for each recipient
                if user:
                    for recipient in to_emails:
                        CommunicationLogger.log_email(
                            doc_type='quotation',
                            doc_id=quotation_id,
                            destination=recipient,
                            success=False,
                            user=user,
                            message=f'Subject: {subject}',
                            error=str(exc)
                        )
            except Exception as log_error:
                logger.error(f'Error logging failed email communication: {str(log_error)}')

            return {
                'success': False,
                'error': str(exc),
                'quotation_id': email_data.get('quotation_id')
            }


def generate_quotation_pdf(quotation):
    """
    Generate PDF for quotation using existing logic
    """
    def format_project_description():
        if not quotation.items.exists():
            return 'No items'
        
        items = list(quotation.items.all()[:3])
        item_names = [item.item for item in items if item.item and item.item.strip()]
        
        if not item_names:
            return 'No item names available'
        
        # Remove duplicates while preserving order
        unique_names = []
        for name in item_names:
            if name not in unique_names:
                unique_names.append(name)
        
        if len(unique_names) <= 2:
            return ' & '.join(unique_names)
        else:
            return ', '.join(unique_names[:2]) + ' & ' + unique_names[2]
    
    # Prepare context for template
    context = {
        'quotation': quotation,
        'project_description': format_project_description(),
    }
    
    # Render HTML template
    html_string = render_to_string('quotations/quotation_pdf.html', context)
    
    # Generate PDF
    pdf_buffer = BytesIO()
    
    # Create HTML object and write PDF
    html = HTML(string=html_string)
    html.write_pdf(pdf_buffer)
    pdf_buffer.seek(0)
    
    return pdf_buffer


def convert_pdf_to_printer_format(pdf_buffer, target_format='pcl'):
    """
    Convert PDF to printer-specific format (PCL, PostScript, or keep as PDF)
    
    Requires GhostScript (gs) to be installed for PCL/PostScript conversion.
    If GhostScript is not available, gracefully falls back to original PDF format.
    
    To install GhostScript on Ubuntu/Debian: sudo apt install ghostscript
    
    Args:
        pdf_buffer: BytesIO buffer containing PDF data
        target_format: 'pcl', 'ps', or 'pdf'
    
    Returns:
        BytesIO buffer containing converted data
    """
    if target_format.lower() == 'pdf':
        # No conversion needed
        return pdf_buffer
    
    try:
        # Create temporary files
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_pdf:
            temp_pdf.write(pdf_buffer.getvalue())
            temp_pdf_path = temp_pdf.name
        
        # Determine output format and GhostScript device
        if target_format.lower() == 'pcl':
            gs_device = 'ljet4'  # PCL 5 format compatible with most laser printers
            output_suffix = '.pcl'
        elif target_format.lower() in ['ps', 'postscript']:
            gs_device = 'ps2write'  # PostScript Level 2
            output_suffix = '.ps'
        else:
            raise ValueError(f"Unsupported target format: {target_format}")
        
        # Create output file path
        temp_output_path = temp_pdf_path.replace('.pdf', output_suffix)
        
        # Run GhostScript conversion
        gs_command = [
            'gs',
            '-dNOPAUSE',
            '-dBATCH',
            '-dSAFER',
            '-sDEVICE=' + gs_device,
            '-sOutputFile=' + temp_output_path,
            '-dPDFFitPage',  # Fit page to printer
            '-r300',  # 300 DPI resolution
            temp_pdf_path
        ]
        
        logger.info(f"Running GhostScript command: {' '.join(gs_command)}")
        result = subprocess.run(gs_command, capture_output=True, text=True, timeout=30)
        
        logger.info(f"GhostScript stdout: {result.stdout}")
        if result.stderr:
            logger.info(f"GhostScript stderr: {result.stderr}")
        
        if result.returncode != 0:
            logger.error(f"GhostScript conversion failed with return code {result.returncode}: {result.stderr}")
            # Fallback: return original PDF
            logger.warning(f"Falling back to PDF format for printer output")
            return pdf_buffer
        
        # Read converted file into buffer
        output_buffer = BytesIO()
        with open(temp_output_path, 'rb') as converted_file:
            output_buffer.write(converted_file.read())
        output_buffer.seek(0)
        
        # Cleanup temporary files
        try:
            os.unlink(temp_pdf_path)
            os.unlink(temp_output_path)
        except OSError:
            pass  # Ignore cleanup errors
        
        logger.info(f"Successfully converted PDF to {target_format.upper()} format")
        return output_buffer
        
    except subprocess.TimeoutExpired:
        logger.error("GhostScript conversion timed out")
        return pdf_buffer
    except Exception as e:
        logger.error(f"PDF conversion error: {str(e)}")
        return pdf_buffer


def is_pdf_virtual_printer(printer_name):
    """
    Detect if printer is a PDF virtual printer that needs PostScript conversion
    
    PDF virtual printers expect print commands (PostScript/PCL), not raw PDF data
    """
    if not printer_name:
        return False
    
    printer_lower = printer_name.lower()
    
    # Common PDF virtual printer indicators
    pdf_indicators = [
        'microsoft print to pdf',
        'adobe pdf',
        'pdf creator',
        'cutepdf',
        'foxit pdf',
        'pdf24',
        'print to pdf',
        'save as pdf',
        'pdf printer'
    ]
    
    return any(indicator in printer_lower for indicator in pdf_indicators)

def detect_printer_format(printer_name):
    """
    Detect the preferred format for a printer based on its name/driver
    This is a simple heuristic - in production you might want to query actual printer capabilities
    
    Returns: 'pcl', 'ps', or 'pdf'
    """
    if not printer_name:
        return 'pdf'  # Fallback to PDF
    
    printer_lower = printer_name.lower()
    
    # PDF virtual printers need PostScript conversion
    if is_pdf_virtual_printer(printer_name):
        return 'ps'  # PostScript works best for PDF virtual printers
    
    # Common PostScript printer indicators
    if any(indicator in printer_lower for indicator in ['postscript', 'ps', 'adobe', 'color']):
        return 'ps'
    
    # Common PCL printer indicators (most laser printers)
    if any(indicator in printer_lower for indicator in ['laser', 'hp', 'canon', 'brother', 'pcl']):
        return 'pcl'
    
    # Default to PCL for unknown printers (most compatible)
    return 'pcl'


@shared_task(bind=True, max_retries=3)
def create_quotation_print_job_task(self, quotation_id, user_id, printer_name=None, copies=1):
    """
    Celery task to create a print job for a quotation using the letterhead template
    """
    try:
        # Get the quotation with related data
        try:
            quotation = SalesQuotation.objects.select_related(
                'customer', 'created_by'
            ).prefetch_related('items').get(pk=quotation_id)
        except SalesQuotation.DoesNotExist:
            logger.error(f'Quotation with ID {quotation_id} does not exist')
            return {
                'success': False,
                'error': f'Quotation with ID {quotation_id} not found',
                'quotation_id': quotation_id
            }
        
        # Get the user for printer preferences
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            logger.error(f'User with ID {user_id} does not exist')
            return {
                'success': False,
                'error': f'User with ID {user_id} not found',
                'user_id': user_id
            }
        
        # Generate PDF using letterhead template
        pdf_buffer = generate_quotation_letterhead_pdf(quotation)
        
        # TEMPORARY FIX: Send PDF directly until PrintCloudClient is updated to handle PCL/PostScript
        # TODO: Re-enable PCL/PostScript conversion after PrintCloudClient C# code is updated
        
        # Determine target printer - use custom printer if specified, otherwise user's default
        target_printer_name = printer_name or user.default_a4_printer
        
        # Detect the best format for the target printer
        target_format = detect_printer_format(target_printer_name)
        
        # Check if this is a PDF virtual printer - they need PDF data, not PostScript
        if is_pdf_virtual_printer(target_printer_name):
            logger.info(f"PDF virtual printer detected: '{target_printer_name}' - keeping original PDF format for Windows Print API")
            # PDF virtual printers work better with original PDF data through Windows Print API
            printer_data_buffer = pdf_buffer
        else:
            logger.info(f"Physical printer detected: '{target_printer_name}' - converting to {target_format.upper()} format")
            # Convert PDF to printer format (PCL/PostScript) for physical printers
            printer_data_buffer = convert_pdf_to_printer_format(pdf_buffer, target_format)
        
        # Convert to base64
        printer_data_bytes = printer_data_buffer.getvalue()
        base64_data = base64.b64encode(printer_data_bytes).decode('utf-8')
        
        # Validate copies
        try:
            copies = int(copies)
            if copies < 1 or copies > 99:
                copies = 1
        except (ValueError, TypeError):
            copies = 1
        
        # Create print job
        print_job = PrintJob.objects.create(
            user=user,
            target_printer_name=target_printer_name or '',
            fallback_printer_names=[],  # Let the system handle fallbacks
            document_type='quotation',
            print_data=base64_data,
            copies=copies,
            status='pending'
        )

        logger.info(f'Print job {print_job.id} created successfully for quotation {quotation.quot_number} by user {user.email}')

        # Log the print communication
        CommunicationLogger.log_print(
            doc_type='quotation',
            doc_id=quotation.id,
            success=True,
            user=user,
            destination=target_printer_name or "Physical Copy",
            message=f'Print job {print_job.id} - {copies} copies'
        )

        return {
            'success': True,
            'message': f'Print job created for quotation {quotation.quot_number}',
            'print_job_id': str(print_job.id),
            'quotation_number': quotation.quot_number
        }
        
    except Exception as exc:
        logger.error(f'Error creating quotation print job: {str(exc)}')

        # Retry logic
        if self.request.retries < self.max_retries:
            logger.info(f'Retrying print job creation. Retry {self.request.retries + 1}/{self.max_retries}')
            raise self.retry(countdown=60 * (self.request.retries + 1), exc=exc)
        else:
            logger.error(f'Max retries exceeded for quotation print job task')

            # Log the failed communication after max retries
            try:
                user = User.objects.get(pk=user_id)
                CommunicationLogger.log_print(
                    doc_type='quotation',
                    doc_id=quotation_id,
                    success=False,
                    user=user,
                    destination=printer_name or "Physical Copy",
                    error=str(exc)
                )
            except Exception as log_error:
                logger.error(f'Error logging failed print communication: {str(log_error)}')

            return {
                'success': False,
                'error': str(exc),
                'quotation_id': quotation_id,
                'user_id': user_id
            }


def generate_quotation_letterhead_pdf(quotation):
    """
    Generate PDF for quotation using the letterhead template
    """
    def format_project_description():
        if not quotation.items.exists():
            return 'No items'
        
        items = list(quotation.items.all()[:3])
        item_names = [item.item for item in items if item.item and item.item.strip()]
        
        if not item_names:
            return 'No item names available'
        
        # Remove duplicates while preserving order
        unique_names = []
        for name in item_names:
            if name not in unique_names:
                unique_names.append(name)
        
        if len(unique_names) <= 2:
            return ' & '.join(unique_names)
        else:
            return ', '.join(unique_names[:2]) + ' & ' + unique_names[2]
    
    # Prepare context for letterhead template
    context = {
        'quotation': quotation,
        'project_description': format_project_description(),
    }
    
    # Render HTML template (using letterhead template as specified)
    html_string = render_to_string('quotations/quotation_letterhead.html', context)
    
    # Generate PDF
    pdf_buffer = BytesIO()
    
    # Create HTML object and write PDF
    html = HTML(string=html_string)
    html.write_pdf(pdf_buffer)
    pdf_buffer.seek(0)
    
    return pdf_buffer


@shared_task(bind=True, max_retries=3)
def send_quotation_whatsapp_task(self, whatsapp_data):
    """
    Celery task to send quotation via WhatsApp using Meta WhatsApp Business API
    """
    try:
        # Extract WhatsApp data
        quotation_id = whatsapp_data['quotation_id']
        phone_number = whatsapp_data['phone_number']
        message = whatsapp_data['message']
        sender_name = whatsapp_data.get('sender_name', 'PrintCloud Team')
        user_id = whatsapp_data.get('user_id')
        
        # Get the quotation with related data
        try:
            quotation = SalesQuotation.objects.select_related(
                'customer', 'created_by'
            ).prefetch_related('items').get(pk=quotation_id)
        except SalesQuotation.DoesNotExist:
            logger.error(f'Quotation with ID {quotation_id} does not exist')
            return {
                'success': False,
                'error': f'Quotation with ID {quotation_id} not found',
                'quotation_id': quotation_id
            }
        
        # Initialize share_url - will be generated for template parameters
        share_url = None
        
        # Get WhatsApp configuration from settings
        whatsapp_config = getattr(settings, 'WHATSAPP_CONFIG', {})
        access_token = whatsapp_config.get('ACCESS_TOKEN')
        phone_number_id = whatsapp_config.get('PHONE_NUMBER_ID')
        api_version = whatsapp_config.get('API_VERSION', 'v22.0')
        
        # Enhanced logging for token validation
        logger.info(f"🔥 WhatsApp Config - API Version: {api_version}")
        logger.info(f"🔥 WhatsApp Config - Phone Number ID: {phone_number_id}")
        logger.info(f"🔥 WhatsApp Config - Access Token (first 20 chars): {access_token[:20] if access_token else 'None'}...")
        
        if not access_token or not phone_number_id:
            logger.error("WhatsApp configuration missing ACCESS_TOKEN or PHONE_NUMBER_ID")
            return {
                'success': False,
                'error': 'WhatsApp configuration incomplete',
                'quotation_id': quotation_id
            }
        
        # Prepare WhatsApp API request
        api_url = f"https://graph.facebook.com/{api_version}/{phone_number_id}/messages"
        
        # Remove country code + from phone number for API (keep the + in the phone_number field)
        whatsapp_phone = phone_number.replace('+', '').replace(' ', '').replace('-', '')
        
        # Extract data for template parameters
        customer_name = quotation.customer.name if quotation.customer else 'Customer'
        sender_name = sender_name or 'PrintCloud Team'
        
        # Ensure we have a share URL - generate one if not present
        if not share_url:
            try:
                # Generate share link if not already created
                expires_at = timezone.now() + timedelta(days=7)
                
                # Generate unique token
                token = QuotationShare.generate_token()
                while QuotationShare.objects.filter(token=token).exists():
                    token = QuotationShare.generate_token()
                
                # Create share record
                share = QuotationShare.objects.create(
                    quotation=quotation,
                    token=token,
                    expires_at=expires_at,
                    created_by_id=user_id or 1  # Default system user if not provided
                )
                
                # Generate the share URL using environment-specific frontend URL
                frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
                share_url = f"{frontend_url}/shared/quotation/{token}"
                logger.info(f"Generated share link for WhatsApp template: {share_url}")
            except Exception as e:
                logger.error(f"Failed to generate share link for WhatsApp template: {str(e)}")
                share_url = 'https://printcloud.io/quotations'  # Fallback URL
        
        # Prepare template message payload (using approved quoation_request template)
        payload = {
            "messaging_product": "whatsapp",
            "to": whatsapp_phone,
            "type": "template",
            "template": {
                "name": "quoation_request",
                "language": {
                    "code": "en"
                },
                "components": [
                    {
                        "type": "body",
                        "parameters": [
                            {
                                "type": "text",
                                "text": customer_name  # {{1}}
                            },
                            {
                                "type": "text", 
                                "text": share_url  # {{2}}
                            },
                            {
                                "type": "text",
                                "text": sender_name  # {{3}}
                            }
                        ]
                    }
                ]
            }
        }
        
        logger.info(f"🔥 WhatsApp API URL: {api_url}")
        logger.info(f"🔥 WhatsApp Phone (cleaned): {whatsapp_phone}")
        logger.info(f"🔥 Template Parameters - Customer: {customer_name}, Share URL: {share_url}, Sender: {sender_name}")
        
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        logger.info(f"Sending WhatsApp template message to {phone_number} for quotation {quotation.quot_number}")
        logger.info(f"Using template 'quoation_request' with parameters: customer={customer_name}, sender={sender_name}")
        logger.info(f"API URL: {api_url}")
        
        # Send WhatsApp message
        response = requests.post(
            api_url,
            headers=headers,
            json=payload,
            timeout=30
        )
        
        # Log response details
        logger.info(f"WhatsApp API response status: {response.status_code}")
        logger.info(f"WhatsApp API response: {response.text}")
        
        # Check response
        if response.status_code == 200:
            response_data = response.json()
            message_id = response_data.get('messages', [{}])[0].get('id', 'unknown')

            logger.info(f'WhatsApp message sent successfully for quotation {quotation.quot_number} to {phone_number}')
            logger.info(f'WhatsApp message ID: {message_id}')

            # Log the WhatsApp communication
            try:
                user = User.objects.get(pk=user_id) if user_id else quotation.created_by
            except User.DoesNotExist:
                user = quotation.created_by

            CommunicationLogger.log_whatsapp(
                doc_type='quotation',
                doc_id=quotation.id,
                destination=phone_number,
                success=True,
                user=user,
                message=f'WhatsApp message ID: {message_id}'
            )

            return {
                'success': True,
                'message': f'WhatsApp message sent to {phone_number}',
                'quotation_number': quotation.quot_number,
                'whatsapp_message_id': message_id,
                'share_url': share_url
            }
        else:
            # Handle WhatsApp API errors
            error_response = response.json() if response.headers.get('content-type', '').startswith('application/json') else {'error': response.text}
            logger.error(f"🔥 WhatsApp API error {response.status_code}: {error_response}")
            
            # Extract specific error message if available
            if 'error' in error_response:
                error_details = error_response['error']
                if isinstance(error_details, dict):
                    error_message = error_details.get('message', 'Unknown WhatsApp API error')
                    error_code = error_details.get('code', 'unknown')
                    error_subcode = error_details.get('error_subcode', 'none')
                    
                    # Special handling for token expiration (OAuth errors)
                    if response.status_code == 401 and (error_code == 190 or 'token' in error_message.lower() or 'expired' in error_message.lower()):
                        logger.error(f"🔥 WhatsApp access token expired or invalid!")
                        logger.error(f"🔥 Error code: {error_code}, subcode: {error_subcode}")
                        logger.error(f"🔥 Full error message: {error_message}")
                        error_message = f"WhatsApp access token expired or invalid. Please update the token in settings. Original error: {error_message}"
                    
                    # Special handling for template-related errors
                    elif error_code == 132000:
                        logger.error(f"🔥 WhatsApp template not found or not approved!")
                        logger.error(f"🔥 Template 'quoation_request' may not be approved yet")
                        error_message = f"WhatsApp template 'quoation_request' not found or not approved. Please check template status in Meta Business Manager. Original error: {error_message}"
                    elif error_code == 132001:
                        logger.error(f"🔥 WhatsApp template parameter error!")
                        logger.error(f"🔥 Invalid template parameters for 'quoation_request'")
                        error_message = f"Invalid template parameters for 'quoation_request'. Please check parameter count and format. Original error: {error_message}"
                    elif error_code in [132005, 132007]:
                        logger.error(f"🔥 WhatsApp template format or language error!")
                        error_message = f"Template format or language error for 'quoation_request'. Original error: {error_message}"
                else:
                    error_message = str(error_details)
                    error_code = 'unknown'
            else:
                error_message = f"HTTP {response.status_code}: {response.text}"
                error_code = str(response.status_code)
            
            # Log the failed WhatsApp communication
            try:
                user = User.objects.get(pk=user_id) if user_id else None
                if not user:
                    try:
                        quotation = SalesQuotation.objects.get(pk=quotation_id)
                        user = quotation.created_by
                    except SalesQuotation.DoesNotExist:
                        user = None

                if user:
                    CommunicationLogger.log_whatsapp(
                        doc_type='quotation',
                        doc_id=quotation_id,
                        destination=phone_number,
                        success=False,
                        user=user,
                        error=error_message
                    )
            except Exception as log_error:
                logger.error(f'Error logging failed WhatsApp communication: {str(log_error)}')

            return {
                'success': False,
                'error': f'WhatsApp API error ({error_code}): {error_message}',
                'quotation_id': quotation_id,
                'phone_number': phone_number
            }
        
    except requests.exceptions.Timeout:
        logger.error('WhatsApp API request timeout')

        # Retry logic for timeout
        if self.request.retries < self.max_retries:
            logger.info(f'Retrying WhatsApp send task due to timeout. Retry {self.request.retries + 1}/{self.max_retries}')
            raise self.retry(countdown=60 * (self.request.retries + 1), exc=requests.exceptions.Timeout())
        else:
            # Log the failed communication
            try:
                user = User.objects.get(pk=user_id) if user_id else None
                if user:
                    CommunicationLogger.log_whatsapp(
                        doc_type='quotation',
                        doc_id=quotation_id,
                        destination=phone_number,
                        success=False,
                        user=user,
                        error='WhatsApp API request timeout after maximum retries'
                    )
            except Exception as log_error:
                logger.error(f'Error logging failed WhatsApp communication: {str(log_error)}')

            return {
                'success': False,
                'error': 'WhatsApp API request timeout after maximum retries',
                'quotation_id': quotation_id
            }
            
    except requests.exceptions.RequestException as req_exc:
        logger.error(f'WhatsApp API request error: {str(req_exc)}')

        # Retry logic for request errors
        if self.request.retries < self.max_retries:
            logger.info(f'Retrying WhatsApp send task due to request error. Retry {self.request.retries + 1}/{self.max_retries}')
            raise self.retry(countdown=60 * (self.request.retries + 1), exc=req_exc)
        else:
            # Log the failed communication
            try:
                user = User.objects.get(pk=user_id) if user_id else None
                if user:
                    CommunicationLogger.log_whatsapp(
                        doc_type='quotation',
                        doc_id=quotation_id,
                        destination=phone_number,
                        success=False,
                        user=user,
                        error=f'WhatsApp API request failed: {str(req_exc)}'
                    )
            except Exception as log_error:
                logger.error(f'Error logging failed WhatsApp communication: {str(log_error)}')

            return {
                'success': False,
                'error': f'WhatsApp API request failed: {str(req_exc)}',
                'quotation_id': quotation_id
            }
            
    except Exception as exc:
        logger.error(f'Error sending WhatsApp message: {str(exc)}')

        # Retry logic for general errors
        if self.request.retries < self.max_retries:
            logger.info(f'Retrying WhatsApp send task. Retry {self.request.retries + 1}/{self.max_retries}')
            raise self.retry(countdown=60 * (self.request.retries + 1), exc=exc)
        else:
            logger.error(f'Max retries exceeded for WhatsApp send task')

            # Log the failed communication
            try:
                user_id = whatsapp_data.get('user_id')
                quotation_id = whatsapp_data.get('quotation_id')
                phone_number = whatsapp_data.get('phone_number')

                user = User.objects.get(pk=user_id) if user_id else None
                if not user:
                    try:
                        quotation = SalesQuotation.objects.get(pk=quotation_id)
                        user = quotation.created_by
                    except SalesQuotation.DoesNotExist:
                        user = None

                if user:
                    CommunicationLogger.log_whatsapp(
                        doc_type='quotation',
                        doc_id=quotation_id,
                        destination=phone_number,
                        success=False,
                        user=user,
                        error=str(exc)
                    )
            except Exception as log_error:
                logger.error(f'Error logging failed WhatsApp communication: {str(log_error)}')

            return {
                'success': False,
                'error': str(exc),
                'quotation_id': quotation_id
            }