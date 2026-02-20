from django.db import models
from django.utils import timezone
from django.db.models import JSONField



class CostingEstimating(models.Model):
    """Main costing project records - matches costing_costing_estimating table"""
    costingId = models.IntegerField()
    customerId = models.IntegerField(null=True, blank=True)
    customerName = models.CharField(max_length=255, null=True, blank=True)
    projectName = models.CharField(max_length=255, null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    isOutbound = models.SmallIntegerField(default=0)
    isActive = models.IntegerField(default=1)
    companyId = models.IntegerField(null=True, blank=True)
    createdBy = models.IntegerField(null=True, blank=True)
    createdDate = models.DateTimeField(null=True, blank=True)
    updatedBy = models.IntegerField(null=True, blank=True)
    updatedDate = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'costing_costing_estimating'
        ordering = ['-id']
    
    def __str__(self):
        return f"{self.projectName or 'Unnamed Project'} (ID: {self.costingId})"


class CostingSheet(models.Model):
    """Individual costing sheets/variants - matches costing_costing_sheet table"""
    costingId = models.IntegerField()
    name = models.CharField(max_length=255, null=True, blank=True)  # Sheet/variant name (finished product name)
    finished_product_id = models.IntegerField(null=True, blank=True)  # ID of selected finished product
    quantity = models.DecimalField(max_digits=20, decimal_places=2, null=True, blank=True)
    subTotal = models.DecimalField(max_digits=20, decimal_places=2, null=True, blank=True)
    profitMargin = models.DecimalField(max_digits=20, decimal_places=2, null=True, blank=True)
    profitAmount = models.DecimalField(max_digits=20, decimal_places=2, null=True, blank=True)
    taxPercentage = models.DecimalField(max_digits=20, decimal_places=2, null=True, blank=True)
    taxProfitAmount = models.DecimalField(max_digits=20, decimal_places=2, null=True, blank=True)
    total = models.DecimalField(max_digits=20, decimal_places=2, null=True, blank=True)
    unitPrice = models.DecimalField(max_digits=20, decimal_places=2, null=True, blank=True)
    formulas = JSONField(null=True, blank=True)  # JSONB field containing all formula data
    activeSheet = models.SmallIntegerField(default=0)
    is_locked = models.SmallIntegerField(default=0)
    
    class Meta:
        db_table = 'costing_costing_sheet'
        ordering = ['id']
    
    def __str__(self):
        return f"Sheet {self.id} - Qty: {self.quantity} (Costing ID: {self.costingId})"
    
    @property
    def estimating(self):
        """Get related estimating record"""
        try:
            return CostingEstimating.objects.get(costingId=self.costingId)
        except CostingEstimating.DoesNotExist:
            return None
