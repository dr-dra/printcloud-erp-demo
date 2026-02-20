from django.db import models
import secrets
import string
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.utils import timezone
from apps.suppliers.models import Supplier

User = get_user_model()


class PurchaseOrder(models.Model):
    """
    Purchase orders to suppliers.

    Similar pattern to SalesOrder.
    Tracks the complete purchase order lifecycle.
    """
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('sent', 'Sent to Supplier'),
        ('confirmed', 'Confirmed'),
        ('partially_received', 'Partially Received'),
        ('received', 'Fully Received'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    po_number = models.CharField(
        max_length=255,
        unique=True,
        db_index=True,
        help_text="Purchase order number (e.g., PO-2026-001)"
    )
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.PROTECT,
        related_name='purchase_orders'
    )

    # Dates
    order_date = models.DateField(
        default=timezone.now,
        db_index=True
    )
    expected_delivery_date = models.DateField(null=True, blank=True)
    actual_delivery_date = models.DateField(null=True, blank=True)

    # Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft',
        db_index=True
    )

    # Financials
    subtotal = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text="Sum of all line items"
    )
    tax_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0
    )
    discount_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0
    )
    total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text="Subtotal + tax - discount"
    )

    # Delivery details
    delivery_address = models.TextField(null=True, blank=True)
    shipping_method = models.CharField(max_length=100, null=True, blank=True)

    # Content
    notes = models.TextField(
        null=True,
        blank=True,
        help_text="Internal notes"
    )
    supplier_notes = models.TextField(
        null=True,
        blank=True,
        help_text="Notes sent to supplier"
    )

    # Audit
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='created_purchase_orders'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Purchase Order"
        verbose_name_plural = "Purchase Orders"
        ordering = ['-order_date', '-po_number']
        indexes = [
            models.Index(fields=['po_number']),
            models.Index(fields=['supplier', 'order_date']),
            models.Index(fields=['status', 'order_date']),
        ]

    def __str__(self):
        return f"{self.po_number} - {self.supplier.name}"

    def calculate_totals(self):
        """Calculate and update totals from line items"""
        items = self.items.all()
        self.subtotal = sum(item.amount for item in items)
        self.total = self.subtotal + self.tax_amount - self.discount_amount
        self.save(update_fields=['subtotal', 'total', 'updated_at'])

    def add_timeline_entry(self, event_type, message, old_status=None, new_status=None, user=None):
        """Add an entry to the timeline"""
        PurchaseOrderTimeline.objects.create(
            purchase_order=self,
            event_type=event_type,
            message=message,
            old_status=old_status,
            new_status=new_status,
            created_by=user
        )


class PurchaseOrderItem(models.Model):
    """
    Line items in purchase orders.
    """
    purchase_order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.CASCADE,
        related_name='items'
    )
    line_number = models.IntegerField(
        help_text="Line number in the order"
    )

    # Item details
    item = models.ForeignKey(
        'inventory.InvItem',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='purchase_order_items',
        help_text='Linked inventory item (optional)'
    )
    item_name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)

    # Quantity
    quantity = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Quantity ordered"
    )
    unit_of_measure = models.CharField(
        max_length=50,
        default='units',
        help_text="e.g., units, kg, meters"
    )

    # Pricing
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    tax_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        help_text="Tax percentage (e.g., 18.00 for 18%)"
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Quantity × Unit Price"
    )

    # Receiving tracking
    quantity_received = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        help_text="Quantity received so far"
    )

    class Meta:
        verbose_name = "Purchase Order Item"
        verbose_name_plural = "Purchase Order Items"
        ordering = ['line_number']
        unique_together = [['purchase_order', 'line_number']]

    def __str__(self):
        return f"{self.purchase_order.po_number} - Line {self.line_number}: {self.item_name}"

    def save(self, *args, **kwargs):
        """Auto-calculate amount"""
        self.amount = self.quantity * self.unit_price
        super().save(*args, **kwargs)

    @property
    def quantity_pending(self):
        """Calculate pending quantity (ordered - received)"""
        return self.quantity - self.quantity_received

    @property
    def is_fully_received(self):
        """Check if item is fully received"""
        return self.quantity_received >= self.quantity


