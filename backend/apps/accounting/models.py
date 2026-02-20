from django.db import models, transaction
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.utils import timezone

User = get_user_model()


class AccountCategory(models.Model):
    """
    Main account categories: Asset, Liability, Equity, Income, Expense

    Defines the fundamental structure of the chart of accounts.
    Each category has a normal balance type (debit or credit).
    """
    ACCOUNT_TYPE_CHOICES = [
        ('debit_normal', 'Debit Normal'),    # Assets, Expenses
        ('credit_normal', 'Credit Normal'),  # Liabilities, Equity, Income
    ]

    code = models.CharField(max_length=10, unique=True, db_index=True)
    name = models.CharField(max_length=100)
    account_type = models.CharField(
        max_length=20,
        choices=ACCOUNT_TYPE_CHOICES,
        help_text="Normal balance type for this category"
    )
    display_order = models.IntegerField(
        default=0,
        help_text="Order for display in reports (lower = first)"
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Account Category"
        verbose_name_plural = "Account Categories"
        ordering = ['display_order', 'code']

    def __str__(self):
        return f"{self.code} - {self.name}"


class ChartOfAccounts(models.Model):
    """
    Individual accounts in the chart of accounts.

    Supports hierarchical structure with parent_account for sub-accounts.
    Tracks current balance (denormalized for performance).
    """
    account_code = models.CharField(
        max_length=20,
        unique=True,
        db_index=True,
        help_text="Unique account code (e.g., 1000, 1010)"
    )
    account_name = models.CharField(max_length=255)
    category = models.ForeignKey(
        AccountCategory,
        on_delete=models.PROTECT,
        related_name='accounts'
    )
    parent_account = models.ForeignKey(
        'self',
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name='sub_accounts',
        help_text="Parent account for hierarchical structure"
    )

    # Account behavior
    is_system_account = models.BooleanField(
        default=False,
        help_text="System accounts cannot be deleted"
    )
    is_active = models.BooleanField(default=True)
    allow_transactions = models.BooleanField(
        default=True,
        help_text="False for parent accounts that only group sub-accounts"
    )

    # Current balance (denormalized for performance)
    current_balance = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        help_text="Current account balance (updated by journal entries)"
    )

    # Audit fields
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='created_accounts'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Chart of Accounts"
        verbose_name_plural = "Chart of Accounts"
        ordering = ['account_code']
        indexes = [
            models.Index(fields=['account_code']),
            models.Index(fields=['category', 'is_active']),
        ]

    def __str__(self):
        return f"{self.account_code} - {self.account_name}"

    def clean(self):
        """Model-level validation"""
        super().clean()

        # Parent account cannot have transactions
        if self.parent_account and self.parent_account.allow_transactions:
            raise ValidationError(
                "Parent account must have allow_transactions=False"
            )

        # Cannot set self as parent
        if self.parent_account == self:
            raise ValidationError("Account cannot be its own parent")

    def update_balance(self, debit, credit):
        """
        Update account balance based on journal entry.

        Args:
            debit: Debit amount
            credit: Credit amount
        """
        if self.category.account_type == 'debit_normal':
            # Assets, Expenses: increase with debit, decrease with credit
            self.current_balance += debit - credit
        else:
            # Liabilities, Equity, Income: increase with credit, decrease with debit
            self.current_balance += credit - debit

        self.save(update_fields=['current_balance', 'updated_at'])


