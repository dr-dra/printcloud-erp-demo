from django.contrib import admin
from .models import Reminder, Notification, ReminderActivity


@admin.register(Reminder)
class ReminderAdmin(admin.ModelAdmin):
    list_display = ['entity_ref', 'assignee_user', 'due_at', 'status', 'created_by', 'created_at']
    list_filter = ['status', 'entity_type', 'created_at', 'due_at']
    search_fields = ['entity_ref', 'note', 'assignee_user__email', 'created_by__email']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Entity Information', {
            'fields': ('entity_type', 'entity_id', 'entity_ref', 'link_path')
        }),
        ('Assignment', {
            'fields': ('assignee_user', 'created_by')
        }),
        ('Scheduling', {
            'fields': ('due_at', 'status')
        }),
        ('Content', {
            'fields': ('note', 'origin_module', 'auto_cancel_on_states')
        }),
        ('Metadata', {
            'fields': ('company_id', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['user', 'reminder', 'channel', 'delivered_at', 'read_at', 'created_at']
    list_filter = ['channel', 'delivered_at', 'read_at', 'created_at']
    search_fields = ['user__email', 'reminder__entity_ref']
    readonly_fields = ['created_at']


@admin.register(ReminderActivity)
class ReminderActivityAdmin(admin.ModelAdmin):
    list_display = ['reminder', 'actor_user', 'action', 'created_at']
    list_filter = ['action', 'created_at']
    search_fields = ['reminder__entity_ref', 'actor_user__email']
    readonly_fields = ['created_at']