class PurchaseOrderTimeline(models.Model):
    """
    Audit trail for purchase order events.

    Follows SalesOrderTimeline pattern.
    """
    purchase_order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.CASCADE,
        related_name='timeline_entries'
    )
    event_type = models.CharField(
        max_length=50,
        help_text="Type of event (e.g., created, sent, confirmed)"
    )
    message = models.TextField(help_text="Event description")
    old_status = models.CharField(max_length=20, null=True, blank=True)
    new_status = models.CharField(max_length=20, null=True, blank=True)

    # Audit
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='purchase_order_timeline_entries',
        null=True,
        blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Purchase Order Timeline"
        verbose_name_plural = "Purchase Order Timeline Entries"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.purchase_order.po_number} - {self.event_type} at {self.created_at}"


class PurchaseOrderShare(models.Model):
    """Secure sharing links for purchase orders."""

    purchase_order = models.ForeignKey(
        PurchaseOrder,
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
        related_name='created_purchase_order_shares'
    )

    class Meta:
        verbose_name = "Purchase Order Share"
        verbose_name_plural = "Purchase Order Shares"
        ordering = ['-created_at']
        db_table = 'purchase_order_shares'

    def __str__(self):
        return f"{self.purchase_order.po_number} - {self.token}"

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at

    @classmethod
    def generate_token(cls):
        chars = string.ascii_lowercase + string.ascii_uppercase + string.digits
        chars = chars.replace('0', '').replace('O', '').replace('l', '').replace('I', '').replace('1', '')
        return ''.join(secrets.choice(chars) for _ in range(12))


