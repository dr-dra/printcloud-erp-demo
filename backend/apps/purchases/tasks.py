"""
Celery tasks for purchase-related async processing
"""

import base64
import logging
from io import BytesIO
from datetime import timedelta

import requests
from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMessage
from django.template.loader import render_to_string
from django.utils import timezone
from weasyprint import HTML

from apps.core.services import CommunicationLogger
from django.contrib.auth import get_user_model

from .models import BillScan, PurchaseOrder, PurchaseOrderTimeline, PurchaseOrderShare
from .services.ai_extraction import AIExtractionService

User = get_user_model()

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def process_bill_scan_task(self, bill_scan_id: int):
    """
    Celery task to process uploaded bill scan with AI extraction

    Steps:
    1. Fetch bill scan from database
    2. Download file from S3
    3. Run AI extraction (Nova 2 Lite multimodal)
    4. Match supplier
    5. Save results

    Args:
        bill_scan_id: ID of the BillScan to process

    Returns:
        dict: Success status and details
    """
    try:
        # Get bill scan
        bill_scan = BillScan.objects.get(pk=bill_scan_id)

        # Update status
        bill_scan.processing_status = 'processing'
        bill_scan.processing_started_at = timezone.now()
        bill_scan.save()

        logger.info(f"Starting AI processing for BillScan #{bill_scan_id}")

        # Download file from S3
        file_bytes = bill_scan.file.read()

        # Initialize AI service
        ai_service = AIExtractionService()

        # Process the scan
        result = ai_service.process_bill_scan(
            file_bytes=file_bytes,
            file_type=bill_scan.file_type,
            file_name=bill_scan.file_name,
        )

        # Update bill scan with results
        bill_scan.textract_response = None  # Not using Textract anymore
        bill_scan.claude_response = result['nova_response']  # Reuse field for Nova response
        bill_scan.extracted_data = result['extracted_data']

        # Extract and save summary
        summary_data = result['extracted_data'].get('summary', {})
        if summary_data and summary_data.get('value'):
            # Truncate to 256 chars if needed (shouldn't happen as AI is instructed to limit it)
            bill_scan.summary = summary_data['value'][:256]

        if result['matched_supplier_id']:
            bill_scan.matched_supplier_id = result['matched_supplier_id']
            bill_scan.supplier_match_confidence = result['supplier_match_confidence']

        bill_scan.processing_status = 'completed'
        bill_scan.processing_completed_at = timezone.now()
        bill_scan.save()

        logger.info(f"Successfully processed BillScan #{bill_scan_id}")

        return {
            'success': True,
            'bill_scan_id': bill_scan_id,
            'extracted_fields': len(result['extracted_data'])
        }

    except BillScan.DoesNotExist:
        logger.error(f"BillScan #{bill_scan_id} not found")
        return {'success': False, 'error': 'Bill scan not found'}

    except Exception as exc:
        logger.error(f"Error processing BillScan #{bill_scan_id}: {str(exc)}")

        # Update bill scan with error
        try:
            bill_scan = BillScan.objects.get(pk=bill_scan_id)
            bill_scan.processing_status = 'failed'
            bill_scan.processing_error = str(exc)
            bill_scan.processing_completed_at = timezone.now()
            bill_scan.save()
        except:
            pass

        # Retry logic
        if self.request.retries < self.max_retries:
            logger.info(
                f'Retrying bill scan processing. '
                f'Retry {self.request.retries + 1}/{self.max_retries}'
            )
            raise self.retry(countdown=60 * (self.request.retries + 1), exc=exc)

        return {
            'success': False,
            'error': str(exc),
            'bill_scan_id': bill_scan_id
        }


def generate_purchase_order_pdf(purchase_order):
    context = {
        'purchase_order': purchase_order,
        'items': purchase_order.items.all(),
        'now': timezone.now(),
    }

    html_string = render_to_string('purchases/purchase_order_pdf.html', context)
    pdf_buffer = BytesIO()
    html = HTML(string=html_string)
    html.write_pdf(pdf_buffer)
    pdf_buffer.seek(0)
    return pdf_buffer


