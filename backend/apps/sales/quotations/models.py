from django.db import models
from django.utils import timezone
from apps.users.models import User
from apps.customers.models import Customer
from apps.costing.models import CostingEstimating, CostingSheet
from apps.sales.models import FinishedProduct
import secrets
import string


class SalesQuotation(models.Model):
    """Sales quotations - main quotation records"""

    NUMBER_TYPE_CHOICES = [
        (1, 'Quote'),
        (2, 'Estimate'),
        (3, 'Proposal'),
    ]

    # Core quotation fields - matching import script field names
    quot_number = models.CharField(max_length=255, unique=True)
    number_type = models.IntegerField(
        choices=NUMBER_TYPE_CHOICES, null=True, blank=True)

    # Relationships
    customer = models.ForeignKey(
        Customer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='quotations'
    )

    # Dates - matching import script
    date = models.DateField(null=True, blank=True)
    required_date = models.DateField(null=True, blank=True)

    # Content
    terms = models.TextField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    private_notes = models.TextField(
        null=True, blank=True, help_text="Internal notes not visible to customer")

    # Financial fields - matching import script
    delivery_charge = models.DecimalField(
        max_digits=10, decimal_places=2, default=0)
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    vat_rate = models.DecimalField(
        max_digits=5,
        decimal_places=4,
        default=0.18,
        help_text='VAT rate (e.g., 0.18 for 18%)'
    )
    vat_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Status and flags - matching import script
    total_applied = models.BooleanField(default=True)
    delivery_applied = models.BooleanField(default=True)
    finalized = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    # Costing integration - matching import script
    costing = models.ForeignKey(
        CostingEstimating,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='quotations'
    )

    # Display preference fields
    show_subtotal = models.BooleanField(
        default=True, 
        help_text="Show subtotal in quotation display"
    )
    show_delivery_charges = models.BooleanField(
        default=True, 
        help_text="Show delivery charges in quotation display"
    )

    # Audit trail - matching import script
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_quotations'
    )
    created_date = models.DateTimeField(
        auto_now_add=True, null=True, blank=True)
    updated_date = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'sales_quotations'
        ordering = ['-id']
        verbose_name = "Sales Quotation"
        verbose_name_plural = "Sales Quotations"

    def __str__(self):
        return f"Quote {self.quot_number} - {self.customer.name if self.customer else 'No Customer'}"

    @property
    def vat_rate_percent(self):
        """Return VAT rate as percentage for display (e.g., 18 for 0.18)."""
        return self.vat_rate * 100

    @property
    def timeline(self):
        """Get timeline entries for this quotation"""
        return self.timeline_entries.all().order_by('created_at')


class SalesQuotationItem(models.Model):
    """Sales quotation items - line items for quotations"""

    quotation = models.ForeignKey(
        SalesQuotation,
        on_delete=models.CASCADE,
        related_name='items'
    )

    # Item details - finished product reference
    finished_product = models.ForeignKey(
        FinishedProduct,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='quotation_items',
        help_text="Reference to finished product"
    )
    # Legacy fields for backward compatibility - will be removed after migration
    item_id = models.CharField(max_length=255, null=True, blank=True)
    item = models.CharField(max_length=255, null=True, blank=True)
    description = models.TextField(null=True, blank=True)

    # Pricing - matching import script
    quantity = models.IntegerField(null=True, blank=True)
    unit_price = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True)
    price = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True)

    # Costing integration - matching import script
    costing_sheet = models.ForeignKey(
        CostingSheet,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='quotation_items'
    )
    cs_profit_margin = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True)
    cs_profit = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True)
    cs_total = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True)

    class Meta:
        db_table = 'sales_quotation_items'
        ordering = ['id']
        verbose_name = "Sales Quotation Item"
        verbose_name_plural = "Sales Quotation Items"

    def __str__(self):
        return f"{self.quotation.quot_number} - {self.item or self.description or 'Item'} (Qty: {int(self.quantity) if self.quantity else 0})"


class SalesQuotationTimeline(models.Model):
    """
    Timeline tracking for quotation status events.

    Note: Communication events (email, print, WhatsApp) are now tracked
    in the DocumentCommunicationLog model (apps.core.models).
    This timeline is strictly for internal status changes.
    """

    EVENT_TYPE_CHOICES = [
        ('created', 'Created'),
        ('modified', 'Modified'),
        ('accepted', 'Accepted by Customer'),
        ('rejected', 'Rejected by Customer'),
        ('expired', 'Expired'),
        ('finalized', 'Finalized'),
        ('cancelled', 'Cancelled'),
        ('converted', 'Converted to Order'),
        ('draft', 'Marked as Draft'),
    ]

    quotation = models.ForeignKey(
        SalesQuotation,
        on_delete=models.CASCADE,
        related_name='timeline_entries'
    )

    event_type = models.CharField(max_length=50, choices=EVENT_TYPE_CHOICES)
    message = models.TextField()

    created_at = models.DateTimeField(default=timezone.now)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='quotation_timeline_entries'
    )

    class Meta:
        db_table = 'sales_quotation_timeline'
        ordering = ['-created_at']
        verbose_name = "Sales Quotation Timeline"
        verbose_name_plural = "Sales Quotation Timeline"

    def __str__(self):
        return f"{self.quotation.quot_number} - {self.get_event_type_display()}: {self.message[:50]}"


class QuotationShare(models.Model):
    """Secure sharing links for quotations"""
    
    quotation = models.ForeignKey(
        SalesQuotation,
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
        related_name='created_quotation_shares'
    )
    
    class Meta:
        db_table = 'quotation_shares'
        ordering = ['-created_at']
        verbose_name = "Quotation Share"
        verbose_name_plural = "Quotation Shares"
    
    def __str__(self):
        return f"{self.quotation.quot_number} - {self.token}"
    
    @property
    def is_expired(self):
        """Check if the share link has expired"""
        return timezone.now() > self.expires_at
    
    @classmethod
    def generate_token(cls):
        """Generate a secure token for sharing"""
        # Generate a mix of letters and numbers, avoiding similar characters
        chars = string.ascii_lowercase + string.ascii_uppercase + string.digits
        chars = chars.replace('0', '').replace('O', '').replace('l', '').replace('I', '').replace('1', '')
        return ''.join(secrets.choice(chars) for _ in range(12))