class GoodsReceivedNote(models.Model):
    """
    Goods Received Note (GRN).

    Records receipt of goods from suppliers.
    Multiple GRNs can be created for a single PO (partial deliveries).
    """
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('received', 'Received'),
        ('inspected', 'Quality Inspected'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
    ]

    grn_number = models.CharField(
        max_length=255,
        unique=True,
        db_index=True,
        help_text="GRN number (e.g., GRN-2026-001)"
    )
    purchase_order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.PROTECT,
        related_name='grns'
    )
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.PROTECT,
        related_name='grns'
    )

    # Dates
    received_date = models.DateField(
        default=timezone.now,
        db_index=True
    )
    inspection_date = models.DateField(null=True, blank=True)

    # Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft',
        db_index=True
    )

    # Quality inspection
    inspected_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='inspected_grns',
        null=True,
        blank=True
    )
    inspection_notes = models.TextField(null=True, blank=True)
    quality_passed = models.BooleanField(
        default=True,
        help_text="Did the goods pass quality inspection?"
    )

    # Delivery details
    delivery_note_number = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        help_text="Supplier's delivery note number"
    )
    vehicle_number = models.CharField(max_length=50, null=True, blank=True)
    driver_name = models.CharField(max_length=255, null=True, blank=True)

    # Notes
    notes = models.TextField(null=True, blank=True)

    # Audit
    received_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='received_grns'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Goods Received Note"
        verbose_name_plural = "Goods Received Notes"
        ordering = ['-received_date', '-grn_number']
        indexes = [
            models.Index(fields=['grn_number']),
            models.Index(fields=['purchase_order', 'received_date']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.grn_number} - {self.purchase_order.po_number}"

    def accept(self, user):
        """Accept the GRN and update PO quantities received"""
        if self.status != 'inspected':
            raise ValidationError("GRN must be inspected before accepting")

        if not self.quality_passed:
            raise ValidationError("Cannot accept GRN that failed quality inspection")

        # Update status
        self.status = 'accepted'
        self.save()

        # Update PO item quantities
        for grn_item in self.items.all():
            po_item = grn_item.purchase_order_item
            po_item.quantity_received += grn_item.quantity_received
            po_item.save()

        # Update PO status if fully received
        po = self.purchase_order
        all_items_received = all(item.is_fully_received for item in po.items.all())

        if all_items_received:
            po.status = 'received'
            po.actual_delivery_date = self.received_date
        else:
            po.status = 'partially_received'

        po.save()
        po.add_timeline_entry(
            event_type='grn_accepted',
            message=f"GRN {self.grn_number} accepted",
            user=user
        )

    def reject(self, user, reason):
        """Reject the GRN"""
        self.status = 'rejected'
        self.quality_passed = False
        self.inspection_notes = f"REJECTED: {reason}\n\n{self.inspection_notes or ''}"
        self.save()

        self.purchase_order.add_timeline_entry(
            event_type='grn_rejected',
            message=f"GRN {self.grn_number} rejected: {reason}",
            user=user
        )


class GRNItem(models.Model):
    """
    Line items in Goods Received Notes.

    Links to PO items to track what was received.
    """
    grn = models.ForeignKey(
        GoodsReceivedNote,
        on_delete=models.CASCADE,
        related_name='items'
    )
    purchase_order_item = models.ForeignKey(
        PurchaseOrderItem,
        on_delete=models.PROTECT,
        related_name='grn_items',
        help_text="Link to original PO item"
    )

    # Quantity received
    quantity_received = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Quantity received in this GRN"
    )

    # Quality inspection
    quantity_accepted = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        help_text="Quantity accepted after inspection"
    )
    quantity_rejected = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        help_text="Quantity rejected (damaged, incorrect, etc.)"
    )

    # Notes
    notes = models.TextField(
        null=True,
        blank=True,
        help_text="Inspection notes, damage reports, etc."
    )

    class Meta:
        verbose_name = "GRN Item"
        verbose_name_plural = "GRN Items"
        ordering = ['purchase_order_item__line_number']

    def __str__(self):
        return f"{self.grn.grn_number} - {self.purchase_order_item.item_name}"

    def clean(self):
        """Validate quantities"""
        super().clean()

        if self.quantity_received <= 0:
            raise ValidationError("Quantity received must be positive")

        if self.quantity_accepted + self.quantity_rejected > self.quantity_received:
            raise ValidationError(
                "Accepted + Rejected cannot exceed Quantity Received"
            )

        # Check if we're receiving more than ordered
        po_item = self.purchase_order_item
        total_to_receive = po_item.quantity_received + self.quantity_received

        if total_to_receive > po_item.quantity:
            raise ValidationError(
                f"Cannot receive more than ordered. "
                f"Ordered: {po_item.quantity}, "
                f"Already received: {po_item.quantity_received}, "
                f"This GRN: {self.quantity_received}"
            )


