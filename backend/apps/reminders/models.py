from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.core.exceptions import ValidationError
import json

User = get_user_model()


class Reminder(models.Model):
    """
    Core reminder model based on user-reminder.md specification
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('sent', 'Sent'),
        ('snoozed', 'Snoozed'),
        ('done', 'Done'),
        ('canceled', 'Canceled'),
    ]
    
    ENTITY_TYPE_CHOICES = [
        ('quotation', 'Quotation'),
        ('job_ticket', 'Job Ticket'),
        ('customer', 'Customer'),
        ('order', 'Order'),
        ('invoice', 'Invoice'),
    ]
    
    # Core fields from specification
    company_id = models.IntegerField(null=True, blank=True, help_text="Company ID for multi-tenant support")
    entity_type = models.CharField(max_length=50, choices=ENTITY_TYPE_CHOICES)
    entity_id = models.BigIntegerField()
    entity_ref = models.CharField(max_length=120, help_text="e.g. 'Quotation #241551' for quick list rendering")
    
    assignee_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='assigned_reminders')
    due_at = models.DateTimeField(help_text="Timezone-aware datetime stored in UTC")
    note = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    origin_module = models.CharField(max_length=50, blank=True, help_text="Module where reminder was created")
    auto_cancel_on_states = models.JSONField(default=list, blank=True, help_text="States that auto-cancel this reminder")
    
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_reminders')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    link_path = models.TextField(blank=True, help_text="Relative URL for navigation")
    
    class Meta:
        db_table = 'reminders'
        indexes = [
            models.Index(fields=['assignee_user', 'status', 'due_at'], name='idx_reminders_assignee_due'),
            models.Index(fields=['entity_type', 'entity_id'], name='idx_reminders_entity'),
            models.Index(fields=['company_id', 'assignee_user'], name='idx_reminders_company'),
        ]
        # Prevent duplicate active reminders for the same entity and user
        constraints = [
            models.UniqueConstraint(
                fields=['entity_type', 'entity_id', 'assignee_user'],
                condition=models.Q(status__in=['pending', 'sent']),
                name='unique_active_reminder_per_entity_user'
            )
        ]
    
    def __str__(self):
        return f"{self.entity_ref} - {self.assignee_user.get_full_name() or self.assignee_user.email} - {self.due_at}"
    
    def clean(self):
        if self.auto_cancel_on_states and not isinstance(self.auto_cancel_on_states, list):
            raise ValidationError("auto_cancel_on_states must be a list")
    
    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
    
    @property
    def is_overdue(self):
        return self.due_at < timezone.now() and self.status in ['pending', 'sent']
    
    @property
    def is_due_today(self):
        now = timezone.now()
        return (
            self.due_at.date() == now.date() 
            and self.status in ['pending', 'sent']
        )
    
    def snooze(self, days=1):
        """Snooze reminder by specified number of days"""
        self.due_at = self.due_at + timezone.timedelta(days=days)
        self.status = 'pending'  # Reset to pending when snoozed
        self.save()
    
    def mark_done(self):
        """Mark reminder as completed"""
        self.status = 'done'
        self.save()
    
    def auto_cancel_if_needed(self, current_state):
        """Auto-cancel reminder if current state is in auto_cancel_on_states"""
        if current_state in self.auto_cancel_on_states:
            self.status = 'canceled'
            self.save()
            return True
        return False


class Notification(models.Model):
    """
    In-app notification tracking for reminders
    """
    CHANNEL_CHOICES = [
        ('in_app', 'In-App'),
        ('email_digest', 'Email Digest'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    reminder = models.ForeignKey(Reminder, on_delete=models.CASCADE, related_name='notifications')
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES, default='in_app')
    
    delivered_at = models.DateTimeField(null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    is_archived = models.BooleanField(default=False, help_text="Soft delete flag - hides notification from UI")
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'reminders_notifications'
        indexes = [
            models.Index(fields=['user', 'read_at'], name='idx_notifications_user_unread'),
            models.Index(fields=['delivered_at'], name='idx_notifications_delivered'),
        ]
    
    def __str__(self):
        return f"{self.user.email} - {self.reminder.entity_ref}"
    
    @property
    def is_unread(self):
        return self.read_at is None
    
    def mark_as_read(self):
        """Mark notification as read"""
        if not self.read_at:
            self.read_at = timezone.now()
            self.save()
    
    def mark_as_delivered(self):
        """Mark notification as delivered"""
        if not self.delivered_at:
            self.delivered_at = timezone.now()
            self.save()
    
    def archive(self):
        """Archive notification (soft delete)"""
        if not self.is_archived:
            self.is_archived = True
            self.save()


class ReminderActivity(models.Model):
    """
    Light audit trail for reminder actions
    """
    ACTION_CHOICES = [
        ('create', 'Create'),
        ('update', 'Update'),
        ('snooze', 'Snooze'),
        ('done', 'Done'),
        ('cancel', 'Cancel'),
        ('deliver', 'Deliver'),
    ]
    
    reminder = models.ForeignKey(Reminder, on_delete=models.CASCADE, related_name='activities')
    actor_user = models.ForeignKey(User, on_delete=models.CASCADE)
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    meta = models.JSONField(default=dict, blank=True, help_text="Additional metadata about the action")
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'reminders_activity'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.actor_user.email} - {self.action} - {self.reminder.entity_ref}"
