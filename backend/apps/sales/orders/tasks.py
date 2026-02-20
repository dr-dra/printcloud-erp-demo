from celery import shared_task
from django.core.mail import EmailMessage
from django.template.loader import render_to_string
from django.conf import settings
from weasyprint import HTML
from io import BytesIO
import logging
import base64
import requests

from .models import SalesOrder, OrderShare, OrderPayment
from .utils import format_project_description
from printcloudclient.models import PrintJob
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from apps.core.services import CommunicationLogger

User = get_user_model()

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def send_order_email_task(self, email_data):
    """
    Celery task to send order confirmation email with PDF attachment
    """
    try:
        # Extract email data
        order_id = email_data['order_id']
        to_emails = email_data['to_emails']
        cc_emails = email_data.get('cc_emails', [])
        subject = email_data['subject']
        message = email_data['message']
        user_id = email_data.get('user_id')

        # Get the order with related data
        try:
            order = SalesOrder.objects.select_related(
                'customer', 'created_by'
            ).prefetch_related('items').get(pk=order_id)
        except SalesOrder.DoesNotExist:
            logger.error(f'Order with ID {order_id} does not exist')
            return {
                'success': False,
                'error': f'Order with ID {order_id} not found',
                'order_id': order_id
            }

        # Generate PDF
        pdf_buffer = generate_order_pdf(order)

        # Get user
        try:
            user = User.objects.get(pk=user_id)
            from_email = user.email
        except User.DoesNotExist:
            from_email = settings.DEFAULT_FROM_EMAIL
            user = order.created_by

        # Generate share link for email
        share_url = None
        try:
            expires_at = timezone.now() + timedelta(days=7)
            token = OrderShare.generate_token()
            while OrderShare.objects.filter(token=token).exists():
                token = OrderShare.generate_token()

            share = OrderShare.objects.create(
                order=order,
                token=token,
                expires_at=expires_at,
                created_by=user
            )

            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
            share_url = f"{frontend_url}/shared/order/{token}"

            logger.info(f"Generated share link for order {order.id}: {share_url}")
        except Exception as e:
            logger.error(f"Failed to generate share link for order {order.id}: {str(e)}")

        # Create email message
        email_body = render_to_string('orders/order_email.html', {
            'order': order,
            'message': message,
            'share_url': share_url,
        })

        # Create email
        email = EmailMessage(
            subject=subject,
            body=email_body,
            from_email=from_email,
            to=to_emails,
            cc=cc_emails,
        )

        # Set email content type to HTML
        email.content_subtype = 'html'

        # Attach PDF
        pdf_filename = f'Order-{order.order_number}.pdf'
        email.attach(pdf_filename, pdf_buffer.getvalue(), 'application/pdf')

        # Send email
        email.send()

        logger.info(f'Order email sent successfully for order {order.order_number} to {len(to_emails)} recipients')

        # Auto-confirm draft orders once the confirmation email is sent
        if order.status == 'draft':
            try:
                order.transition_to_confirmed(user)
                logger.info(f'Order {order.order_number} status updated to confirmed after email send')
            except Exception as status_error:
                logger.warning(
                    f'Failed to auto-confirm order {order.order_number} after email: {status_error}'
                )

        # Log email to each recipient
        for recipient in to_emails:
            CommunicationLogger.log_email(
                doc_type='order',
                doc_id=order.id,
                destination=recipient,
                success=True,
                user=user,
                message=f'Subject: {subject}'
            )

        return {
            'success': True,
            'message': f'Email sent to {len(to_emails)} recipients',
            'order_number': order.order_number
        }

    except Exception as exc:
        logger.error(f'Error sending order email: {str(exc)}')

        # Retry logic
        if self.request.retries < self.max_retries:
            logger.info(f'Retrying email send task. Retry {self.request.retries + 1}/{self.max_retries}')
            raise self.retry(countdown=60 * (self.request.retries + 1), exc=exc)
        else:
            logger.error(f'Max retries exceeded for order email task')

            # Log the failed communication
            try:
                order_id = email_data.get('order_id')
                to_emails = email_data.get('to_emails', [])
                user_id = email_data.get('user_id')
                subject = email_data.get('subject')

                try:
                    user = User.objects.get(pk=user_id)
                except User.DoesNotExist:
                    try:
                        order = SalesOrder.objects.get(pk=order_id)
                        user = order.created_by
                    except SalesOrder.DoesNotExist:
                        user = None

                if user:
                    for recipient in to_emails:
                        CommunicationLogger.log_email(
                            doc_type='order',
                            doc_id=order_id,
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
                'order_id': email_data.get('order_id')
            }