class SupplierBill(models.Model):
    """
    Supplier invoices/bills received.

    Triggers AP accounting entries when approved.
    Can be linked to a purchase order or created standalone.
    """
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('approved', 'Approved'),
        ('partially_paid', 'Partially Paid'),
        ('paid', 'Paid'),
        ('void', 'Void'),
    ]

    bill_number = models.CharField(
        max_length=255,
        db_index=True,
        help_text="Supplier's invoice/bill number"
    )
    internal_reference = models.CharField(
        max_length=255,
        unique=True,
        db_index=True,
        help_text="Our internal reference number"
    )
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.PROTECT,
        related_name='bills'
    )
    purchase_order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.PROTECT,
        related_name='bills',
        null=True,
        blank=True,
        help_text="Link to purchase order (if applicable)"
    )

    # Dates
    bill_date = models.DateField(db_index=True)
    due_date = models.DateField(db_index=True)
    payment_date = models.DateField(
        null=True,
        blank=True,
        help_text="Date when fully paid"
    )

    # Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft',
        db_index=True
    )

    # Financials
    subtotal = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Sum of all line items"
    )
    tax_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0
    )
    discount_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0
    )
    total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Subtotal + tax - discount"
    )
    amount_paid = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text="Total amount paid so far"
    )
    balance_due = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Remaining balance to pay"
    )

    # Content
    notes = models.TextField(null=True, blank=True)

    # Approval
    approved_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='approved_supplier_bills',
        null=True,
        blank=True
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    # Audit
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='created_supplier_bills'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Supplier Bill"
        verbose_name_plural = "Supplier Bills"
        ordering = ['-bill_date', '-internal_reference']
        indexes = [
            models.Index(fields=['bill_number', 'supplier']),
            models.Index(fields=['internal_reference']),
            models.Index(fields=['status', 'due_date']),
        ]

    def __str__(self):
        return f"{self.internal_reference} - {self.supplier.name} - {self.total}"

    def save(self, *args, **kwargs):
        """Calculate balance due"""
        self.balance_due = self.total - self.amount_paid
        super().save(*args, **kwargs)

    def approve(self, user):
        """
        Approve the bill for payment.
        This will trigger accounting entry creation via signals.
        """
        if self.status != 'draft':
            raise ValidationError(f"Cannot approve bill with status '{self.status}'")

        self.status = 'approved'
        self.approved_by = user
        self.approved_at = timezone.now()
        self.save()

        # Update supplier balance
        self.supplier.update_balance(self.total)

    def record_payment(
        self,
        amount,
        payment_method,
        user,
        payment_date=None,
        reference_number=None,
        notes=None,
        cheque_number=None,
        cheque_date=None,
        cheque_cleared=False,
        cheque_cleared_date=None,
    ):
        """
        Record a payment against this bill.

        Returns:
            BillPayment: Created payment record
        """
        if self.status not in ['approved', 'partially_paid']:
            raise ValidationError(f"Cannot record payment for bill with status '{self.status}'")

        if amount <= 0:
            raise ValidationError("Payment amount must be positive")

        if amount > self.balance_due:
            raise ValidationError(
                f"Payment amount ({amount}) cannot exceed balance due ({self.balance_due})"
            )

        if payment_method == 'cheque' and not cheque_number:
            raise ValidationError("Cheque number is required for cheque payments")

        if cheque_cleared and not cheque_cleared_date:
            cheque_cleared_date = (payment_date or timezone.now()).date()

        # Create payment record
        payment = BillPayment.objects.create(
            bill=self,
            payment_date=payment_date or timezone.now(),
            amount=amount,
            payment_method=payment_method,
            reference_number=reference_number,
            notes=notes,
            cheque_number=cheque_number,
            cheque_date=cheque_date,
            cheque_cleared=cheque_cleared,
            cheque_cleared_date=cheque_cleared_date,
            created_by=user
        )

        # Update bill amounts
        self.amount_paid += amount
        self.balance_due -= amount

        # Update status
        if self.balance_due == 0:
            self.status = 'paid'
            self.payment_date = payment.payment_date
        else:
            self.status = 'partially_paid'

        self.save()

        # Update supplier balance
        self.supplier.update_balance(-amount)

        return payment


class BillPayment(models.Model):
    """
    Payments made to suppliers against bills.

    Similar to InvoicePayment pattern.
    Triggers journal entries via signals.
    """
    PAYMENT_METHOD_CHOICES = [
        ('cash', 'Cash'),
        ('bank_transfer', 'Bank Transfer'),
        ('cheque', 'Cheque'),
        ('card', 'Card'),
        ('other', 'Other'),
    ]

    bill = models.ForeignKey(
        SupplierBill,
        on_delete=models.PROTECT,
        related_name='payments'
    )
    payment_date = models.DateField(default=timezone.now, db_index=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(
        max_length=20,
        choices=PAYMENT_METHOD_CHOICES
    )
    reference_number = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text="Bank reference, cheque number, etc."
    )
    notes = models.TextField(null=True, blank=True)

    # Cheque handling
    cheque_number = models.CharField(max_length=50, null=True, blank=True)
    cheque_date = models.DateField(null=True, blank=True)
    cheque_cleared = models.BooleanField(default=False)
    cheque_cleared_date = models.DateField(null=True, blank=True)

    # Audit
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='created_bill_payments'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Bill Payment"
        verbose_name_plural = "Bill Payments"
        ordering = ['-payment_date', '-created_at']

    def __str__(self):
        return f"Payment {self.amount} for {self.bill.internal_reference} on {self.payment_date}"

    def clean(self):
        """Validate payment"""
        super().clean()

        if self.amount and self.amount <= 0:
            raise ValidationError("Payment amount must be positive")

        if self.payment_method == 'cheque' and not self.cheque_number:
            raise ValidationError("Cheque number is required for cheque payments")