class AccountingAccountMapping(models.Model):
    """
    Mapping of accounting roles to specific chart of account entries.
    """
    KEY_CHOICES = [
        ('cash', 'Cash'),
        ('bank', 'Bank (Default)'),
        ('bank_savings', 'Bank Savings'),
        ('ar', 'Accounts Receivable'),
        ('ap', 'Accounts Payable'),
        ('sales', 'Sales Revenue'),
        ('expense', 'Expense / Purchases'),
        ('customer_advances', 'Customer Advances'),
        ('vat_payable', 'VAT Payable'),
        ('cheques_received', 'Cheques Received'),
        ('cheques_pending', 'Cheques Pending'),
        ('bank_charges', 'Bank Charges'),
        ('other_income', 'Other Income'),
        ('operating_expenses', 'Operating Expenses'),
    ]

    key = models.CharField(max_length=50, choices=KEY_CHOICES, unique=True, db_index=True)
    account = models.ForeignKey(
        ChartOfAccounts,
        on_delete=models.PROTECT,
        related_name='role_mappings'
    )
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Accounting Account Mapping"
        verbose_name_plural = "Accounting Account Mappings"
        ordering = ['key']

    def __str__(self):
        return f"{self.key} -> {self.account.account_code}"


class FiscalPeriod(models.Model):
    """
    Fiscal periods for organizing accounting entries.

    Supports period locking to prevent backdated entries in closed periods.
    """
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('closed', 'Closed'),
        ('locked', 'Locked'),
    ]

    name = models.CharField(
        max_length=100,
        help_text="Period name (e.g., 'January 2026', 'Q1 2026')"
    )
    start_date = models.DateField(db_index=True)
    end_date = models.DateField(db_index=True)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='open',
        db_index=True
    )

    # Audit
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='created_fiscal_periods'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='closed_fiscal_periods',
        null=True,
        blank=True
    )

    class Meta:
        verbose_name = "Fiscal Period"
        verbose_name_plural = "Fiscal Periods"
        ordering = ['-start_date']
        indexes = [
            models.Index(fields=['start_date', 'end_date']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.name} ({self.start_date} to {self.end_date})"

    @classmethod
    def get_open_period_for_date(cls, entry_date):
        """
        Return the open fiscal period covering the entry date, if any.
        """
        return cls.objects.filter(
            start_date__lte=entry_date,
            end_date__gte=entry_date,
            status='open'
        ).first()

    def clean(self):
        """Validate period dates"""
        super().clean()
        if self.start_date and self.end_date and self.start_date >= self.end_date:
            raise ValidationError("Start date must be before end date")

    def close_period(self, user):
        """Close the fiscal period"""
        if self.status != 'open':
            raise ValidationError(f"Cannot close period with status '{self.status}'")

        self.status = 'closed'
        self.closed_at = timezone.now()
        self.closed_by = user
        self.save()

    def lock_period(self):
        """Lock the fiscal period (prevents any modifications)"""
        if self.status != 'closed':
            raise ValidationError("Period must be closed before locking")

        self.status = 'locked'
        self.save()


class JournalEntry(models.Model):
    """
    Main journal entry header.

    Each business event creates one journal entry with 2+ lines.
    Entries are immutable once posted.
    """
    ENTRY_TYPE_CHOICES = [
        ('system', 'System Generated'),
        ('manual', 'Manual Entry'),
    ]

    SOURCE_TYPE_CHOICES = [
        ('sales_invoice', 'Sales Invoice'),
        ('invoice_payment', 'Invoice Payment'),
        ('sales_credit_note', 'Sales Credit Note'),
        ('pos_transaction', 'POS Transaction'),
        ('pos_zreport', 'POS Z Report'),
        ('supplier_bill', 'Supplier Bill'),
        ('bill_payment', 'Bill Payment'),
        ('supplier_credit_note', 'Supplier Credit Note'),
        ('payout_voucher', 'Payout Voucher'),
        ('bank_transaction', 'Bank Transaction'),
        ('manual', 'Manual Entry'),
        ('opening_balance', 'Opening Balance'),
    ]

    journal_number = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text="Unique journal number (e.g., JE-20260104-0001)"
    )
    entry_date = models.DateField(
        db_index=True,
        help_text="Date of the journal entry"
    )
    entry_type = models.CharField(
        max_length=20,
        choices=ENTRY_TYPE_CHOICES,
        default='system'
    )

    # Source document tracking
    source_type = models.CharField(
        max_length=50,
        choices=SOURCE_TYPE_CHOICES,
        db_index=True
    )
    event_type = models.CharField(
        max_length=100,
        db_index=True,
        help_text="Specific event type for idempotency (e.g., invoice_sent, bill_payment_created)"
    )
    source_id = models.IntegerField(
        null=True,
        blank=True,
        db_index=True,
        help_text="ID of source document"
    )
    source_reference = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text="Human-readable reference (e.g., invoice number)"
    )

    # Description
    description = models.TextField(help_text="Description of the transaction")

    # Status
    is_posted = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Posted entries are locked and immutable"
    )
    posted_at = models.DateTimeField(null=True, blank=True)

    # Totals (for validation)
    total_debit = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        help_text="Sum of all debit lines"
    )
    total_credit = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        help_text="Sum of all credit lines"
    )

    # Optional fiscal period
    fiscal_period = models.ForeignKey(
        FiscalPeriod,
        on_delete=models.PROTECT,
        related_name='journal_entries',
        null=True,
        blank=True
    )

    # Reversal tracking
    is_reversed = models.BooleanField(
        default=False,
        db_index=True,
        help_text="True if this entry has been reversed"
    )
    reversed_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='reversed_journal_entries',
        null=True,
        blank=True,
        help_text="User who created the reversal entry"
    )
    reversed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this entry was reversed"
    )
    reverses = models.ForeignKey(
        'self',
        on_delete=models.PROTECT,
        related_name='reversal_entries',
        null=True,
        blank=True,
        help_text="Original entry that this entry reverses (if this is a reversal)"
    )

    # Audit
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='created_journal_entries',
        null=True,
        blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Journal Entry"
        verbose_name_plural = "Journal Entries"
        ordering = ['-entry_date', '-journal_number']
        indexes = [
            models.Index(fields=['journal_number']),
            models.Index(fields=['entry_date', 'is_posted']),
            models.Index(fields=['source_type', 'source_id', 'event_type']),
            models.Index(fields=['is_posted']),
        ]
        # Ensure idempotency: one journal entry per source event
        constraints = [
            models.UniqueConstraint(
                fields=['source_type', 'source_id', 'event_type'],
                condition=models.Q(source_id__isnull=False),
                name='unique_source_event_journal'
            ),
            models.UniqueConstraint(
                fields=['source_type', 'event_type', 'source_reference'],
                condition=models.Q(source_id__isnull=True, source_reference__isnull=False),
                name='unique_source_reference_event'
            ),
        ]

    def __str__(self):
        return f"{self.journal_number} - {self.description[:50]}"

    def clean(self):
        """Validate that debits = credits"""
        super().clean()

        if self.total_debit != self.total_credit:
            raise ValidationError(
                f'Debits must equal credits. DR={self.total_debit}, CR={self.total_credit}'
            )

        # Cannot modify posted entries
        if self.pk and self.is_posted:
            original = JournalEntry.objects.get(pk=self.pk)
            if original.is_posted:
                raise ValidationError('Cannot modify posted journal entries')

    def save(self, *args, **kwargs):
        if self.pk:
            original = JournalEntry.objects.get(pk=self.pk)
            if original.is_posted:
                update_fields = kwargs.get('update_fields')
                allowed_fields = {'is_reversed', 'reversed_by', 'reversed_at', 'reverses'}
                if update_fields is None or not set(update_fields).issubset(allowed_fields):
                    raise ValidationError('Cannot modify posted journal entries')
        super().save(*args, **kwargs)

    def post(self):
        """
        Post the journal entry (make immutable and update account balances).

        Raises:
            ValidationError: If entry is already posted or unbalanced
        """
        with transaction.atomic():
            journal = JournalEntry.objects.select_for_update().get(pk=self.pk)

            if journal.is_posted:
                raise ValidationError('Entry already posted')

            if journal.total_debit != journal.total_credit:
                raise ValidationError(
                    f'Cannot post unbalanced entry. DR={journal.total_debit}, CR={journal.total_credit}'
                )

            if journal.fiscal_period:
                if journal.fiscal_period.status != 'open':
                    raise ValidationError(
                        f'Cannot post entry in {journal.fiscal_period.status} period {journal.fiscal_period.name}'
                    )
                if not (journal.fiscal_period.start_date <= journal.entry_date <= journal.fiscal_period.end_date):
                    raise ValidationError('Entry date is outside the assigned fiscal period')
            else:
                if FiscalPeriod.objects.exists():
                    open_period = FiscalPeriod.get_open_period_for_date(journal.entry_date)
                    if not open_period:
                        raise ValidationError('No open fiscal period for entry date')
                    journal.fiscal_period = open_period

            journal.is_posted = True
            journal.posted_at = timezone.now()
            journal.save(update_fields=['is_posted', 'posted_at', 'fiscal_period'])

            lines = list(journal.lines.select_related('account', 'account__category'))
            account_ids = {line.account_id for line in lines}
            accounts = {
                account.id: account
                for account in ChartOfAccounts.objects.select_for_update()
                .filter(id__in=account_ids)
                .select_related('category')
            }

            # Update account balances with row-level locks held
            for line in lines:
                account = accounts.get(line.account_id)
                if account:
                    account.update_balance(line.debit, line.credit)

            # Sync instance fields
            self.is_posted = journal.is_posted
            self.posted_at = journal.posted_at
            self.fiscal_period = journal.fiscal_period

    def reverse(self, user, reversal_date=None, description=None):
        """
        Create a reversal entry that undoes this journal entry.

        Args:
            user: User creating the reversal
            reversal_date: Date for the reversal (defaults to today)
            description: Custom description (defaults to "Reversal of {original}")

        Returns:
            The newly created reversal journal entry

        Raises:
            ValidationError: If entry is not posted, already reversed, or in locked period
        """
        if not self.is_posted:
            raise ValidationError('Cannot reverse unposted entry')

        if self.is_reversed:
            raise ValidationError('Entry has already been reversed')

        if self.reverses:
            raise ValidationError('Cannot reverse a reversal entry')

        # Check if fiscal period is locked
        if self.fiscal_period and self.fiscal_period.status == 'locked':
            raise ValidationError(
                f'Cannot reverse entry in locked period {self.fiscal_period.name}'
            )

        # Create reversal entry with swapped debits/credits
        from .services.journal_engine import JournalEngine

        reversal_description = description or f"Reversal of {self.journal_number}: {self.description}"
        lines_data = []

        for line in self.lines.all():
            lines_data.append({
                'account_code': line.account.account_code,
                'debit': line.credit,  # Swap debit and credit
                'credit': line.debit,
                'description': f"Reversal: {line.description or line.account.account_name}"
            })

        reversal_entry = JournalEngine.create_journal_entry(
            entry_date=reversal_date or timezone.now().date(),
            source_type='manual',
            source_id=None,
            event_type='reversal',
            description=reversal_description,
            lines_data=lines_data,
            created_by=user,
            auto_post=True
        )

        # Link the reversal
        reversal_entry.reverses = self
        reversal_entry.save(update_fields=['reverses'])

        # Mark original as reversed
        self.is_reversed = True
        self.reversed_by = user
        self.reversed_at = timezone.now()
        self.save(update_fields=['is_reversed', 'reversed_by', 'reversed_at'])

        return reversal_entry