def generate_order_pdf(order):
    """
    Generate PDF for order confirmation
    """
    project_description = order.project_name or format_project_description(order.items.all())

    # Prepare context for template
    context = {
        'order': order,
        'project_description': project_description,
    }

    # Render HTML template
    html_string = render_to_string('orders/order_pdf.html', context)

    # Generate PDF
    pdf_buffer = BytesIO()
    html = HTML(string=html_string)
    html.write_pdf(pdf_buffer)
    pdf_buffer.seek(0)

    return pdf_buffer


@shared_task(bind=True, max_retries=3)
def create_order_print_job_task(self, order_id, user_id, printer_name=None, copies=1):
    """
    Celery task to create a print job for an order
    """
    try:
        # Get the order with related data
        try:
            order = SalesOrder.objects.select_related(
                'customer', 'created_by'
            ).prefetch_related('items').get(pk=order_id)
        except SalesOrder.DoesNotExist:
            logger.error(f'Order with ID {order_id} does not exist')
            return {
                'success': False,
                'error': f'Order with ID {order_id} not found'
            }

        # Get user
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            user = order.created_by

        # Generate PDF
        pdf_buffer = generate_order_pdf(order)

        # Determine printer to use
        if not printer_name:
            # Use user's default printer if available
            if hasattr(user, 'default_a4_printer') and user.default_a4_printer:
                printer_name = user.default_a4_printer
            else:
                printer_name = 'Default Printer'

        # Convert PDF to base64
        pdf_base64 = base64.b64encode(pdf_buffer.getvalue()).decode('utf-8')

        # Create print job
        print_job = PrintJob.objects.create(
            user=user,
            target_printer_name=printer_name or '',
            fallback_printer_names=[],
            document_type='order',
            print_data=pdf_base64,
            copies=copies,
            status='pending'
        )

        logger.info(f'Print job created for order {order.order_number} on printer {printer_name}')

        # Log the print communication
        CommunicationLogger.log_print(
            doc_type='order',
            doc_id=order.id,
            destination=printer_name,
            success=True,
            user=user,
            message=f'Print job #{print_job.id} for {copies} copy/copies'
        )

        return {
            'success': True,
            'message': f'Print job created for order {order.order_number}',
            'print_job_id': print_job.id,
            'order_number': order.order_number
        }

    except Exception as exc:
        logger.error(f'Error creating print job for order {order_id}: {str(exc)}')

        # Log the failed communication
        try:
            user = User.objects.get(pk=user_id)
            CommunicationLogger.log_print(
                doc_type='order',
                doc_id=order_id,
                destination=printer_name or 'Default Printer',
                success=False,
                user=user,
                message=f'Failed to create print job',
                error=str(exc)
            )
        except Exception as log_error:
            logger.error(f'Error logging failed print communication: {str(log_error)}')

        # Retry logic
        if self.request.retries < self.max_retries:
            logger.info(f'Retrying print job task. Retry {self.request.retries + 1}/{self.max_retries}')
            raise self.retry(countdown=60 * (self.request.retries + 1), exc=exc)
        else:
            return {
                'success': False,
                'error': str(exc),
                'order_id': order_id
            }


