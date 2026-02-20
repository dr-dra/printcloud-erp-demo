from decimal import Decimal
import secrets
import string
from django.db import models
from django.db.models import Q
from django.utils import timezone
from django.core.exceptions import ValidationError
from apps.users.models import User
from apps.customers.models import Customer
from apps.sales.orders.models import SalesOrder
from apps.sales.models import FinishedProduct

class SalesInvoice(models.Model):
    """
    Sales Invoices - Financial records for billing customers.

    Invoice Types:
    - proforma: Not a tax invoice, payments go to Customer Advances
    - tax_invoice: Legal VAT trigger, creates AR and Sales entries
    """
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('sent', 'Sent'),
        ('partially_paid', 'Partially Paid'),
        ('paid', 'Paid'),
        ('overdue', 'Overdue'),
        ('void', 'Void'),
    ]

    INVOICE_TYPE_CHOICES = [
        ('proforma', 'Proforma Invoice'),
        ('tax_invoice', 'Tax Invoice'),
    ]

    # Core fields
    invoice_number = models.CharField(max_length=255, unique=True, db_index=True)
    invoice_type = models.CharField(
        max_length=20,
        choices=INVOICE_TYPE_CHOICES,
        default='proforma',
        db_index=True,
        help_text='Proforma invoices do not trigger VAT; Tax Invoices are legal VAT documents'
    )
    customer = models.ForeignKey(
        Customer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='invoices'
    )
    order = models.ForeignKey(
        SalesOrder,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='invoices',
        help_text='Source order if invoice was converted from an order'
    )

    # Dates
    invoice_date = models.DateField(default=timezone.now)
    due_date = models.DateField(null=True, blank=True)

    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', db_index=True)

    # Content
    po_so_number = models.CharField(max_length=255, null=True, blank=True)
    notes = models.TextField(null=True, blank=True, help_text='Internal notes')
    customer_notes = models.TextField(null=True, blank=True, help_text='Notes visible to customer')

    # Financials
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    net_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    balance_due = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # VAT fields
    vat_rate = models.DecimalField(
        max_digits=5,
        decimal_places=4,
        default=0.18,
        help_text='VAT rate (e.g., 0.18 for 18%)'
    )
    advances_applied = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text='Total customer advances applied to this invoice'
    )
    converted_to_tax_invoice_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When proforma was converted to tax invoice'
    )

    # Migration
    legacy_invoice_id = models.CharField(max_length=255, null=True, blank=True, unique=True)
    prepared_by_legacy_id = models.IntegerField(null=True, blank=True, help_text='Legacy employee ID from old system for prepared_by mapping')

    # Audit
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_invoices')
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_invoices')
    created_date = models.DateTimeField(auto_now_add=True)
    updated_date = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'sales_invoices'
        ordering = ['-invoice_date', '-id']
        verbose_name = 'Sales Invoice'
        verbose_name_plural = 'Sales Invoices'

    def __str__(self):
        return f"Invoice {self.invoice_number} - {self.customer.name if self.customer else 'No Customer'}"

    def save(self, *args, **kwargs):
        # Auto-calculate balance due
        self.balance_due = self.net_total - self.amount_paid
        super().save(*args, **kwargs)

    @property
    def vat_rate_percent(self):
        """Return VAT rate as percentage for display (e.g., 18 for 0.18)."""
        return (self.vat_rate or Decimal('0.00')) * Decimal('100')

    def convert_proforma_to_tax_invoice(self, user=None):
        """
        Idempotent conversion with row-level locking.

        - Only proforma invoices can be converted.
        - Repeated calls on an already-converted invoice return the locked row.
        - Schedules tax-invoice journaling on commit (authoritative producer).
        """
        from django.db import transaction
        from apps.accounting.services.journal_events import schedule_tax_invoice_created

        if not self.pk:
            raise ValidationError("Invoice must be saved before conversion")

        with transaction.atomic():
            invoice = SalesInvoice.objects.select_for_update().get(pk=self.pk)

            if invoice.invoice_type == 'tax_invoice':
                schedule_tax_invoice_created(invoice.id)
                return invoice

            if invoice.invoice_type != 'proforma':
                raise ValidationError("Only Proforma Invoices can be converted to Tax Invoices")

            total_advances = invoice.amount_paid or Decimal('0.00')

            invoice.invoice_type = 'tax_invoice'
            invoice.advances_applied = total_advances
            invoice.converted_to_tax_invoice_at = timezone.now()
            invoice.save(update_fields=[
                'invoice_type',
                'advances_applied',
                'converted_to_tax_invoice_at',
                'updated_date',
            ])

            schedule_tax_invoice_created(invoice.id)

            return invoice


