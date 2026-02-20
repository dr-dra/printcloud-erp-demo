from rest_framework import serializers

from .models import (
    InvCategory,
    InvUnitMeasure,
    InvItem,
    PriceHistory,
    InvGoodsReceivedNote,
    InvGRNItem,
    InvMRN,
    InvMRNItem,
    InvStockAllocation,
    InvPRN,
    InvPRNItem,
    InvPRNItemPOLink,
    InvGoodsIssueNote,
    InvGINItem,
    InvUsageReport,
    InvUsageItem,
    InvStockAdjustment,
    InvStockAdjustmentItem,
    InvStockMovement,
    InvDispatchNote,
    InvDispatchItem,
    InvWastageCategory,
)


class InvCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = InvCategory
        fields = [
            'id', 'code', 'name',
            'is_active', 'created_at', 'updated_at'
        ]


class InvUnitMeasureSerializer(serializers.ModelSerializer):
    base_unit_code = serializers.CharField(source='base_unit.code', read_only=True)

    class Meta:
        model = InvUnitMeasure
        fields = [
            'id', 'code', 'name', 'symbol', 'base_unit', 'base_unit_code',
            'conversion_factor', 'is_active', 'created_at', 'updated_at'
        ]


class InvItemSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    stock_uom_code = serializers.CharField(source='stock_uom.code', read_only=True)
    purchase_uom_code = serializers.CharField(source='purchase_uom.code', read_only=True)
    preferred_supplier_name = serializers.CharField(source='preferred_supplier.name', read_only=True)

    class Meta:
        model = InvItem
        fields = [
            'id', 'sku', 'name', 'category', 'category_name',
            'preferred_supplier', 'preferred_supplier_name',
            'stock_uom', 'stock_uom_code', 'purchase_uom', 'purchase_uom_code',
            'purchase_to_stock_factor',
            'gsm', 'width_mm', 'height_mm',
            'is_offcut', 'parent_item', 'exclude_from_valuation',
            'reorder_level', 'reorder_quantity', 'is_active',
            'created_at', 'updated_at'
        ]


class PriceHistorySerializer(serializers.ModelSerializer):
    item_sku = serializers.CharField(source='item.sku', read_only=True)
    item_name = serializers.CharField(source='item.name', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)

    class Meta:
        model = PriceHistory
        fields = [
            'id',
            'item',
            'item_sku',
            'item_name',
            'supplier',
            'supplier_name',
            'unit_price',
            'currency',
            'effective_date',
            'source_type',
            'source_ref',
            'source_id',
            'quantity',
            'remarks',
            'created_at',
            'created_by',
        ]


class PriceHistoryCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PriceHistory
        fields = [
            'item',
            'supplier',
            'unit_price',
            'currency',
            'effective_date',
            'source_type',
            'source_ref',
            'source_id',
            'quantity',
            'remarks',
        ]
        extra_kwargs = {
            'source_type': {'required': False},
        }

    def validate_source_type(self, value):
        if value not in ['QUOTATION', 'MANUAL']:
            raise serializers.ValidationError("Manual entries must use QUOTATION or MANUAL.")
        return value

    def validate(self, attrs):
        if not attrs.get('source_type'):
            attrs['source_type'] = 'MANUAL'
        return attrs


class InvGRNItemSerializer(serializers.ModelSerializer):
    item_sku = serializers.CharField(source='item.sku', read_only=True)
    item_name = serializers.CharField(source='item.name', read_only=True)
    purchase_order_item_name = serializers.CharField(source='purchase_order_item.item_name', read_only=True)

    class Meta:
        model = InvGRNItem
        fields = [
            'id', 'grn', 'purchase_order_item', 'purchase_order_item_name',
            'item', 'item_sku', 'item_name',
            'quantity_received', 'quantity_accepted', 'quantity_rejected',
            'unit_cost', 'notes'
        ]