@shared_task(bind=True, max_retries=3)
def send_order_whatsapp_task(self, whatsapp_data):
    """
    Celery task to send order confirmation via WhatsApp
    """
    try:
        order_id = whatsapp_data['order_id']
        phone_number = whatsapp_data['phone_number']
        message = whatsapp_data.get('message', '')
        user_id = whatsapp_data.get('user_id')

        # Get the order
        try:
            order = SalesOrder.objects.select_related('customer').get(pk=order_id)
        except SalesOrder.DoesNotExist:
            logger.error(f'Order with ID {order_id} does not exist')
            return {
                'success': False,
                'error': f'Order with ID {order_id} not found'
            }

        # Get user
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            user = order.created_by

        # Format phone number (remove non-digits)
        phone = ''.join(filter(str.isdigit, phone_number))

        # Generate share link
        expires_at = timezone.now() + timedelta(days=7)
        token = OrderShare.generate_token()
        while OrderShare.objects.filter(token=token).exists():
            token = OrderShare.generate_token()

        share = OrderShare.objects.create(
            order=order,
            token=token,
            expires_at=expires_at,
            created_by=user
        )

        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        share_url = f"{frontend_url}/shared/order/{token}"

        # Send WhatsApp message via API (template)
        whatsapp_config = settings.WHATSAPP_CONFIG
        url = f"https://graph.facebook.com/{whatsapp_config['API_VERSION']}/{whatsapp_config['PHONE_NUMBER_ID']}/messages"

        headers = {
            'Authorization': f"Bearer {whatsapp_config['ACCESS_TOKEN']}",
            'Content-Type': 'application/json'
        }

        data = {
            'messaging_product': 'whatsapp',
            'to': phone,
            'type': 'template',
            'template': {
                'name': 'order_send',
                'language': {'code': 'en'},
                'components': [
                    {
                        'type': 'body',
                        'parameters': [
                            {'type': 'text', 'text': order.customer.name if order.customer else 'Customer'},
                            {'type': 'text', 'text': order.order_number},
                            {'type': 'text', 'text': share_url},
                            {'type': 'text', 'text': user.get_full_name() or user.username},
                        ],
                    }
                ],
            },
        }

        response = requests.post(url, headers=headers, json=data)
        response.raise_for_status()

        logger.info(f'WhatsApp message sent for order {order.order_number} to {phone}')

        # Log the communication
        CommunicationLogger.log_whatsapp(
            doc_type='order',
            doc_id=order.id,
            destination=phone,
            success=True,
            user=user,
            message=f"Order template sent for {order.order_number}"
        )

        return {
            'success': True,
            'message': f'WhatsApp message sent to {phone}',
            'order_number': order.order_number
        }

    except Exception as exc:
        logger.error(f'Error sending WhatsApp message for order: {str(exc)}')

        # Log failed communication
        try:
            order_id = whatsapp_data.get('order_id')
            phone_number = whatsapp_data.get('phone_number')
            user_id = whatsapp_data.get('user_id')

            user = User.objects.get(pk=user_id)
            CommunicationLogger.log_whatsapp(
                doc_type='order',
                doc_id=order_id,
                destination=phone_number,
                success=False,
                user=user,
                message='WhatsApp send failed',
                error=str(exc)
            )
        except Exception as log_error:
            logger.error(f'Error logging failed WhatsApp communication: {str(log_error)}')

        # Retry logic
        if self.request.retries < self.max_retries:
            logger.info(f'Retrying WhatsApp send task. Retry {self.request.retries + 1}/{self.max_retries}')
            raise self.retry(countdown=60 * (self.request.retries + 1), exc=exc)
        else:
            return {
                'success': False,
                'error': str(exc),
                'order_id': whatsapp_data.get('order_id')
            }


@shared_task
def generate_job_tickets_task(order_id):
    """
    Future task to generate job tickets for all items in an order
    Placeholder for production workflow integration
    """
    try:
        order = SalesOrder.objects.prefetch_related('items').get(pk=order_id)

        # TODO: Implement job ticket generation logic
        # This would integrate with the production workflow system

        logger.info(f'Job tickets generation requested for order {order.order_number}')

        return {
            'success': True,
            'message': 'Job ticket generation not yet implemented',
            'order_id': order_id
        }

    except SalesOrder.DoesNotExist:
        return {
            'success': False,
            'error': f'Order with ID {order_id} not found'
        }
    except Exception as exc:
        logger.error(f'Error in job tickets generation: {str(exc)}')
        return {
            'success': False,
            'error': str(exc)
        }