@shared_task(bind=True, max_retries=3)
def send_purchase_order_email_task(self, email_data):
    try:
        purchase_order_id = email_data['purchase_order_id']
        to_emails = email_data['to_emails']
        cc_emails = email_data.get('cc_emails', [])
        bcc_emails = email_data.get('bcc_emails', [])
        subject = email_data['subject']
        message = email_data['message']
        sender_name = email_data.get('sender_name', 'PrintCloud Team')
        send_copy_to_sender = email_data.get('send_copy_to_sender', False)
        user_id = email_data.get('user_id')

        try:
            purchase_order = PurchaseOrder.objects.select_related(
                'supplier', 'created_by'
            ).prefetch_related('items').get(pk=purchase_order_id)
        except PurchaseOrder.DoesNotExist:
            logger.error(f'Purchase order with ID {purchase_order_id} does not exist')
            return {
                'success': False,
                'error': f'Purchase order with ID {purchase_order_id} not found',
                'purchase_order_id': purchase_order_id,
            }

        pdf_buffer = generate_purchase_order_pdf(purchase_order)

        try:
            user = User.objects.get(pk=user_id) if user_id else purchase_order.created_by
            from_email = user.email or settings.DEFAULT_FROM_EMAIL
        except User.DoesNotExist:
            from_email = settings.DEFAULT_FROM_EMAIL
            user = purchase_order.created_by

        recipients = to_emails.copy()
        if send_copy_to_sender and from_email and from_email not in recipients:
            recipients.append(from_email)

        email_body = render_to_string('purchases/purchase_order_email.html', {
            'purchase_order': purchase_order,
            'message': message,
            'sender_name': sender_name,
        })

        email = EmailMessage(
            subject=subject,
            body=email_body,
            from_email=from_email,
            to=recipients,
            cc=cc_emails,
            bcc=bcc_emails,
        )
        email.content_subtype = 'html'

        pdf_filename = f'Purchase-Order-{purchase_order.po_number}.pdf'
        email.attach(pdf_filename, pdf_buffer.getvalue(), 'application/pdf')
        email.send()

        try:
            old_status = purchase_order.status
            if purchase_order.status == 'draft':
                purchase_order.status = 'sent'
                purchase_order.save(update_fields=['status', 'updated_at'])

            PurchaseOrderTimeline.objects.create(
                purchase_order=purchase_order,
                event_type='sent',
                message=f"Purchase order sent to {', '.join(to_emails)}",
                old_status=old_status,
                new_status=purchase_order.status,
                created_by_id=user_id or purchase_order.created_by_id,
            )
        except Exception as timeline_err:
            logger.warning(f"Failed to update purchase order timeline: {str(timeline_err)}")

        for recipient in recipients:
            CommunicationLogger.log_email(
                doc_type='purchase_order',
                doc_id=purchase_order.id,
                destination=recipient,
                success=True,
                user=user,
                message=f'Subject: {subject}',
            )

        return {
            'success': True,
            'message': f'Email sent to {len(recipients)} recipients',
            'purchase_order_number': purchase_order.po_number,
        }

    except Exception as exc:
        logger.error(f'Error sending purchase order email: {str(exc)}')

        if self.request.retries < self.max_retries:
            logger.info(
                f'Retrying purchase order email task. '
                f'Retry {self.request.retries + 1}/{self.max_retries}'
            )
            raise self.retry(countdown=60 * (self.request.retries + 1), exc=exc)

        try:
            purchase_order_id = email_data.get('purchase_order_id')
            to_emails = email_data.get('to_emails', [])
            user_id = email_data.get('user_id')
            subject = email_data.get('subject')
            user = User.objects.get(id=user_id) if user_id else None
            if user:
                for recipient in to_emails:
                    CommunicationLogger.log_email(
                        doc_type='purchase_order',
                        doc_id=purchase_order_id,
                        destination=recipient,
                        success=False,
                        user=user,
                        message=f'Subject: {subject}',
                        error=str(exc),
                    )
        except Exception as log_error:
            logger.error(f"Error logging failed purchase order email: {str(log_error)}")

        return {
            'success': False,
            'error': str(exc),
            'purchase_order_id': email_data.get('purchase_order_id'),
        }


