from django.contrib import admin
from .models import DocumentCommunicationLog, BugReport


@admin.register(DocumentCommunicationLog)
class DocumentCommunicationLogAdmin(admin.ModelAdmin):
    """Admin interface for DocumentCommunicationLog"""

    list_display = [
        'id',
        'doc_type',
        'doc_id',
        'method',
        'destination',
        'success',
        'sent_at',
        'sent_by_display',
    ]

    list_filter = [
        'doc_type',
        'method',
        'success',
        'sent_at',
    ]

    search_fields = [
        'doc_id',
        'destination',
        'message',
        'error_message',
        'sent_by__username',
        'sent_by__email',
    ]

    readonly_fields = [
        'id',
        'sent_at',
    ]

    date_hierarchy = 'sent_at'

    ordering = ['-sent_at']

    fieldsets = (
        ('Document Information', {
            'fields': ('doc_type', 'doc_id')
        }),
        ('Communication Details', {
            'fields': ('method', 'destination', 'success', 'message', 'error_message')
        }),
        ('Metadata', {
            'fields': ('sent_at', 'sent_by')
        }),
    )

    def sent_by_display(self, obj):
        """Display the user who sent the communication"""
        return obj.sent_by_name

    sent_by_display.short_description = 'Sent By'

    def has_add_permission(self, request):
        """Disable manual creation - logs should only be created via code"""
        return False

    def has_change_permission(self, request, obj=None):
        """Disable editing - logs are immutable"""
        return False


@admin.register(BugReport)
class BugReportAdmin(admin.ModelAdmin):
    list_display = [
        'id',
        'page_url',
        'created_at',
        'created_by_display',
        'has_screenshot',
    ]

    list_filter = ['created_at']

    search_fields = ['page_url', 'description', 'created_by__username', 'created_by__email']

    readonly_fields = ['id', 'created_at', 'created_by']

    ordering = ['-created_at']

    fieldsets = (
        ('Bug Report', {
            'fields': ('page_url', 'description', 'screenshot')
        }),
        ('Metadata', {
            'fields': ('created_at', 'created_by', 'user_agent')
        }),
    )

    def created_by_display(self, obj):
        if obj.created_by:
            return obj.created_by.get_complete_name()
        return 'Unknown'

    created_by_display.short_description = 'Reported By'

    def has_screenshot(self, obj):
        return bool(obj.screenshot)

    has_screenshot.boolean = True
    has_screenshot.short_description = 'Screenshot'
