from django.db import models
from django.utils import timezone


class FinishedProductCategory(models.Model):
    """
    Categories for finished products with hierarchical support.
    Examples: Books, Stationery, Large Format, etc.
    """
    
    category_name = models.CharField(max_length=255, help_text="Category name e.g., Books, Stationery")
    description = models.TextField(blank=True, help_text="Category description")
    parent_category = models.ForeignKey(
        'self', 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True,
        related_name='subcategories',
        help_text="Parent category for hierarchical structure"
    )
    income_account_id = models.CharField(
        max_length=50, 
        help_text="Income account ID for accounting integration e.g., 4300"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'finished_product_categories'
        ordering = ['category_name']
        verbose_name = "Finished Product Category"
        verbose_name_plural = "Finished Product Categories"
    
    def __str__(self):
        if self.parent_category:
            return f"{self.parent_category.category_name} > {self.category_name}"
        return self.category_name


class FinishedProduct(models.Model):
    """
    Master list of finished products that can be used across quotations, orders, and invoices.
    Examples: Books A4, Business Cards, Letterheads, etc.
    """
    
    name = models.CharField(max_length=255, help_text="Product name e.g., Books A4, Business Cards")
    width = models.DecimalField(
        max_digits=8, 
        decimal_places=2, 
        null=True, 
        blank=True,
        help_text="Width in mm"
    )
    height = models.DecimalField(
        max_digits=8, 
        decimal_places=2, 
        null=True, 
        blank=True,
        help_text="Height in mm"
    )
    description = models.TextField(
        blank=True, 
        help_text="Product description - leave blank for items with variable specifications"
    )
    category = models.ForeignKey(
        FinishedProductCategory,
        on_delete=models.CASCADE,
        related_name='products',
        help_text="Product category"
    )
    is_active = models.BooleanField(default=True)
    is_vat_exempt = models.BooleanField(
        default=False,
        help_text='Check for VAT-exempt items (Books, Newspapers, Educational materials)'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'finished_products'
        ordering = ['name']
        verbose_name = "Finished Product"
        verbose_name_plural = "Finished Products"
    
    def __str__(self):
        dimensions = ""
        if self.width and self.height:
            dimensions = f" ({self.width}mm x {self.height}mm)"
        return f"{self.name}{dimensions}"


# Legacy SalesItem model - kept for backward compatibility during transition
# Will be removed once all references are migrated to FinishedProduct
# class SalesItem(models.Model):
#     """
#     Master list of items that can be used across quotations, orders, and invoices.
#     Examples: Books A4 (297mm x 210mm), Docket Books A5 (210 x 148), Flyers A4 (297mm x 210mm)
#     """
#     
#     item_name = models.CharField(max_length=255, help_text="Item name e.g., Books A4 (297mm x 210mm)")
#     created_at = models.DateTimeField(auto_now_add=True)
#     updated_at = models.DateTimeField(auto_now=True)
#     is_active = models.BooleanField(default=True)
#     
#     class Meta:
#         db_table = 'sales_items'
#         ordering = ['item_name']
#         verbose_name = "Sales Item"
#         verbose_name_plural = "Sales Items"
#     
#     def __str__(self):
#         return self.item_name
