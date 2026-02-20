from celery import shared_task
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.db import transaction
import logging

from .models import Reminder, Notification, ReminderActivity

logger = logging.getLogger(__name__)
User = get_user_model()


@shared_task(bind=True, max_retries=3)
def process_due_reminders(self):
    """
    Process reminders that are due for notification.
    This task runs every 15 minutes via Celery Beat.
    """
    try:
        now = timezone.now()
        
        # Find reminders that are due and haven't been sent yet
        due_reminders = Reminder.objects.filter(
            due_at__lte=now,
            status='pending'
        ).select_related('assignee_user')
        
        processed_count = 0
        
        for reminder in due_reminders:
            try:
                with transaction.atomic():
                    # Update reminder status to 'sent'
                    reminder.status = 'sent'
                    reminder.save()
                    
                    # Create in-app notification
                    notification, created = Notification.objects.get_or_create(
                        user=reminder.assignee_user,
                        reminder=reminder,
                        channel='in_app',
                        defaults={
                            'delivered_at': now
                        }
                    )
                    
                    if created:
                        # Log the activity
                        ReminderActivity.objects.create(
                            reminder=reminder,
                            actor_user=reminder.assignee_user,  # System action, but use assignee as actor
                            action='deliver',
                            meta={
                                'delivered_at': now.isoformat(),
                                'channel': 'in_app'
                            }
                        )
                        
                        processed_count += 1
                        logger.info(f"Created notification for reminder {reminder.id}: {reminder.entity_ref}")
            
            except Exception as e:
                logger.error(f"Failed to process reminder {reminder.id}: {str(e)}")
                continue
        
        logger.info(f"Processed {processed_count} due reminders")
        return {
            'status': 'success',
            'processed_count': processed_count,
            'total_due': due_reminders.count()
        }
    
    except Exception as exc:
        logger.error(f"Error in process_due_reminders task: {str(exc)}")
        # Retry the task if it fails
        raise self.retry(exc=exc, countdown=60, max_retries=3)


@shared_task
def auto_cancel_reminder(reminder_id, current_state, reason=None):
    """
    Auto-cancel a reminder based on entity state changes.
    This task is called when an entity (e.g., quotation) changes state.
    """
    try:
        reminder = Reminder.objects.get(id=reminder_id)
        
        if reminder.auto_cancel_if_needed(current_state):
            # Log the auto-cancellation
            ReminderActivity.objects.create(
                reminder=reminder,
                actor_user=reminder.created_by,  # Use creator as the actor for system actions
                action='cancel',
                meta={
                    'reason': 'auto_cancel',
                    'triggered_by_state': current_state,
                    'custom_reason': reason
                }
            )
            
            logger.info(f"Auto-cancelled reminder {reminder.id} due to state change: {current_state}")
            return {'status': 'cancelled', 'reminder_id': reminder_id}
        
        return {'status': 'no_action', 'reminder_id': reminder_id}
    
    except Reminder.DoesNotExist:
        logger.warning(f"Reminder {reminder_id} not found for auto-cancellation")
        return {'status': 'not_found', 'reminder_id': reminder_id}
    except Exception as exc:
        logger.error(f"Error in auto_cancel_reminder task: {str(exc)}")
        raise exc


@shared_task
def cleanup_old_notifications(days_old=30):
    """
    Clean up old read notifications to prevent database bloat.
    Run this task weekly or monthly via Celery Beat.
    """
    try:
        cutoff_date = timezone.now() - timezone.timedelta(days=days_old)
        
        # Delete old read notifications
        deleted_count, _ = Notification.objects.filter(
            read_at__lt=cutoff_date,
            read_at__isnull=False
        ).delete()
        
        logger.info(f"Cleaned up {deleted_count} old notifications")
        return {
            'status': 'success',
            'deleted_count': deleted_count,
            'cutoff_date': cutoff_date.isoformat()
        }
    
    except Exception as exc:
        logger.error(f"Error in cleanup_old_notifications task: {str(exc)}")
        raise exc


@shared_task
def send_reminder_summary(user_id, period='weekly'):
    """
    Send reminder summary to a user (for future email digest feature).
    Currently just logs the summary, but can be extended to send emails.
    """
    try:
        user = User.objects.get(id=user_id)
        
        # Get user's active reminders
        reminders = Reminder.objects.filter(
            assignee_user=user,
            status__in=['pending', 'sent']
        )
        
        overdue = reminders.filter(due_at__lt=timezone.now()).count()
        upcoming = reminders.filter(due_at__gte=timezone.now()).count()
        
        summary = {
            'user': user.email,
            'period': period,
            'overdue_count': overdue,
            'upcoming_count': upcoming,
            'total_active': overdue + upcoming
        }
        
        logger.info(f"Reminder summary for {user.email}: {summary}")
        return summary
    
    except User.DoesNotExist:
        logger.warning(f"User {user_id} not found for reminder summary")
        return {'status': 'user_not_found', 'user_id': user_id}
    except Exception as exc:
        logger.error(f"Error in send_reminder_summary task: {str(exc)}")
        raise exc