class BillScan(models.Model):
    """
    Stores scanned supplier bills with AI extraction data.

    Workflow:
    1. User uploads bill scan (PDF/JPG/PNG)
    2. File saved to S3
    3. Celery task triggers AI processing (Textract + Claude)
    4. User validates extracted data
    5. SupplierBill created after validation

    Preserves full AI audit trail and tracks user edits.
    """
    PROCESSING_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]

    # File storage
    file = models.FileField(
        upload_to='bill-scans/%Y/%m/',
        help_text="Scanned bill file (PDF/JPG/PNG)"
    )
    file_name = models.CharField(max_length=255)
    file_size = models.IntegerField(help_text="File size in bytes")
    file_type = models.CharField(
        max_length=50,
        help_text="MIME type: application/pdf, image/jpeg, image/png"
    )

    # Processing status
    processing_status = models.CharField(
        max_length=20,
        choices=PROCESSING_STATUS_CHOICES,
        default='pending',
        db_index=True
    )
    processing_started_at = models.DateTimeField(null=True, blank=True)
    processing_completed_at = models.DateTimeField(null=True, blank=True)
    processing_error = models.TextField(
        null=True,
        blank=True,
        help_text="Error message if processing failed"
    )

    # AI Extraction - Raw Response (for debugging/audit)
    textract_response = models.JSONField(
        null=True,
        blank=True,
        help_text="Raw Textract OCR response"
    )
    claude_response = models.JSONField(
        null=True,
        blank=True,
        help_text="Raw Claude extraction response"
    )

    # AI Extraction - Structured Data with Confidence
    extracted_data = models.JSONField(
        null=True,
        blank=True,
        help_text="Structured extracted data with confidence scores"
    )
    # Structure: {
    #   "bill_number": {"value": "INV-123", "confidence": 0.95},
    #   "supplier_name": {"value": "ABC Corp", "confidence": 0.88},
    #   "bill_date": {"value": "2026-01-06", "confidence": 0.92},
    #   "due_date": {"value": "2026-02-05", "confidence": 0.85},
    #   "subtotal": {"value": "1000.00", "confidence": 0.90},
    #   "tax_amount": {"value": "150.00", "confidence": 0.87},
    #   "total": {"value": "1150.00", "confidence": 0.93},
    #   "discount_amount": {"value": "0.00", "confidence": 0.80}
    # }

    # AI-generated summary of bill contents
    summary = models.CharField(
        max_length=256,
        null=True,
        blank=True,
        help_text="AI-generated summary of bill line items/contents (max 256 chars)"
    )

    # Supplier Matching
    matched_supplier = models.ForeignKey(
        Supplier,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='bill_scans',
        help_text="Auto-matched supplier from database"
    )
    supplier_match_confidence = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Confidence score for supplier match (0.00-1.00)"
    )

    # User Edits Tracking
    user_edited_fields = models.JSONField(
        default=dict,
        help_text="Track which fields user manually edited"
    )
    # Structure: {"bill_number": true, "total": true}

    # Link to created bill (after validation)
    created_bill = models.OneToOneField(
        SupplierBill,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='scan_source'
    )

    # Audit
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='uploaded_bill_scans'
    )
    uploaded_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Bill Scan"
        verbose_name_plural = "Bill Scans"
        ordering = ['-uploaded_at']
        indexes = [
            models.Index(fields=['processing_status', 'uploaded_at']),
            models.Index(fields=['uploaded_by', 'processing_status']),
        ]

    def __str__(self):
        return f"Scan #{self.id} - {self.file_name} ({self.processing_status})"

    def clean(self):
        """Validate bill scan"""
        super().clean()

        # Validate file size (100MB max)
        if self.file_size and self.file_size > 100 * 1024 * 1024:
            raise ValidationError("File too large. Maximum size is 100MB.")

        # Validate file type
        allowed_types = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
        if self.file_type and self.file_type not in allowed_types:
            raise ValidationError(
                f"Invalid file type. Allowed types: {', '.join(allowed_types)}"
            )