# ===================== RECEIPT TASKS =====================

@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_receipt_email_task(self, payment_id, to_emails, cc_emails, bcc_emails,
                           subject, message, message_html, send_copy_to_sender, sender_id):
    """
    Background task to send order receipt via email with PDF attachment.
    """
    try:
        from .utils import generate_order_receipt_pdf

        payment = OrderPayment.objects.select_related('order__customer', 'created_by').get(id=payment_id)
        sender = User.objects.get(id=sender_id)

        if not payment.receipt_number:
            payment.generate_receipt_number()

        pdf_buffer = generate_order_receipt_pdf(payment_id, include_company_details=True)

        recipients = to_emails + cc_emails + bcc_emails
        if send_copy_to_sender and sender.email and sender.email not in recipients:
            bcc_emails.append(sender.email)

        email = EmailMessage(
            subject=subject,
            body=message_html or message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=to_emails,
            cc=cc_emails,
            bcc=bcc_emails,
        )

        if message_html:
            email.content_subtype = 'html'

        email.attach(
            f'Receipt-{payment.receipt_number}.pdf',
            pdf_buffer.read(),
            'application/pdf'
        )

        email.send()

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
        logger.error(f"Error sending order receipt email: {exc}", exc_info=True)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_receipt_whatsapp_task(self, payment_id, phone_number, custom_message, sender_id):
    """
    Background task to send order receipt link via WhatsApp.
    """
    try:
        from django.core.signing import Signer

        payment = OrderPayment.objects.select_related('order__customer').get(id=payment_id)
        sender = User.objects.get(id=sender_id)

        if not payment.receipt_number:
            payment.generate_receipt_number()

        signer = Signer()
        token = signer.sign(f"order_receipt_{payment.id}")
        share_url = f"{settings.FRONTEND_URL}/receipts/view/{token}"

        customer_name = payment.order.customer.name if payment.order.customer else 'Customer'

        if custom_message:
            message = custom_message
        else:
            message = f"""Payment Receipt - {payment.receipt_number}

Dear {customer_name},

Thank you for your payment of Rs. {payment.amount:,.2f} for Order #{payment.order.order_number}.

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
                                {"type": "text", "text": "Order"},
                                {"type": "text", "text": payment.order.order_number},
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

        error_msg = response.text
        logger.error(f'Failed to send order receipt WhatsApp: {error_msg}')
        raise Exception(f'WhatsApp API error: {error_msg}')

    except Exception as exc:
        logger.error(f"Error sending order receipt WhatsApp: {exc}", exc_info=True)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def create_receipt_print_job_task(self, payment_id, printer_name, copies, user_id):
    """
    Background task to create print job for order receipt.
    Uses A5 printer (default or specified).
    """
    try:
        from .utils import generate_order_receipt_pdf

        payment = OrderPayment.objects.select_related('order__customer').get(id=payment_id)
        user = User.objects.get(id=user_id)

        if not payment.receipt_number:
            payment.generate_receipt_number()

        if not printer_name and hasattr(user, 'default_a5_printer'):
            printer_name = user.default_a5_printer

        pdf_buffer = generate_order_receipt_pdf(payment_id, include_company_details=False)
        pdf_data = pdf_buffer.read()

        pdf_base64 = base64.b64encode(pdf_data).decode('utf-8')

        try:
            print_job = PrintJob.objects.create(
                user=user,
                target_printer_name=printer_name or '',
                fallback_printer_names=[],
                document_type='receipt',
                print_data=pdf_base64,
                copies=copies,
                status='pending'
            )

            return {'success': True, 'print_job_id': print_job.id}

        except Exception as print_err:
            logger.error(f"Error creating print job: {print_err}")
            logger.warning("PrintCloudClient models not available, printing feature disabled")
            return {'success': False, 'error': 'Print service not available'}

    except Exception as exc:
        logger.error(f"Error creating order receipt print job: {exc}")
        raise self.retry(exc=exc)
