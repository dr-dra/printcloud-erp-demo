"""
Serializers for Purchases Module

Provides REST API serialization for:
- Purchase Orders
- Goods Received Notes (GRN)
- Supplier Bills
- Bill Payments
- Credit Notes
"""

from rest_framework import serializers
from decimal import Decimal
from .models import (
    PurchaseOrder,
    PurchaseOrderItem,
    PurchaseOrderTimeline,
    GoodsReceivedNote,
    GRNItem,
    SupplierBill,
    BillPayment,
    BillScan,
    SupplierCreditNote
)
from apps.suppliers.serializers import SupplierSerializer


# ==============================================================================
# Purchase Order Serializers
# ==============================================================================

class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    """Serializer for PurchaseOrderItem model."""

    item_sku = serializers.CharField(source='item.sku', read_only=True)
    item_display_name = serializers.CharField(source='item.name', read_only=True)
    quantity_pending = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        read_only=True
    )
    is_fully_received = serializers.BooleanField(read_only=True)

    class Meta:
        model = PurchaseOrderItem
        fields = [
            'id',
            'purchase_order',
            'line_number',
            'item',
            'item_sku',
            'item_display_name',
            'item_name',
            'description',
            'quantity',
            'unit_of_measure',
            'unit_price',
            'tax_rate',
            'amount',
            'quantity_received',
            'quantity_pending',
            'is_fully_received',
        ]
        read_only_fields = [
            'id',
            'amount',
            'quantity_received',
            'quantity_pending',
            'is_fully_received',
        ]


class PurchaseOrderTimelineSerializer(serializers.ModelSerializer):
    """Serializer for PurchaseOrderTimeline model."""

    created_by_name = serializers.CharField(
        source='created_by.get_full_name',
        read_only=True
    )

    class Meta:
        model = PurchaseOrderTimeline
        fields = [
            'id',
            'purchase_order',
            'event_type',
            'message',
            'old_status',
            'new_status',
            'created_by',
            'created_by_name',
            'created_at',
        ]
        read_only_fields = ['id', 'created_by_name', 'created_at']


