from django.contrib import admin
from .models import SalesQuotation, SalesQuotationItem, SalesQuotationTimeline


class SalesQuotationItemInline(admin.TabularInline):
    model = SalesQuotationItem
    extra = 0
    readonly_fields = ('cs_total',)


class SalesQuotationTimelineInline(admin.TabularInline):
    model = SalesQuotationTimeline
    extra = 0
    readonly_fields = ('created_at',)
    ordering = ['-created_at']


@admin.register(SalesQuotation)
class SalesQuotationAdmin(admin.ModelAdmin):
    list_display = ('quot_number', 'customer', 'date', 'total', 'finalized', 'is_active')
    list_filter = ('finalized', 'is_active', 'date', 'number_type')
    search_fields = ('quot_number', 'customer__name', 'notes')
    readonly_fields = ('created_by', 'created_date', 'updated_date')
    inlines = [SalesQuotationItemInline, SalesQuotationTimelineInline]
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('quot_number', 'number_type', 'customer', 'date', 'required_date')
        }),
        ('Financial Details', {
            'fields': ('delivery_charge', 'discount', 'total', 'total_applied', 'delivery_applied')
        }),
        ('Additional Information', {
            'fields': ('terms', 'notes', 'costing', 'finalized', 'is_active')
        }),
        ('Audit Information', {
            'fields': ('created_by', 'created_date', 'updated_date'),
            'classes': ('collapse',)
        }),
    )


@admin.register(SalesQuotationItem)
class SalesQuotationItemAdmin(admin.ModelAdmin):
    list_display = ('quotation', 'item', 'quantity', 'unit_price', 'price')
    list_filter = ('quotation__finalized',)
    search_fields = ('item', 'description', 'quotation__quot_number')
    readonly_fields = ('cs_total',)


@admin.register(SalesQuotationTimeline)
class SalesQuotationTimelineAdmin(admin.ModelAdmin):
    list_display = ('quotation', 'event_type', 'message', 'created_at', 'created_by')
    list_filter = ('event_type', 'created_at')
    search_fields = ('quotation__quot_number', 'message', 'created_by__email')
    readonly_fields = ('created_at',)