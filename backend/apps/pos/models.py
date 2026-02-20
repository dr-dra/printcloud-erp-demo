from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import models
from django.db.models import Sum
from django.utils import timezone

from apps.accounting.models import JournalEntry
from apps.customers.models import Customer

User = get_user_model()


class POSLocation(models.Model):
    """
    POS location management.
    Defines physical shop locations where POS operates.
    """

    name = models.CharField(
        max_length=100,
        help_text="Location name"
    )
    code = models.CharField(
        max_length=20,
        unique=True,
        help_text="Location code (e.g., 'MAIN')"
    )
    address = models.TextField(
        blank=True,
        help_text="Physical address"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Whether location is active"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'pos_locations'
        ordering = ['name']
        verbose_name = 'POS Location'
        verbose_name_plural = 'POS Locations'

    def __str__(self):
        return f"{self.name} ({self.code})"


class POSCategory(models.Model):
    """
    Product categories for POS module.
    Organizes products into logical groups.
    """

    name = models.CharField(
        max_length=100,
        unique=True,
        help_text="Category name"
    )
    description = models.TextField(
        blank=True,
        help_text="Category description"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Whether category is active"
    )
    display_order = models.IntegerField(
        default=0,
        help_text="Display order for sorting"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'pos_categories'
        ordering = ['display_order', 'name']
        verbose_name = 'POS Category'
        verbose_name_plural = 'POS Categories'

    def __str__(self):
        return self.name


class POSProduct(models.Model):
    """
    POS products - independent from inventory module.
    Contains all product data needed for point of sale operations.
    """

    # Basic Product Info
    name = models.CharField(
        max_length=255,
        help_text="Product name"
    )
    sku = models.CharField(
        max_length=100,
        unique=True,
        blank=True,
        null=True,
        help_text="Stock keeping unit code"
    )
    description = models.TextField(
        blank=True,
        help_text="Product description"
    )
    category = models.ForeignKey(
        POSCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='products',
        help_text="Product category"
    )

    # Pricing
    default_selling_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Default selling price"
    )
    unit_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        help_text="Unit cost (for profit calculations)"
    )
    tax_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        help_text="Default tax rate percentage"
    )

    # Quick Access Panel Configuration
    is_quick_access = models.BooleanField(
        default=False,
        help_text="Show in quick access panel"
    )
    default_quantity = models.IntegerField(
        default=1,
        help_text="Default quantity when added from quick access"
    )

    # Inventory Tracking (POS-managed)
    track_inventory = models.BooleanField(
        default=False,
        help_text="Track inventory for this product"
    )
    quantity_on_hand = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        help_text="Current quantity on hand"
    )
    allow_backorder = models.BooleanField(
        default=True,
        help_text="Allow sales when out of stock"
    )
    low_stock_threshold = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        help_text="Low stock alert threshold"
    )

    # Status & Metadata
    is_active = models.BooleanField(
        default=True,
        help_text="Product is active and available for sale"
    )
    sales_count = models.IntegerField(
        default=0,
        help_text="Total number of sales (for popularity tracking)"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_pos_products',
        help_text="User who created this product"
    )

    class Meta:
        db_table = 'pos_products'
        ordering = ['name']
        verbose_name = 'POS Product'
        verbose_name_plural = 'POS Products'
        indexes = [
            models.Index(fields=['sku'], name='idx_pos_product_sku'),
            models.Index(fields=['is_active', 'is_quick_access'], name='idx_pos_product_active_quick'),
            models.Index(fields=['category'], name='idx_pos_product_category'),
        ]

    def __str__(self):
        return f"{self.name} ({self.sku or 'NO-SKU'})"


