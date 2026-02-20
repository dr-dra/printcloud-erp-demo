import logging

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

logger = logging.getLogger(__name__)


def _get_alert_recipients():
    raw = getattr(settings, 'JOURNAL_FAILURE_ALERT_EMAILS', [])
    if isinstance(raw, str):
        raw = [email.strip() for email in raw.split(',')]
    return [email for email in raw if email]


def _send_failure_alert(failure):
    recipients = _get_alert_recipients()
    if not recipients:
        return

    subject = f"[Accounting] Journal failure: {failure.source_type}:{failure.event_type}"
    message = (
        f"Journal failure recorded.\n\n"
        f"Source: {failure.source_type}\n"
        f"Source ID: {failure.source_id}\n"
        f"Event: {failure.event_type}\n"
        f"Attempts: {failure.attempts}\n"
        f"Last error: {failure.last_error}\n"
        f"Last attempt: {failure.last_attempt_at}\n"
    )

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', None),
            recipient_list=recipients,
            fail_silently=True,
        )
    except Exception:
        logger.exception("Failed to send journal failure alert email")


def record_journal_failure(source_type, source_id, event_type, error):
    from apps.accounting.models import JournalFailure

    failure, created = JournalFailure.objects.get_or_create(
        source_type=source_type,
        source_id=source_id,
        event_type=event_type,
    )
    failure.attempts = 1 if created else failure.attempts + 1
    failure.last_error = str(error)[:2000]
    failure.last_attempt_at = timezone.now()
    failure.resolved_at = None
    failure.save(update_fields=[
        'attempts', 'last_error', 'last_attempt_at', 'resolved_at'
    ])
    if created:
        _send_failure_alert(failure)


def resolve_journal_failure(source_type, source_id, event_type):
    from apps.accounting.models import JournalFailure

    JournalFailure.objects.filter(
        source_type=source_type,
        source_id=source_id,
        event_type=event_type,
        resolved_at__isnull=True,
    ).update(resolved_at=timezone.now())
