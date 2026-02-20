"""
URL Configuration for Purchases Module

Provides REST API endpoints for:
- Purchase Orders
- Goods Received Notes (GRN)
- Supplier Bills
- Bill Payments
- Credit Notes
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PurchaseOrderViewSet,
    PurchaseOrderItemViewSet,
    GoodsReceivedNoteViewSet,
    GRNItemViewSet,
    SupplierBillViewSet,
    BillPaymentViewSet,
    BillScanViewSet,
    SupplierCreditNoteViewSet,
)

app_name = 'purchases'

# Create router and register viewsets
router = DefaultRouter()
router.register(r'orders', PurchaseOrderViewSet, basename='purchaseorder')
router.register(r'order-items', PurchaseOrderItemViewSet, basename='purchaseorderitem')
router.register(r'grns', GoodsReceivedNoteViewSet, basename='grn')
router.register(r'grn-items', GRNItemViewSet, basename='grnitem')
router.register(r'bills', SupplierBillViewSet, basename='supplierbill')
router.register(r'bill-payments', BillPaymentViewSet, basename='billpayment')
router.register(r'bill-scans', BillScanViewSet, basename='billscan')
router.register(r'credit-notes', SupplierCreditNoteViewSet, basename='suppliercreditnote')

urlpatterns = [
    path('', include(router.urls)),
]