class POSStockMovement(models.Model):
    """
    Track POS-managed inventory movements.
    Records all changes to product quantities.
    """

    MOVEMENT_TYPE_CHOICES = [
        ('sale', 'Sale'),
        ('adjustment', 'Adjustment'),
        ('void', 'Void/Refund'),
    ]

    product = models.ForeignKey(
        POSProduct,
        on_delete=models.CASCADE,
        related_name='stock_movements',
        help_text="Product being moved"
    )
    location = models.ForeignKey(
        POSLocation,
        on_delete=models.PROTECT,
        related_name='stock_movements',
        help_text="Location where movement occurred"
    )
    movement_type = models.CharField(
        max_length=20,
        choices=MOVEMENT_TYPE_CHOICES,
        help_text="Type of movement"
    )
    quantity = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Quantity moved (negative for sales)"
    )
    reference_type = models.CharField(
        max_length=50,
        help_text="Reference type (e.g., 'pos_transaction', 'adjustment')"
    )
    reference_id = models.IntegerField(
        help_text="ID of reference object"
    )
    notes = models.TextField(
        blank=True,
        help_text="Movement notes"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_pos_stock_movements',
        help_text="User who created this movement"
    )

    class Meta:
        db_table = 'pos_stock_movements'
        ordering = ['-created_at']
        verbose_name = 'POS Stock Movement'
        verbose_name_plural = 'POS Stock Movements'
        indexes = [
            models.Index(fields=['product', 'created_at'], name='idx_pos_movement_product'),
            models.Index(fields=['location', 'created_at'], name='idx_pos_movement_location'),
            models.Index(fields=['movement_type'], name='idx_pos_movement_type'),
        ]

    def __str__(self):
        return f"{self.product.name} - {self.get_movement_type_display()} - {self.quantity}"


class POSOrder(models.Model):
    """
    Orders created by designers before payment.
    Separates order creation from payment acceptance in the workflow.
    """

    STATUS_CHOICES = [
        ('pending_payment', 'Pending Payment'),
        ('completed', 'Completed'),
        ('voided', 'Voided'),
    ]

    # Order identification
    order_number = models.CharField(
        max_length=12,
        unique=True,
        help_text="Unique daily sequential order number (e.g., '251225001')"
    )

    # Location and customer
    location = models.ForeignKey(
        POSLocation,
        on_delete=models.PROTECT,
        related_name='orders',
        help_text="POS Location"
    )
    customer = models.ForeignKey(
        Customer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pos_orders',
        help_text="Customer (null for anonymous walk-in)"
    )

    # Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending_payment'
    )

    # Financial totals
    subtotal = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        help_text="Sum of all line items before tax"
    )
    discount_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        help_text="Total discount applied"
    )
    tax_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        help_text="Total tax"
    )
    total = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        help_text="Final total (subtotal - discount + tax)"
    )

    # Notes
    notes = models.TextField(
        null=True,
        blank=True,
        help_text="Order notes"
    )

    # Audit trail - Created by designer
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='created_pos_orders',
        help_text="Designer/Typesetter who created the order"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Completion - By accounting/cashier
    completed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='completed_pos_orders',
        help_text="Accounting/Cashier who accepted payment"
    )
    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When payment was accepted"
    )

    # Voiding
    voided_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='voided_pos_orders',
        help_text="User who voided the order"
    )
    voided_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When order was voided"
    )
    void_reason = models.TextField(
        null=True,
        blank=True,
        help_text="Reason for voiding"
    )

    # Link to final transaction after payment
    related_transaction = models.ForeignKey(
        'POSTransaction',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='source_order',
        help_text="Final POS transaction created after payment acceptance"
    )

    class Meta:
        db_table = 'pos_orders'
        ordering = ['-created_at']
        verbose_name = 'POS Order'
        verbose_name_plural = 'POS Orders'
        indexes = [
            models.Index(fields=['order_number'], name='idx_order_number'),
            models.Index(fields=['status'], name='idx_order_status'),
            models.Index(fields=['created_by', 'created_at'], name='idx_order_creator_date'),
            models.Index(fields=['created_at'], name='idx_order_created_at'),
        ]

    def __str__(self):
        customer_name = self.customer.name if self.customer else "Walk-in"
        return f"Order {self.order_number} - {customer_name} - Rs. {self.total}"

    @property
    def is_editable(self):
        """Can only edit if status is pending_payment"""
        return self.status == 'pending_payment'

    @classmethod
    def generate_order_number(cls):
        """
        Generate daily sequential order number: YYMMDDXXX
        Example: 251225001 for Dec 25, 2025, 1st order.
        """
        today = timezone.now()
        date_prefix = today.strftime('%y%m%d')  # YYMMDD
        
        # Find the last order number for today
        last_order = cls.objects.filter(
            order_number__startswith=date_prefix
        ).order_by('-order_number').first()
        
        if last_order:
            # Extract last 3 digits
            last_sequence = int(last_order.order_number[-3:])
            new_sequence = last_sequence + 1
        else:
            new_sequence = 1
            
        # Format: YYMMDD + 3-digit sequence
        return f"{date_prefix}{new_sequence:03d}"


