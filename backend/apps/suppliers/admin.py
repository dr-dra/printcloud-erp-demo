from django.contrib import admin
from .models import Supplier, SupplierContact, SupplierDocument


class SupplierContactInline(admin.TabularInline):
    """Inline admin for supplier contacts"""
    model = SupplierContact
    extra = 1
    fields = ['name', 'position', 'email', 'phone', 'mobile', 'is_primary']


class SupplierDocumentInline(admin.TabularInline):
    """Inline admin for supplier documents"""
    model = SupplierDocument
    extra = 0
    fields = ['title', 'document_type', 'file', 'description']
    readonly_fields = ['uploaded_by', 'uploaded_at']


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = [
        'supplier_code',
        'name',
        'email',
        'phone',
        'current_balance',
        'payment_terms_days',
        'is_active',
        'created_at'
    ]
    list_filter = ['is_active', 'country', 'created_at']
    search_fields = ['supplier_code', 'name', 'company_name', 'email', 'phone']
    readonly_fields = ['current_balance', 'created_at', 'updated_at', 'created_by']
    ordering = ['name']
    inlines = [SupplierContactInline, SupplierDocumentInline]
    # Enable autocomplete for foreign key lookups
    autocomplete_fields = []

    fieldsets = (
        ('Basic Information', {
            'fields': ('supplier_code', 'name', 'company_name', 'is_active')
        }),
        ('Contact Information', {
            'fields': ('email', 'phone', 'mobile', 'website')
        }),
        ('Address', {
            'fields': (
                'address_line1',
                'address_line2',
                'city',
                'state',
                'postal_code',
                'country'
            )
        }),
        ('Financial Settings', {
            'fields': (
                'payment_terms_days',
                'credit_limit',
                'current_balance'
            ),
            'description': 'Current balance is automatically updated by bills and payments'
        }),
        ('Tax & Banking', {
            'fields': (
                'tax_id',
                'bank_name',
                'bank_account_number',
                'bank_account_name',
                'bank_branch'
            ),
            'classes': ('collapse',)
        }),
        ('Additional Information', {
            'fields': ('notes',),
            'classes': ('collapse',)
        }),
        ('Audit Information', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def save_model(self, request, obj, form, change):
        """Set created_by on new objects"""
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(SupplierContact)
class SupplierContactAdmin(admin.ModelAdmin):
    list_display = ['name', 'supplier', 'position', 'email', 'phone', 'is_primary']
    list_filter = ['is_primary', 'supplier']
    search_fields = ['name', 'email', 'phone', 'supplier__name']
    autocomplete_fields = ['supplier']
    ordering = ['supplier', '-is_primary', 'name']

    fieldsets = (
        ('Contact Information', {
            'fields': ('supplier', 'name', 'position', 'is_primary')
        }),
        ('Contact Methods', {
            'fields': ('email', 'phone', 'mobile')
        }),
        ('Notes', {
            'fields': ('notes',),
            'classes': ('collapse',)
        }),
    )


@admin.register(SupplierDocument)
class SupplierDocumentAdmin(admin.ModelAdmin):
    list_display = [
        'title',
        'supplier',
        'document_type',
        'file_size_display',
        'uploaded_by',
        'uploaded_at'
    ]
    list_filter = ['document_type', 'uploaded_at']
    search_fields = ['title', 'description', 'supplier__name']
    readonly_fields = ['file_size', 'uploaded_by', 'uploaded_at']
    autocomplete_fields = ['supplier']
    ordering = ['-uploaded_at']

    fieldsets = (
        ('Document Information', {
            'fields': ('supplier', 'title', 'document_type', 'description')
        }),
        ('File', {
            'fields': ('file', 'file_size')
        }),
        ('Audit Information', {
            'fields': ('uploaded_by', 'uploaded_at'),
            'classes': ('collapse',)
        }),
    )

    def file_size_display(self, obj):
        """Display file size in human-readable format"""
        if not obj.file_size:
            return '-'

        size = obj.file_size
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024.0:
                return f"{size:.1f} {unit}"
            size /= 1024.0
        return f"{size:.1f} TB"

    file_size_display.short_description = 'File Size'

    def save_model(self, request, obj, form, change):
        """Set uploaded_by on new objects"""
        if not change:
            obj.uploaded_by = request.user
        super().save_model(request, obj, form, change)
