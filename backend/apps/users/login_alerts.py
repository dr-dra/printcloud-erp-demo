import logging

from django.conf import settings
from django.core.mail import EmailMessage
from django.utils import timezone
from django.utils.html import escape

logger = logging.getLogger(__name__)


def _client_ip(request) -> str:
    if request is None:
        return 'Unknown'
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', 'Unknown')


def send_login_alert(user, request, login_method: str = 'password') -> None:
    """
    Sends a login alert email for successful logins.
    Guarded by LOGIN_ALERTS_ENABLED and LOGIN_ALERT_RECIPIENTS.
    """
    if not getattr(settings, 'LOGIN_ALERTS_ENABLED', False):
        return

    recipients = getattr(settings, 'LOGIN_ALERT_RECIPIENTS', [])
    if not recipients:
        return

    try:
        ip = _client_ip(request)
        user_agent = request.META.get('HTTP_USER_AGENT', 'Unknown') if request else 'Unknown'
        timestamp = timezone.localtime(timezone.now()).strftime('%Y-%m-%d %H:%M:%S %Z')
        host = request.get_host() if request else 'Unknown'

        subject = f'PrintCloud Login Alert: {user.email}'
        body = (
            '<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5;">'
            '<h3 style="margin:0 0 12px 0;">Successful Login</h3>'
            f'<div><strong>User:</strong> {escape(user.email)}</div>'
            f'<div><strong>Role:</strong> {escape(str(getattr(user, "role", "unknown")))}</div>'
            f'<div><strong>Method:</strong> {escape(login_method)}</div>'
            f'<div><strong>IP:</strong> {escape(ip)}</div>'
            f'<div><strong>Date/Time:</strong> {escape(timestamp)}</div>'
            f'<div><strong>Host:</strong> {escape(host)}</div>'
            f'<div><strong>User Agent:</strong> {escape(user_agent)}</div>'
            '</div>'
        )

        email = EmailMessage(
            subject=subject,
            body=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=recipients,
        )
        email.content_subtype = 'html'
        email.send(fail_silently=True)
    except Exception:
        logger.exception('Failed to send login alert email')