class POSOrderItem(models.Model):
    """
    Individual line items in POS orders.
    Each row represents one product/quantity in an order.
    """

    order = models.ForeignKey(
        POSOrder,
        on_delete=models.CASCADE,
        related_name='items',
        help_text="Parent order"
    )

    # Product
    product = models.ForeignKey(
        POSProduct,
        on_delete=models.PROTECT,
        related_name='order_items',
        help_text="POS Product"
    )

    # Snapshot fields (capture at time of order)
    item_name = models.CharField(
        max_length=255,
        help_text="Product name at time of order"
    )
    sku = models.CharField(
        max_length=100,
        help_text="SKU at time of order"
    )

    # Quantity and pricing
    quantity = models.IntegerField(
        help_text="Quantity ordered"
    )
    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Price per unit (before tax)"
    )

    # Tax
    tax_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0.00,
        help_text="Tax rate percentage applied"
    )
    tax_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        help_text="Total tax for this line (calculated)"
    )

    # Discounts
    discount_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        help_text="Discount applied to this line"
    )

    # Totals
    line_total = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Total for line (quantity * unit_price - discount + tax)"
    )

    # Notes
    notes = models.TextField(
        null=True,
        blank=True,
        help_text="Line item notes"
    )

    class Meta:
        db_table = 'pos_order_items'
        ordering = ['id']
        verbose_name = 'POS Order Item'
        verbose_name_plural = 'POS Order Items'
        indexes = [
            models.Index(fields=['order'], name='idx_order_item_order'),
            models.Index(fields=['product'], name='idx_order_item_product'),
        ]

    def __str__(self):
        return f"Order {self.order.order_number} - {self.item_name} x {self.quantity}"


