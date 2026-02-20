"""
URL Configuration for Suppliers Module

Provides REST API endpoints for:
- Suppliers
- Supplier Contacts
- Supplier Documents
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SupplierViewSet,
    SupplierContactViewSet,
    SupplierDocumentViewSet,
)

app_name = 'suppliers'

# Create router and register viewsets
# IMPORTANT: Register more specific patterns BEFORE generic patterns
router = DefaultRouter()
router.register(r'contacts', SupplierContactViewSet, basename='suppliercontact')
router.register(r'documents', SupplierDocumentViewSet, basename='supplierdocument')
router.register(r'', SupplierViewSet, basename='supplier')

urlpatterns = [
    path('', include(router.urls)),
]
