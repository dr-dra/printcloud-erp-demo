"""
Serializers for Accounting Module

Provides REST API serialization for:
- Chart of Accounts
- Journal Entries
- Fiscal Periods
- Bank Transactions
"""

from rest_framework import serializers
from decimal import Decimal
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


# ==============================================================================
# Chart of Accounts Serializers
# ==============================================================================

class AccountCategorySerializer(serializers.ModelSerializer):
    """Serializer for AccountCategory model."""

    class Meta:
        model = AccountCategory
        fields = [
            'id',
            'code',
            'name',
            'account_type',
            'display_order',
            'is_active',
        ]
        read_only_fields = ['id']


class ChartOfAccountsSerializer(serializers.ModelSerializer):
    """Serializer for ChartOfAccounts model."""

    category_name = serializers.CharField(source='category.name', read_only=True)
    parent_account_name = serializers.CharField(
        source='parent_account.account_name',
        read_only=True
    )

    class Meta:
        model = ChartOfAccounts
        fields = [
            'id',
            'account_code',
            'account_name',
            'category',
            'category_name',
            'parent_account',
            'parent_account_name',
            'is_system_account',
            'is_active',
            'allow_transactions',
            'current_balance',
            'created_by',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'current_balance',
            'created_at',
            'updated_at',
            'category_name',
            'parent_account_name',
            'created_by',
        ]

    def validate_account_code(self, value):
        """Ensure account code is unique."""
        if self.instance:
            # Update - exclude self from uniqueness check
            if ChartOfAccounts.objects.exclude(
                pk=self.instance.pk
            ).filter(account_code=value).exists():
                raise serializers.ValidationError(
                    "Account code must be unique"
                )
        else:
            # Create - check if code already exists
            if ChartOfAccounts.objects.filter(account_code=value).exists():
                raise serializers.ValidationError(
                    "Account code must be unique"
                )
        return value


class ChartOfAccountsListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for account lists."""

    category_name = serializers.CharField(source='category.name', read_only=True)

    class Meta:
        model = ChartOfAccounts
        fields = [
            'id',
            'account_code',
            'account_name',
            'category',
            'category_name',
            'current_balance',
            'is_active',
        ]


class AccountingAccountMappingSerializer(serializers.ModelSerializer):
    """Serializer for AccountingAccountMapping model."""

    account_code = serializers.CharField(source='account.account_code', read_only=True)
    account_name = serializers.CharField(source='account.account_name', read_only=True)

    class Meta:
        model = AccountingAccountMapping
        fields = [
            'id',
            'key',
            'account',
            'account_code',
            'account_name',
            'is_active',
            'updated_at',
        ]
        read_only_fields = ['id', 'account_code', 'account_name', 'updated_at']


# ==============================================================================
# Journal Entry Serializers
# ==============================================================================

class JournalLineSerializer(serializers.ModelSerializer):
    """Serializer for JournalLine model."""

    account_code = serializers.CharField(source='account.account_code', read_only=True)
    account_name = serializers.CharField(source='account.account_name', read_only=True)

    class Meta:
        model = JournalLine
        fields = [
            'id',
            'account',
            'account_code',
            'account_name',
            'debit',
            'credit',
            'description',
        ]
        read_only_fields = ['id', 'account_code', 'account_name']

    def validate(self, data):
        """Ensure only one of debit or credit is non-zero."""
        debit = data.get('debit', Decimal('0'))
        credit = data.get('credit', Decimal('0'))

        if debit > 0 and credit > 0:
            raise serializers.ValidationError(
                "A line cannot have both debit and credit"
            )

        if debit == 0 and credit == 0:
            raise serializers.ValidationError(
                "A line must have either debit or credit"
            )

        return data


class JournalEntrySerializer(serializers.ModelSerializer):
    """Serializer for JournalEntry model with inline lines."""

    lines = JournalLineSerializer(many=True)
    created_by_name = serializers.CharField(
        source='created_by.get_full_name',
        read_only=True
    )
    reversed_by_name = serializers.CharField(
        source='reversed_by.get_full_name',
        read_only=True
    )
    reverses_journal_number = serializers.CharField(
        source='reverses.journal_number',
        read_only=True
    )

    class Meta:
        model = JournalEntry
        fields = [
            'id',
            'journal_number',
            'entry_date',
            'entry_type',
            'source_type',
            'event_type',
            'source_id',
            'source_reference',
            'description',
            'is_posted',
            'posted_at',
            'total_debit',
            'total_credit',
            'fiscal_period',
            'is_reversed',
            'reversed_by',
            'reversed_by_name',
            'reversed_at',
            'reverses',
            'reverses_journal_number',
            'created_by',
            'created_by_name',
            'created_at',
            'lines',
        ]
        read_only_fields = [
            'id',
            'journal_number',
            'is_posted',
            'posted_at',
            'total_debit',
            'total_credit',
            'is_reversed',
            'reversed_by',
            'reversed_by_name',
            'reversed_at',
            'reverses_journal_number',
            'created_at',
            'created_by_name',
        ]

    def validate_lines(self, lines_data):
        """Validate that journal has at least 2 lines and debits = credits."""
        if len(lines_data) < 2:
            raise serializers.ValidationError(
                "Journal entry must have at least 2 lines"
            )

        total_debit = sum(
            line.get('debit', Decimal('0')) for line in lines_data
        )
        total_credit = sum(
            line.get('credit', Decimal('0')) for line in lines_data
        )

        if total_debit != total_credit:
            raise serializers.ValidationError(
                f"Debits ({total_debit}) must equal credits ({total_credit})"
            )

        return lines_data

    def create(self, validated_data):
        """Create journal entry with lines."""
        from .services.journal_engine import JournalEngine

        lines_data = validated_data.pop('lines')
        created_by = validated_data.get('created_by')

        # Convert lines_data to format expected by JournalEngine
        formatted_lines = []
        for line_data in lines_data:
            account = line_data.get('account')
            formatted_lines.append({
                'account_code': account.account_code,
                'debit': line_data.get('debit', Decimal('0')),
                'credit': line_data.get('credit', Decimal('0')),
                'description': line_data.get('description', ''),
            })

        # Use JournalEngine to create entry. Preserve source_reference/fiscal_period so callers
        # can rely on DB-level idempotency (unique_source_reference_event) when source_id is null.
        journal = JournalEngine.create_journal_entry(
            entry_date=validated_data['entry_date'],
            source_type=validated_data['source_type'],
            source_id=validated_data.get('source_id'),
            event_type=validated_data.get('event_type') or 'manual_entry',
            source_reference=validated_data.get('source_reference'),
            description=validated_data['description'],
            lines_data=formatted_lines,
            created_by=created_by,
            auto_post=False,  # Don't auto-post for manual entries
            fiscal_period=validated_data.get('fiscal_period'),
        )

        return journal


class JournalEntryListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for journal entry lists."""

    created_by_name = serializers.CharField(
        source='created_by.get_full_name',
        read_only=True
    )

    class Meta:
        model = JournalEntry
        fields = [
            'id',
            'journal_number',
            'entry_date',
            'entry_type',
            'source_type',
            'event_type',
            'description',
            'total_debit',
            'total_credit',
            'is_posted',
            'is_reversed',
            'created_by_name',
        ]


