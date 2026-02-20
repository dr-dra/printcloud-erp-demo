from django.contrib import admin
from .models import PrintCloudClient, Printer, PrintJob

@admin.register(PrintCloudClient)
class PrintCloudClientAdmin(admin.ModelAdmin):
    list_display = ['name', 'ip_address', 'status', 'last_heartbeat', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['name', 'ip_address']
    readonly_fields = ['id', 'created_at', 'updated_at']

@admin.register(Printer)
class PrinterAdmin(admin.ModelAdmin):
    list_display = ['name', 'client', 'printer_type', 'status', 'last_status_update']
    list_filter = ['printer_type', 'status', 'client']
    search_fields = ['name', 'client__name']

@admin.register(PrintJob)
class PrintJobAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'document_type', 'target_printer_name', 'status', 'created_at']
    list_filter = ['status', 'document_type', 'created_at']
    search_fields = ['user__email', 'target_printer_name']
    readonly_fields = ['id', 'created_at', 'assigned_at', 'completed_at']