class SupplierCreditNote(models.Model):
    """
    Credit notes from suppliers (reduces accounts payable).
    Used for returns, adjustments, discounts, etc.
    """
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
        help_text="Credit note number (e.g., CN-2026-001)"
    )
    supplier = models.ForeignKey(
        'suppliers.Supplier',
        on_delete=models.PROTECT,
        related_name='credit_notes',
        help_text="Supplier issuing the credit note"
    )
    supplier_bill = models.ForeignKey(
        SupplierBill,
        on_delete=models.PROTECT,
        related_name='credit_notes',
        null=True,
        blank=True,
        help_text="Original bill being credited (optional)"
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
        help_text="Reason for credit note (returns, adjustment, discount, etc.)"
    )
    description = models.TextField(
        null=True,
        blank=True,
        help_text="Detailed description"
    )

    # Application tracking
    applied_to_bill = models.ForeignKey(
        SupplierBill,
        on_delete=models.PROTECT,
        related_name='applied_credit_notes',
        null=True,
        blank=True,
        help_text="Bill this credit note was applied to"
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
        related_name='approved_supplier_credit_notes',
        null=True,
        blank=True
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    # Audit
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='created_supplier_credit_notes'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Supplier Credit Note'
        verbose_name_plural = 'Supplier Credit Notes'
        ordering = ['-credit_note_date', '-credit_note_number']

    def __str__(self):
        return f"{self.credit_note_number} - {self.supplier.name} - {self.amount}"

    def approve(self, user):
        """Approve the credit note and update supplier balance."""
        if self.status != 'draft':
            raise ValidationError(
                f"Cannot approve credit note with status '{self.status}'"
            )

        self.status = 'approved'
        self.approved_by = user
        self.approved_at = timezone.now()
        self.save()

        # Update supplier balance (credit reduces what we owe)
        self.supplier.update_balance(-self.amount)

        return self

    def apply_to_bill(self, bill, user):
        """Apply this credit note to a specific bill."""
        if self.status not in ['approved']:
            raise ValidationError(
                f"Cannot apply credit note with status '{self.status}'"
            )

        if bill.supplier != self.supplier:
            raise ValidationError(
                "Credit note supplier must match bill supplier"
            )

        if self.amount > bill.balance_due:
            raise ValidationError(
                f"Credit amount ({self.amount}) cannot exceed bill balance ({bill.balance_due})"
            )

        # Update credit note
        self.applied_to_bill = bill
        self.applied_at = timezone.now()
        self.status = 'applied'
        self.save()

        # Update bill
        bill.amount_paid += self.amount
        bill.balance_due -= self.amount

        if bill.balance_due == 0:
            bill.status = 'paid'
            bill.payment_date = timezone.now().date()
        else:
            bill.status = 'partially_paid'

        bill.save()

        return self

    def void(self):
        """Void the credit note."""
        if self.status == 'applied':
            raise ValidationError(
                "Cannot void credit note that has been applied to a bill"
            )

        # Reverse supplier balance if approved
        if self.status == 'approved':
            self.supplier.update_balance(self.amount)

        self.status = 'void'
        self.save()

        return self