class SalesInvoiceItem(models.Model):
    """
    Line items for an invoice.
    """
    invoice = models.ForeignKey(SalesInvoice, on_delete=models.CASCADE, related_name='items')
    finished_product = models.ForeignKey(FinishedProduct, on_delete=models.SET_NULL, null=True, blank=True)

    item_name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)

    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    amount = models.DecimalField(max_digits=12, decimal_places=2)

    # VAT fields
    is_vat_exempt = models.BooleanField(
        default=False,
        help_text='Item is VAT-exempt (Books, Newspapers, Educational materials)'
    )
    tax_rate = models.DecimalField(max_digits=5, decimal_places=4, default=Decimal('0.18'))
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        db_table = 'sales_invoice_items'

class SalesInvoiceTimeline(models.Model):
    """
    Audit trail for invoice events.
    """
    invoice = models.ForeignKey(SalesInvoice, on_delete=models.CASCADE, related_name='timeline_entries')
    event_type = models.CharField(max_length=50)
    message = models.TextField()
    old_status = models.CharField(max_length=20, null=True, blank=True)
    new_status = models.CharField(max_length=20, null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'sales_invoice_timeline'
        ordering = ['-created_at']


class InvoiceShare(models.Model):
    """Secure sharing links for invoices."""

    invoice = models.ForeignKey(
        SalesInvoice,
        on_delete=models.CASCADE,
        related_name='share_links'
    )

    token = models.CharField(max_length=50, unique=True)

    created_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()

    view_count = models.IntegerField(default=0)
    last_viewed_at = models.DateTimeField(null=True, blank=True)

    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_invoice_shares'
    )

    class Meta:
        db_table = 'sales_invoice_shares'
        ordering = ['-created_at']
        verbose_name = 'Invoice Share'
        verbose_name_plural = 'Invoice Shares'

    def __str__(self):
        return f"{self.invoice.invoice_number} - {self.token}"

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at

    @classmethod
    def generate_token(cls):
        chars = string.ascii_lowercase + string.ascii_uppercase + string.digits
        chars = chars.replace('0', '').replace('O', '').replace('l', '').replace('I', '').replace('1', '')
        return ''.join(secrets.choice(chars) for _ in range(12))

class InvoicePayment(models.Model):
    """
    Records of payments made against an invoice.
    """
    PAYMENT_METHOD_CHOICES = [
        ('cash', 'Cash'),
        ('bank_transfer', 'Bank Transfer'),
        ('cheque', 'Cheque'),
        ('card', 'Card'),
        ('other', 'Other'),
    ]

    invoice = models.ForeignKey(SalesInvoice, on_delete=models.CASCADE, related_name='payments')
    payment_date = models.DateTimeField(default=timezone.now)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, default='cash')
    reference_number = models.CharField(max_length=255, null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # Accounting integration
    deposit_account = models.ForeignKey(
        'accounting.ChartOfAccounts',
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='invoice_payments',
        help_text='Account to deposit payment to (1000=Cash, 1010=Bank, 1040=Cheques Received)'
    )
    journal_entry = models.ForeignKey(
        'accounting.JournalEntry',
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='invoice_payments',
        help_text='Journal entry for this payment'
    )

    # Cheque handling (two-step clearance)
    cheque_number = models.CharField(max_length=50, null=True, blank=True, help_text='Cheque number if payment method is cheque')
    cheque_date = models.DateField(null=True, blank=True, help_text='Date on the cheque')
    cheque_cleared = models.BooleanField(default=False, help_text='Has cheque been cleared/deposited')
    cheque_cleared_date = models.DateField(null=True, blank=True, help_text='Date cheque was cleared')
    cheque_clearance_journal_entry = models.ForeignKey(
        'accounting.JournalEntry',
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='cheque_clearance_payments',
        help_text='Journal entry for cheque clearance (moves from 1040 to selected bank account)'
    )
    cheque_deposit_account = models.ForeignKey(
        'accounting.ChartOfAccounts',
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='cheque_deposits',
        help_text='Bank account where cheque will be deposited/cleared to (e.g., 1010, 1020, 1030)'
    )

    # Void tracking
    is_void = models.BooleanField(default=False, help_text='Has this payment been voided')
    void_reason = models.TextField(null=True, blank=True, help_text='Reason for voiding payment')
    voided_by = models.ForeignKey(User, on_delete=models.PROTECT, null=True, blank=True, related_name='voided_payments')
    voided_at = models.DateTimeField(null=True, blank=True, help_text='When payment was voided')

    # Reversal tracking (preferred over voiding)
    is_reversed = models.BooleanField(default=False, help_text='Has this payment been reversed')
    reversed_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='reversed_invoice_payments'
    )
    reversed_at = models.DateTimeField(null=True, blank=True, help_text='When payment was reversed')
    reversal_journal_entry = models.ForeignKey(
        'accounting.JournalEntry',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='invoice_payment_reversals',
        help_text='Journal entry that reverses this payment'
    )

    # Refund tracking (money moved, use refund instead of reversal)
    is_refunded = models.BooleanField(default=False, help_text='Has this payment been refunded')
    refunded_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='refunded_invoice_payments'
    )
    refunded_at = models.DateTimeField(null=True, blank=True, help_text='When payment was refunded')
    refund_journal_entry = models.ForeignKey(
        'accounting.JournalEntry',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='invoice_payment_refunds',
        help_text='Journal entry that refunds this payment'
    )

    # Receipt tracking
    receipt_number = models.CharField(
        max_length=50,
        unique=True,
        null=True,
        blank=True,
        db_index=True,
        help_text='Receipt number for this payment (e.g., R00001)'
    )
    receipt_generated_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When the receipt was first generated'
    )

    class Meta:
        db_table = 'sales_invoice_payments'
        ordering = ['-payment_date']

    def generate_receipt_number(self):
        """Generate unique receipt number in format R00001."""
        if self.receipt_number:
            return self.receipt_number

        from django.db import transaction

        with transaction.atomic():
            sequence, _ = ReceiptSequence.objects.select_for_update().get_or_create(
                name=ReceiptSequence.DEFAULT_NAME
            )

            if sequence.last_number == 0:
                existing_max = _get_max_legacy_receipt_number()
                if existing_max:
                    sequence.last_number = existing_max

            sequence.last_number += 1
            sequence.save(update_fields=['last_number'])

            self.receipt_number = f"{sequence.prefix}{sequence.last_number:05d}"
            self.receipt_generated_at = timezone.now()
            self.save(update_fields=['receipt_number', 'receipt_generated_at'])

        return self.receipt_number


