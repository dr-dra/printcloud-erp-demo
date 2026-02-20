from django.db import models
from django.utils import timezone
from apps.users.models import User
from apps.customers.models import Customer
from apps.costing.models import CostingEstimating, CostingSheet
from apps.sales.models import FinishedProduct
from apps.sales.quotations.models import SalesQuotation
import secrets
import string


class SalesOrder(models.Model):
    """
    Sales orders - production-focused orders for print shop.
    Separate from POS (walk-in sales) - these drive production workflow.
    """

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('confirmed', 'Confirmed'),
        ('production', 'In Production'),
        ('ready', 'Ready for Pickup/Delivery'),
        ('delivered', 'Delivered'),
        ('invoiced', 'Invoiced'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    PRODUCTION_STAGE_CHOICES = [
        ('pre_press', 'Pre-Press'),
        ('press', 'Press'),
        ('post_press', 'Post-Press'),
    ]

    NUMBER_TYPE_CHOICES = [
        (1, 'Order'),
        (2, 'Work Order'),
        (3, 'Job Order'),
    ]

    # Core order fields
    order_number = models.CharField(max_length=255, unique=True, db_index=True)
    number_type = models.IntegerField(choices=NUMBER_TYPE_CHOICES, default=1)

    # Relationships
    customer = models.ForeignKey(
        Customer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='orders'
    )

    # Quotation integration - track conversion
    quotation = models.ForeignKey(
        SalesQuotation,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='converted_orders',
        help_text='Source quotation if order was converted from quote'
    )

    # Dates
    order_date = models.DateField(default=timezone.now)
    required_date = models.DateField(null=True, blank=True, help_text='Customer requested delivery date')
    production_start_date = models.DateField(null=True, blank=True)
    completion_date = models.DateField(null=True, blank=True)
    delivered_date = models.DateField(null=True, blank=True)

    # Status tracking
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', db_index=True)
    production_stage = models.CharField(
        max_length=20,
        choices=PRODUCTION_STAGE_CHOICES,
        null=True,
        blank=True,
        help_text='Production stage when order is in production'
    )

    # Content
    po_so_number = models.CharField(max_length=255, null=True, blank=True, help_text='Customer PO/SO reference')
    project_name = models.CharField(max_length=255, null=True, blank=True, help_text='Order project name')
    notes = models.TextField(null=True, blank=True, help_text='Internal production notes')
    customer_notes = models.TextField(null=True, blank=True, help_text='Notes visible to customer')
    delivery_instructions = models.TextField(null=True, blank=True)

    # Financial fields
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    delivery_charge = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    net_total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    vat_rate = models.DecimalField(
        max_digits=5,
        decimal_places=4,
        default=0.18,
        help_text='VAT rate (e.g., 0.18 for 18%)'
    )
    vat_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Payment tracking (advances received)
    amount_paid = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text='Total advances paid against this order'
    )
    balance_due = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text='Remaining balance (net_total - amount_paid)'
    )

    # Production integration
    costing = models.ForeignKey(
        CostingEstimating,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='orders'
    )

    # Legacy integration fields
    legacy_order_id = models.CharField(max_length=255, null=True, blank=True, unique=True, help_text='Legacy pressmanager_db order ID')
    prepared_by_legacy_id = models.IntegerField(null=True, blank=True, help_text='Legacy employee ID from old system for prepared_by mapping')

    # Prepared by (who created the order)
    prepared_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='prepared_orders',
        help_text='User who prepared this order'
    )
    prepared_from = models.CharField(max_length=50, null=True, blank=True, help_text='Source: quotation, costing, direct')
    prepared_reff = models.CharField(max_length=255, null=True, blank=True, help_text='Reference to source document')

    # Flags
    is_active = models.BooleanField(default=True)

    # Audit trail
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_orders'
    )
    created_date = models.DateTimeField(auto_now_add=True)
    updated_date = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_orders'
    )

    class Meta:
        db_table = 'sales_orders'
        ordering = ['-order_date', '-id']
        verbose_name = 'Sales Order'
        verbose_name_plural = 'Sales Orders'
        indexes = [
            models.Index(fields=['order_number']),
            models.Index(fields=['status']),
            models.Index(fields=['order_date']),
            models.Index(fields=['customer']),
        ]

    def __str__(self):
        return f"Order {self.order_number} - {self.customer.name if self.customer else 'No Customer'}"

    @property
    def vat_rate_percent(self):
        """Return VAT rate as percentage for display (e.g., 18 for 0.18)."""
        return self.vat_rate * 100

    @property
    def timeline(self):
        """Get timeline entries for this order"""
        return self.timeline_entries.all().order_by('created_at')

    @property
    def can_transition_to_production(self):
        """Check if order can move to production"""
        return self.status in ['confirmed'] and self.items.exists()

    @property
    def can_be_invoiced(self):
        """Check if order is ready for invoicing"""
        return self.status in ['delivered', 'completed']

    def transition_to_confirmed(self, user):
        """Transition order from draft to confirmed"""
        if self.status != 'draft':
            raise ValueError('Can only confirm draft orders')
        if not self.customer:
            raise ValueError('Customer required to confirm order')
        if not self.items.exists():
            raise ValueError('At least one item required')

        self.status = 'confirmed'
        self.save()

        SalesOrderTimeline.objects.create(
            order=self,
            event_type='confirmed',
            message=f'Order confirmed by {user.get_full_name() if user else "system"}',
            old_status='draft',
            new_status='confirmed',
            created_by=user
        )

    def transition_to_production(self, user):
        """Move order to production"""
        if self.status != 'confirmed':
            raise ValueError('Can only start production on confirmed orders')

        self.status = 'production'
        self.production_start_date = timezone.now().date()
        self.save()

        SalesOrderTimeline.objects.create(
            order=self,
            event_type='production_started',
            message=f'Production started by {user.get_full_name() if user else "system"}',
            old_status='confirmed',
            new_status='production',
            created_by=user
        )


