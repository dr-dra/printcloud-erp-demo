from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.suppliers.models import Supplier

from .managers import PriceHistoryManager

User = get_user_model()


class InvCategory(models.Model):
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'inv_category'
        ordering = ['name']
        verbose_name = 'Inventory Category'
        verbose_name_plural = 'Inventory Categories'

    def __str__(self):
        return self.name


class InvUnitMeasure(models.Model):
    code = models.CharField(max_length=30, unique=True)
    name = models.CharField(max_length=100)
    symbol = models.CharField(max_length=20, blank=True)
    base_unit = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='derived_units'
    )
    conversion_factor = models.DecimalField(
        max_digits=12,
        decimal_places=6,
        default=1,
        help_text='Multiply by this factor to convert to base unit'
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'inv_unit_measure'
        ordering = ['name']
        verbose_name = 'Unit of Measure'
        verbose_name_plural = 'Units of Measure'

    def __str__(self):
        return f"{self.name} ({self.code})"


class InvItem(models.Model):
    sku = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=255)
    category = models.ForeignKey(
        InvCategory,
        on_delete=models.PROTECT,
        related_name='items'
    )
    preferred_supplier = models.ForeignKey(
        Supplier,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inventory_items'
    )

    stock_uom = models.ForeignKey(
        InvUnitMeasure,
        on_delete=models.PROTECT,
        related_name='stock_items'
    )
    purchase_uom = models.ForeignKey(
        InvUnitMeasure,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='purchase_items'
    )
    purchase_to_stock_factor = models.DecimalField(
        max_digits=12,
        decimal_places=6,
        default=1,
        help_text='Multiply purchase quantity to get stock quantity'
    )

    gsm = models.IntegerField(null=True, blank=True)
    width_mm = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    height_mm = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    is_offcut = models.BooleanField(default=False)
    parent_item = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='offcuts'
    )
    exclude_from_valuation = models.BooleanField(
        default=False,
        help_text='Exclude from inventory valuation reports'
    )

    reorder_level = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    reorder_quantity = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'inv_item'
        ordering = ['sku']
        verbose_name = 'Inventory Item'
        verbose_name_plural = 'Inventory Items'

    def __str__(self):
        return f"{self.sku} - {self.name}"


class PriceHistory(models.Model):
    """
    Append-only ledger for tracking supplier pricing per inventory item.
    """
    SOURCE_TYPE_CHOICES = [
        ('PO', 'Purchase Order'),
        ('GRN', 'Goods Received Note'),
        ('QUOTATION', 'Supplier Quotation'),
        ('MANUAL', 'Manual Entry'),
    ]

    item = models.ForeignKey(
        InvItem,
        on_delete=models.PROTECT,
        related_name='price_history'
    )
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.PROTECT,
        related_name='price_history'
    )

    unit_price = models.DecimalField(max_digits=15, decimal_places=4)
    currency = models.CharField(max_length=3, default='LKR')

    effective_date = models.DateField()

    source_type = models.CharField(max_length=20, choices=SOURCE_TYPE_CHOICES)
    source_ref = models.CharField(max_length=50, blank=True, null=True)
    source_id = models.BigIntegerField(blank=True, null=True)

    quantity = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        blank=True,
        null=True,
        help_text="Quantity at which this price was quoted"
    )
    remarks = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='price_history_entries'
    )

    objects = PriceHistoryManager()

    class Meta:
        db_table = 'inv_price_history'
        ordering = ['-effective_date', '-created_at']
        indexes = [
            models.Index(fields=['item', 'supplier', 'effective_date', 'created_at'], name='inv_price_current_idx'),
            models.Index(fields=['supplier', 'effective_date'], name='inv_price_supplier_idx'),
            models.Index(fields=['item', 'effective_date'], name='inv_price_item_idx'),
        ]

    def __str__(self):
        return f"{self.item.sku} - {self.supplier.name}: {self.unit_price} ({self.effective_date})"

    @classmethod
    def record_price(
        cls,
        *,
        item_id,
        supplier_id,
        unit_price,
        effective_date,
        source_type,
        created_by=None,
        source_ref=None,
        source_id=None,
        quantity=None,
        remarks=None,
        currency='LKR',
    ):
        last_price = cls.objects.get_current_price(item_id, supplier_id)
        if last_price and last_price.unit_price == unit_price:
            return last_price, False

        entry = cls.objects.create(
            item_id=item_id,
            supplier_id=supplier_id,
            unit_price=unit_price,
            currency=currency,
            effective_date=effective_date,
            source_type=source_type,
            source_ref=source_ref,
            source_id=source_id,
            quantity=quantity,
            remarks=remarks,
            created_by=created_by,
        )
        return entry, True