class JournalLine(models.Model):
    """
    Individual debit/credit lines in a journal entry.

    Each journal entry must have at least 2 lines.
    Sum of debits must equal sum of credits.
    """
    journal_entry = models.ForeignKey(
        JournalEntry,
        on_delete=models.CASCADE,
        related_name='lines'
    )
    account = models.ForeignKey(
        ChartOfAccounts,
        on_delete=models.PROTECT,
        related_name='journal_lines'
    )

    # Amount (only one of debit or credit should be non-zero)
    debit = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        help_text="Debit amount (use 0 for credit lines)"
    )
    credit = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        help_text="Credit amount (use 0 for debit lines)"
    )

    # Description
    description = models.CharField(
        max_length=500,
        null=True,
        blank=True,
        help_text="Line-specific description"
    )

    class Meta:
        verbose_name = "Journal Line"
        verbose_name_plural = "Journal Lines"
        ordering = ['id']

    def __str__(self):
        amount = self.debit if self.debit > 0 else self.credit
        dr_cr = 'DR' if self.debit > 0 else 'CR'
        return f"{self.account.account_code} - {dr_cr} {amount}"

    def clean(self):
        """Validate that only one of debit/credit is non-zero"""
        super().clean()

        if self.debit > 0 and self.credit > 0:
            raise ValidationError('Line cannot have both debit and credit')

        if self.debit == 0 and self.credit == 0:
            raise ValidationError('Line must have either debit or credit')

        if self.debit < 0 or self.credit < 0:
            raise ValidationError('Debit and credit must be positive')

        # Validate account allows transactions
        if self.account and not self.account.allow_transactions:
            raise ValidationError(
                f"Account {self.account.account_code} does not allow transactions"
            )