class SalesOrderItem(models.Model):
    """
    Sales order line items - products/services in the order.
    """

    order = models.ForeignKey(
        SalesOrder,
        on_delete=models.CASCADE,
        related_name='items'
    )

    # Product details - snapshot at order time
    finished_product = models.ForeignKey(
        FinishedProduct,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='order_items',
        help_text='Reference to finished product'
    )

    # Snapshot fields (captured at order time for historical accuracy)
    item_name = models.CharField(max_length=255, help_text='Product name snapshot')
    description = models.TextField(null=True, blank=True, help_text='Product description snapshot')

    # Pricing
    quantity = models.IntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    amount = models.DecimalField(max_digits=10, decimal_places=2, help_text='quantity * unit_price')

    # Costing integration
    costing_sheet = models.ForeignKey(
        CostingSheet,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='order_items'
    )
    cs_profit_margin = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    cs_profit = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    cs_total = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    # Production tracking
    job_ticket_generated = models.BooleanField(default=False, help_text='Has job ticket been generated')
    job_ticket_number = models.CharField(max_length=255, null=True, blank=True)
    production_notes = models.TextField(null=True, blank=True, help_text='Specific production notes for this item')

    # Item-level status tracking (optional, for complex orders)
    item_status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending'),
            ('production', 'In Production'),
            ('completed', 'Completed'),
        ],
        default='pending',
        null=True,
        blank=True
    )

    class Meta:
        db_table = 'sales_order_items'
        ordering = ['id']
        verbose_name = 'Sales Order Item'
        verbose_name_plural = 'Sales Order Items'

    def __str__(self):
        return f"{self.order.order_number} - {self.item_name} (Qty: {self.quantity})"

    def save(self, *args, **kwargs):
        # Auto-calculate amount
        if self.quantity and self.unit_price:
            self.amount = self.quantity * self.unit_price
        super().save(*args, **kwargs)


class SalesOrderTimeline(models.Model):
    """
    Timeline tracking for order status events and milestones.

    Note: Communication events (email, print, WhatsApp) are tracked
    in the DocumentCommunicationLog model (apps.core.models).
    This timeline is for internal status changes and production events.
    """

    EVENT_TYPE_CHOICES = [
        ('created', 'Order Created'),
        ('confirmed', 'Order Confirmed'),
        ('production_started', 'Production Started'),
        ('production_completed', 'Production Completed'),
        ('ready', 'Ready for Pickup/Delivery'),
        ('delivered', 'Delivered to Customer'),
        ('invoiced', 'Invoiced'),
        ('completed', 'Order Completed'),
        ('cancelled', 'Order Cancelled'),
        ('modified', 'Order Modified'),
        ('converted', 'Converted from Quotation'),
        ('job_ticket_generated', 'Job Ticket Generated'),
        ('status_changed', 'Status Changed'),
        ('note_added', 'Note Added'),
    ]

    order = models.ForeignKey(
        SalesOrder,
        on_delete=models.CASCADE,
        related_name='timeline_entries'
    )

    event_type = models.CharField(max_length=50, choices=EVENT_TYPE_CHOICES)
    message = models.TextField()

    # Optional status change tracking
    old_status = models.CharField(max_length=20, null=True, blank=True)
    new_status = models.CharField(max_length=20, null=True, blank=True)

    created_at = models.DateTimeField(default=timezone.now)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='order_timeline_entries'
    )

    class Meta:
        db_table = 'sales_order_timeline'
        ordering = ['-created_at']
        verbose_name = 'Sales Order Timeline'
        verbose_name_plural = 'Sales Order Timeline'

    def __str__(self):
        return f"{self.order.order_number} - {self.get_event_type_display()}: {self.message[:50]}"


def order_attachment_upload_path(instance, filename):
    """Generate upload path for order attachments"""
    # Organize files: order-files/order_123/filename
    return f'order-files/order_{instance.order.id}/{filename}'