class ReceiptSequence(models.Model):
    DEFAULT_NAME = "default"

    name = models.CharField(max_length=50, unique=True, default=DEFAULT_NAME)
    prefix = models.CharField(max_length=5, default="R")
    last_number = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'sales_receipt_sequence'

    def __str__(self):
        return f"{self.prefix}{self.last_number:05d}"


def _get_max_legacy_receipt_number():
    """Find the max numeric receipt in the existing R##### format."""
    max_number = 0
    for receipt_number in InvoicePayment.objects.filter(
        receipt_number__regex=r'^R\\d+$'
    ).values_list('receipt_number', flat=True):
        try:
            number = int(receipt_number[1:])
        except ValueError:
            continue
        if number > max_number:
            max_number = number
    return max_number or None


class SalesCreditNote(models.Model):
    """
    Credit notes to customers (reduces accounts receivable).
    Used for returns, adjustments, discounts, etc.
    """
    REASON_CHOICES = [
        ('bounced_cheque', 'Bounced Cheque'),
        ('overpayment', 'Overpayment'),
        ('less_quantity', 'Less Quantity'),
        ('canceled_item', 'Canceled Item'),
        ('customer_change', 'Customer Change'),
        ('price_correction', 'Price Correction'),
        ('service_not_delivered', 'Service not delivered'),
        ('other', 'Other'),
    ]

    CREDIT_NOTE_TYPE_CHOICES = [
        ('ar_credit', 'AR Credit'),
        ('payment_reverse', 'Payment Reverse'),
        ('payment_refund', 'Payment Refund'),
    ]

    PAYOUT_METHOD_CHOICES = [
        ('cash', 'Cash'),
        ('bank_transfer', 'Bank Transfer'),
        ('cheque', 'Cheque'),
    ]

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('approved', 'Approved'),
        ('applied', 'Applied'),
        ('void', 'Void'),
    ]

    credit_note_number = models.CharField(
        max_length=255,
        unique=True,
        db_index=True,
        help_text="Credit note number (e.g., SCN-2026-001)"
    )
    credit_note_type = models.CharField(
        max_length=20,
        choices=CREDIT_NOTE_TYPE_CHOICES,
        default='ar_credit',
        db_index=True,
        help_text="Type of credit note"
    )
    customer = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        related_name='credit_notes',
        help_text="Customer receiving the credit note"
    )
    invoice = models.ForeignKey(
        SalesInvoice,
        on_delete=models.PROTECT,
        related_name='credit_notes',
        null=True,
        blank=True,
        help_text="Original invoice being credited (optional)"
    )
    order = models.ForeignKey(
        SalesOrder,
        on_delete=models.PROTECT,
        related_name='credit_notes',
        null=True,
        blank=True,
        help_text="Original order being credited (optional)"
    )

    invoice_payment = models.ForeignKey(
        'invoices.InvoicePayment',
        on_delete=models.PROTECT,
        related_name='credit_notes',
        null=True,
        blank=True,
        help_text="Invoice payment being reversed/refunded"
    )
    order_payment = models.ForeignKey(
        'orders.OrderPayment',
        on_delete=models.PROTECT,
        related_name='credit_notes',
        null=True,
        blank=True,
        help_text="Order payment being reversed/refunded"
    )

    # Dates
    credit_note_date = models.DateField(
        default=timezone.now,
        db_index=True,
        help_text="Date of the credit note"
    )

    # Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft',
        db_index=True
    )

    # Financial
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Credit amount"
    )

    # Reason
    reason = models.CharField(
        max_length=255,
        choices=REASON_CHOICES,
        help_text="Reason for credit note (returns, adjustment, discount, etc.)"
    )
    detail_note = models.TextField(
        help_text="Detailed reason note (required)"
    )
    description = models.TextField(
        null=True,
        blank=True,
        help_text="Detailed description"
    )

    # Payout details (refunds only)
    payout_method = models.CharField(
        max_length=20,
        choices=PAYOUT_METHOD_CHOICES,
        null=True,
        blank=True,
        help_text="Refund payout method"
    )
    payout_account = models.ForeignKey(
        'accounting.ChartOfAccounts',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='credit_note_payouts',
        help_text="Cash/Bank account used for refund payout"
    )
    payout_voucher_number = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        help_text="Payout voucher number"
    )
    payout_cheque_number = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        help_text="Cheque number (if refund by cheque)"
    )
    customer_bank_account_name = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text="Customer bank account name for refund"
    )
    customer_bank_name = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text="Customer bank name for refund"
    )
    customer_bank_account_number = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text="Customer bank account number for refund"
    )

    journal_entry = models.ForeignKey(
        'accounting.JournalEntry',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='sales_credit_notes',
        help_text="Journal entry created for this credit note"
    )

    # Application tracking
    applied_to_invoice = models.ForeignKey(
        SalesInvoice,
        on_delete=models.PROTECT,
        related_name='applied_credit_notes',
        null=True,
        blank=True,
        help_text="Invoice this credit note was applied to"
    )
    applied_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the credit note was applied"
    )

    # Approval
    approved_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='approved_sales_credit_notes',
        null=True,
        blank=True
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    # Audit
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='created_sales_credit_notes'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'sales_credit_notes'
        verbose_name = 'Sales Credit Note'
        verbose_name_plural = 'Sales Credit Notes'
        ordering = ['-credit_note_date', '-credit_note_number']

    def __str__(self):
        return f"{self.credit_note_number} - {self.customer.name} - {self.amount}"

    def generate_credit_note_number(self):
        """Generate unique credit note number in format 00001."""
        if self.credit_note_number:
            return self.credit_note_number

        from django.db import transaction

        with transaction.atomic():
            sequence, _ = CreditNoteSequence.objects.select_for_update().get_or_create(
                name=CreditNoteSequence.DEFAULT_NAME
            )
            sequence.last_number += 1
            sequence.save(update_fields=['last_number'])

            self.credit_note_number = f"{sequence.prefix}{sequence.last_number:05d}"

        return self.credit_note_number

    def save(self, *args, **kwargs):
        if not self.credit_note_number:
            self.generate_credit_note_number()
        super().save(*args, **kwargs)

    def approve(self, user):
        """Approve the credit note and update customer AR."""
        from django.core.exceptions import ValidationError

        if self.credit_note_type != 'ar_credit':
            raise ValidationError(
                "Only AR credit notes can be approved via this workflow"
            )

        if self.status != 'draft':
            raise ValidationError(
                f"Cannot approve credit note with status '{self.status}'"
            )

        self.status = 'approved'
        self.approved_by = user
        self.approved_at = timezone.now()
        self.save()

        # Note: Customer AR balance update will be handled by journal entry
        # when accounting integration is complete

        return self

    def apply_to_invoice(self, invoice, user):
        """Apply this credit note to a specific invoice."""
        from django.core.exceptions import ValidationError
        from django.db import transaction

        with transaction.atomic():
            invoice = SalesInvoice.objects.select_for_update().get(pk=invoice.pk)

            if self.credit_note_type != 'ar_credit':
                raise ValidationError(
                    "Only AR credit notes can be applied to invoices"
                )

            if self.status not in ['approved']:
                raise ValidationError(
                    f"Cannot apply credit note with status '{self.status}'"
                )

            if invoice.customer != self.customer:
                raise ValidationError(
                    "Credit note customer must match invoice customer"
                )

            if self.amount > invoice.balance_due:
                raise ValidationError(
                    f"Credit amount ({self.amount}) cannot exceed invoice balance ({invoice.balance_due})"
                )

            # Update credit note
            self.applied_to_invoice = invoice
            self.applied_at = timezone.now()
            self.status = 'applied'
            self.save()

            # Update invoice
            invoice.amount_paid += self.amount
            invoice.balance_due -= self.amount

            if invoice.balance_due == 0:
                invoice.status = 'paid'
            else:
                invoice.status = 'partially_paid'

            invoice.save()

        return self

    def void(self):
        """Void the credit note."""
        from django.core.exceptions import ValidationError

        if self.status == 'applied':
            raise ValidationError(
                "Cannot void credit note that has been applied to an invoice"
            )

        self.status = 'void'
        self.save()

        return self


