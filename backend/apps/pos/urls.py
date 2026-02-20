from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    POSOrderViewSet,
    POSQuickServiceItemViewSet,
    CashDrawerSessionViewSet,
    POSProductViewSet,
    POSCategoryViewSet,
    POSLocationViewSet,
)

router = DefaultRouter()

# Register ViewSets
router.register(r'orders', POSOrderViewSet, basename='posorder')
# Force reload
router.register(r'quick-services', POSQuickServiceItemViewSet, basename='quickservice')
router.register(r'cash-drawer-sessions', CashDrawerSessionViewSet, basename='cashdrawersession')

# Product Management
router.register(r'products', POSProductViewSet, basename='posproduct')
router.register(r'categories', POSCategoryViewSet, basename='poscategory')
router.register(r'locations', POSLocationViewSet, basename='poslocation')

urlpatterns = [
    path('', include(router.urls)),
]
