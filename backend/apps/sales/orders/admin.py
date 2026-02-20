from django.contrib import admin
from .models import SalesOrder, SalesOrderItem, SalesOrderTimeline, OrderAttachment, OrderShare


class SalesOrderItemInline(admin.TabularInline):
    model = SalesOrderItem
    extra = 0
    readonly_fields = ('amount', 'cs_total')


class SalesOrderTimelineInline(admin.TabularInline):
    model = SalesOrderTimeline
    extra = 0
    readonly_fields = ('created_at',)
    ordering = ['-created_at']


class OrderAttachmentInline(admin.TabularInline):
    model = OrderAttachment
    extra = 0
    readonly_fields = ('uploaded_at',)


@admin.register(SalesOrder)
class SalesOrderAdmin(admin.ModelAdmin):
    list_display = ('order_number', 'customer', 'order_date', 'status', 'net_total', 'is_active')
    list_filter = ('status', 'is_active', 'order_date', 'number_type')
    search_fields = ('order_number', 'customer__name', 'notes', 'po_so_number')
    readonly_fields = ('created_by', 'created_date', 'updated_date', 'updated_by')
    inlines = [SalesOrderItemInline, SalesOrderTimelineInline, OrderAttachmentInline]

    fieldsets = (
        ('Basic Information', {
            'fields': ('order_number', 'number_type', 'customer', 'quotation', 'order_date', 'required_date')
        }),
        ('Status & Production', {
            'fields': ('status', 'production_start_date', 'completion_date', 'delivered_date')
        }),
        ('Financial Details', {
            'fields': ('subtotal', 'discount', 'delivery_charge', 'net_total')
        }),
        ('Additional Information', {
            'fields': ('po_so_number', 'notes', 'customer_notes', 'delivery_instructions', 'costing')
        }),
        ('Preparation Details', {
            'fields': ('prepared_by', 'prepared_from', 'prepared_reff', 'is_active'),
            'classes': ('collapse',)
        }),
        ('Legacy Data', {
            'fields': ('legacy_order_id',),
            'classes': ('collapse',)
        }),
        ('Audit Information', {
            'fields': ('created_by', 'created_date', 'updated_by', 'updated_date'),
            'classes': ('collapse',)
        }),
    )


@admin.register(SalesOrderItem)
class SalesOrderItemAdmin(admin.ModelAdmin):
    list_display = ('order', 'item_name', 'quantity', 'unit_price', 'amount', 'job_ticket_generated')
    list_filter = ('job_ticket_generated', 'item_status')
    search_fields = ('item_name', 'description', 'order__order_number')
    readonly_fields = ('amount', 'cs_total')


@admin.register(SalesOrderTimeline)
class SalesOrderTimelineAdmin(admin.ModelAdmin):
    list_display = ('order', 'event_type', 'message', 'created_at', 'created_by')
    list_filter = ('event_type', 'created_at')
    search_fields = ('order__order_number', 'message', 'created_by__email')
    readonly_fields = ('created_at',)


@admin.register(OrderAttachment)
class OrderAttachmentAdmin(admin.ModelAdmin):
    list_display = ('order', 'title', 'file_type', 'uploaded_by', 'uploaded_at')
    list_filter = ('file_type', 'uploaded_at')
    search_fields = ('title', 'description', 'order__order_number')
    readonly_fields = ('uploaded_at',)


@admin.register(OrderShare)
class OrderShareAdmin(admin.ModelAdmin):
    list_display = ('order', 'token', 'created_at', 'expires_at', 'view_count')
    list_filter = ('created_at', 'expires_at')
    search_fields = ('order__order_number', 'token')
    readonly_fields = ('created_at', 'view_count', 'last_viewed_at')
