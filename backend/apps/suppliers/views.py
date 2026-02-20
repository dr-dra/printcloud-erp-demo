"""
Views for Suppliers Module

Provides REST API views for:
- Suppliers
- Supplier Contacts
- Supplier Documents
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import Supplier, SupplierContact, SupplierDocument
from .serializers import (
    SupplierSerializer,
    SupplierListSerializer,
    SupplierContactSerializer,
    SupplierDocumentSerializer,
)


class SupplierViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Supplier management.
    Supports CRUD operations for supplier records.
    """
    queryset = Supplier.objects.prefetch_related('contacts', 'documents')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['is_active', 'country']
    search_fields = ['supplier_code', 'name', 'company_name', 'email']
    ordering_fields = ['supplier_code', 'name', 'created_at', 'current_balance']
    ordering = ['supplier_code']

    def get_serializer_class(self):
        """Use list serializer for list action."""
        if self.action == 'list':
            return SupplierListSerializer
        return SupplierSerializer

    def get_queryset(self):
        """Filter queryset based on query parameters."""
        queryset = super().get_queryset()

        # Filter by active status (default: show active only)
        active = self.request.query_params.get('active')
        if active is not None:
            queryset = queryset.filter(is_active=active.lower() == 'true')
        else:
            # Default: show only active suppliers
            queryset = queryset.filter(is_active=True)

        return queryset

    def perform_create(self, serializer):
        """Set created_by on new suppliers."""
        serializer.save(created_by=self.request.user)

    def perform_destroy(self, instance):
        """
        Don't actually delete - just deactivate.
        """
        instance.is_active = False
        instance.save()

    @action(detail=True, methods=['get'])
    def balance(self, request, pk=None):
        """Get current balance for a supplier."""
        supplier = self.get_object()
        return Response({
            'supplier_code': supplier.supplier_code,
            'supplier_name': supplier.name,
            'current_balance': supplier.current_balance,
        })

    @action(detail=True, methods=['get'])
    def bills(self, request, pk=None):
        """Get all bills for a supplier."""
        from apps.purchases.models import SupplierBill
        from apps.purchases.serializers import SupplierBillListSerializer

        supplier = self.get_object()
        bills = SupplierBill.objects.filter(supplier=supplier).order_by('-bill_date')

        # Apply filters
        status_filter = request.query_params.get('status')
        if status_filter:
            bills = bills.filter(status=status_filter)

        serializer = SupplierBillListSerializer(bills, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def payments(self, request, pk=None):
        """Get payment history for a supplier."""
        from apps.purchases.models import BillPayment
        from apps.purchases.serializers import BillPaymentSerializer

        supplier = self.get_object()
        payments = BillPayment.objects.filter(
            bill__supplier=supplier
        ).select_related('bill').order_by('-payment_date')

        serializer = BillPaymentSerializer(payments, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def purchase_orders(self, request, pk=None):
        """Get all purchase orders for a supplier."""
        from apps.purchases.models import PurchaseOrder
        from apps.purchases.serializers import PurchaseOrderListSerializer

        supplier = self.get_object()
        purchase_orders = PurchaseOrder.objects.filter(
            supplier=supplier
        ).order_by('-order_date')

        # Apply filters
        status_filter = request.query_params.get('status')
        if status_filter:
            purchase_orders = purchase_orders.filter(status=status_filter)

        serializer = PurchaseOrderListSerializer(purchase_orders, many=True)
        return Response(serializer.data)


class SupplierContactViewSet(viewsets.ModelViewSet):
    """ViewSet for SupplierContact management."""
    queryset = SupplierContact.objects.select_related('supplier')
    serializer_class = SupplierContactSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['supplier', 'is_primary']
    search_fields = ['name', 'email', 'phone']
    ordering = ['supplier', 'name']


class SupplierDocumentViewSet(viewsets.ModelViewSet):
    """ViewSet for SupplierDocument management."""
    queryset = SupplierDocument.objects.select_related('supplier', 'uploaded_by')
    serializer_class = SupplierDocumentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['supplier', 'document_type']
    search_fields = ['title', 'description']
    ordering = ['-uploaded_at']

    def perform_create(self, serializer):
        """Set uploaded_by on new documents."""
        serializer.save(uploaded_by=self.request.user)