class InvStockBatch(models.Model):
    SOURCE_CHOICES = [
        ('grn', 'Goods Received'),
        ('adjustment', 'Stock Adjustment'),
        ('return', 'Return'),
        ('opening', 'Opening Balance'),
    ]

    item = models.ForeignKey(InvItem, on_delete=models.PROTECT, related_name='batches')
    received_date = models.DateField(default=timezone.now)
    source_type = models.CharField(max_length=20, choices=SOURCE_CHOICES)
    source_reference = models.CharField(max_length=100, blank=True)

    quantity_received = models.DecimalField(max_digits=12, decimal_places=2)
    quantity_remaining = models.DecimalField(max_digits=12, decimal_places=2)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'inv_stock_batch'
        ordering = ['received_date', 'id']
        verbose_name = 'Stock Batch'
        verbose_name_plural = 'Stock Batches'

    def __str__(self):
        return f"{self.item.sku} - {self.quantity_remaining} @ {self.unit_cost}"


class InvStockMovement(models.Model):
    MOVEMENT_CHOICES = [
        ('grn', 'Goods Received'),
        ('gin', 'Goods Issue'),
        ('adjustment', 'Stock Adjustment'),
        ('allocation', 'Allocation'),
        ('release', 'Allocation Release'),
        ('return', 'Return'),
    ]

    item = models.ForeignKey(InvItem, on_delete=models.PROTECT, related_name='movements')
    movement_type = models.CharField(max_length=20, choices=MOVEMENT_CHOICES)
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    quantity_before = models.DecimalField(max_digits=12, decimal_places=2)
    quantity_after = models.DecimalField(max_digits=12, decimal_places=2)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    total_value = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)

    reference_type = models.CharField(max_length=50, blank=True)
    reference_id = models.IntegerField(null=True, blank=True)
    notes = models.TextField(blank=True)

    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='inv_stock_movements'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'inv_stock_movement'
        ordering = ['-created_at']
        verbose_name = 'Stock Movement'
        verbose_name_plural = 'Stock Movements'

    def __str__(self):
        return f"{self.item.sku} {self.movement_type} {self.quantity}"


class InvMRN(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('pending', 'Pending Approval'),
        ('approved', 'Approved'),
        ('cancelled', 'Cancelled'),
        ('completed', 'Completed'),
    ]

    mrn_number = models.CharField(max_length=50, unique=True)
    request_date = models.DateField(default=timezone.now)
    required_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')

    job_reference = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)

    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_mrns'
    )
    approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_mrns'
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'inv_mrn'
        ordering = ['-request_date', '-mrn_number']
        verbose_name = 'Material Requisition Note'
        verbose_name_plural = 'Material Requisition Notes'

    def __str__(self):
        return self.mrn_number


class InvPRN(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('approved', 'Approved'),
        ('partially_ordered', 'Partially Ordered'),
        ('ordered', 'Ordered'),
        ('closed', 'Closed'),
        ('cancelled', 'Cancelled'),
    ]

    prn_number = models.CharField(max_length=50, unique=True)
    request_date = models.DateField(default=timezone.now)
    needed_by = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='draft')

    job_ticket_id = models.IntegerField(null=True, blank=True)
    notes = models.TextField(blank=True)

    requested_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='requested_prns'
    )
    approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_prns'
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'inv_prn'
        ordering = ['-request_date', '-prn_number']
        verbose_name = 'Purchase Requisition Note'
        verbose_name_plural = 'Purchase Requisition Notes'

    def __str__(self):
        return self.prn_number


class InvPRNItem(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('approved', 'Approved'),
        ('partially_ordered', 'Partially Ordered'),
        ('ordered', 'Ordered'),
        ('partially_received', 'Partially Received'),
        ('received', 'Received'),
        ('closed', 'Closed'),
        ('cancelled', 'Cancelled'),
    ]

    prn = models.ForeignKey(InvPRN, on_delete=models.CASCADE, related_name='items')
    item = models.ForeignKey(InvItem, on_delete=models.PROTECT, related_name='prn_items')

    required_qty = models.DecimalField(max_digits=12, decimal_places=2)
    ordered_qty = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    received_qty = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='draft')

    class Meta:
        db_table = 'inv_prn_item'
        verbose_name = 'PRN Item'
        verbose_name_plural = 'PRN Items'

    def __str__(self):
        return f"{self.prn.prn_number} - {self.item.sku}"


class InvPRNItemPOLink(models.Model):
    prn_item = models.ForeignKey(InvPRNItem, on_delete=models.CASCADE, related_name='po_links')
    purchase_order_item = models.ForeignKey(
        'purchases.PurchaseOrderItem',
        on_delete=models.CASCADE,
        related_name='prn_links'
    )
    ordered_qty = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        db_table = 'inv_prn_item_po_link'
        verbose_name = 'PRN Item PO Link'
        verbose_name_plural = 'PRN Item PO Links'


