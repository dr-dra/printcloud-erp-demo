from django.contrib import admin
from .models import (
    CashDrawerSession, POSTransaction, POSTransactionItem,
    POSPayment, CustomerAccount, CustomerAccountTransaction,
    POSProduct, POSCategory, POSLocation, POSStockMovement
)


@admin.register(CashDrawerSession)
class CashDrawerSessionAdmin(admin.ModelAdmin):
    list_display = ('session_number', 'user', 'location', 'status', 'opened_at', 'closed_at',
                    'opening_balance', 'expected_balance', 'actual_balance', 'variance')
    list_filter = ('status', 'location', 'opened_at')
    search_fields = ('session_number', 'user__email', 'location__code')
    readonly_fields = ('opened_at', 'variance')
    date_hierarchy = 'opened_at'

    fieldsets = (
        ('Session Information', {
            'fields': ('session_number', 'user', 'location', 'status')
        }),
        ('Opening', {
            'fields': ('opened_at', 'opening_balance', 'opening_notes')
        }),
        ('Closing', {
            'fields': ('closed_at', 'expected_balance', 'actual_balance', 'variance', 'closing_notes'),
            'classes': ('collapse',)
        }),
        ('Reconciliation', {
            'fields': ('reconciled_at', 'reconciled_by'),
            'classes': ('collapse',)
        }),
    )


class POSTransactionItemInline(admin.TabularInline):
    model = POSTransactionItem
    extra = 0
    readonly_fields = ('item_name', 'sku', 'line_total', 'profit')
    fields = ('product', 'item_name', 'quantity', 'unit_price', 'tax_rate',
              'tax_amount', 'discount_amount', 'line_total')


class POSPaymentInline(admin.TabularInline):
    model = POSPayment
    extra = 0
    readonly_fields = ('created_at',)
    fields = ('payment_method', 'amount', 'reference_number', 'created_by')