class CreditNoteSequence(models.Model):
    DEFAULT_NAME = "default"

    name = models.CharField(max_length=50, unique=True, default=DEFAULT_NAME)
    prefix = models.CharField(max_length=5, default="")
    last_number = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'sales_credit_note_sequence'

    def __str__(self):
        return f"{self.prefix}{self.last_number:05d}"


class CustomerAdvance(models.Model):
    """
    Track customer prepayments and overpayments.

    CRITICAL: When an advance is applied to an invoice, NO journal entry is created.
    The journal was already created when the advance was received.
    This is purely operational balance adjustment.
    """
    STATUS_CHOICES = [
        ('available', 'Available'),
        ('applied', 'Applied'),
        ('refunded', 'Refunded'),
        ('voided', 'Voided'),
    ]

    customer = models.ForeignKey('customers.Customer', on_delete=models.PROTECT, related_name='advances')
    advance_date = models.DateField(default=timezone.now)
    amount = models.DecimalField(max_digits=12, decimal_places=2, help_text='Original advance amount')
    balance = models.DecimalField(max_digits=12, decimal_places=2, help_text='Remaining balance to apply')

    # Source tracking
    source_type = models.CharField(max_length=50, help_text="'overpayment' or 'prepayment'")
    source_payment = models.ForeignKey(
        InvoicePayment,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='created_advances',
        help_text='Payment that created this advance (for overpayments)'
    )

    # Accounting linkage - for audit trail
    journal_entry = models.ForeignKey(
        'accounting.JournalEntry',
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='customer_advances',
        help_text='Journal entry that created this advance'
    )

    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='available')

    notes = models.TextField(null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'customer_advances'
        ordering = ['-advance_date']
        verbose_name = 'Customer Advance'
        verbose_name_plural = 'Customer Advances'
        constraints = [
            models.UniqueConstraint(
                fields=['source_payment', 'source_type'],
                condition=Q(source_payment__isnull=False),
                name='uniq_customeradvance_source_payment_type',
            )
        ]

    def __str__(self):
        return f"Advance {self.id} - {self.customer.name} ({self.balance})"


class PaymentAllocation(models.Model):
    """
    Split one payment across multiple invoices.

    IMPORTANT: This is OPERATIONAL data for tracking which invoices a payment applies to.
    The journal entry remains customer-level (control account).
    Do NOT create additional journal entries when allocating.
    """
    payment = models.ForeignKey(InvoicePayment, on_delete=models.CASCADE, related_name='allocations')
    invoice = models.ForeignKey(SalesInvoice, on_delete=models.CASCADE, related_name='payment_allocations')
    amount = models.DecimalField(max_digits=12, decimal_places=2, help_text='Amount of payment allocated to this invoice')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'payment_allocations'
        verbose_name = 'Payment Allocation'
        verbose_name_plural = 'Payment Allocations'

    def __str__(self):
        return f"Allocation: Payment {self.payment.id} -> Invoice {self.invoice.invoice_number} ({self.amount})"

    def clean(self):
        """Validate allocation amount doesn't exceed invoice balance."""
        from django.core.exceptions import ValidationError

        if self.invoice.balance_due < 0:
            raise ValidationError(f"Invoice is overpaid ({self.invoice.balance_due})")

        if self.amount > self.invoice.balance_due:
            raise ValidationError(
                f"Allocation amount ({self.amount}) cannot exceed invoice balance ({self.invoice.balance_due})"
            )