class InvMRNItem(models.Model):
    STATUS_CHOICES = [
        ('stock_available', 'Stock Available'),
        ('partial_stock', 'Partial Stock'),
        ('to_order', 'To Order'),
    ]

    mrn = models.ForeignKey(InvMRN, on_delete=models.CASCADE, related_name='items')
    item = models.ForeignKey(InvItem, on_delete=models.PROTECT, related_name='mrn_items')

    required_qty = models.DecimalField(max_digits=12, decimal_places=2)
    available_qty = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    allocated_qty = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    to_order_qty = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='to_order')

    class Meta:
        db_table = 'inv_mrn_item'
        verbose_name = 'MRN Item'
        verbose_name_plural = 'MRN Items'

    def __str__(self):
        return f"{self.mrn.mrn_number} - {self.item.sku}"


class InvStockAllocation(models.Model):
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('released', 'Released'),
    ]

    mrn_item = models.ForeignKey(InvMRNItem, on_delete=models.CASCADE, related_name='allocations')
    item = models.ForeignKey(InvItem, on_delete=models.PROTECT, related_name='allocations')
    quantity = models.DecimalField(max_digits=12, decimal_places=2)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    allocated_at = models.DateTimeField(auto_now_add=True)
    released_at = models.DateTimeField(null=True, blank=True)

    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_allocations'
    )

    class Meta:
        db_table = 'inv_stock_allocation'
        verbose_name = 'Stock Allocation'
        verbose_name_plural = 'Stock Allocations'

    def __str__(self):
        return f"{self.item.sku} - {self.quantity}"


class InvGoodsReceivedNote(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('received', 'Received'),
        ('inspected', 'Quality Inspected'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
    ]

    grn_number = models.CharField(max_length=50, unique=True)
    purchase_order = models.ForeignKey(
        'purchases.PurchaseOrder',
        on_delete=models.PROTECT,
        related_name='inventory_grns'
    )
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.PROTECT,
        related_name='inventory_grns'
    )

    received_date = models.DateField(default=timezone.now)
    inspection_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')

    inspected_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inspected_inventory_grns'
    )
    inspection_notes = models.TextField(blank=True)
    quality_passed = models.BooleanField(default=True)

    delivery_note_number = models.CharField(max_length=100, blank=True)
    vehicle_number = models.CharField(max_length=50, blank=True)
    driver_name = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)

    received_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='received_inventory_grns'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'inv_grn'
        ordering = ['-received_date', '-grn_number']
        verbose_name = 'Goods Received Note'
        verbose_name_plural = 'Goods Received Notes'

    def __str__(self):
        return self.grn_number


class InvGRNItem(models.Model):
    grn = models.ForeignKey(InvGoodsReceivedNote, on_delete=models.CASCADE, related_name='items')
    purchase_order_item = models.ForeignKey(
        'purchases.PurchaseOrderItem',
        on_delete=models.PROTECT,
        related_name='inventory_grn_items'
    )
    item = models.ForeignKey(InvItem, on_delete=models.PROTECT, related_name='grn_items')

    quantity_received = models.DecimalField(max_digits=12, decimal_places=2)
    quantity_accepted = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    quantity_rejected = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'inv_grn_item'
        verbose_name = 'GRN Item'
        verbose_name_plural = 'GRN Items'

    def __str__(self):
        return f"{self.grn.grn_number} - {self.item.sku}"


class InvGoodsIssueNote(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('issued', 'Issued'),
        ('cancelled', 'Cancelled'),
    ]

    COST_CENTER_CHOICES = [
        ('PREPRESS', 'Pre-Press'),
        ('PRESS', 'Press'),
        ('POSTPRESS', 'Post-Press'),
        ('MAINT', 'Maintenance'),
        ('GENERAL', 'General'),
    ]

    gin_number = models.CharField(max_length=50, unique=True)
    issue_date = models.DateField(default=timezone.now)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')

    job_reference = models.CharField(max_length=100, blank=True)
    prn = models.ForeignKey(
        InvPRN,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='gins'
    )
    cost_center = models.CharField(max_length=20, choices=COST_CENTER_CHOICES, null=True, blank=True)
    notes = models.TextField(blank=True)

    issued_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='issued_gins'
    )
    received_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='received_gins'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'inv_gin'
        ordering = ['-issue_date', '-gin_number']
        verbose_name = 'Goods Issue Note'
        verbose_name_plural = 'Goods Issue Notes'

    def __str__(self):
        return self.gin_number