@admin.register(POSTransaction)
class POSTransactionAdmin(admin.ModelAdmin):
    list_display = ('receipt_number', 'customer', 'location', 'transaction_date', 'total',
                    'status', 'created_by')
    list_filter = ('status', 'location', 'transaction_date')
    search_fields = ('receipt_number', 'customer__name', 'notes')
    readonly_fields = ('transaction_date', 'updated_at', 'total_paid', 'change_given')
    date_hierarchy = 'transaction_date'
    inlines = [POSTransactionItemInline, POSPaymentInline]

    fieldsets = (
        ('Receipt Information', {
            'fields': ('receipt_number', 'cash_drawer_session', 'location', 'customer')
        }),
        ('Financial Summary', {
            'fields': ('subtotal', 'discount_amount', 'discount_reason', 'tax_amount', 'total',
                       'total_paid', 'change_given')
        }),
        ('Status', {
            'fields': ('status', 'transaction_date', 'notes')
        }),
        ('Void Information', {
            'fields': ('voided_at', 'voided_by', 'void_reason'),
            'classes': ('collapse',)
        }),
        ('Audit', {
            'fields': ('created_by', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(POSTransactionItem)
class POSTransactionItemAdmin(admin.ModelAdmin):
    list_display = ('transaction', 'item_name', 'sku', 'quantity', 'unit_price',
                    'tax_amount', 'line_total', 'profit')
    list_filter = ('transaction__location', 'transaction__transaction_date')
    search_fields = ('transaction__receipt_number', 'item_name', 'sku')
    readonly_fields = ('profit',)

    fieldsets = (
        ('Transaction', {
            'fields': ('transaction', 'product')
        }),
        ('Item Details', {
            'fields': ('item_name', 'sku', 'quantity')
        }),
        ('Pricing', {
            'fields': ('unit_price', 'tax_rate', 'tax_amount', 'discount_amount', 'line_total')
        }),
        ('Cost & Profit', {
            'fields': ('unit_cost', 'profit', 'notes'),
            'classes': ('collapse',)
        }),
    )


@admin.register(POSPayment)
class POSPaymentAdmin(admin.ModelAdmin):
    list_display = ('transaction', 'payment_method', 'amount', 'reference_number',
                    'created_at', 'created_by')
    list_filter = ('payment_method', 'created_at')
    search_fields = ('transaction__receipt_number', 'reference_number', 'notes')
    readonly_fields = ('created_at',)
    date_hierarchy = 'created_at'

    fieldsets = (
        ('Payment Details', {
            'fields': ('transaction', 'payment_method', 'amount', 'reference_number')
        }),
        ('Account Tracking', {
            'fields': ('customer_account_balance_before', 'customer_account_balance_after'),
            'classes': ('collapse',)
        }),
        ('Notes & Audit', {
            'fields': ('notes', 'created_at', 'created_by')
        }),
    )


class CustomerAccountTransactionInline(admin.TabularInline):
    model = CustomerAccountTransaction
    extra = 0
    readonly_fields = ('created_at', 'balance_before', 'balance_after')
    fields = ('transaction_type', 'amount', 'balance_before', 'balance_after',
              'reference_number', 'due_date', 'created_at')


@admin.register(CustomerAccount)
class CustomerAccountAdmin(admin.ModelAdmin):
    list_display = ('customer', 'current_balance', 'credit_limit', 'available_credit',
                    'is_active', 'is_suspended', 'last_transaction_date')
    list_filter = ('is_active', 'is_suspended')
    search_fields = ('customer__name', 'customer__email')
    readonly_fields = ('available_credit', 'is_over_limit', 'created_at', 'updated_at')
    inlines = [CustomerAccountTransactionInline]

    fieldsets = (
        ('Customer', {
            'fields': ('customer',)
        }),
        ('Balance & Credit', {
            'fields': ('current_balance', 'credit_limit', 'available_credit', 'is_over_limit')
        }),
        ('Settings', {
            'fields': ('payment_term_days', 'is_active', 'is_suspended')
        }),
        ('Activity', {
            'fields': ('last_transaction_date', 'last_payment_date'),
            'classes': ('collapse',)
        }),
        ('Audit', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(CustomerAccountTransaction)
class CustomerAccountTransactionAdmin(admin.ModelAdmin):
    list_display = ('account', 'transaction_type', 'amount', 'balance_after',
                    'pos_transaction', 'due_date', 'created_at')
    list_filter = ('transaction_type', 'created_at', 'due_date')
    search_fields = ('account__customer__name', 'reference_number', 'notes')
    readonly_fields = ('created_at',)
    date_hierarchy = 'created_at'

    fieldsets = (
        ('Account', {
            'fields': ('account', 'transaction_type')
        }),
        ('Amount & Balance', {
            'fields': ('amount', 'balance_before', 'balance_after')
        }),
        ('Reference', {
            'fields': ('pos_transaction', 'reference_number', 'due_date', 'notes')
        }),
        ('Audit', {
            'fields': ('created_at', 'created_by'),
            'classes': ('collapse',)
        }),
    )


@admin.register(POSCategory)
class POSCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_active', 'display_order', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('name', 'description')
    ordering = ('display_order', 'name')

    fieldsets = (
        ('Category Information', {
            'fields': ('name', 'description', 'is_active', 'display_order')
        }),
        ('Audit', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(POSLocation)
class POSLocationAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'is_active', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('name', 'code', 'address')

    fieldsets = (
        ('Location Information', {
            'fields': ('name', 'code', 'address', 'is_active')
        }),
        ('Audit', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(POSProduct)
class POSProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'sku', 'category', 'default_selling_price', 'quantity_on_hand',
                    'is_quick_access', 'is_active', 'sales_count')
    list_filter = ('is_active', 'is_quick_access', 'track_inventory', 'category')
    search_fields = ('name', 'sku', 'description')
    readonly_fields = ('sales_count', 'created_at', 'updated_at')

    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'sku', 'description', 'category')
        }),
        ('Pricing', {
            'fields': ('default_selling_price', 'unit_cost', 'tax_rate')
        }),
        ('Quick Access Configuration', {
            'fields': ('is_quick_access', 'default_quantity'),
            'classes': ('collapse',)
        }),
        ('Inventory Management', {
            'fields': ('track_inventory', 'quantity_on_hand', 'allow_backorder', 'low_stock_threshold'),
            'classes': ('collapse',)
        }),
        ('Status & Metadata', {
            'fields': ('is_active', 'sales_count', 'created_by', 'created_at', 'updated_at')
        }),
    )


@admin.register(POSStockMovement)
class POSStockMovementAdmin(admin.ModelAdmin):
    list_display = ('product', 'location', 'movement_type', 'quantity', 'created_at', 'created_by')
    list_filter = ('movement_type', 'location', 'created_at')
    search_fields = ('product__name', 'product__sku', 'notes', 'reference_type')
    readonly_fields = ('created_at',)
    date_hierarchy = 'created_at'

    fieldsets = (
        ('Movement Details', {
            'fields': ('product', 'location', 'movement_type', 'quantity')
        }),
        ('Reference', {
            'fields': ('reference_type', 'reference_id', 'notes')
        }),
        ('Audit', {
            'fields': ('created_at', 'created_by'),
            'classes': ('collapse',)
        }),
    )