class OrderAttachment(models.Model):
    """
    File attachments for orders (artwork, specifications, customer files).
    Stored in S3 like CustomerDocument.
    """

    order = models.ForeignKey(
        SalesOrder,
        on_delete=models.CASCADE,
        related_name='attachments'
    )

    file = models.FileField(upload_to=order_attachment_upload_path)
    title = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    file_type = models.CharField(
        max_length=50,
        choices=[
            ('artwork', 'Artwork'),
            ('specification', 'Specification'),
            ('customer_file', 'Customer File'),
            ('proof', 'Proof'),
            ('other', 'Other'),
        ],
        default='other'
    )

    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'sales_order_attachments'
        ordering = ['-uploaded_at']
        verbose_name = 'Order Attachment'
        verbose_name_plural = 'Order Attachments'

    def __str__(self):
        return f"{self.title} ({self.order.order_number})"


class OrderShare(models.Model):
    """
    Secure sharing links for order confirmations.
    Similar to QuotationShare.
    """

    order = models.ForeignKey(
        SalesOrder,
        on_delete=models.CASCADE,
        related_name='share_links'
    )

    # Secure token for sharing
    token = models.CharField(max_length=50, unique=True)

    # Timestamps
    created_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()

    # Access tracking
    view_count = models.IntegerField(default=0)
    last_viewed_at = models.DateTimeField(null=True, blank=True)

    # Created by user
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_order_shares'
    )

    class Meta:
        db_table = 'sales_order_shares'
        ordering = ['-created_at']
        verbose_name = 'Order Share'
        verbose_name_plural = 'Order Shares'

    def __str__(self):
        return f"{self.order.order_number} - {self.token}"

    @property
    def is_expired(self):
        """Check if the share link has expired"""
        return timezone.now() > self.expires_at

    @classmethod
    def generate_token(cls):
        """Generate a secure token for sharing"""
        chars = string.ascii_lowercase + string.ascii_uppercase + string.digits
        chars = chars.replace('0', '').replace('O', '').replace('l', '').replace('I', '').replace('1', '')
        return ''.join(secrets.choice(chars) for _ in range(12))


class OrderPayment(models.Model):
    """
    Payments received against orders - goes to Customer Advances.

    CRITICAL: Order payments do NOT create AR or Sales entries.
    They create journal entries:
        DR: Cash/Bank
        CR: Customer Advances (net of VAT)
        CR: VAT Payable (VAT portion)

    The VAT is calculated as: vat = amount * rate / (1 + rate)
    """
    PAYMENT_METHOD_CHOICES = [
        ('cash', 'Cash'),
        ('bank_transfer', 'Bank Transfer'),
        ('cheque', 'Cheque'),
        ('card', 'Card'),
        ('other', 'Other'),
    ]

    order = models.ForeignKey(
        SalesOrder,
        on_delete=models.CASCADE,
        related_name='payments'
    )
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
        related_name='order_payments',
        help_text='Account to deposit payment to (1000=Cash, 1010=Bank, 1040=Cheques Received)'
    )
    journal_entry = models.ForeignKey(
        'accounting.JournalEntry',
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='order_payments',
        help_text='Journal entry for this advance payment'
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
        related_name='order_cheque_clearance_payments',
        help_text='Journal entry for cheque clearance'
    )
    cheque_deposit_account = models.ForeignKey(
        'accounting.ChartOfAccounts',
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='order_cheque_deposits',
        help_text='Bank account where cheque will be deposited'
    )

    # Void tracking
    is_void = models.BooleanField(default=False, help_text='Has this payment been voided')
    void_reason = models.TextField(null=True, blank=True, help_text='Reason for voiding payment')
    voided_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='voided_order_payments'
    )
    voided_at = models.DateTimeField(null=True, blank=True, help_text='When payment was voided')

    # Reversal tracking (preferred over voiding)
    is_reversed = models.BooleanField(default=False, help_text='Has this payment been reversed')
    reversed_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='reversed_order_payments'
    )
    reversed_at = models.DateTimeField(null=True, blank=True, help_text='When payment was reversed')
    reversal_journal_entry = models.ForeignKey(
        'accounting.JournalEntry',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='order_payment_reversals',
        help_text='Journal entry that reverses this payment'
    )

    # Refund tracking (money moved, use refund instead of reversal)
    is_refunded = models.BooleanField(default=False, help_text='Has this payment been refunded')
    refunded_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='refunded_order_payments'
    )
    refunded_at = models.DateTimeField(null=True, blank=True, help_text='When payment was refunded')
    refund_journal_entry = models.ForeignKey(
        'accounting.JournalEntry',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='order_payment_refunds',
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
        db_table = 'sales_order_payments'
        ordering = ['-payment_date']
        verbose_name = 'Order Payment'
        verbose_name_plural = 'Order Payments'

    def __str__(self):
        return f"Payment {self.id} - {self.order.order_number} ({self.amount})"

    def generate_receipt_number(self):
        """Generate unique receipt number in format R00001."""
        if self.receipt_number:
            return self.receipt_number

        from django.db import transaction
        from apps.sales.invoices.models import ReceiptSequence, _get_max_legacy_receipt_number

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
