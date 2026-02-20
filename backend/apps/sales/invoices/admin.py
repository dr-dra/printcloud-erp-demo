from django.contrib import admin
from django.utils.html import format_html
from .models import (
    SalesInvoice,
    SalesInvoiceItem,
    SalesInvoiceTimeline,
    InvoicePayment,
    SalesCreditNote,
    ReceiptSequence,
    InvoiceShare
)


class SalesInvoiceItemInline(admin.TabularInline):
    """Inline admin for sales invoice items"""
    model = SalesInvoiceItem
    extra = 1
    fields = ['item_name', 'description', 'quantity', 'unit_price', 'tax_rate', 'amount']
    readonly_fields = ['amount']


class SalesInvoiceTimelineInline(admin.TabularInline):
    """Inline admin for sales invoice timeline"""
    model = SalesInvoiceTimeline
    extra = 0
    fields = ['event_type', 'message', 'old_status', 'new_status', 'created_by', 'created_at']
    readonly_fields = ['event_type', 'message', 'old_status', 'new_status', 'created_by', 'created_at']
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


class InvoicePaymentInline(admin.TabularInline):
    """Inline admin for invoice payments"""
    model = InvoicePayment
    extra = 0
    fields = ['payment_date', 'amount', 'payment_method', 'reference_number', 'notes']
    readonly_fields = ['created_by', 'created_at']

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(SalesInvoice)
class SalesInvoiceAdmin(admin.ModelAdmin):
    list_display = [
        'invoice_number',
        'customer',
        'invoice_date',
        'due_date',
        'status_badge',
        'net_total',
        'balance_due',
        'created_by'
    ]
    list_filter = ['status', 'invoice_date', 'customer']
    search_fields = ['invoice_number', 'customer__name', 'po_so_number']
    readonly_fields = [
        'subtotal',
        'net_total',
        'balance_due',
        'created_date',
        'updated_date'
    ]
    autocomplete_fields = ['customer', 'order']
    ordering = ['-invoice_date', '-invoice_number']
    date_hierarchy = 'invoice_date'
    inlines = [SalesInvoiceItemInline, InvoicePaymentInline, SalesInvoiceTimelineInline]

    fieldsets = (
        ('Invoice Information', {
            'fields': ('invoice_number', 'customer', 'order', 'status')
        }),
        ('Dates', {
            'fields': ('invoice_date', 'due_date')
        }),
        ('Financial Details', {
            'fields': ('subtotal', 'discount', 'tax_amount', 'net_total', 'amount_paid', 'balance_due')
        }),
        ('Additional Information', {
            'fields': ('po_so_number', 'notes', 'customer_notes'),
            'classes': ('collapse',)
        }),
        ('Audit Information', {
            'fields': ('created_by', 'updated_by', 'created_date', 'updated_date'),
            'classes': ('collapse',)
        }),
    )

    def status_badge(self, obj):
        """Display status as colored badge"""
        colors = {
            'draft': 'gray',
            'sent': 'blue',
            'partially_paid': 'orange',
            'paid': 'green',
            'overdue': 'red',
            'void': 'darkred',
        }
        color = colors.get(obj.status, 'gray')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; '
            'border-radius: 3px; font-weight: bold;">{}</span>',
            color,
            obj.get_status_display()
        )
    status_badge.short_description = 'Status'

    def save_model(self, request, obj, form, change):
        """Set created_by/updated_by"""
        if not change:
            obj.created_by = request.user
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(InvoicePayment)
class InvoicePaymentAdmin(admin.ModelAdmin):
    list_display = [
        'invoice',
        'payment_date',
        'amount',
        'payment_method',
        'reference_number',
        'created_by'
    ]
    list_filter = ['payment_method', 'payment_date']
    search_fields = [
        'invoice__invoice_number',
        'reference_number'
    ]
    readonly_fields = ['created_at']
    autocomplete_fields = ['invoice']
    ordering = ['-payment_date']
    date_hierarchy = 'payment_date'

    fieldsets = (
        ('Payment Information', {
            'fields': ('invoice', 'payment_date', 'amount', 'payment_method')
        }),
        ('Reference', {
            'fields': ('reference_number', 'notes')
        }),
        ('Audit Information', {
            'fields': ('created_by', 'created_at'),
            'classes': ('collapse',)
        }),
    )

    def save_model(self, request, obj, form, change):
        """Set created_by on new objects"""
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(SalesCreditNote)
class SalesCreditNoteAdmin(admin.ModelAdmin):
    list_display = [
        'credit_note_number',
        'customer',
        'invoice',
        'credit_note_date',
        'status_badge',
        'amount',
        'reason',
        'created_by'
    ]
    list_filter = ['status', 'credit_note_date', 'customer']
    search_fields = [
        'credit_note_number',
        'customer__name',
        'reason',
        'description'
    ]
    readonly_fields = ['approved_by', 'approved_at', 'applied_at', 'created_at', 'updated_at']
    autocomplete_fields = ['customer', 'invoice', 'applied_to_invoice', 'approved_by']
    ordering = ['-credit_note_date', '-credit_note_number']
    date_hierarchy = 'credit_note_date'

    fieldsets = (
        ('Credit Note Information', {
            'fields': ('credit_note_number', 'customer', 'invoice', 'status')
        }),
        ('Date', {
            'fields': ('credit_note_date',)
        }),
        ('Financial', {
            'fields': ('amount',)
        }),
        ('Reason', {
            'fields': ('reason', 'description')
        }),
        ('Application', {
            'fields': ('applied_to_invoice', 'applied_at'),
            'classes': ('collapse',)
        }),
        ('Approval', {
            'fields': ('approved_by', 'approved_at'),
            'classes': ('collapse',)
        }),
        ('Audit Information', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def status_badge(self, obj):
        """Display status as colored badge"""
        colors = {
            'draft': 'gray',
            'approved': 'blue',
            'applied': 'green',
            'void': 'red',
        }
        color = colors.get(obj.status, 'gray')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; '
            'border-radius: 3px; font-weight: bold;">{}</span>',
            color,
            obj.get_status_display()
        )
    status_badge.short_description = 'Status'

    def save_model(self, request, obj, form, change):
        """Set created_by on new objects"""
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(InvoiceShare)
class InvoiceShareAdmin(admin.ModelAdmin):
    list_display = ['invoice', 'token', 'created_at', 'expires_at', 'view_count', 'last_viewed_at']
    search_fields = ['invoice__invoice_number', 'token']
    readonly_fields = ['created_at', 'view_count', 'last_viewed_at']
    ordering = ['-created_at']


@admin.register(ReceiptSequence)
class ReceiptSequenceAdmin(admin.ModelAdmin):
    list_display = ['name', 'prefix', 'last_number', 'updated_at']
    readonly_fields = ['updated_at']

    actions = ['approve_credit_notes', 'void_credit_notes']

    def approve_credit_notes(self, request, queryset):
        """Bulk approve selected credit notes"""
        approved_count = 0
        error_count = 0

        for cn in queryset:
            try:
                if cn.status == 'draft':
                    cn.approve(request.user)
                    approved_count += 1
            except Exception as e:
                error_count += 1
                self.message_user(
                    request,
                    f"Error approving credit note {cn.credit_note_number}: {str(e)}",
                    level='ERROR'
                )

        if approved_count:
            self.message_user(
                request,
                f"Successfully approved {approved_count} credit note(s)",
                level='SUCCESS'
            )
        if error_count:
            self.message_user(
                request,
                f"Failed to approve {error_count} credit note(s)",
                level='WARNING'
            )

    approve_credit_notes.short_description = "Approve selected credit notes"

    def void_credit_notes(self, request, queryset):
        """Void selected credit notes"""
        voided_count = 0
        error_count = 0

        for cn in queryset:
            try:
                cn.void()
                voided_count += 1
            except Exception as e:
                error_count += 1
                self.message_user(
                    request,
                    f"Error voiding credit note {cn.credit_note_number}: {str(e)}",
                    level='ERROR'
                )

        if voided_count:
            self.message_user(
                request,
                f"Voided {voided_count} credit note(s)",
                level='SUCCESS'
            )
        if error_count:
            self.message_user(
                request,
                f"Failed to void {error_count} credit note(s)",
                level='WARNING'
            )

    void_credit_notes.short_description = "Void selected credit notes"


@admin.register(SalesInvoiceTimeline)
class SalesInvoiceTimelineAdmin(admin.ModelAdmin):
    list_display = ['invoice', 'event_type', 'message', 'created_by', 'created_at']
    list_filter = ['event_type', 'created_at']
    search_fields = ['invoice__invoice_number', 'message']
    autocomplete_fields = ['invoice']
    ordering = ['-created_at']

    def has_add_permission(self, request):
        """Timeline entries should only be created programmatically"""
        return False

    def has_change_permission(self, request, obj=None):
        """Timeline entries are immutable"""
        return False

    def has_delete_permission(self, request, obj=None):
        """Timeline entries cannot be deleted"""
        return False