@shared_task(bind=True, max_retries=3)
def send_purchase_order_whatsapp_task(self, whatsapp_data):
    try:
        purchase_order_id = whatsapp_data['purchase_order_id']
        phone_number = whatsapp_data['phone_number']
        message = whatsapp_data['message']
        sender_name = whatsapp_data.get('sender_name', 'PrintCloud Team')
        user_id = whatsapp_data.get('user_id')

        try:
            purchase_order = PurchaseOrder.objects.select_related(
                'supplier', 'created_by'
            ).get(pk=purchase_order_id)
        except PurchaseOrder.DoesNotExist:
            logger.error(f'Purchase order with ID {purchase_order_id} does not exist')
            return {
                'success': False,
                'error': f'Purchase order with ID {purchase_order_id} not found',
                'purchase_order_id': purchase_order_id,
            }

        whatsapp_config = getattr(settings, 'WHATSAPP_CONFIG', {})
        access_token = whatsapp_config.get('ACCESS_TOKEN')
        phone_number_id = whatsapp_config.get('PHONE_NUMBER_ID')
        api_version = whatsapp_config.get('API_VERSION', 'v22.0')

        if not access_token or not phone_number_id:
            logger.error('WhatsApp not configured - missing ACCESS_TOKEN or PHONE_NUMBER_ID')
            return {
                'success': False,
                'error': 'WhatsApp not configured',
                'purchase_order_id': purchase_order_id,
            }

        whatsapp_phone = phone_number.replace('+', '').replace(' ', '').replace('-', '')

        expires_at = timezone.now() + timedelta(days=7)
        token = PurchaseOrderShare.generate_token()
        while PurchaseOrderShare.objects.filter(token=token).exists():
            token = PurchaseOrderShare.generate_token()

        PurchaseOrderShare.objects.create(
            purchase_order=purchase_order,
            token=token,
            expires_at=expires_at,
            created_by_id=user_id or purchase_order.created_by_id,
        )

        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        share_url = f"{frontend_url}/shared/purchase-order/{token}"
        url = f'https://graph.facebook.com/{api_version}/{phone_number_id}/messages'
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json',
        }
        payload = {
            "messaging_product": "whatsapp",
            "to": whatsapp_phone,
            "type": "template",
            "template": {
                "name": "purchase_order_send",
                "language": {"code": "en"},
                "components": [
                    {
                        "type": "body",
                        "parameters": [
                            {
                                "type": "text",
                                "text": purchase_order.supplier.name if purchase_order.supplier else "Supplier",
                            },
                            {"type": "text", "text": purchase_order.po_number},
                            {"type": "text", "text": share_url},
                            {"type": "text", "text": sender_name},
                        ],
                    }
                ],
            },
        }

        logger.info(f'Sending Purchase Order WhatsApp to {whatsapp_phone}')
        response = requests.post(url, json=payload, headers=headers, timeout=30)

        if response.status_code == 200:
            response_data = response.json()
            message_id = response_data.get('messages', [{}])[0].get('id')

            try:
                old_status = purchase_order.status
                if purchase_order.status == 'draft':
                    purchase_order.status = 'sent'
                    purchase_order.save(update_fields=['status', 'updated_at'])

                PurchaseOrderTimeline.objects.create(
                    purchase_order=purchase_order,
                    event_type='sent',
                    message=f"Purchase order sent via WhatsApp to {phone_number}",
                    old_status=old_status,
                    new_status=purchase_order.status,
                    created_by_id=user_id or purchase_order.created_by_id,
                )
            except Exception as timeline_err:
                logger.warning(f"Failed to update purchase order timeline: {str(timeline_err)}")

            try:
                user = User.objects.get(id=user_id) if user_id else purchase_order.created_by
                CommunicationLogger.log_whatsapp(
                    doc_type='purchase_order',
                    doc_id=purchase_order.id,
                    destination=phone_number,
                    success=True,
                    user=user,
                    message=f"Purchase order template sent for {purchase_order.po_number}",
                    message_id=message_id,
                )
            except Exception as logging_err:
                logger.warning(f"Failed to log purchase order WhatsApp: {str(logging_err)}")

            return {
                'success': True,
                'message': f'WhatsApp sent to {phone_number}',
                'message_id': message_id,
                'purchase_order_number': purchase_order.po_number,
            }

        error_msg = response.text
        logger.error(f'Failed to send purchase order WhatsApp: {error_msg}')
        raise Exception(f'WhatsApp API error: {error_msg}')

    except Exception as exc:
        logger.error(f'Error sending purchase order WhatsApp: {str(exc)}')

        if self.request.retries < self.max_retries:
            logger.info(
                f'Retrying purchase order WhatsApp task. '
                f'Retry {self.request.retries + 1}/{self.max_retries}'
            )
            raise self.retry(countdown=60 * (self.request.retries + 1), exc=exc)

        try:
            purchase_order_id = whatsapp_data.get('purchase_order_id')
            phone_number = whatsapp_data.get('phone_number')
            user_id = whatsapp_data.get('user_id')
            user = User.objects.get(id=user_id) if user_id else None
            if user:
                CommunicationLogger.log_whatsapp(
                    doc_type='purchase_order',
                    doc_id=purchase_order_id,
                    destination=phone_number,
                    success=False,
                    user=user,
                    message=whatsapp_data.get('message'),
                    error=str(exc),
                )
        except Exception as log_error:
            logger.error(f"Error logging failed purchase order WhatsApp: {str(log_error)}")

        return {
            'success': False,
            'error': str(exc),
            'purchase_order_id': whatsapp_data.get('purchase_order_id'),
        }