class InvGINItem(models.Model):
    gin = models.ForeignKey(InvGoodsIssueNote, on_delete=models.CASCADE, related_name='items')
    item = models.ForeignKey(InvItem, on_delete=models.PROTECT, related_name='gin_items')
    quantity_issued = models.DecimalField(max_digits=12, decimal_places=2)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    class Meta:
        db_table = 'inv_gin_item'
        verbose_name = 'GIN Item'
        verbose_name_plural = 'GIN Items'

    def __str__(self):
        return f"{self.gin.gin_number} - {self.item.sku}"


class InvStockBatchIssue(models.Model):
    gin_item = models.ForeignKey(InvGINItem, on_delete=models.CASCADE, related_name='batch_issues')
    batch = models.ForeignKey(InvStockBatch, on_delete=models.PROTECT, related_name='issues')
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        db_table = 'inv_stock_batch_issue'
        verbose_name = 'Stock Batch Issue'
        verbose_name_plural = 'Stock Batch Issues'


class InvWastageCategory(models.Model):
    code = models.CharField(max_length=30, unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'inv_wastage_category'
        ordering = ['name']
        verbose_name = 'Wastage Category'
        verbose_name_plural = 'Wastage Categories'

    def __str__(self):
        return self.name


class InvUsageReport(models.Model):
    report_number = models.CharField(max_length=50, unique=True)
    report_date = models.DateField(default=timezone.now)
    job_reference = models.CharField(max_length=100, blank=True)
    gin = models.ForeignKey(
        InvGoodsIssueNote,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='usage_reports'
    )
    notes = models.TextField(blank=True)

    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_usage_reports'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'inv_usage_report'
        ordering = ['-report_date', '-report_number']
        verbose_name = 'Usage Report'
        verbose_name_plural = 'Usage Reports'

    def __str__(self):
        return self.report_number


class InvUsageItem(models.Model):
    usage_report = models.ForeignKey(InvUsageReport, on_delete=models.CASCADE, related_name='items')
    item = models.ForeignKey(InvItem, on_delete=models.PROTECT, related_name='usage_items')

    issued_qty = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    used_qty = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    returned_qty = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    spoiled_qty = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    wastage_category = models.ForeignKey(
        InvWastageCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='usage_items'
    )
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'inv_usage_item'
        verbose_name = 'Usage Item'
        verbose_name_plural = 'Usage Items'

    def __str__(self):
        return f"{self.usage_report.report_number} - {self.item.sku}"


class InvStockAdjustment(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('pending', 'Pending Approval'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    adjustment_number = models.CharField(max_length=50, unique=True)
    adjustment_date = models.DateField(default=timezone.now)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    reason = models.CharField(max_length=255)
    notes = models.TextField(blank=True)

    requested_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='requested_adjustments'
    )
    approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_adjustments'
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'inv_stock_adjustment'
        ordering = ['-adjustment_date', '-adjustment_number']
        verbose_name = 'Stock Adjustment'
        verbose_name_plural = 'Stock Adjustments'

    def __str__(self):
        return self.adjustment_number


class InvStockAdjustmentItem(models.Model):
    adjustment = models.ForeignKey(
        InvStockAdjustment,
        on_delete=models.CASCADE,
        related_name='items'
    )
    item = models.ForeignKey(InvItem, on_delete=models.PROTECT, related_name='adjustment_items')
    quantity_change = models.DecimalField(max_digits=12, decimal_places=2)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'inv_stock_adjustment_item'
        verbose_name = 'Stock Adjustment Item'
        verbose_name_plural = 'Stock Adjustment Items'


class InvDispatchNote(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('dispatched', 'Dispatched'),
        ('cancelled', 'Cancelled'),
    ]

    dispatch_number = models.CharField(max_length=50, unique=True)
    dispatch_date = models.DateField(default=timezone.now)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')

    invoice_reference = models.CharField(max_length=100, blank=True)
    job_reference = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)

    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_dispatch_notes'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'inv_dispatch_note'
        ordering = ['-dispatch_date', '-dispatch_number']
        verbose_name = 'Dispatch Note'
        verbose_name_plural = 'Dispatch Notes'

    def __str__(self):
        return self.dispatch_number


class InvDispatchItem(models.Model):
    dispatch_note = models.ForeignKey(InvDispatchNote, on_delete=models.CASCADE, related_name='items')
    item_description = models.CharField(max_length=255)
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    parcels = models.IntegerField(default=0)

    class Meta:
        db_table = 'inv_dispatch_item'
        verbose_name = 'Dispatch Item'
        verbose_name_plural = 'Dispatch Items'

    def __str__(self):
        return f"{self.dispatch_note.dispatch_number} - {self.item_description}"
