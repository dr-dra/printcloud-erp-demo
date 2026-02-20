from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    InvCategoryViewSet,
    InvUnitMeasureViewSet,
    InvItemViewSet,
    PriceHistoryViewSet,
    InvGoodsReceivedNoteViewSet,
    InvGRNItemViewSet,
    InvPRNViewSet,
    InvPRNItemViewSet,
    InvStockPositionViewSet,
    InvGoodsIssueNoteViewSet,
    InvGINItemViewSet,
    InvUsageReportViewSet,
    InvUsageItemViewSet,
    InvStockAdjustmentViewSet,
    InvStockAdjustmentItemViewSet,
    InvStockMovementViewSet,
    InvDispatchNoteViewSet,
    InvDispatchItemViewSet,
    InvWastageCategoryViewSet,
)

router = DefaultRouter()
router.register(r'categories', InvCategoryViewSet, basename='inv-category')
router.register(r'units', InvUnitMeasureViewSet, basename='inv-unit')
router.register(r'items', InvItemViewSet, basename='inv-item')
router.register(r'prices', PriceHistoryViewSet, basename='inv-price-history')
router.register(r'grns', InvGoodsReceivedNoteViewSet, basename='inv-grn')
router.register(r'grn-items', InvGRNItemViewSet, basename='inv-grn-item')
router.register(r'prns', InvPRNViewSet, basename='inv-prn')
router.register(r'prn-items', InvPRNItemViewSet, basename='inv-prn-item')
router.register(r'gins', InvGoodsIssueNoteViewSet, basename='inv-gin')
router.register(r'gin-items', InvGINItemViewSet, basename='inv-gin-item')
router.register(r'usage-reports', InvUsageReportViewSet, basename='inv-usage-report')
router.register(r'usage-items', InvUsageItemViewSet, basename='inv-usage-item')
router.register(r'adjustments', InvStockAdjustmentViewSet, basename='inv-adjustment')
router.register(r'adjustment-items', InvStockAdjustmentItemViewSet, basename='inv-adjustment-item')
router.register(r'stock-movements', InvStockMovementViewSet, basename='inv-stock-movement')
router.register(r'stock-position', InvStockPositionViewSet, basename='inv-stock-position')
router.register(r'dispatch-notes', InvDispatchNoteViewSet, basename='inv-dispatch-note')
router.register(r'dispatch-items', InvDispatchItemViewSet, basename='inv-dispatch-item')
router.register(r'wastage-categories', InvWastageCategoryViewSet, basename='inv-wastage-category')

urlpatterns = [
    path('', include(router.urls)),
]
