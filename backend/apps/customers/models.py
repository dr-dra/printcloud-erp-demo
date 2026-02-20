from django.db import models
from apps.users.models import User


class Customer(models.Model):
    CUSTOMER_TYPE_CHOICES = [
        ('individual', 'Individual'),
        ('business', 'Business'),
    ]

    legacy_id = models.IntegerField(unique=True)
    name = models.CharField(max_length=255)
    customer_type = models.CharField(max_length=10, choices=CUSTOMER_TYPE_CHOICES, default='individual')

    email = models.EmailField(null=True, blank=True)
    contact = models.CharField(max_length=50, null=True, blank=True)
    account_no = models.CharField(max_length=255, null=True, blank=True)
    website = models.URLField(null=True, blank=True)
    fax = models.CharField(max_length=255, null=True, blank=True)
    bank_account_name = models.CharField(max_length=255, null=True, blank=True)
    bank_name = models.CharField(max_length=255, null=True, blank=True)
    bank_account_number = models.CharField(max_length=255, null=True, blank=True)

    credit_limit = models.FloatField(null=True, blank=True)
    due_on_days = models.IntegerField(null=True, blank=True)
    payment_term = models.IntegerField(null=True, blank=True)

    pos_customer = models.BooleanField(
        default=False,
        help_text="Mark as POS walk-in customer"
    )

    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='customers_created')
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='customers_updated')
    created_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'customers_customer'
        verbose_name = "Customer"
        verbose_name_plural = "Customers"


    def __str__(self):
        return self.name


class CustomerAltContact(models.Model):
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='alt_contacts')
    number = models.CharField(max_length=50)
    note = models.CharField(max_length=255, null=True, blank=True)

    class Meta:
        db_table = 'customers_customeraltcontact'

    def __str__(self):
        return f"{self.number} ({self.note or 'no note'})"


class CustomerAddress(models.Model):
    ADDRESS_TYPE_CHOICES = [
        ('billing', 'Billing'),
        ('shipping', 'Shipping'),
    ]

    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='addresses')
    type = models.CharField(max_length=10, choices=ADDRESS_TYPE_CHOICES)
    line1 = models.CharField(max_length=255)
    line2 = models.CharField(max_length=255, null=True, blank=True)
    city = models.CharField(max_length=255)
    zip_code = models.CharField(max_length=20, null=True, blank=True)
    province = models.CharField(max_length=50, null=True, blank=True)
    country = models.CharField(max_length=100, null=True, blank=True, default="Sri Lanka")
    phone = models.CharField(max_length=50, null=True, blank=True)
    delivery_instructions = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'customers_customeraddress'

    def __str__(self):
        return f"{self.get_type_display()} Address for {self.customer.name}"


def customer_document_upload_path(instance, filename):
    """Generate upload path for customer documents"""
    # Organize files: customer-files/customer_123/filename
    return f'customer-files/customer_{instance.customer.id}/{filename}'

class CustomerDocument(models.Model):
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='documents')
    file = models.FileField(upload_to=customer_document_upload_path)
    title = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)

    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'customers_customerdocument'

    def __str__(self):
        return f"{self.title} ({self.customer.name})"


class CustomerEmail(models.Model):
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='emails')
    email = models.EmailField()
    
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'customers_customeremail'
        unique_together = ('customer', 'email')
        verbose_name = "Customer Email"
        verbose_name_plural = "Customer Emails"

    def __str__(self):
        return f"{self.email} ({self.customer.name})"
