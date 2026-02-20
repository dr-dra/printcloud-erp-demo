from django.contrib import admin
from django.utils.html import format_html
from .models import (
    PurchaseOrder,
    PurchaseOrderItem,
    PurchaseOrderTimeline,
    GoodsReceivedNote,
    GRNItem,
    SupplierBill,
    BillPayment,
    SupplierCreditNote,
    PurchaseOrderShare
)


class PurchaseOrderItemInline(admin.TabularInline):
    """Inline admin for purchase order items"""
    model = PurchaseOrderItem
    extra = 1
    fields = [
        'line_number',
        'item_name',
        'description',
        'quantity',
        'unit_of_measure',
        'unit_price',
        'amount',
        'quantity_received'
    ]
    readonly_fields = ['amount', 'quantity_received']


class PurchaseOrderTimelineInline(admin.TabularInline):
    """Inline admin for purchase order timeline"""
    model = PurchaseOrderTimeline
    extra = 0
    fields = ['event_type', 'message', 'old_status', 'new_status', 'created_by', 'created_at']
    readonly_fields = ['event_type', 'message', 'old_status', 'new_status', 'created_by', 'created_at']
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display = [
        'po_number',
        'supplier',
        'order_date',
        'expected_delivery_date',
        'status_badge',
        'total',
        'created_by'
    ]
    list_filter = ['status', 'order_date', 'supplier']
    search_fields = ['po_number', 'supplier__name', 'supplier__supplier_code']
    readonly_fields = ['subtotal', 'total', 'created_at', 'updated_at', 'created_by', 'actual_delivery_date']
    autocomplete_fields = ['supplier']
    ordering = ['-order_date', '-po_number']
    date_hierarchy = 'order_date'
    inlines = [PurchaseOrderItemInline, PurchaseOrderTimelineInline]

    fieldsets = (
        ('Order Information', {
            'fields': ('po_number', 'supplier', 'status')
        }),
        ('Dates', {
            'fields': ('order_date', 'expected_delivery_date', 'actual_delivery_date')
        }),
        ('Financial Details', {
            'fields': ('subtotal', 'tax_amount', 'discount_amount', 'total')
        }),
        ('Delivery Information', {
            'fields': ('delivery_address', 'shipping_method'),
            'classes': ('collapse',)
        }),
        ('Notes', {
            'fields': ('notes', 'supplier_notes'),
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
            'sent': 'blue',
            'confirmed': 'green',
            'partially_received': 'orange',
            'received': 'purple',
            'completed': 'darkgreen',
            'cancelled': 'red',
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
        """Set created_by on new objects and add timeline entry"""
        if not change:
            obj.created_by = request.user
            super().save_model(request, obj, form, change)
            obj.add_timeline_entry(
                event_type='created',
                message=f"Purchase Order {obj.po_number} created",
                new_status=obj.status,
                user=request.user
            )
        else:
            # Track status changes
            if 'status' in form.changed_data:
                old_obj = PurchaseOrder.objects.get(pk=obj.pk)
                super().save_model(request, obj, form, change)
                obj.add_timeline_entry(
                    event_type='status_changed',
                    message=f"Status changed from {old_obj.get_status_display()} to {obj.get_status_display()}",
                    old_status=old_obj.status,
                    new_status=obj.status,
                    user=request.user
                )
            else:
                super().save_model(request, obj, form, change)

    def save_formset(self, request, form, formset, change):
        """Recalculate totals when items change"""
        super().save_formset(request, form, formset, change)
        if formset.model == PurchaseOrderItem:
            form.instance.calculate_totals()


@admin.register(PurchaseOrderShare)
class PurchaseOrderShareAdmin(admin.ModelAdmin):
    list_display = ['purchase_order', 'token', 'created_at', 'expires_at', 'view_count', 'last_viewed_at']
    search_fields = ['purchase_order__po_number', 'token']
    readonly_fields = ['created_at', 'view_count', 'last_viewed_at']
    ordering = ['-created_at']


class GRNItemInline(admin.TabularInline):
    """Inline admin for GRN items"""
    model = GRNItem
    extra = 1
    fields = [
        'purchase_order_item',
        'quantity_received',
        'quantity_accepted',
        'quantity_rejected',
        'notes'
    ]
    autocomplete_fields = ['purchase_order_item']


@admin.register(GoodsReceivedNote)
class GoodsReceivedNoteAdmin(admin.ModelAdmin):
    list_display = [
        'grn_number',
        'purchase_order',
        'supplier',
        'received_date',
        'status_badge',
        'quality_passed',
        'received_by'
    ]
    list_filter = ['status', 'quality_passed', 'received_date', 'supplier']
    search_fields = ['grn_number', 'purchase_order__po_number', 'supplier__name', 'delivery_note_number']
    readonly_fields = ['created_at', 'updated_at']
    autocomplete_fields = ['purchase_order', 'supplier', 'inspected_by', 'received_by']
    ordering = ['-received_date', '-grn_number']
    date_hierarchy = 'received_date'
    inlines = [GRNItemInline]

    fieldsets = (
        ('GRN Information', {
            'fields': ('grn_number', 'purchase_order', 'supplier', 'status')
        }),
        ('Dates', {
            'fields': ('received_date', 'inspection_date')
        }),
        ('Quality Inspection', {
            'fields': ('inspected_by', 'quality_passed', 'inspection_notes')
        }),
        ('Delivery Details', {
            'fields': ('delivery_note_number', 'vehicle_number', 'driver_name'),
            'classes': ('collapse',)
        }),
        ('Notes', {
            'fields': ('notes',),
            'classes': ('collapse',)
        }),
        ('Audit Information', {
            'fields': ('received_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def status_badge(self, obj):
        """Display status as colored badge"""
        colors = {
            'draft': 'gray',
            'received': 'blue',
            'inspected': 'orange',
            'accepted': 'green',
            'rejected': 'red',
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
        """Set received_by on new objects"""
        if not change:
            obj.received_by = request.user
        super().save_model(request, obj, form, change)

    actions = ['accept_grns', 'mark_as_inspected']

    def accept_grns(self, request, queryset):
        """Bulk accept selected GRNs"""
        accepted_count = 0
        error_count = 0

        for grn in queryset:
            try:
                if grn.status == 'inspected' and grn.quality_passed:
                    grn.accept(request.user)
                    accepted_count += 1
            except Exception as e:
                error_count += 1
                self.message_user(
                    request,
                    f"Error accepting GRN {grn.grn_number}: {str(e)}",
                    level='ERROR'
                )

        if accepted_count:
            self.message_user(
                request,
                f"Successfully accepted {accepted_count} GRN(s)",
                level='SUCCESS'
            )
        if error_count:
            self.message_user(
                request,
                f"Failed to accept {error_count} GRN(s)",
                level='WARNING'
            )

    accept_grns.short_description = "Accept selected GRNs"

    def mark_as_inspected(self, request, queryset):
        """Mark GRNs as inspected"""
        updated = queryset.filter(status='received').update(status='inspected')
        self.message_user(
            request,
            f"Marked {updated} GRN(s) as inspected",
            level='SUCCESS'
        )

    mark_as_inspected.short_description = "Mark as inspected"


@admin.register(PurchaseOrderItem)
class PurchaseOrderItemAdmin(admin.ModelAdmin):
    list_display = [
        'purchase_order',
        'line_number',
        'item_name',
        'quantity',
        'unit_price',
        'amount',
        'quantity_received',
        'quantity_pending_display'
    ]
    list_filter = ['purchase_order__status', 'purchase_order__order_date']
    search_fields = ['item_name', 'description', 'purchase_order__po_number']
    autocomplete_fields = ['purchase_order']
    ordering = ['purchase_order', 'line_number']
    # Enable search for autocomplete
    # Already has search_fields defined above

    def quantity_pending_display(self, obj):
        """Display pending quantity"""
        pending = obj.quantity_pending
        if pending > 0:
            return format_html(
                '<span style="color: orange; font-weight: bold;">{}</span>',
                pending
            )
        return format_html('<span style="color: green;">Completed</span>')

    quantity_pending_display.short_description = 'Pending'


@admin.register(GRNItem)
class GRNItemAdmin(admin.ModelAdmin):
    list_display = [
        'grn',
        'purchase_order_item',
        'quantity_received',
        'quantity_accepted',
        'quantity_rejected'
    ]
    list_filter = ['grn__status', 'grn__received_date']
    search_fields = ['grn__grn_number', 'purchase_order_item__item_name']
    autocomplete_fields = ['grn', 'purchase_order_item']
    ordering = ['grn', 'purchase_order_item']


@admin.register(PurchaseOrderTimeline)
class PurchaseOrderTimelineAdmin(admin.ModelAdmin):
    list_display = ['purchase_order', 'event_type', 'message', 'created_by', 'created_at']
    list_filter = ['event_type', 'created_at']
    search_fields = ['purchase_order__po_number', 'message']
    autocomplete_fields = ['purchase_order']
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


class BillPaymentInline(admin.TabularInline):
    """Inline admin for bill payments"""
    model = BillPayment
    extra = 0
    fields = [
        'payment_date',
        'amount',
        'payment_method',
        'reference_number',
        'cheque_number',
        'cheque_cleared',
        'notes'
    ]
    readonly_fields = ['created_by', 'created_at']

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(SupplierBill)
class SupplierBillAdmin(admin.ModelAdmin):
    list_display = [
        'internal_reference',
        'bill_number',
        'supplier',
        'purchase_order',
        'bill_date',
        'due_date',
        'status_badge',
        'total',
        'balance_due',
        'created_by'
    ]
    list_filter = ['status', 'bill_date', 'due_date', 'supplier']
    search_fields = [
        'internal_reference',
        'bill_number',
        'supplier__name',
        'supplier__supplier_code',
        'purchase_order__po_number'
    ]
    readonly_fields = [
        'internal_reference',
        'subtotal',
        'total',
        'amount_paid',
        'balance_due',
        'approved_by',
        'approved_at',
        'payment_date',
        'created_at',
        'updated_at'
    ]
    autocomplete_fields = ['supplier', 'purchase_order', 'approved_by']
    ordering = ['-bill_date', '-internal_reference']
    date_hierarchy = 'bill_date'
    inlines = [BillPaymentInline]

    fieldsets = (
        ('Bill Information', {
            'fields': ('internal_reference', 'bill_number', 'supplier', 'purchase_order', 'status')
        }),
        ('Dates', {
            'fields': ('bill_date', 'due_date', 'payment_date')
        }),
        ('Financial Details', {
            'fields': ('subtotal', 'tax_amount', 'discount_amount', 'total', 'amount_paid', 'balance_due')
        }),
        ('Approval', {
            'fields': ('approved_by', 'approved_at'),
            'classes': ('collapse',)
        }),
        ('Notes', {
            'fields': ('notes',),
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
            'partially_paid': 'orange',
            'paid': 'green',
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
        """Set created_by on new objects and generate internal reference"""
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)

    actions = ['approve_bills', 'void_bills']

    def approve_bills(self, request, queryset):
        """Bulk approve selected bills"""
        approved_count = 0
        error_count = 0

        for bill in queryset:
            try:
                if bill.status == 'draft':
                    bill.approve(request.user)
                    approved_count += 1
            except Exception as e:
                error_count += 1
                self.message_user(
                    request,
                    f"Error approving bill {bill.internal_reference}: {str(e)}",
                    level='ERROR'
                )

        if approved_count:
            self.message_user(
                request,
                f"Successfully approved {approved_count} bill(s)",
                level='SUCCESS'
            )
        if error_count:
            self.message_user(
                request,
                f"Failed to approve {error_count} bill(s)",
                level='WARNING'
            )

    approve_bills.short_description = "Approve selected bills"

    def void_bills(self, request, queryset):
        """Void selected bills"""
        voided_count = queryset.filter(
            status__in=['draft', 'approved']
        ).update(status='void')

        self.message_user(
            request,
            f"Voided {voided_count} bill(s)",
            level='SUCCESS'
        )

    void_bills.short_description = "Void selected bills"


@admin.register(BillPayment)
class BillPaymentAdmin(admin.ModelAdmin):
    list_display = [
        'bill',
        'payment_date',
        'amount',
        'payment_method',
        'reference_number',
        'cheque_status',
        'created_by'
    ]
    list_filter = ['payment_method', 'payment_date', 'cheque_cleared']
    search_fields = [
        'bill__internal_reference',
        'bill__bill_number',
        'reference_number',
        'cheque_number'
    ]
    readonly_fields = ['created_at']
    autocomplete_fields = ['bill']
    ordering = ['-payment_date']
    date_hierarchy = 'payment_date'

    fieldsets = (
        ('Payment Information', {
            'fields': ('bill', 'payment_date', 'amount', 'payment_method')
        }),
        ('Reference', {
            'fields': ('reference_number', 'notes')
        }),
        ('Cheque Details', {
            'fields': ('cheque_number', 'cheque_date', 'cheque_cleared', 'cheque_cleared_date'),
            'classes': ('collapse',)
        }),
        ('Audit Information', {
            'fields': ('created_by', 'created_at'),
            'classes': ('collapse',)
        }),
    )

    def cheque_status(self, obj):
        """Display cheque clearance status"""
        if obj.payment_method != 'cheque':
            return '-'

        if obj.cheque_cleared:
            return format_html(
                '<span style="color: green; font-weight: bold;">✓ Cleared</span>'
            )
        return format_html(
            '<span style="color: orange; font-weight: bold;">⏳ Pending</span>'
        )

    cheque_status.short_description = 'Cheque Status'

    def save_model(self, request, obj, form, change):
        """Set created_by on new objects"""
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)

    actions = ['mark_cheques_cleared']

    def mark_cheques_cleared(self, request, queryset):
        """Mark cheques as cleared"""
        from django.utils import timezone

        updated = queryset.filter(
            payment_method='cheque',
            cheque_cleared=False
        ).update(
            cheque_cleared=True,
            cheque_cleared_date=timezone.now().date()
        )

        self.message_user(
            request,
            f"Marked {updated} cheque(s) as cleared",
            level='SUCCESS'
        )

    mark_cheques_cleared.short_description = "Mark cheques as cleared"


@admin.register(SupplierCreditNote)
class SupplierCreditNoteAdmin(admin.ModelAdmin):
    list_display = [
        'credit_note_number',
        'supplier',
        'supplier_bill',
        'credit_note_date',
        'status_badge',
        'amount',
        'reason',
        'created_by'
    ]
    list_filter = ['status', 'credit_note_date', 'supplier']
    search_fields = [
        'credit_note_number',
        'supplier__name',
        'supplier__supplier_code',
        'reason',
        'description'
    ]
    readonly_fields = ['approved_by', 'approved_at', 'applied_at', 'created_at', 'updated_at']
    autocomplete_fields = ['supplier', 'supplier_bill', 'applied_to_bill', 'approved_by']
    ordering = ['-credit_note_date', '-credit_note_number']
    date_hierarchy = 'credit_note_date'

    fieldsets = (
        ('Credit Note Information', {
            'fields': ('credit_note_number', 'supplier', 'supplier_bill', 'status')
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
            'fields': ('applied_to_bill', 'applied_at'),
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