class InvGoodsReceivedNoteSerializer(serializers.ModelSerializer):
    items = InvGRNItemSerializer(many=True, read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    purchase_order_number = serializers.CharField(source='purchase_order.po_number', read_only=True)

    class Meta:
        model = InvGoodsReceivedNote
        fields = [
            'id', 'grn_number', 'purchase_order', 'purchase_order_number',
            'supplier', 'supplier_name', 'received_date', 'inspection_date',
            'status', 'inspection_notes', 'quality_passed',
            'delivery_note_number', 'vehicle_number', 'driver_name', 'notes',
            'received_by', 'inspected_by', 'created_at', 'updated_at',
            'items'
        ]
        extra_kwargs = {
            'grn_number': {'required': False, 'allow_blank': True},
        }


class InvMRNItemSerializer(serializers.ModelSerializer):
    item_sku = serializers.CharField(source='item.sku', read_only=True)
    item_name = serializers.CharField(source='item.name', read_only=True)

    class Meta:
        model = InvMRNItem
        fields = [
            'id', 'mrn', 'item', 'item_sku', 'item_name',
            'required_qty', 'available_qty', 'allocated_qty', 'to_order_qty', 'status'
        ]


class InvMRNSerializer(serializers.ModelSerializer):
    items = InvMRNItemSerializer(many=True, read_only=True)

    class Meta:
        model = InvMRN
        fields = [
            'id', 'mrn_number', 'request_date', 'required_date', 'status',
            'job_reference', 'notes', 'created_by', 'approved_by',
            'approved_at', 'created_at', 'updated_at', 'items'
        ]
        extra_kwargs = {
            'mrn_number': {'required': False, 'allow_blank': True},
        }


class InvStockAllocationSerializer(serializers.ModelSerializer):
    item_sku = serializers.CharField(source='item.sku', read_only=True)
    item_name = serializers.CharField(source='item.name', read_only=True)

    class Meta:
        model = InvStockAllocation
        fields = [
            'id', 'mrn_item', 'item', 'item_sku', 'item_name',
            'quantity', 'status', 'allocated_at', 'released_at', 'created_by'
        ]


class InvPRNItemSerializer(serializers.ModelSerializer):
    item_sku = serializers.CharField(source='item.sku', read_only=True)
    item_name = serializers.CharField(source='item.name', read_only=True)
    prn_number = serializers.CharField(source='prn.prn_number', read_only=True)
    remaining_to_order = serializers.SerializerMethodField()

    class Meta:
        model = InvPRNItem
        fields = [
            'id', 'prn', 'prn_number', 'item', 'item_sku', 'item_name',
            'required_qty', 'ordered_qty', 'received_qty', 'status',
            'remaining_to_order'
        ]

    def get_remaining_to_order(self, obj):
        remaining = obj.required_qty - obj.ordered_qty
        return remaining if remaining > 0 else 0


class InvPRNSerializer(serializers.ModelSerializer):
    items = InvPRNItemSerializer(many=True, read_only=True)

    class Meta:
        model = InvPRN
        fields = [
            'id', 'prn_number', 'request_date', 'needed_by', 'status',
            'job_ticket_id', 'notes', 'requested_by', 'approved_by', 'approved_at',
            'created_at', 'updated_at', 'items'
        ]
        extra_kwargs = {
            'prn_number': {'required': False, 'allow_blank': True},
        }


class InvPRNItemPOLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvPRNItemPOLink
        fields = [
            'id', 'prn_item', 'purchase_order_item', 'ordered_qty'
        ]


class InvStockPositionSerializer(serializers.Serializer):
    item_id = serializers.IntegerField()
    item_sku = serializers.CharField()
    item_name = serializers.CharField()
    category_name = serializers.CharField()
    stock_uom_code = serializers.CharField(allow_null=True)
    location = serializers.CharField()
    on_hand = serializers.DecimalField(max_digits=14, decimal_places=2)
    allocated = serializers.DecimalField(max_digits=14, decimal_places=2)
    available = serializers.DecimalField(max_digits=14, decimal_places=2)
    on_order = serializers.DecimalField(max_digits=14, decimal_places=2)
    reorder_level = serializers.DecimalField(max_digits=12, decimal_places=2)
    status = serializers.CharField()


class InvGINItemSerializer(serializers.ModelSerializer):
    item_sku = serializers.CharField(source='item.sku', read_only=True)
    item_name = serializers.CharField(source='item.name', read_only=True)

    class Meta:
        model = InvGINItem
        fields = [
            'id', 'gin', 'item', 'item_sku', 'item_name',
            'quantity_issued', 'unit_cost', 'total_cost'
        ]


class InvGoodsIssueNoteSerializer(serializers.ModelSerializer):
    items = InvGINItemSerializer(many=True, read_only=True)
    prn_number = serializers.CharField(source='prn.prn_number', read_only=True)

    class Meta:
        model = InvGoodsIssueNote
        fields = [
            'id', 'gin_number', 'issue_date', 'status', 'job_reference', 'prn', 'prn_number',
            'cost_center', 'notes', 'issued_by', 'received_by', 'created_at', 'updated_at', 'items'
        ]
        extra_kwargs = {
            'gin_number': {'required': False, 'allow_blank': True},
        }

    def validate(self, attrs):
        prn = attrs.get('prn', getattr(self.instance, 'prn', None))
        cost_center = attrs.get('cost_center', getattr(self.instance, 'cost_center', None))

        if (prn and cost_center) or (not prn and not cost_center):
            raise serializers.ValidationError(
                "GIN must be linked to either a PRN or a Cost Center (exactly one)."
            )
        return attrs


class InvUsageItemSerializer(serializers.ModelSerializer):
    item_sku = serializers.CharField(source='item.sku', read_only=True)
    item_name = serializers.CharField(source='item.name', read_only=True)
    wastage_code = serializers.CharField(source='wastage_category.code', read_only=True)

    class Meta:
        model = InvUsageItem
        fields = [
            'id', 'usage_report', 'item', 'item_sku', 'item_name',
            'issued_qty', 'used_qty', 'returned_qty', 'spoiled_qty',
            'wastage_category', 'wastage_code', 'notes'
        ]


class InvUsageReportSerializer(serializers.ModelSerializer):
    items = InvUsageItemSerializer(many=True, read_only=True)

    class Meta:
        model = InvUsageReport
        fields = [
            'id', 'report_number', 'report_date', 'job_reference',
            'gin', 'notes', 'created_by', 'created_at', 'items'
        ]
        extra_kwargs = {
            'report_number': {'required': False, 'allow_blank': True},
        }


class InvStockAdjustmentItemSerializer(serializers.ModelSerializer):
    item_sku = serializers.CharField(source='item.sku', read_only=True)
    item_name = serializers.CharField(source='item.name', read_only=True)

    class Meta:
        model = InvStockAdjustmentItem
        fields = [
            'id', 'adjustment', 'item', 'item_sku', 'item_name',
            'quantity_change', 'unit_cost', 'notes'
        ]


class InvStockAdjustmentSerializer(serializers.ModelSerializer):
    items = InvStockAdjustmentItemSerializer(many=True, read_only=True)

    class Meta:
        model = InvStockAdjustment
        fields = [
            'id', 'adjustment_number', 'adjustment_date', 'status', 'reason',
            'notes', 'requested_by', 'approved_by', 'approved_at',
            'created_at', 'updated_at', 'items'
        ]
        extra_kwargs = {
            'adjustment_number': {'required': False, 'allow_blank': True},
        }


class InvStockMovementSerializer(serializers.ModelSerializer):
    item_sku = serializers.CharField(source='item.sku', read_only=True)
    item_name = serializers.CharField(source='item.name', read_only=True)

    class Meta:
        model = InvStockMovement
        fields = [
            'id', 'item', 'item_sku', 'item_name', 'movement_type',
            'quantity', 'quantity_before', 'quantity_after',
            'unit_cost', 'total_value', 'reference_type', 'reference_id',
            'notes', 'created_by', 'created_at'
        ]


class InvDispatchItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvDispatchItem
        fields = [
            'id', 'dispatch_note', 'item_description', 'quantity', 'parcels'
        ]


class InvDispatchNoteSerializer(serializers.ModelSerializer):
    items = InvDispatchItemSerializer(many=True, read_only=True)

    class Meta:
        model = InvDispatchNote
        fields = [
            'id', 'dispatch_number', 'dispatch_date', 'status',
            'invoice_reference', 'job_reference', 'notes',
            'created_by', 'created_at', 'items'
        ]
        extra_kwargs = {
            'dispatch_number': {'required': False, 'allow_blank': True},
        }


class InvWastageCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = InvWastageCategory
        fields = [
            'id', 'code', 'name', 'description', 'is_active'
        ]
