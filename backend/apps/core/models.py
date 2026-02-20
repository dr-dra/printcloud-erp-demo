from django.db import models
from django.conf import settings


class DocumentCommunicationLog(models.Model):
    """
    Shared model for tracking all outbound document communications
    (Email, WhatsApp, Print) across Quotations, Invoices, and Orders.
    """

    DOC_TYPE_CHOICES = [
        ('quotation', 'Quotation'),
        ('invoice', 'Invoice'),
        ('order', 'Order'),
    ]

    METHOD_CHOICES = [
        ('email', 'Email'),
        ('whatsapp', 'WhatsApp'),
        ('print', 'Print'),
    ]

    # Document reference
    doc_type = models.CharField(
        max_length=20,
        choices=DOC_TYPE_CHOICES,
        db_index=True,
        help_text='Type of document (Quotation, Invoice, or Order)'
    )
    doc_id = models.IntegerField(
        db_index=True,
        help_text='ID of the document in its respective table'
    )

    # Communication details
    method = models.CharField(
        max_length=20,
        choices=METHOD_CHOICES,
        help_text='Communication method used'
    )
    destination = models.TextField(
        help_text='Email address, phone number, or "Physical Copy" for prints'
    )
    success = models.BooleanField(
        default=True,
        help_text='Whether the communication was successful'
    )

    # Optional details
    message = models.TextField(
        blank=True,
        null=True,
        help_text='Additional details about the communication'
    )
    error_message = models.TextField(
        blank=True,
        null=True,
        help_text='Error details if communication failed'
    )

    # Audit fields
    sent_at = models.DateTimeField(
        auto_now_add=True,
        help_text='When the communication was sent'
    )
    sent_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='sent_communications',
        help_text='User who initiated the communication'
    )

    class Meta:
        db_table = 'core_document_communication_log'
        ordering = ['-sent_at']
        verbose_name = 'Document Communication Log'
        verbose_name_plural = 'Document Communication Logs'
        indexes = [
            models.Index(fields=['doc_type', 'doc_id'], name='doc_type_id_idx'),
            models.Index(fields=['sent_at'], name='sent_at_idx'),
        ]

    def __str__(self):
        status = "✓" if self.success else "✗"
        return f"{status} {self.get_method_display()} - {self.get_doc_type_display()} #{self.doc_id} to {self.destination}"

    @property
    def sent_by_name(self):
        """Return the full name of the user who sent the communication"""
        if self.sent_by:
            # Try to get full name from employee profile
            try:
                if hasattr(self.sent_by, 'employee') and self.sent_by.employee:
                    return self.sent_by.employee.full_name
            except Exception:
                pass
            # Fallback to username or email
            return self.sent_by.username or self.sent_by.email
        return "System"


class BugReport(models.Model):
    """
    User-submitted bug report from the app.
    """

    page_url = models.TextField(help_text='URL of the page where the issue occurred')
    description = models.TextField(help_text='User description of the issue')
    screenshot = models.FileField(
        upload_to='bug_reports/',
        blank=True,
        null=True,
        help_text='Optional screenshot attachment'
    )
    user_agent = models.TextField(blank=True, null=True, help_text='Browser user agent')
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='bug_reports'
    )

    class Meta:
        db_table = 'core_bug_report'
        ordering = ['-created_at']
        verbose_name = 'Bug Report'
        verbose_name_plural = 'Bug Reports'
        indexes = [
            models.Index(fields=['created_at'], name='bug_report_created_at_idx'),
        ]

    def __str__(self):
        return f'Bug Report #{self.id} - {self.page_url}'
