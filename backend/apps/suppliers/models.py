from django.db import models
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

User = get_user_model()


class Supplier(models.Model):
    """
    Supplier/vendor master records.

    Similar to Customer model pattern.
    Tracks supplier information, payment terms, and current balance.
    """
    supplier_code = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text="Unique supplier code (e.g., SUP-001)"
    )
    name = models.CharField(
        max_length=255,
        db_index=True,
        help_text="Supplier name"
    )
    company_name = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text="Official company name (if different from name)"
    )

    # Contact information
    email = models.EmailField(null=True, blank=True)
    phone = models.CharField(max_length=20, null=True, blank=True)
    mobile = models.CharField(max_length=20, null=True, blank=True)
    website = models.URLField(null=True, blank=True)

    # Address
    address_line1 = models.CharField(max_length=255, null=True, blank=True)
    address_line2 = models.CharField(max_length=255, null=True, blank=True)
    city = models.CharField(max_length=100, null=True, blank=True)
    state = models.CharField(max_length=100, null=True, blank=True)
    postal_code = models.CharField(max_length=20, null=True, blank=True)
    country = models.CharField(max_length=100, default='Sri Lanka')

    # Financial settings
    payment_terms_days = models.IntegerField(
        default=30,
        help_text="Payment terms in days (e.g., Net 30)"
    )
    credit_limit = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text="Maximum credit limit"
    )
    current_balance = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text="Current outstanding balance (updated by bills/payments)"
    )

    # Tax information
    tax_id = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        help_text="Tax ID / VAT number"
    )

    # Banking details
    bank_name = models.CharField(max_length=255, null=True, blank=True)
    bank_account_number = models.CharField(max_length=50, null=True, blank=True)
    bank_account_name = models.CharField(max_length=255, null=True, blank=True)
    bank_branch = models.CharField(max_length=255, null=True, blank=True)

    # Additional information
    notes = models.TextField(null=True, blank=True)

    # Status
    is_active = models.BooleanField(default=True)

    # Audit
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='created_suppliers'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Supplier"
        verbose_name_plural = "Suppliers"
        ordering = ['name']
        indexes = [
            models.Index(fields=['supplier_code']),
            models.Index(fields=['name']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return f"{self.supplier_code} - {self.name}"

    def update_balance(self, amount):
        """
        Update supplier balance.

        Args:
            amount: Amount to add (positive for new bills, negative for payments)
        """
        self.current_balance += amount
        self.save(update_fields=['current_balance', 'updated_at'])


class SupplierContact(models.Model):
    """
    Multiple contacts per supplier.

    Allows tracking different contact persons at the same supplier.
    """
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.CASCADE,
        related_name='contacts'
    )
    name = models.CharField(max_length=255)
    position = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        help_text="Job title or position"
    )
    email = models.EmailField(null=True, blank=True)
    phone = models.CharField(max_length=20, null=True, blank=True)
    mobile = models.CharField(max_length=20, null=True, blank=True)
    is_primary = models.BooleanField(
        default=False,
        help_text="Primary contact for this supplier"
    )
    notes = models.TextField(null=True, blank=True)

    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Supplier Contact"
        verbose_name_plural = "Supplier Contacts"
        ordering = ['-is_primary', 'name']

    def __str__(self):
        primary = " (Primary)" if self.is_primary else ""
        return f"{self.name}{primary} - {self.supplier.name}"

    def clean(self):
        """Validate at least one contact method"""
        super().clean()
        if not any([self.email, self.phone, self.mobile]):
            raise ValidationError("Contact must have at least one contact method (email, phone, or mobile)")


class SupplierDocument(models.Model):
    """
    Document storage for suppliers (S3).

    Similar to CustomerDocument pattern.
    Stores contracts, invoices, certificates, etc.
    """
    DOCUMENT_TYPE_CHOICES = [
        ('contract', 'Contract'),
        ('invoice', 'Invoice'),
        ('certificate', 'Certificate'),
        ('tax_document', 'Tax Document'),
        ('price_list', 'Price List'),
        ('product_catalog', 'Product Catalog'),
        ('quality_cert', 'Quality Certificate'),
        ('other', 'Other'),
    ]

    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.CASCADE,
        related_name='documents'
    )
    file = models.FileField(
        upload_to='supplier-documents/',
        help_text="Document file (stored in S3)"
    )
    title = models.CharField(max_length=255)
    document_type = models.CharField(
        max_length=50,
        choices=DOCUMENT_TYPE_CHOICES,
        default='other'
    )
    description = models.TextField(null=True, blank=True)
    file_size = models.IntegerField(
        null=True,
        blank=True,
        help_text="File size in bytes"
    )

    # Audit
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='uploaded_supplier_documents'
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Supplier Document"
        verbose_name_plural = "Supplier Documents"
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.title} - {self.supplier.name}"

    def save(self, *args, **kwargs):
        """Auto-set file size on save"""
        if self.file and not self.file_size:
            try:
                self.file_size = self.file.size
            except Exception:
                pass
        super().save(*args, **kwargs)
