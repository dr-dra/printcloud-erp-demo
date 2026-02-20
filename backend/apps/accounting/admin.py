from django.contrib import admin
from django.utils.html import format_html
from .models import (
    AccountCategory,
    ChartOfAccounts,
    AccountingAccountMapping,
    FiscalPeriod,
    JournalEntry,
    JournalLine,
    BankTransaction,
    JournalFailure
)


@admin.register(AccountCategory)
class AccountCategoryAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'account_type', 'display_order', 'is_active']
    list_filter = ['account_type', 'is_active']
    search_fields = ['code', 'name']
    ordering = ['display_order', 'code']


@admin.register(ChartOfAccounts)
class ChartOfAccountsAdmin(admin.ModelAdmin):
    list_display = [
        'account_code',
        'account_name',
        'category',
        'current_balance',
        'is_active',
        'allow_transactions'
    ]
    list_filter = ['category', 'is_active', 'is_system_account', 'allow_transactions']
    search_fields = ['account_code', 'account_name']
    readonly_fields = ['current_balance', 'created_at', 'updated_at', 'created_by']
    ordering = ['account_code']
    # Enable autocomplete for foreign key lookups
    autocomplete_fields = []  # No foreign keys to autocomplete in this model

    fieldsets = (
        ('Basic Information', {
            'fields': ('account_code', 'account_name', 'category', 'parent_account')
        }),
        ('Account Settings', {
            'fields': ('is_system_account', 'is_active', 'allow_transactions')
        }),
        ('Balance', {
            'fields': ('current_balance',),
            'description': 'Current balance is automatically updated by journal entries'
        }),
        ('Audit Information', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def save_model(self, request, obj, form, change):
        """Set created_by on new objects"""
        if not change:  # New object
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(FiscalPeriod)
class FiscalPeriodAdmin(admin.ModelAdmin):
    list_display = ['name', 'start_date', 'end_date', 'status', 'created_at']
    list_filter = ['status', 'start_date']
    search_fields = ['name']
    readonly_fields = ['created_at', 'updated_at', 'created_by', 'closed_at', 'closed_by']
    ordering = ['-start_date']

    fieldsets = (
        ('Period Information', {
            'fields': ('name', 'start_date', 'end_date', 'status')
        }),
        ('Audit Information', {
            'fields': ('created_by', 'created_at', 'updated_at', 'closed_by', 'closed_at'),
            'classes': ('collapse',)
        }),
    )

    def save_model(self, request, obj, form, change):
        """Set created_by on new objects"""
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


class JournalLineInline(admin.TabularInline):
    """Inline admin for journal lines"""
    model = JournalLine
    extra = 2
    fields = ['account', 'debit', 'credit', 'description']
    autocomplete_fields = ['account']


@admin.register(JournalEntry)
class JournalEntryAdmin(admin.ModelAdmin):
    list_display = [
        'journal_number',
        'entry_date',
        'entry_type',
        'source_type',
        'event_type',
        'total_debit',
        'total_credit',
        'is_posted',
        'created_at'
    ]
    list_filter = ['entry_type', 'source_type', 'event_type', 'is_posted', 'entry_date']
    search_fields = ['journal_number', 'description', 'source_reference', 'event_type']
    readonly_fields = ['journal_number', 'is_posted', 'posted_at', 'created_at', 'created_by']
    ordering = ['-entry_date', '-journal_number']
    inlines = [JournalLineInline]

    fieldsets = (
        ('Entry Information', {
            'fields': ('journal_number', 'entry_date', 'entry_type', 'fiscal_period')
        }),
        ('Source Document', {
            'fields': ('source_type', 'event_type', 'source_id', 'source_reference')
        }),
        ('Description', {
            'fields': ('description',)
        }),
        ('Totals', {
            'fields': ('total_debit', 'total_credit'),
            'description': 'Totals are automatically calculated from journal lines'
        }),
        ('Status', {
            'fields': ('is_posted', 'posted_at')
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

    def has_delete_permission(self, request, obj=None):
        """Prevent deletion of posted entries"""
        if obj and obj.is_posted:
            return False
        return super().has_delete_permission(request, obj)


@admin.register(JournalLine)
class JournalLineAdmin(admin.ModelAdmin):
    list_display = ['journal_entry', 'account', 'debit', 'credit', 'description']
    list_filter = ['journal_entry__entry_date', 'account__category']
    search_fields = ['journal_entry__journal_number', 'account__account_code', 'description']
    autocomplete_fields = ['journal_entry', 'account']
    ordering = ['-journal_entry__entry_date', 'id']


@admin.register(BankTransaction)
class BankTransactionAdmin(admin.ModelAdmin):
    list_display = [
        'transaction_date',
        'transaction_type',
        'bank_account',
        'amount',
        'approved_by',
        'created_by'
    ]
    list_filter = ['transaction_type', 'status', 'transaction_date', 'bank_account']
    search_fields = ['description', 'reference_number', 'bank_account__account_name']
    readonly_fields = [
        'status',
        'approved_by',
        'approved_at',
        'journal_entry',
        'created_at',
        'updated_at',
        'created_by'
    ]
    autocomplete_fields = ['bank_account', 'transfer_to_account', 'contra_account']
    ordering = ['-transaction_date', '-created_at']
    date_hierarchy = 'transaction_date'

    fieldsets = (
        ('Transaction Information', {
            'fields': (
                'transaction_date',
                'transaction_type',
                'reference_number',
                'description'
            )
        }),
        ('Accounts', {
            'fields': (
                'bank_account',
                'transfer_to_account',
                'contra_account'
            ),
            'description': 'Select bank account and contra account or transfer destination'
        }),
        ('Amount', {
            'fields': ('amount',)
        }),
        ('Status & Approval', {
            'fields': (
                'status',
                'approved_by',
                'approved_at',
                'rejection_reason'
            )
        }),
        ('Journal Entry Link', {
            'fields': ('journal_entry',),
            'description': 'Journal entry is created automatically upon approval'
        }),
        ('Audit Information', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(AccountingAccountMapping)
class AccountingAccountMappingAdmin(admin.ModelAdmin):
    list_display = ['key', 'account', 'is_active', 'updated_at']
    list_filter = ['is_active']
    search_fields = ['key', 'account__account_code', 'account__account_name']
    autocomplete_fields = ['account']
    ordering = ['key']


@admin.register(JournalFailure)
class JournalFailureAdmin(admin.ModelAdmin):
    list_display = ['source_type', 'source_id', 'event_type', 'attempts', 'last_attempt_at', 'resolved_at']
    list_filter = ['source_type', 'event_type', 'resolved_at']
    search_fields = ['source_type', 'source_id', 'event_type', 'last_error']
    readonly_fields = ['created_at', 'last_attempt_at', 'resolved_at', 'attempts', 'last_error']
    ordering = ['-last_attempt_at', '-created_at']

    def status_badge(self, obj):
        """Display status as colored badge"""
        colors = {
            'draft': 'gray',
            'pending': 'orange',
            'approved': 'green',
            'rejected': 'red',
            'posted': 'blue',
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

    def has_delete_permission(self, request, obj=None):
        """Prevent deletion of posted transactions"""
        if obj and obj.status == 'posted':
            return False
        return super().has_delete_permission(request, obj)

    actions = ['approve_transactions', 'mark_as_pending']

    def approve_transactions(self, request, queryset):
        """Bulk approve selected transactions"""
        approved_count = 0
        error_count = 0

        for transaction in queryset:
            try:
                if transaction.status in ['draft', 'pending']:
                    transaction.approve(request.user)
                    approved_count += 1
            except Exception as e:
                error_count += 1
                self.message_user(
                    request,
                    f"Error approving transaction {transaction.id}: {str(e)}",
                    level='ERROR'
                )

        if approved_count:
            self.message_user(
                request,
                f"Successfully approved {approved_count} transaction(s)",
                level='SUCCESS'
            )
        if error_count:
            self.message_user(
                request,
                f"Failed to approve {error_count} transaction(s)",
                level='WARNING'
            )

    approve_transactions.short_description = "Approve selected transactions"

    def mark_as_pending(self, request, queryset):
        """Mark draft transactions as pending approval"""
        updated = queryset.filter(status='draft').update(status='pending')
        self.message_user(
            request,
            f"Marked {updated} transaction(s) as pending approval",
            level='SUCCESS'
        )

    mark_as_pending.short_description = "Mark as pending approval"