# ==============================================================================
# Fiscal Period Serializers
# ==============================================================================

class FiscalPeriodSerializer(serializers.ModelSerializer):
    """Serializer for FiscalPeriod model."""

    period_name = serializers.CharField(source='name')
    closed_by_name = serializers.CharField(
        source='closed_by.get_full_name',
        read_only=True
    )

    class Meta:
        model = FiscalPeriod
        fields = [
            'id',
            'period_name',
            'start_date',
            'end_date',
            'status',
            'closed_at',
            'closed_by',
            'closed_by_name',
        ]
        read_only_fields = [
            'id',
            'closed_at',
            'closed_by_name',
        ]

    def validate(self, data):
        """Validate date range."""
        if data.get('start_date') and data.get('end_date'):
            if data['start_date'] >= data['end_date']:
                raise serializers.ValidationError(
                    "Start date must be before end date"
                )
        return data


# ==============================================================================
# Bank Transaction Serializers
# ==============================================================================

class BankTransactionSerializer(serializers.ModelSerializer):
    """Serializer for BankTransaction model."""

    created_by_name = serializers.CharField(
        source='created_by.get_full_name',
        read_only=True
    )
    approved_by_name = serializers.CharField(
        source='approved_by.get_full_name',
        read_only=True
    )
    journal_entry_number = serializers.CharField(
        source='journal_entry.journal_number',
        read_only=True
    )

    class Meta:
        model = BankTransaction
        fields = [
            'id',
            'transaction_date',
            'transaction_type',
            'amount',
            'description',
            'reference_number',
            'status',
            'approved_by',
            'approved_by_name',
            'approved_at',
            'journal_entry',
            'journal_entry_number',
            'created_by',
            'created_by_name',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'status',
            'approved_by',
            'approved_by_name',
            'approved_at',
            'journal_entry',
            'journal_entry_number',
            'created_by_name',
            'created_at',
            'updated_at',
        ]


# ==============================================================================
# Journal Failure Serializers
# ==============================================================================

class JournalFailureSerializer(serializers.ModelSerializer):
    """Serializer for JournalFailure model."""

    class Meta:
        model = JournalFailure
        fields = [
            'id',
            'source_type',
            'source_id',
            'event_type',
            'last_error',
            'attempts',
            'last_attempt_at',
            'resolved_at',
            'created_at',
        ]
        read_only_fields = fields