class CashDrawerSession(models.Model):
    """
    Cash drawer sessions for daily cash management.
    Each user opens a drawer at start of shift and closes at end.
    """

    STATUS_CHOICES = [
        ('open', 'Open'),
        ('closed', 'Closed'),
        ('reconciled', 'Reconciled'),
    ]

    # Session identification
    session_number = models.CharField(
        max_length=50,
        unique=True,
        help_text="Unique session identifier (e.g., 'CD-20250124-001')"
    )

    # User and location
    user = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='cash_drawer_sessions',
        help_text="User operating this drawer"
    )
    location = models.ForeignKey(
        POSLocation,
        on_delete=models.PROTECT,
        related_name='cash_drawer_sessions',
        help_text="POS Location"
    )

    # Opening
    opened_at = models.DateTimeField(auto_now_add=True)
    opening_balance = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Starting cash in drawer"
    )
    opening_notes = models.TextField(
        null=True,
        blank=True,
        help_text="Notes at opening (e.g., denomination breakdown)"
    )

    # Closing
    closed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When drawer was closed"
    )
    expected_balance = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Expected cash (opening + sales - account payments)"
    )
    actual_balance = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Actual counted cash at closing"
    )
    variance = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Difference (actual - expected)"
    )
    closing_notes = models.TextField(
        null=True,
        blank=True,
        help_text="Notes at closing (denomination breakdown, variance explanation)"
    )

    # Commercial printing and payouts
    commercial_printing_income = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Income from commercial printing (calculated manually from receipts)"
    )
    payouts = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Cash paid out (hand-written vouchers)"
    )

    # Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='open'
    )

    # Reconciliation
    reconciled_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When variance was reviewed/approved"
    )
    reconciled_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reconciled_sessions',
        help_text="Manager who approved variance"
    )

    class Meta:
        db_table = 'pos_cash_drawer_sessions'
        ordering = ['-opened_at']
        verbose_name = 'Cash Drawer Session'
        verbose_name_plural = 'Cash Drawer Sessions'
        indexes = [
            models.Index(fields=['user', 'status', 'opened_at'], name='idx_session_user_status'),
            models.Index(fields=['location', 'opened_at'], name='idx_session_loc_date'),
            models.Index(fields=['status'], name='idx_session_status'),
        ]
        constraints = [
            # Ensure user can only have one open session at a time
            models.UniqueConstraint(
                fields=['user', 'location'],
                condition=models.Q(status='open'),
                name='unique_open_session_per_user_location'
            )
        ]

    def __str__(self):
        return f"{self.session_number} - {self.user.email} ({self.get_status_display()})"

    def close_session(self, actual_balance, commercial_printing_income=None, payouts=None, closing_notes=None):
        """
        Close the cash drawer session

        Args:
            actual_balance: Actual counted cash
            commercial_printing_income: Income from commercial printing (optional)
            payouts: Cash paid out via vouchers (optional)
            closing_notes: Closing notes/discrepancies (optional)
        """
        from decimal import Decimal

        self.closed_at = timezone.now()
        self.actual_balance = Decimal(str(actual_balance))

        # Update commercial printing and payouts if provided
        if commercial_printing_income is not None:
            self.commercial_printing_income = Decimal(str(commercial_printing_income))
        if payouts is not None:
            self.payouts = Decimal(str(payouts))

        # Recalculate expected_balance with new components
        if self.expected_balance is None:
            self.expected_balance = self.opening_balance

        self.expected_balance = self.expected_balance + self.commercial_printing_income - self.payouts

        # Calculate variance
        self.variance = self.actual_balance - self.expected_balance
        self.closing_notes = closing_notes
        self.status = 'closed'
        self.save()

    def is_from_today(self):
        """Check if session was opened today"""
        from django.utils import timezone
        return self.opened_at.date() == timezone.now().date()

    def is_stale(self):
        """Check if session is from previous day (needs force closure)"""
        from django.utils import timezone
        return self.status == 'open' and self.opened_at.date() < timezone.now().date()


class POSZReport(models.Model):
    """
    Persisted Z-report snapshot for a closed cash drawer session.
    """

    cash_drawer_session = models.OneToOneField(
        CashDrawerSession,
        on_delete=models.PROTECT,
        related_name='z_report',
        help_text="Closed cash drawer session for this Z-report"
    )

    gross_sales = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Subtotal + tax for completed transactions"
    )
    net_sales = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Gross sales minus discounts"
    )
    vat_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="VAT portion calculated from VAT-inclusive net sales"
    )
    discounts_total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Total discounts applied"
    )

    cash_total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Total cash payments"
    )
    card_total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Total card/bank payments"
    )
    on_account_total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Total on-account payments"
    )

    journal_entry = models.ForeignKey(
        JournalEntry,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pos_z_reports',
        help_text="Accounting journal entry for this Z-report"
    )
    posted_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this Z-report was posted to accounting"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'pos_z_reports'
        ordering = ['-created_at']
        verbose_name = 'POS Z Report'
        verbose_name_plural = 'POS Z Reports'

    def save(self, *args, **kwargs):
        if self.pk:
            update_fields = kwargs.get('update_fields')
            allowed = {'journal_entry', 'posted_at'}
            if update_fields is None or not set(update_fields).issubset(allowed):
                raise ValueError('POSZReport records are immutable after creation')
        super().save(*args, **kwargs)


