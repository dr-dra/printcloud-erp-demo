from celery import shared_task
from django.core.mail import EmailMessage
from django.template.loader import render_to_string
from django.conf import settings
from weasyprint import HTML
from io import BytesIO
import logging
import requests
import json

from .models import SalesInvoice, SalesInvoiceTimeline, InvoiceShare
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from apps.core.services import CommunicationLogger

User = get_user_model()

logger = logging.getLogger(__name__)


def generate_invoice_pdf(invoice):
    """Generate PDF for invoice"""
    try:
        from django.template.loader import render_to_string

        context = {
            'invoice': invoice,
            'items': invoice.items.all(),
            'now': timezone.now(),
        }

        html_string = render_to_string('invoices/invoice_pdf.html', context)
        pdf_buffer = BytesIO()
        html = HTML(string=html_string, base_url='/')
        html.write_pdf(pdf_buffer)
        pdf_buffer.seek(0)
        return pdf_buffer
    except Exception as e:
        logger.error(f"Failed to generate invoice PDF: {str(e)}")
        raise


@shared_task(bind=True, max_retries=3)
def send_invoice_email_task(self, email_data):
    """
    Celery task to send invoice email with PDF attachment
    """
    try:
        # Extract email data
        invoice_id = email_data['invoice_id']
        from_email = email_data['from_email']
        to_emails = email_data['to_emails']
        cc_emails = email_data.get('cc_emails', [])
        bcc_emails = email_data.get('bcc_emails', [])
        subject = email_data['subject']
        message = email_data['message']
        send_copy_to_sender = email_data.get('send_copy_to_sender', False)
        sender_name = email_data.get('sender_name', '')
        user_id = email_data.get('user_id')

        # Get the invoice with related data
        try:
            invoice = SalesInvoice.objects.select_related(
                'customer', 'created_by'
            ).prefetch_related('items').get(pk=invoice_id)
        except SalesInvoice.DoesNotExist:
            logger.error(f'Invoice with ID {invoice_id} does not exist')
            return {
                'success': False,
                'error': f'Invoice with ID {invoice_id} not found',
                'invoice_id': invoice_id
            }

        # Generate PDF
        pdf_buffer = generate_invoice_pdf(invoice)

        # Prepare recipients
        recipients = to_emails.copy()

        # Add sender to recipients if requested
        if send_copy_to_sender and from_email not in recipients:
            recipients.append(from_email)

        # Create email message
        email_subject = subject
        email_body = render_to_string('invoices/invoice_email.html', {
            'invoice': invoice,
            'message': message,
            'sender_name': sender_name,
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
        pdf_filename = f'Invoice-{invoice.invoice_number}.pdf'
        email.attach(pdf_filename, pdf_buffer.getvalue(), 'application/pdf')

        # Send email
        email.send()

        logger.info(f'Invoice email sent successfully for invoice {invoice.invoice_number} to {len(recipients)} recipients')

        # Update invoice status to 'sent' and create timeline entry
        try:
            old_status = invoice.status
            if invoice.status == 'draft':
                invoice.status = 'sent'
                invoice.save(update_fields=['status', 'updated_date'])

            # Create timeline entry
            SalesInvoiceTimeline.objects.create(
                invoice=invoice,
                event_type='sent',
                message=f"Invoice sent to {', '.join(to_emails)}",
                old_status=old_status,
                new_status=invoice.status,
                created_by_id=user_id or invoice.created_by_id
            )
        except Exception as timeline_err:
            logger.warning(f"Failed to update timeline: {str(timeline_err)}")

        # Log the communication
        try:
            # Get the user who sent the email
            user = User.objects.get(id=user_id) if user_id else User.objects.get(email=from_email)
        except User.DoesNotExist:
            # Try to get the user who created the invoice
            user = invoice.created_by

        # Log email to each recipient
        for recipient in recipients:
            CommunicationLogger.log_email(
                doc_type='invoice',
                doc_id=invoice.id,
                destination=recipient,
                success=True,
                user=user,
                message=f'Subject: {subject}'
            )

        return {
            'success': True,
            'message': f'Email sent to {len(recipients)} recipients',
            'invoice_number': invoice.invoice_number
        }

    except Exception as exc:
        logger.error(f'Error sending invoice email: {str(exc)}')

        # Retry logic
        if self.request.retries < self.max_retries:
            logger.info(f'Retrying email send task. Retry {self.request.retries + 1}/{self.max_retries}')
            raise self.retry(countdown=60 * (self.request.retries + 1), exc=exc)
        else:
            logger.error(f'Max retries exceeded for invoice email task')

            # Log the failed communication after max retries
            try:
                invoice_id = email_data.get('invoice_id')
                to_emails = email_data.get('to_emails', [])
                from_email = email_data.get('from_email')
                subject = email_data.get('subject')
                user_id = email_data.get('user_id')

                # Get the user
                try:
                    user = User.objects.get(id=user_id) if user_id else User.objects.get(email=from_email)
                except User.DoesNotExist:
                    try:
                        invoice = SalesInvoice.objects.get(pk=invoice_id)
                        user = invoice.created_by
                    except SalesInvoice.DoesNotExist:
                        user = None

                # Log failed email to each recipient
                for recipient in to_emails:
                    if user:
                        CommunicationLogger.log_email(
                            doc_type='invoice',
                            doc_id=invoice_id,
                            destination=recipient,
                            success=False,
                            user=user,
                            message=f'Subject: {subject} - FAILED after retries: {str(exc)}'
                        )
            except Exception as logging_err:
                logger.error(f"Failed to log failed communication: {str(logging_err)}")

            return {
                'success': False,
                'error': str(exc),
                'invoice_id': invoice_id
            }


@shared_task(bind=True, max_retries=3)
def send_invoice_whatsapp_task(self, whatsapp_data):
    """
    Celery task to send invoice via WhatsApp
    """
    try:
        # Extract WhatsApp data
        invoice_id = whatsapp_data['invoice_id']
        phone_number = whatsapp_data['phone_number']
        message = whatsapp_data['message']
        sender_name = whatsapp_data.get('sender_name', 'PrintCloud Team')
        user_id = whatsapp_data.get('user_id')

        # Get the invoice
        try:
            invoice = SalesInvoice.objects.select_related(
                'customer', 'created_by'
            ).get(pk=invoice_id)
        except SalesInvoice.DoesNotExist:
            logger.error(f'Invoice with ID {invoice_id} does not exist')
            return {
                'success': False,
                'error': f'Invoice with ID {invoice_id} not found',
                'invoice_id': invoice_id
            }

        # Get WhatsApp configuration
        whatsapp_config = getattr(settings, 'WHATSAPP_CONFIG', {})
        access_token = whatsapp_config.get('ACCESS_TOKEN')
        phone_number_id = whatsapp_config.get('PHONE_NUMBER_ID')
        api_version = whatsapp_config.get('API_VERSION', 'v22.0')

        # Validate WhatsApp is configured
        if not access_token or not phone_number_id:
            logger.error('WhatsApp not configured - missing ACCESS_TOKEN or PHONE_NUMBER_ID')
            return {
                'success': False,
                'error': 'WhatsApp not configured',
                'invoice_id': invoice_id
            }

        # Clean phone number
        whatsapp_phone = phone_number.replace('+', '').replace(' ', '').replace('-', '')
        logger.info(f'WhatsApp Phone (cleaned): {whatsapp_phone}')

        # Generate share link
        expires_at = timezone.now() + timedelta(days=7)
        token = InvoiceShare.generate_token()
        while InvoiceShare.objects.filter(token=token).exists():
            token = InvoiceShare.generate_token()

        InvoiceShare.objects.create(
            invoice=invoice,
            token=token,
            expires_at=expires_at,
            created_by_id=user_id or invoice.created_by_id,
        )

        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        share_url = f"{frontend_url}/shared/invoice/{token}"

        # WhatsApp API endpoint (Cloud API)
        url = f'https://graph.facebook.com/{api_version}/{phone_number_id}/messages'

        # Prepare request headers
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json',
        }

        # Prepare request payload
        payload = {
            "messaging_product": "whatsapp",
            "to": whatsapp_phone,
            "type": "template",
            "template": {
                "name": "invoice_request",
                "language": {"code": "en"},
                "components": [
                    {
                        "type": "body",
                        "parameters": [
                            {"type": "text", "text": invoice.customer.name if invoice.customer else "Customer"},
                            {"type": "text", "text": invoice.invoice_number},
                            {"type": "text", "text": share_url},
                            {"type": "text", "text": sender_name},
                        ],
                    }
                ],
            },
        }

        # Send WhatsApp message
        logger.info(f'Sending WhatsApp to {whatsapp_phone}')
        response = requests.post(url, json=payload, headers=headers, timeout=30)

        if response.status_code == 200:
            response_data = response.json()
            message_id = response_data.get('messages', [{}])[0].get('id')

            logger.info(f'WhatsApp sent successfully to {whatsapp_phone}, message_id: {message_id}')

            # Update invoice status to 'sent' and create timeline entry
            try:
                old_status = invoice.status
                if invoice.status == 'draft':
                    invoice.status = 'sent'
                    invoice.save(update_fields=['status', 'updated_date'])

                # Create timeline entry
                SalesInvoiceTimeline.objects.create(
                    invoice=invoice,
                    event_type='sent',
                    message=f"Invoice sent via WhatsApp to {phone_number}",
                    old_status=old_status,
                    new_status=invoice.status,
                    created_by_id=user_id or invoice.created_by_id
                )
            except Exception as timeline_err:
                logger.warning(f"Failed to update timeline: {str(timeline_err)}")

            # Log the communication
            try:
                user = User.objects.get(id=user_id) if user_id else invoice.created_by
                CommunicationLogger.log_whatsapp(
                    doc_type='invoice',
                    doc_id=invoice.id,
                    destination=phone_number,
                    success=True,
                    user=user,
                    message=f"Invoice template sent for {invoice.invoice_number}",
                    message_id=message_id
                )
            except Exception as logging_err:
                logger.warning(f"Failed to log WhatsApp communication: {str(logging_err)}")

            return {
                'success': True,
                'message': f'WhatsApp sent to {phone_number}',
                'message_id': message_id,
                'invoice_number': invoice.invoice_number
            }
        else:
            error_msg = response.text
            logger.error(f'Failed to send WhatsApp: {error_msg}')
            raise Exception(f'WhatsApp API error: {error_msg}')

    except Exception as exc:
        logger.error(f'Error sending invoice WhatsApp: {str(exc)}')

        # Retry logic
        if self.request.retries < self.max_retries:
            logger.info(f'Retrying WhatsApp send task. Retry {self.request.retries + 1}/{self.max_retries}')
            raise self.retry(countdown=60 * (self.request.retries + 1), exc=exc)
        else:
            logger.error(f'Max retries exceeded for invoice WhatsApp task')

            # Log the failed communication
            try:
                invoice_id = whatsapp_data.get('invoice_id')
                phone_number = whatsapp_data.get('phone_number')
                user_id = whatsapp_data.get('user_id')

                # Get the user
                try:
                    user = User.objects.get(id=user_id) if user_id else SalesInvoice.objects.get(pk=invoice_id).created_by
                except:
                    user = None

                if user:
                    CommunicationLogger.log_whatsapp(
                        doc_type='invoice',
                        doc_id=invoice_id,
                        destination=phone_number,
                        success=False,
                        user=user,
                        message=f'FAILED after retries: {str(exc)}'
                    )
            except Exception as logging_err:
                logger.error(f"Failed to log failed WhatsApp communication: {str(logging_err)}")

            return {
                'success': False,
                'error': str(exc),
                'invoice_id': invoice_id
            }


# ===================== RECEIPT TASKS =====================

@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_receipt_email_task(self, payment_id, to_emails, cc_emails, bcc_emails,
                           subject, message, message_html, send_copy_to_sender, sender_id):
    """
    Background task to send receipt via email with PDF attachment.
    """
    try:
        from .models import InvoicePayment
        from .utils import generate_receipt_pdf

        payment = InvoicePayment.objects.select_related('invoice__customer', 'created_by').get(id=payment_id)
        sender = User.objects.get(id=sender_id)

        # Ensure receipt number exists
        if not payment.receipt_number:
            payment.generate_receipt_number()

        # Generate PDF
        pdf_buffer = generate_receipt_pdf(payment_id, include_company_details=True)

        # Prepare recipients
        recipients = to_emails + cc_emails + bcc_emails
        if send_copy_to_sender and sender.email and sender.email not in recipients:
            bcc_emails.append(sender.email)

        # Prepare email
        email = EmailMessage(
            subject=subject,
            body=message_html or message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=to_emails,
            cc=cc_emails,
            bcc=bcc_emails,
        )

        # Set content type to HTML if HTML provided
        if message_html:
            email.content_subtype = 'html'

        # Attach PDF
        email.attach(
            f'Receipt-{payment.receipt_number}.pdf',
            pdf_buffer.read(),
            'application/pdf'
        )

        # Send email
        email.send()

        logger.info(f"Receipt email sent for payment {payment_id} to {to_emails}")

        # Log the communication
        for recipient in to_emails:
            try:
                CommunicationLogger.log_email(
                    doc_type='receipt',
                    doc_id=payment_id,
                    destination=recipient,
                    success=True,
                    user=sender,
                    message=f'Subject: {subject}'
                )
            except Exception as logging_err:
                logger.warning(f"Failed to log email communication: {str(logging_err)}")

        return {'success': True, 'payment_id': payment_id}

    except Exception as exc:
        logger.error(f"Error sending receipt email: {exc}", exc_info=True)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_receipt_whatsapp_task(self, payment_id, phone_number, custom_message, sender_id):
    """
    Background task to send receipt link via WhatsApp.
    """
    try:
        from .models import InvoicePayment
        from django.core.signing import Signer

        payment = InvoicePayment.objects.select_related('invoice__customer').get(id=payment_id)
        sender = User.objects.get(id=sender_id)

        # Ensure receipt number exists
        if not payment.receipt_number:
            payment.generate_receipt_number()

        # Generate secure share link
        signer = Signer()
        token = signer.sign(f"receipt_{payment.id}")
        share_url = f"{settings.FRONTEND_URL}/receipts/view/{token}"

        # Prepare WhatsApp message
        customer_name = payment.invoice.customer.name if payment.invoice.customer else 'Customer'

        if custom_message:
            message = custom_message
        else:
            message = f"""Payment Receipt - {payment.receipt_number}

Dear {customer_name},

Thank you for your payment of Rs. {payment.amount:,.2f} for Invoice #{payment.invoice.invoice_number}.

View your receipt online:
{share_url}

Cashier: {sender.get_full_name()}

Thank you for your business!
Kandy Offset Printers (Pvt) Ltd"""

        whatsapp_config = getattr(settings, 'WHATSAPP_CONFIG', {})
        access_token = whatsapp_config.get('ACCESS_TOKEN')
        phone_number_id = whatsapp_config.get('PHONE_NUMBER_ID')
        api_version = whatsapp_config.get('API_VERSION', 'v22.0')

        if not access_token or not phone_number_id:
            logger.error('WhatsApp not configured - missing ACCESS_TOKEN or PHONE_NUMBER_ID')
            raise Exception('WhatsApp not configured')

        whatsapp_phone = phone_number.replace('+', '').replace(' ', '').replace('-', '')
        whatsapp_api_url = f"https://graph.facebook.com/{api_version}/{phone_number_id}/messages"

        response = requests.post(
            whatsapp_api_url,
            headers={'Authorization': f'Bearer {access_token}'},
            json={
                "messaging_product": "whatsapp",
                "to": whatsapp_phone,
                "type": "template",
                "template": {
                    "name": "receipt_send",
                    "language": {"code": "en"},
                    "components": [
                        {
                            "type": "body",
                            "parameters": [
                                {"type": "text", "text": payment.receipt_number},
                                {"type": "text", "text": customer_name},
                                {"type": "text", "text": f"{payment.amount:,.2f}"},
                                {"type": "text", "text": "Invoice"},
                                {"type": "text", "text": payment.invoice.invoice_number},
                                {"type": "text", "text": share_url},
                                {"type": "text", "text": sender.get_full_name()},
                            ],
                        }
                    ],
                },
            },
            timeout=30
        )

        if response.status_code == 200:
            logger.info(f"Receipt WhatsApp sent for payment {payment_id} to {phone_number}")

            # Log the communication
            try:
                CommunicationLogger.log_whatsapp(
                    doc_type='receipt',
                    doc_id=payment_id,
                    destination=phone_number,
                    success=True,
                    user=sender,
                    message=message[:200]
                )
            except Exception as logging_err:
                logger.warning(f"Failed to log WhatsApp communication: {str(logging_err)}")

            return {'success': True, 'payment_id': payment_id}
        else:
            error_msg = response.text
            logger.error(f'Failed to send receipt WhatsApp: {error_msg}')
            raise Exception(f'WhatsApp API error: {error_msg}')

    except Exception as exc:
        logger.error(f"Error sending receipt WhatsApp: {exc}", exc_info=True)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def create_receipt_print_job_task(self, payment_id, printer_name, copies, user_id):
    """
    Background task to create print job for receipt.
    Uses A5 printer (default or specified).
    """
    try:
        from .models import InvoicePayment
        from .utils import generate_receipt_pdf
        import base64

        payment = InvoicePayment.objects.select_related('invoice__customer').get(id=payment_id)
        user = User.objects.get(id=user_id)

        # Ensure receipt number exists
        if not payment.receipt_number:
            payment.generate_receipt_number()

        # Get user's default A5 printer if no printer specified
        if not printer_name and hasattr(user, 'default_a5_printer'):
            printer_name = user.default_a5_printer

        # Generate PDF
        pdf_buffer = generate_receipt_pdf(payment_id, include_company_details=False)
        pdf_data = pdf_buffer.read()

        # Encode PDF as base64
        pdf_base64 = base64.b64encode(pdf_data).decode('utf-8')

        # Create print job (following existing pattern from quotations)
        try:
            from printcloudclient.models import PrintJob

            print_job = PrintJob.objects.create(
                user=user,
                target_printer_name=printer_name or '',
                fallback_printer_names=[],
                document_type='receipt',
                print_data=pdf_base64,
                copies=copies,
                status='pending'
            )

            logger.info(f"Print job created for receipt {payment.receipt_number}: {print_job.id}")
            return {'success': True, 'print_job_id': print_job.id}

        except Exception as print_err:
            logger.error(f"Error creating print job: {print_err}")
            # If PrintJob model doesn't exist, just log and return success
            logger.warning("PrintCloudClient models not available, printing feature disabled")
            return {'success': False, 'error': 'Print service not available'}

    except Exception as exc:
        logger.error(f"Error creating receipt print job: {exc}")
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def create_credit_note_print_job_task(self, credit_note_id, printer_name, copies, user_id):
    """
    Background task to create print job for credit note.
    Uses A5 printer (default or specified).
    """
    try:
        from .utils import generate_credit_note_pdf
        import base64

        user = User.objects.get(id=user_id)

        # Get user's default A5 printer if no printer specified
        if not printer_name and hasattr(user, 'default_a5_printer'):
            printer_name = user.default_a5_printer

        # Generate PDF
        pdf_buffer = generate_credit_note_pdf(credit_note_id, include_company_details=False)
        pdf_data = pdf_buffer.read()

        # Encode PDF as base64
        pdf_base64 = base64.b64encode(pdf_data).decode('utf-8')

        try:
            from printcloudclient.models import PrintJob

            print_job = PrintJob.objects.create(
                user=user,
                target_printer_name=printer_name or '',
                fallback_printer_names=[],
                document_type='credit_note',
                print_data=pdf_base64,
                copies=copies,
                status='pending'
            )

            logger.info(f"Print job created for credit note {credit_note_id}: {print_job.id}")
            return {'success': True, 'print_job_id': print_job.id}

        except Exception as print_err:
            logger.error(f"Error creating print job: {print_err}")
            logger.warning("PrintCloudClient models not available, printing feature disabled")
            return {'success': False, 'error': 'Print service not available'}

    except Exception as exc:
        logger.error(f"Error creating credit note print job: {exc}")
        raise self.retry(exc=exc)