class JournalFailure(models.Model):
    """
    Track journal creation failures for business events.

    Used to surface issues and support retries.
    """
    source_type = models.CharField(max_length=50, db_index=True)
    source_id = models.IntegerField(null=True, blank=True, db_index=True)
    event_type = models.CharField(max_length=100, db_index=True)

    last_error = models.TextField(null=True, blank=True)
    attempts = models.PositiveIntegerField(default=0)
    last_attempt_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Journal Failure"
        verbose_name_plural = "Journal Failures"
        indexes = [
            models.Index(fields=['source_type', 'source_id', 'event_type']),
            models.Index(fields=['last_attempt_at']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['source_type', 'source_id', 'event_type'],
                name='unique_journal_failure'
            )
        ]

    def __str__(self):
        return f"{self.source_type}:{self.source_id} ({self.event_type})"


class BankTransaction(models.Model):
    """
    Bank transactions that require approval before posting.

    Handles receipts, payments, and transfers between bank accounts.
    Creates journal entries automatically upon approval.
    """
    TRANSACTION_TYPE_CHOICES = [
        ('receipt', 'Receipt'),           # Money received into bank
        ('payment', 'Payment'),           # Money paid from bank
        ('transfer', 'Transfer'),         # Transfer between bank accounts
        ('bank_charge', 'Bank Charge'),   # Bank fees, charges
        ('interest', 'Interest'),         # Interest earned
        ('other', 'Other'),
    ]

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('pending', 'Pending Approval'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('posted', 'Posted to Ledger'),
    ]

    # Transaction details
    transaction_date = models.DateField(
        db_index=True,
        help_text="Date of the bank transaction"
    )
    transaction_type = models.CharField(
        max_length=20,
        choices=TRANSACTION_TYPE_CHOICES,
        db_index=True
    )
    reference_number = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        help_text="Bank reference, cheque number, or transaction ID"
    )
    description = models.TextField(help_text="Transaction description")

    # Bank account (from Chart of Accounts)
    bank_account = models.ForeignKey(
        ChartOfAccounts,
        on_delete=models.PROTECT,
        related_name='bank_transactions',
        help_text="Bank account (1010, 1020, etc.)"
    )

    # For transfers: destination bank account
    transfer_to_account = models.ForeignKey(
        ChartOfAccounts,
        on_delete=models.PROTECT,
        related_name='bank_transfers_received',
        null=True,
        blank=True,
        help_text="Destination account for transfers"
    )

    # Contra account (what account to debit/credit on the other side)
    contra_account = models.ForeignKey(
        ChartOfAccounts,
        on_delete=models.PROTECT,
        related_name='contra_bank_transactions',
        null=True,
        blank=True,
        help_text="Contra account for receipt/payment (e.g., AR, AP, Expense)"
    )

    # Amount
    amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        help_text="Transaction amount"
    )

    # Status and approval
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft',
        db_index=True
    )
    approved_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='approved_bank_transactions',
        null=True,
        blank=True
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(null=True, blank=True)

    # Link to journal entry (created on approval)
    journal_entry = models.OneToOneField(
        JournalEntry,
        on_delete=models.PROTECT,
        related_name='bank_transaction',
        null=True,
        blank=True
    )

    # Audit
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='created_bank_transactions'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Bank Transaction"
        verbose_name_plural = "Bank Transactions"
        ordering = ['-transaction_date', '-created_at']
        indexes = [
            models.Index(fields=['transaction_date', 'status']),
            models.Index(fields=['bank_account', 'transaction_date']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.get_transaction_type_display()} - {self.amount} on {self.transaction_date}"

    def clean(self):
        """Validate transaction data"""
        super().clean()

        # Validate amount is positive
        if self.amount and self.amount <= 0:
            raise ValidationError("Amount must be positive")

        # Validate bank account is actually a bank account
        if self.bank_account:
            if not self.bank_account.account_code.startswith(('1010', '1020')):
                raise ValidationError(
                    f"Selected account {self.bank_account.account_code} is not a bank account. "
                    "Use accounts starting with 1010 or 1020."
                )

        # Validate transfer has destination
        if self.transaction_type == 'transfer':
            if not self.transfer_to_account:
                raise ValidationError("Transfer transactions must specify a destination account")

            if self.transfer_to_account == self.bank_account:
                raise ValidationError("Cannot transfer to the same account")

            # Ensure destination is also a bank account
            if not self.transfer_to_account.account_code.startswith(('1010', '1020')):
                raise ValidationError(
                    f"Transfer destination {self.transfer_to_account.account_code} must be a bank account"
                )
        else:
            # Non-transfer transactions need contra account
            if not self.contra_account:
                raise ValidationError(
                    f"{self.get_transaction_type_display()} transactions must specify a contra account"
                )

        # Cannot approve/post if already posted
        if self.status == 'posted' and self.pk:
            original = BankTransaction.objects.get(pk=self.pk)
            if original.status == 'posted':
                raise ValidationError("Cannot modify posted transactions")

    def approve(self, user):
        """
        Approve the bank transaction and create journal entry.

        Args:
            user: User approving the transaction

        Returns:
            JournalEntry: Created journal entry
        """
        txn_id = self.pk
        with transaction.atomic():
            txn = BankTransaction.objects.select_for_update().get(pk=txn_id)

            # Idempotency: repeated approvals return the already-created journal.
            if txn.journal_entry_id:
                if txn.status != 'posted':
                    txn.status = 'posted'
                    txn.save(update_fields=['status'])
                self.refresh_from_db(fields=['status', 'approved_by', 'approved_at', 'journal_entry'])
                return txn.journal_entry

            if txn.status not in ['draft', 'pending', 'approved']:
                raise ValidationError(f"Cannot approve transaction with status '{txn.status}'")

            if txn.status in ['draft', 'pending']:
                txn.status = 'approved'
                txn.approved_by = user
                txn.approved_at = timezone.now()
                txn.save(update_fields=['status', 'approved_by', 'approved_at'])

            def _post_after_commit():
                from django.db import transaction as db_txn
                from apps.accounting.services.journal_engine import JournalEngine
                from apps.accounting.services.journal_failure import record_journal_failure, resolve_journal_failure

                try:
                    with db_txn.atomic():
                        locked = BankTransaction.objects.select_for_update().get(pk=txn_id)
                        if locked.journal_entry_id:
                            if locked.status != 'posted':
                                BankTransaction.objects.filter(pk=txn_id).update(status='posted')
                            resolve_journal_failure('bank_transaction', txn_id, 'bank_txn_approved')
                            return

                        journal = JournalEngine.handle_bank_transaction(locked)
                        BankTransaction.objects.filter(pk=txn_id, journal_entry__isnull=True).update(
                            journal_entry=journal,
                            status='posted',
                        )
                        resolve_journal_failure('bank_transaction', txn_id, 'bank_txn_approved')
                except Exception as e:
                    record_journal_failure('bank_transaction', txn_id, 'bank_txn_approved', e)

            transaction.on_commit(_post_after_commit)

        # Best effort: on_commit runs after the atomic commits (for outermost transactions).
        self.refresh_from_db(fields=['status', 'approved_by', 'approved_at', 'journal_entry'])
        return self.journal_entry

    def reject(self, user, reason):
        """
        Reject the bank transaction.

        Args:
            user: User rejecting the transaction
            reason: Reason for rejection
        """
        if self.status not in ['draft', 'pending']:
            raise ValidationError(f"Cannot reject transaction with status '{self.status}'")

        self.status = 'rejected'
        self.rejection_reason = reason
        self.approved_by = user  # Track who rejected it
        self.approved_at = timezone.now()
        self.save()

    def _get_journal_lines(self):
        """
        Generate journal lines based on transaction type.

        Returns:
            list: Journal lines data for JournalEngine
        """
        lines = []

        if self.transaction_type == 'receipt':
            # Receipt: DR Bank, CR Contra Account
            lines.append({
                'account_code': self.bank_account.account_code,
                'debit': self.amount,
                'credit': 0,
                'description': f"Receipt to {self.bank_account.account_name}"
            })
            lines.append({
                'account_code': self.contra_account.account_code,
                'debit': 0,
                'credit': self.amount,
                'description': self.description
            })

        elif self.transaction_type == 'payment':
            # Payment: DR Contra Account, CR Bank
            lines.append({
                'account_code': self.contra_account.account_code,
                'debit': self.amount,
                'credit': 0,
                'description': self.description
            })
            lines.append({
                'account_code': self.bank_account.account_code,
                'debit': 0,
                'credit': self.amount,
                'description': f"Payment from {self.bank_account.account_name}"
            })

        elif self.transaction_type == 'transfer':
            # Transfer: DR Destination Bank, CR Source Bank
            lines.append({
                'account_code': self.transfer_to_account.account_code,
                'debit': self.amount,
                'credit': 0,
                'description': f"Transfer to {self.transfer_to_account.account_name}"
            })
            lines.append({
                'account_code': self.bank_account.account_code,
                'debit': 0,
                'credit': self.amount,
                'description': f"Transfer from {self.bank_account.account_name}"
            })

        elif self.transaction_type == 'bank_charge':
            # Bank Charge: DR Bank Charges Expense, CR Bank
            lines.append({
                'account_code': self.contra_account.account_code or '5210',  # Bank Charges
                'debit': self.amount,
                'credit': 0,
                'description': self.description
            })
            lines.append({
                'account_code': self.bank_account.account_code,
                'debit': 0,
                'credit': self.amount,
                'description': f"Bank charge from {self.bank_account.account_name}"
            })

        elif self.transaction_type == 'interest':
            # Interest: DR Bank, CR Interest Income
            lines.append({
                'account_code': self.bank_account.account_code,
                'debit': self.amount,
                'credit': 0,
                'description': f"Interest to {self.bank_account.account_name}"
            })
            lines.append({
                'account_code': self.contra_account.account_code or '4900',  # Other Income
                'debit': 0,
                'credit': self.amount,
                'description': self.description
            })

        else:  # other
            # Other: Use contra account
            if self.contra_account:
                lines.append({
                    'account_code': self.bank_account.account_code,
                    'debit': self.amount,
                    'credit': 0,
                    'description': f"Transaction in {self.bank_account.account_name}"
                })
                lines.append({
                    'account_code': self.contra_account.account_code,
                    'debit': 0,
                    'credit': self.amount,
                    'description': self.description
                })

        return lines