class POSTransaction(models.Model):
    """
    Main POS transaction records (receipts).
    Each transaction represents one customer purchase.
    """

    STATUS_CHOICES = [
        ('completed', 'Completed'),
        ('voided', 'Voided'),
        ('refunded', 'Refunded'),
        ('partial_refund', 'Partial Refund'),
    ]

    # Receipt identification
    receipt_number = models.CharField(
        max_length=50,
        unique=True,
        help_text="Unique receipt number (e.g., 'RCP-20250124-0001')"
    )

    # Session and location
    cash_drawer_session = models.ForeignKey(
        CashDrawerSession,
        on_delete=models.PROTECT,
        related_name='transactions',
        help_text="Cash drawer session this transaction belongs to"
    )
    location = models.ForeignKey(
        POSLocation,
        on_delete=models.PROTECT,
        related_name='transactions',
        help_text="POS Location"
    )

    # Customer (nullable for walk-ins)
    customer = models.ForeignKey(
        Customer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pos_transactions',
        help_text="Customer (null for anonymous walk-in)"
    )

    # Transaction details
    transaction_date = models.DateTimeField(
        auto_now_add=True,
        help_text="When transaction was created"
    )

    # Financial totals
    subtotal = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        help_text="Sum of all line items before tax"
    )
    discount_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        help_text="Total discount applied"
    )
    discount_reason = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text="Reason for discount"
    )
    tax_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        help_text="Total tax"
    )
    total = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        help_text="Final total (subtotal - discount + tax)"
    )

    # Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='completed'
    )

    # Voiding/refunding
    voided_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When transaction was voided"
    )
    voided_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='voided_transactions',
        help_text="User who voided transaction"
    )
    void_reason = models.TextField(
        null=True,
        blank=True,
        help_text="Reason for voiding"
    )

    # Notes
    notes = models.TextField(
        null=True,
        blank=True,
        help_text="Additional transaction notes"
    )

    # Audit
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='created_pos_transactions',
        help_text="User who processed transaction"
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'pos_transactions'
        ordering = ['-transaction_date']
        verbose_name = 'POS Transaction'
        verbose_name_plural = 'POS Transactions'
        indexes = [
            models.Index(fields=['receipt_number'], name='idx_pos_receipt_number'),
            models.Index(fields=['transaction_date'], name='idx_pos_transaction_date'),
            models.Index(fields=['customer', 'transaction_date'], name='idx_pos_customer_date'),
            models.Index(fields=['cash_drawer_session'], name='idx_pos_session'),
            models.Index(fields=['status'], name='idx_pos_status'),
            models.Index(fields=['location', 'transaction_date'], name='idx_pos_loc_date'),
        ]

    def __str__(self):
        customer_name = self.customer.name if self.customer else "Walk-in"
        return f"{self.receipt_number} - {customer_name} - Rs. {self.total}"

    @property
    def total_paid(self):
        """Total amount paid across all payment methods"""
        result = self.payments.aggregate(total=Sum('amount'))
        return result['total'] or 0

    @property
    def change_given(self):
        """Change returned to customer"""
        return max(0, self.total_paid - self.total)

    @classmethod
    def generate_receipt_number(cls, location):
        """
        Generate receipt number: LOC-YYYYMMDD-####
        Example: SHOP-20250124-0001
        Resets daily per location.
        """
        today = timezone.now().date()
        prefix = f"{location.code}-{today.strftime('%Y%m%d')}"

        # Get last receipt for today
        last_receipt = cls.objects.filter(
            receipt_number__startswith=prefix
        ).order_by('-receipt_number').first()

        if last_receipt:
            last_num = int(last_receipt.receipt_number.split('-')[-1])
            new_num = last_num + 1
        else:
            new_num = 1

        return f"{prefix}-{new_num:04d}"


