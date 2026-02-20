import logging
import mimetypes

from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMessage
from django.utils.html import escape

from .models import BugReport

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def send_bug_report_email(self, report_id: int) -> None:
    try:
        report = BugReport.objects.select_related('created_by').get(pk=report_id)

        user = report.created_by
        user_name = user.get_complete_name() if user else 'Unknown'
        user_email = user.email if user else 'Unknown'
        user_role = getattr(user, 'role', 'unknown')

        subject = f'PrintCloud Bug Report #{report.id}'
        description_html = escape(report.description).replace('\n', '<br>')
        meta_lines = [
            f'User: {escape(user_name)}',
            f'Email: {escape(user_email)}',
            f'Role: {escape(user_role)}',
            f'Page URL: {escape(report.page_url)}',
            f'User Agent: {escape(report.user_agent or "Unknown")}',
            f'Submitted At: {escape(str(report.created_at))}',
        ]
        meta_html = '<br>'.join(meta_lines)
        body = (
            f'<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5;">'
            f'<div>{description_html}</div>'
            f'<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;" />'
            f'<div style="font-size:12px;color:#6b7280;line-height:1.4;">{meta_html}</div>'
            f'</div>'
        )

        email = EmailMessage(
            subject=subject,
            body=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[settings.BUG_REPORT_EMAIL],
        )
        email.content_subtype = 'html'

        if report.screenshot:
            report.screenshot.open('rb')
            content_type, _ = mimetypes.guess_type(report.screenshot.name)
            email.attach(
                report.screenshot.name,
                report.screenshot.read(),
                content_type or 'application/octet-stream'
            )
            report.screenshot.close()

        email.send(fail_silently=False)
    except BugReport.DoesNotExist:
        logger.warning('Bug report not found for email send: %s', report_id)
    except Exception:
        logger.exception('Failed to send bug report email')
