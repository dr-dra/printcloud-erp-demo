from django.db import models
from django.contrib.auth import get_user_model
import uuid

User = get_user_model()

class PrintCloudClient(models.Model):
    STATUS_CHOICES = [
        ('online', 'Online'),
        ('offline', 'Offline'),
        ('error', 'Error'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, help_text="Computer/client name")
    ip_address = models.GenericIPAddressField()
    last_heartbeat = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='online')
    version = models.CharField(max_length=50, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-last_heartbeat']
        
    def __str__(self):
        return f"{self.name} ({self.ip_address})"

class Printer(models.Model):
    TYPE_CHOICES = [
        ('standard', 'Standard Printer'),
        ('pos', 'POS/Thermal Printer'),
    ]
    
    STATUS_CHOICES = [
        ('online', 'Online'),
        ('offline', 'Offline'),
        ('error', 'Error'),
        ('busy', 'Busy'),
    ]
    
    client = models.ForeignKey(PrintCloudClient, on_delete=models.CASCADE, related_name='printers')
    name = models.CharField(max_length=255)
    driver = models.CharField(max_length=255, blank=True, null=True)
    printer_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='standard')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='online')
    capabilities = models.JSONField(default=dict, blank=True)
    last_status_update = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['client', 'name']
        ordering = ['printer_type', 'name']
        
    def __str__(self):
        return f"{self.name} ({self.client.name})"

class PrintJob(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('assigned', 'Assigned'),
        ('printing', 'Printing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    
    DOCUMENT_TYPE_CHOICES = [
        ('invoice', 'Invoice'),
        ('quotation', 'Quotation'),
        ('receipt', 'Receipt'),
        ('job_ticket', 'Job Ticket'),
        ('dispatch_note', 'Dispatch Note'),
        ('credit_note', 'Credit Note'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='print_jobs')
    assigned_client = models.ForeignKey(PrintCloudClient, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_jobs')
    target_printer_name = models.CharField(max_length=255, help_text="User's preferred printer name")
    fallback_printer_names = models.JSONField(default=list, help_text="Alternative printer names if preferred unavailable")
    document_type = models.CharField(max_length=20, choices=DOCUMENT_TYPE_CHOICES)
    print_data = models.TextField(help_text="Base64 encoded printer data (PDF, PCL, PostScript, or ESC/POS commands)")
    copies = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    error_message = models.TextField(blank=True, null=True)
    used_printer_name = models.CharField(max_length=255, blank=True, null=True, help_text="Actually used printer name")
    created_at = models.DateTimeField(auto_now_add=True)
    assigned_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        
    def __str__(self):
        return f"Print Job {self.id} - {self.document_type} for {self.user.email}"