class POSTransactionItem(models.Model):
    """
    Individual line items in POS transactions.
    Each row represents one product/quantity sold.
    """

    transaction = models.ForeignKey(
        POSTransaction,
        on_delete=models.CASCADE,
        related_name='items',
        help_text="Parent transaction"
    )

    # Product
    product = models.ForeignKey(
        POSProduct,
        on_delete=models.PROTECT,
        related_name='transaction_items',
        help_text="POS Product"
    )

    # Snapshot fields (capture at time of sale)
    item_name = models.CharField(
        max_length=255,
        help_text="Product name at time of sale"
    )
    sku = models.CharField(
        max_length=100,
        help_text="SKU at time of sale"
    )

    # Quantity and pricing
    quantity = models.IntegerField(
        help_text="Quantity sold"
    )
    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Price per unit (before tax)"
    )

    # Tax
    tax_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0.00,
        help_text="Tax rate percentage applied"
    )
    tax_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        help_text="Total tax for this line (calculated)"
    )

    # Discounts
    discount_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        help_text="Discount applied to this line"
    )

    # Totals
    line_total = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Total for line (quantity * unit_price - discount + tax)"
    )

    # Cost (for profit tracking)
    unit_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Cost per unit at time of sale (for COGS)"
    )

    # Notes
    notes = models.TextField(
        null=True,
        blank=True,
        help_text="Line item notes (e.g., customization details)"
    )

    class Meta:
        db_table = 'pos_transaction_items'
        ordering = ['id']
        verbose_name = 'POS Transaction Item'
        verbose_name_plural = 'POS Transaction Items'
        indexes = [
            models.Index(fields=['transaction'], name='idx_pos_item_transaction'),
            models.Index(fields=['product'], name='idx_pos_item_product'),
        ]

    def __str__(self):
        return f"{self.transaction.receipt_number} - {self.item_name} x {self.quantity}"

    @property
    def profit(self):
        """Gross profit for this line item"""
        if self.unit_cost:
            return (self.unit_price - self.unit_cost) * self.quantity
        return None


class POSPayment(models.Model):
    """
    Payment records for POS transactions.
    Multiple payments per transaction support split payment methods.
    """

    PAYMENT_METHOD_CHOICES = [
        ('cash', 'Cash'),
        ('card', 'Credit/Debit Card'),
        ('account', 'Customer Account'),
        ('bank_transfer', 'Bank Transfer'),
        ('mobile_payment', 'Mobile Payment'),
        ('other', 'Other'),
    ]

    transaction = models.ForeignKey(
        POSTransaction,
        on_delete=models.CASCADE,
        related_name='payments',
        help_text="Parent transaction"
    )

    # Payment details
    payment_method = models.CharField(
        max_length=20,
        choices=PAYMENT_METHOD_CHOICES,
        help_text="Payment method used"
    )
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Amount paid via this method"
    )

    # Reference information
    reference_number = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        help_text="Card transaction ID, check number, transfer reference, etc."
    )

    # Account payment tracking
    customer_account_balance_before = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Customer account balance before this payment (for account payments)"
    )
    customer_account_balance_after = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Customer account balance after this payment (for account payments)"
    )

    # Notes
    notes = models.TextField(
        null=True,
        blank=True,
        help_text="Payment notes"
    )

    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='created_pos_payments'
    )

    class Meta:
        db_table = 'pos_payments'
        ordering = ['id']
        verbose_name = 'POS Payment'
        verbose_name_plural = 'POS Payments'
        indexes = [
            models.Index(fields=['transaction'], name='idx_payment_transaction'),
            models.Index(fields=['payment_method', 'created_at'], name='idx_payment_method_date'),
        ]

    def __str__(self):
        return f"{self.transaction.receipt_number} - {self.get_payment_method_display()} - Rs. {self.amount}"