@shared_task(bind=True, max_retries=3)
def create_purchase_order_print_job_task(self, purchase_order_id, user_id, printer_name=None, copies=1):
    try:
        try:
            purchase_order = PurchaseOrder.objects.select_related(
                'supplier', 'created_by'
            ).prefetch_related('items').get(pk=purchase_order_id)
        except PurchaseOrder.DoesNotExist:
            logger.error(f'Purchase order with ID {purchase_order_id} does not exist')
            return {
                'success': False,
                'error': f'Purchase order with ID {purchase_order_id} not found',
            }

        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            user = purchase_order.created_by

        pdf_buffer = generate_purchase_order_pdf(purchase_order)

        if not printer_name:
            if hasattr(user, 'default_a4_printer') and user.default_a4_printer:
                printer_name = user.default_a4_printer
            else:
                printer_name = 'Default Printer'

        pdf_base64 = base64.b64encode(pdf_buffer.getvalue()).decode('utf-8')

        from printcloudclient.models import PrintJob
        print_job = PrintJob.objects.create(
            user=user,
            target_printer_name=printer_name or '',
            fallback_printer_names=[],
            document_type='purchase_order',
            print_data=pdf_base64,
            copies=copies,
            status='pending',
        )

        try:
            old_status = purchase_order.status
            if purchase_order.status == 'draft':
                purchase_order.status = 'sent'
                purchase_order.save(update_fields=['status', 'updated_at'])

            PurchaseOrderTimeline.objects.create(
                purchase_order=purchase_order,
                event_type='sent',
                message=f"Purchase order printed ({copies} copy/copies)",
                old_status=old_status,
                new_status=purchase_order.status,
                created_by=user,
            )
        except Exception as timeline_err:
            logger.warning(f"Failed to update purchase order timeline after print: {str(timeline_err)}")

        CommunicationLogger.log_print(
            doc_type='purchase_order',
            doc_id=purchase_order.id,
            destination=printer_name,
            success=True,
            user=user,
            message=f'Print job #{print_job.id} for {copies} copy/copies',
        )

        return {
            'success': True,
            'message': f'Print job created for purchase order {purchase_order.po_number}',
            'print_job_id': print_job.id,
            'purchase_order_number': purchase_order.po_number,
        }

    except Exception as exc:
        logger.error(f'Error creating print job for purchase order {purchase_order_id}: {str(exc)}')

        try:
            user = User.objects.get(pk=user_id)
            CommunicationLogger.log_print(
                doc_type='purchase_order',
                doc_id=purchase_order_id,
                destination=printer_name or 'Default Printer',
                success=False,
                user=user,
                message='Failed to create print job',
                error=str(exc),
            )
        except Exception as log_error:
            logger.error(f"Error logging failed purchase order print: {str(log_error)}")

        if self.request.retries < self.max_retries:
            logger.info(
                f'Retrying purchase order print task. '
                f'Retry {self.request.retries + 1}/{self.max_retries}'
            )
            raise self.retry(countdown=60 * (self.request.retries + 1), exc=exc)

        return {
            'success': False,
            'error': str(exc),
            'purchase_order_id': purchase_order_id,
        }