class PurchaseOrderSerializer(serializers.ModelSerializer):
    """Full serializer for PurchaseOrder with nested items and timeline."""

    items = PurchaseOrderItemSerializer(many=True, read_only=True)
    timeline_entries = PurchaseOrderTimelineSerializer(many=True, read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    supplier_detail = SupplierSerializer(source='supplier', read_only=True)
    created_by_name = serializers.CharField(
        source='created_by.get_full_name',
        read_only=True
    )

    class Meta:
        model = PurchaseOrder
        fields = [
            'id',
            'po_number',
            'supplier',
            'supplier_name',
            'supplier_detail',
            'order_date',
            'expected_delivery_date',
            'actual_delivery_date',
            'status',
            'subtotal',
            'tax_amount',
            'discount_amount',
            'total',
            'delivery_address',
            'shipping_method',
            'notes',
            'supplier_notes',
            'created_by',
            'created_by_name',
            'created_at',
            'updated_at',
            'items',
            'timeline_entries',
        ]
        read_only_fields = [
            'id',
            'subtotal',
            'total',
            'actual_delivery_date',
            'created_by',
            'created_by_name',
            'created_at',
            'updated_at',
            'items',
            'timeline_entries',
        ]


class PurchaseOrderListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for purchase order lists."""

    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    created_by_name = serializers.CharField(
        source='created_by.get_full_name',
        read_only=True
    )

    class Meta:
        model = PurchaseOrder
        fields = [
            'id',
            'po_number',
            'supplier_name',
            'order_date',
            'expected_delivery_date',
            'status',
            'total',
            'created_by_name',
        ]


# ==============================================================================
# GRN Serializers
# ==============================================================================

class GRNItemSerializer(serializers.ModelSerializer):
    """Serializer for GRNItem model."""

    purchase_order_item_name = serializers.CharField(
        source='purchase_order_item.item_name',
        read_only=True
    )

    class Meta:
        model = GRNItem
        fields = [
            'id',
            'grn',
            'purchase_order_item',
            'purchase_order_item_name',
            'quantity_received',
            'quantity_accepted',
            'quantity_rejected',
            'notes',
        ]
        read_only_fields = ['id', 'purchase_order_item_name']


class GoodsReceivedNoteSerializer(serializers.ModelSerializer):
    """Full serializer for GoodsReceivedNote with nested items."""

    items = GRNItemSerializer(many=True, read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    purchase_order_number = serializers.CharField(
        source='purchase_order.po_number',
        read_only=True
    )
    received_by_name = serializers.CharField(
        source='received_by.get_full_name',
        read_only=True
    )
    inspected_by_name = serializers.CharField(
        source='inspected_by.get_full_name',
        read_only=True
    )

    class Meta:
        model = GoodsReceivedNote
        fields = [
            'id',
            'grn_number',
            'purchase_order',
            'purchase_order_number',
            'supplier',
            'supplier_name',
            'received_date',
            'inspection_date',
            'status',
            'inspection_notes',
            'quality_passed',
            'delivery_note_number',
            'vehicle_number',
            'driver_name',
            'notes',
            'received_by',
            'received_by_name',
            'inspected_by',
            'inspected_by_name',
            'created_at',
            'updated_at',
            'items',
        ]
        read_only_fields = [
            'id',
            'purchase_order_number',
            'supplier_name',
            'received_by_name',
            'inspected_by_name',
            'created_at',
            'updated_at',
            'items',
        ]


class GoodsReceivedNoteListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for GRN lists."""

    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    purchase_order_number = serializers.CharField(
        source='purchase_order.po_number',
        read_only=True
    )

    class Meta:
        model = GoodsReceivedNote
        fields = [
            'id',
            'grn_number',
            'purchase_order_number',
            'supplier_name',
            'received_date',
            'status',
            'quality_passed',
        ]


# ==============================================================================
# Supplier Bill Serializers
# ==============================================================================

class BillPaymentSerializer(serializers.ModelSerializer):
    """Serializer for BillPayment model."""

    created_by_name = serializers.CharField(
        source='created_by.get_full_name',
        read_only=True
    )

    class Meta:
        model = BillPayment
        fields = [
            'id',
            'bill',
            'payment_date',
            'amount',
            'payment_method',
            'reference_number',
            'cheque_number',
            'cheque_date',
            'cheque_cleared',
            'cheque_cleared_date',
            'notes',
            'created_by',
            'created_by_name',
            'created_at',
        ]
        read_only_fields = [
            'id',
            'created_by',
            'created_by_name',
            'created_at',
        ]

    def validate(self, data):
        """Validate cheque fields."""
        if data.get('payment_method') == 'cheque':
            if not data.get('cheque_number'):
                raise serializers.ValidationError({
                    'cheque_number': 'Cheque number is required for cheque payments'
                })
        return data


class SupplierBillSerializer(serializers.ModelSerializer):
    """Full serializer for SupplierBill with nested payments."""

    payments = BillPaymentSerializer(many=True, read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    purchase_order_number = serializers.CharField(
        source='purchase_order.po_number',
        read_only=True,
        allow_null=True
    )
    created_by_name = serializers.CharField(
        source='created_by.get_full_name',
        read_only=True
    )
    approved_by_name = serializers.CharField(
        source='approved_by.get_full_name',
        read_only=True
    )
    scan_file_url = serializers.SerializerMethodField()
    scan_summary = serializers.SerializerMethodField()

    class Meta:
        model = SupplierBill
        fields = [
            'id',
            'internal_reference',
            'bill_number',
            'supplier',
            'supplier_name',
            'purchase_order',
            'purchase_order_number',
            'bill_date',
            'due_date',
            'payment_date',
            'status',
            'subtotal',
            'tax_amount',
            'discount_amount',
            'total',
            'amount_paid',
            'balance_due',
            'notes',
            'approved_by',
            'approved_by_name',
            'approved_at',
            'created_by',
            'created_by_name',
            'created_at',
            'updated_at',
            'payments',
            'scan_file_url',
            'scan_summary',
        ]
        read_only_fields = [
            'id',
            'total',
            'amount_paid',
            'balance_due',
            'payment_date',
            'approved_by',
            'approved_by_name',
            'approved_at',
            'created_by',
            'created_by_name',
            'created_at',
            'updated_at',
            'payments',
        ]

    def create(self, validated_data):
        """Compute totals before creating a supplier bill."""
        subtotal = validated_data.get('subtotal')
        tax_amount = validated_data.get('tax_amount', 0)
        discount_amount = validated_data.get('discount_amount', 0)

        if subtotal is None:
            raise serializers.ValidationError({'subtotal': 'Subtotal is required.'})

        total = subtotal + tax_amount - discount_amount
        validated_data['total'] = total

        return super().create(validated_data)

    def update(self, instance, validated_data):
        """Recalculate total when amounts change."""
        subtotal = validated_data.get('subtotal', instance.subtotal)
        tax_amount = validated_data.get('tax_amount', instance.tax_amount)
        discount_amount = validated_data.get('discount_amount', instance.discount_amount)
        validated_data['total'] = subtotal + tax_amount - discount_amount
        return super().update(instance, validated_data)

    def get_scan_file_url(self, obj):
        """Get URL of original scanned bill document if available"""
        if hasattr(obj, 'scan_source') and obj.scan_source and obj.scan_source.file:
            return obj.scan_source.file.url
        return None

    def get_scan_summary(self, obj):
        """Get AI-generated summary of bill contents if available"""
        if hasattr(obj, 'scan_source') and obj.scan_source:
            return obj.scan_source.summary
        return None


class SupplierBillListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for supplier bill lists."""

    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    has_scan = serializers.SerializerMethodField()

    class Meta:
        model = SupplierBill
        fields = [
            'id',
            'internal_reference',
            'bill_number',
            'supplier_name',
            'bill_date',
            'due_date',
            'status',
            'total',
            'balance_due',
            'has_scan',
        ]

    def get_has_scan(self, obj):
        """Check if bill has an associated scan document"""
        return hasattr(obj, 'scan_source') and obj.scan_source is not None


# ==============================================================================
# Supplier Credit Note Serializers
# ==============================================================================

class SupplierCreditNoteSerializer(serializers.ModelSerializer):
    """Serializer for SupplierCreditNote model."""

    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    supplier_bill_number = serializers.CharField(
        source='supplier_bill.bill_number',
        read_only=True,
        allow_null=True
    )
    applied_to_bill_number = serializers.CharField(
        source='applied_to_bill.bill_number',
        read_only=True,
        allow_null=True
    )
    created_by_name = serializers.CharField(
        source='created_by.get_full_name',
        read_only=True
    )
    approved_by_name = serializers.CharField(
        source='approved_by.get_full_name',
        read_only=True
    )

    class Meta:
        model = SupplierCreditNote
        fields = [
            'id',
            'credit_note_number',
            'supplier',
            'supplier_name',
            'supplier_bill',
            'supplier_bill_number',
            'credit_note_date',
            'status',
            'amount',
            'reason',
            'description',
            'applied_to_bill',
            'applied_to_bill_number',
            'applied_at',
            'approved_by',
            'approved_by_name',
            'approved_at',
            'created_by',
            'created_by_name',
            'created_at',
            'updated_at',
        ]
        extra_kwargs = {
            'po_number': {'required': False, 'allow_blank': True},
        }
        read_only_fields = [
            'id',
            'supplier_name',
            'supplier_bill_number',
            'applied_to_bill_number',
            'applied_at',
            'approved_by',
            'approved_by_name',
            'approved_at',
            'created_by_name',
            'created_at',
            'updated_at',
        ]


class SupplierCreditNoteListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for supplier credit note lists."""

    supplier_name = serializers.CharField(source='supplier.name', read_only=True)

    class Meta:
        model = SupplierCreditNote
        fields = [
            'id',
            'credit_note_number',
            'supplier_name',
            'credit_note_date',
            'status',
            'amount',
            'reason',
        ]


# ==============================================================================
# Bill Scan Serializers (AI-Powered Bill Extraction)
# ==============================================================================

class BillScanSerializer(serializers.ModelSerializer):
    """
    Serializer for BillScan with all details including AI extraction results.

    Used for:
    - Retrieving individual bill scan details
    - Updating user edits and extracted data
    """
    uploaded_by_name = serializers.CharField(
        source='uploaded_by.get_full_name',
        read_only=True
    )
    matched_supplier_name = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = BillScan
        fields = [
            'id',
            'file',
            'file_url',
            'file_name',
            'file_size',
            'file_type',
            'processing_status',
            'processing_started_at',
            'processing_completed_at',
            'processing_error',
            'extracted_data',
            'summary',
            'matched_supplier',
            'matched_supplier_name',
            'supplier_match_confidence',
            'user_edited_fields',
            'created_bill',
            'uploaded_by',
            'uploaded_by_name',
            'uploaded_at',
            'updated_at',
        ]
        read_only_fields = [
            'processing_status',
            'processing_started_at',
            'processing_completed_at',
            'processing_error',
            'textract_response',
            'claude_response',
            'extracted_data',
            'matched_supplier',
            'supplier_match_confidence',
            'uploaded_by',
            'uploaded_at',
            'updated_at',
        ]

    def get_matched_supplier_name(self, obj):
        """Get matched supplier name safely"""
        if obj.matched_supplier:
            return obj.matched_supplier.name
        return None

    def get_file_url(self, obj):
        """Get signed S3 URL for file"""
        if obj.file:
            return obj.file.url
        return None


class BillScanListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for bill scan list views.

    Shows only essential fields for list display.
    """
    uploaded_by_name = serializers.CharField(
        source='uploaded_by.get_full_name',
        read_only=True
    )
    matched_supplier_name = serializers.SerializerMethodField()

    class Meta:
        model = BillScan
        fields = [
            'id',
            'file_name',
            'processing_status',
            'matched_supplier_name',
            'uploaded_by_name',
            'uploaded_at',
        ]

    def get_matched_supplier_name(self, obj):
        """Get matched supplier name safely"""
        if obj.matched_supplier:
            return obj.matched_supplier.name
        return None