class CustomerAccount(models.Model):
    """
    Customer account tracking for credit sales and outstanding balances.
    One record per customer who uses account payment method.
    """

    customer = models.OneToOneField(
        Customer,
        on_delete=models.PROTECT,
        related_name='account',
        help_text="Customer with account privileges"
    )

    # Balance tracking
    current_balance = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        help_text="Current outstanding balance (negative = credit, positive = owes)"
    )
    credit_limit = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        help_text="Maximum credit allowed"
    )

    # Payment terms
    payment_term_days = models.IntegerField(
        default=30,
        help_text="Payment due days (e.g., Net 30)"
    )

    # Status
    is_active = models.BooleanField(
        default=True,
        help_text="Whether account is active for new charges"
    )
    is_suspended = models.BooleanField(
        default=False,
        help_text="Account suspended due to overdue balance"
    )

    # Dates
    last_transaction_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Last charge or payment date"
    )
    last_payment_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Last payment received date"
    )

    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_customer_accounts'
    )

    class Meta:
        db_table = 'pos_customer_accounts'
        ordering = ['customer__name']
        verbose_name = 'Customer Account'
        verbose_name_plural = 'Customer Accounts'
        indexes = [
            models.Index(fields=['is_active', 'current_balance'], name='idx_account_active_balance'),
            models.Index(fields=['is_suspended'], name='idx_account_suspended'),
        ]

    def __str__(self):
        return f"{self.customer.name} - Balance: Rs. {self.current_balance}"

    @property
    def available_credit(self):
        """Remaining credit available"""
        return self.credit_limit - self.current_balance

    @property
    def is_over_limit(self):
        """Check if balance exceeds credit limit"""
        return self.current_balance > self.credit_limit


class CustomerAccountTransaction(models.Model):
    """
    Ledger entries for customer account activity.
    Tracks all charges and payments affecting account balance.
    """

    TRANSACTION_TYPE_CHOICES = [
        ('charge', 'Charge (Sale)'),
        ('payment', 'Payment'),
        ('adjustment', 'Balance Adjustment'),
        ('refund', 'Refund'),
    ]

    account = models.ForeignKey(
        CustomerAccount,
        on_delete=models.CASCADE,
        related_name='transactions',
        help_text="Customer account"
    )

    # Transaction details
    transaction_type = models.CharField(
        max_length=20,
        choices=TRANSACTION_TYPE_CHOICES,
        help_text="Type of transaction"
    )
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Transaction amount (positive = charge, negative = payment)"
    )

    # Balance tracking
    balance_before = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Account balance before this transaction"
    )
    balance_after = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Account balance after this transaction"
    )

    # Reference to source
    pos_transaction = models.ForeignKey(
        POSTransaction,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='account_transactions',
        help_text="Related POS transaction (if applicable)"
    )
    reference_number = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        help_text="Payment reference or invoice number"
    )

    # Payment terms
    due_date = models.DateField(
        null=True,
        blank=True,
        help_text="Payment due date (for charges)"
    )

    # Notes
    notes = models.TextField(
        null=True,
        blank=True,
        help_text="Transaction notes"
    )

    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_account_transactions'
    )

    class Meta:
        db_table = 'pos_customer_account_transactions'
        ordering = ['-created_at']
        verbose_name = 'Customer Account Transaction'
        verbose_name_plural = 'Customer Account Transactions'
        indexes = [
            models.Index(fields=['account', 'created_at'], name='idx_acct_txn_account_date'),
            models.Index(fields=['transaction_type'], name='idx_acct_txn_type'),
            models.Index(fields=['due_date'], name='idx_acct_txn_due_date'),
        ]

    def __str__(self):
        return f"{self.account.customer.name} - {self.get_transaction_type_display()} - Rs. {self.amount}"
