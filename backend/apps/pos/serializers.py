from rest_framework import serializers
from .models import (
    POSOrder, POSOrderItem,
    POSTransaction, POSTransactionItem, POSPayment,
    CashDrawerSession, CustomerAccount, CustomerAccountTransaction,
    POSProduct, POSCategory, POSLocation, POSZReport
)
from apps.customers.models import Customer


# =============================================================================
# POS Order Serializers
# =============================================================================

class POSOrderItemSerializer(serializers.ModelSerializer):
    """Serializer for POS order line items"""

    product_id = serializers.IntegerField(write_only=True, required=False)
    product_name = serializers.CharField(source='item_name', read_only=True)
    product_sku = serializers.CharField(source='sku', read_only=True)

    class Meta:
        model = POSOrderItem
        fields = [
            'id', 'product', 'product_id', 'product_name', 'product_sku',
            'item_name', 'sku', 'quantity', 'unit_price',
            'tax_rate', 'tax_amount', 'discount_amount', 'line_total', 'notes'
        ]
        read_only_fields = ['id', 'item_name', 'sku', 'tax_amount', 'line_total']


class POSOrderListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list view"""

    customer_name = serializers.CharField(source='customer.name', read_only=True, allow_null=True)
    created_by_email = serializers.CharField(source='created_by.email', read_only=True)
    item_count = serializers.SerializerMethodField()
    display_code = serializers.SerializerMethodField()

    class Meta:
        model = POSOrder
        fields = [
            'id', 'order_number', 'display_code', 'status', 'customer', 'customer_name',
            'total', 'created_at', 'created_by_email', 'item_count'
        ]

    def get_item_count(self, obj):
        return obj.items.count()

    def get_display_code(self, obj):
        """Return the last 3 digits for easy reading (e.g., '001')"""
        return obj.order_number[-3:] if obj.order_number else ""


class POSOrderDetailSerializer(serializers.ModelSerializer):
    """Full serializer with nested items for detail view"""

    items = POSOrderItemSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True, allow_null=True)
    location_name = serializers.CharField(source='location.name', read_only=True)
    created_by_email = serializers.CharField(source='created_by.email', read_only=True)
    completed_by_email = serializers.CharField(source='completed_by.email', read_only=True, allow_null=True)
    voided_by_email = serializers.CharField(source='voided_by.email', read_only=True, allow_null=True)
    is_editable = serializers.BooleanField(read_only=True)
    display_code = serializers.SerializerMethodField()

    class Meta:
        model = POSOrder
        fields = [
            'id', 'order_number', 'display_code', 'status', 'location', 'location_name',
            'customer', 'customer_name', 'subtotal', 'discount_amount',
            'tax_amount', 'total', 'notes', 'items', 'created_by',
            'created_by_email', 'created_at', 'updated_at', 'completed_by',
            'completed_by_email', 'completed_at', 'voided_by', 'voided_by_email',
            'voided_at', 'void_reason', 'is_editable', 'related_transaction'
        ]
        read_only_fields = [
            'id', 'order_number', 'display_code', 'status', 'subtotal', 'discount_amount',
            'tax_amount', 'total', 'created_at', 'updated_at', 'completed_at',
            'completed_by', 'voided_at', 'voided_by', 'void_reason',
            'is_editable', 'related_transaction'
        ]

    def get_display_code(self, obj):
        """Return the last 3 digits for easy reading (e.g., '001')"""
        return obj.order_number[-3:] if obj.order_number else ""


class POSOrderCreateSerializer(serializers.Serializer):
    """Serializer for creating new orders"""

    location_id = serializers.IntegerField()
    customer_id = serializers.IntegerField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    items = serializers.ListField(
        child=serializers.DictField(),
        help_text="List of items with: product_id, quantity, unit_price, tax_rate, discount_amount"
    )

    def validate_items(self, items):
        """Validate items structure"""
        if not items:
            raise serializers.ValidationError("At least one item is required")

        for item in items:
            if 'product_id' not in item:
                raise serializers.ValidationError("Each item must have product_id")
            if 'quantity' not in item or item['quantity'] <= 0:
                raise serializers.ValidationError("Each item must have quantity > 0")
            if 'unit_price' not in item or item['unit_price'] < 0:
                raise serializers.ValidationError("Each item must have valid unit_price")

        return items


class POSOrderUpdateSerializer(serializers.Serializer):
    """Serializer for updating existing orders"""

    items = serializers.ListField(
        child=serializers.DictField(),
        help_text="List of items with: product_id, quantity, unit_price, tax_rate, discount_amount"
    )

    def validate_items(self, items):
        """Validate items structure"""
        if not items:
            raise serializers.ValidationError("At least one item is required")

        for item in items:
            if 'product_id' not in item:
                raise serializers.ValidationError("Each item must have product_id")
            if 'quantity' not in item or item['quantity'] <= 0:
                raise serializers.ValidationError("Each item must have quantity > 0")
            if 'unit_price' not in item or item['unit_price'] < 0:
                raise serializers.ValidationError("Each item must have valid unit_price")

        return items


class POSOrderVoidSerializer(serializers.Serializer):
    """Serializer for voiding orders"""

    void_reason = serializers.CharField(required=True)


class POSOrderCompletePaymentSerializer(serializers.Serializer):
    """Serializer for completing payment on orders"""

    cash_drawer_session_id = serializers.IntegerField()
    payments = serializers.ListField(
        child=serializers.DictField(),
        help_text="List of payments with: payment_method, amount, reference_number"
    )

    def validate_payments(self, payments):
        """Validate payments structure"""
        if not payments:
            raise serializers.ValidationError("At least one payment is required")

        for payment in payments:
            if 'payment_method' not in payment:
                raise serializers.ValidationError("Each payment must have payment_method")
            if 'amount' not in payment or payment['amount'] <= 0:
                raise serializers.ValidationError("Each payment must have amount > 0")

        return payments


# =============================================================================
# Quick Access Product Serializers
# =============================================================================

class POSProductQuickAccessSerializer(serializers.ModelSerializer):
    """Serializer for POS products marked as quick access"""

    product_id = serializers.IntegerField(source='id', read_only=True)
    product_name = serializers.CharField(source='name', read_only=True)
    product_sku = serializers.CharField(source='sku', read_only=True)
    effective_price = serializers.DecimalField(source='default_selling_price', max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = POSProduct
        fields = [
            'id', 'product_id', 'product_name', 'product_sku',
            'sku', 'effective_price', 'tax_rate', 'default_quantity', 'is_active',
            'sales_count'
        ]


# =============================================================================
# POS Transaction Serializers (existing functionality)
# =============================================================================

class POSTransactionItemSerializer(serializers.ModelSerializer):
    """Serializer for transaction items"""

    profit = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = POSTransactionItem
        fields = [
            'id', 'product', 'item_name', 'sku', 'quantity',
            'unit_price', 'tax_rate', 'tax_amount', 'discount_amount',
            'line_total', 'unit_cost', 'profit', 'notes'
        ]


class POSPaymentSerializer(serializers.ModelSerializer):
    """Serializer for payments"""

    class Meta:
        model = POSPayment
        fields = [
            'id', 'payment_method', 'amount', 'reference_number',
            'customer_account_balance_before', 'customer_account_balance_after',
            'notes', 'created_at', 'created_by'
        ]
        read_only_fields = ['created_at', 'created_by']


class POSTransactionSerializer(serializers.ModelSerializer):
    """Serializer for POS transactions"""

    items = POSTransactionItemSerializer(many=True, read_only=True)
    payments = POSPaymentSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True, allow_null=True)
    total_paid = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    change_given = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = POSTransaction
        fields = [
            'id', 'receipt_number', 'cash_drawer_session', 'location',
            'customer', 'customer_name', 'transaction_date', 'subtotal',
            'discount_amount', 'discount_reason', 'tax_amount', 'total',
            'total_paid', 'change_given', 'status', 'voided_at', 'voided_by',
            'void_reason', 'notes', 'created_by', 'updated_at', 'items', 'payments'
        ]


class POSZReportSerializer(serializers.ModelSerializer):
    """Serializer for POS Z-reports"""

    class Meta:
        model = POSZReport
        fields = [
            'id',
            'cash_drawer_session',
            'gross_sales',
            'net_sales',
            'vat_amount',
            'discounts_total',
            'cash_total',
            'card_total',
            'on_account_total',
            'journal_entry',
            'posted_at',
            'created_at',
        ]


class CashDrawerSessionSerializer(serializers.ModelSerializer):
    """Serializer for cash drawer sessions"""
    is_from_today = serializers.SerializerMethodField()
    is_stale = serializers.SerializerMethodField()
    z_report = serializers.SerializerMethodField()

    def get_z_report(self, obj):
        report = getattr(obj, 'z_report', None)
        if not report:
            return None
        return POSZReportSerializer(report).data

    class Meta:
        model = CashDrawerSession
        fields = [
            'id', 'session_number', 'user', 'location', 'opened_at',
            'opening_balance', 'expected_balance', 'actual_balance',
            'variance', 'status', 'closed_at', 'opening_notes',
            'closing_notes', 'commercial_printing_income', 'payouts',
            'reconciled_at', 'reconciled_by',
            'is_from_today', 'is_stale', 'z_report'
        ]
        read_only_fields = [
            'id', 'session_number', 'user', 'opened_at',
            'expected_balance', 'variance', 'closed_at',
            'reconciled_at', 'reconciled_by',
            'is_from_today', 'is_stale'
        ]

    def get_is_from_today(self, obj):
        return obj.is_from_today()

    def get_is_stale(self, obj):
        return obj.is_stale()

    def update(self, instance, validated_data):
        """Custom update to handle session closing"""
        try:
            # If closing the session, use the close_session method
            if validated_data.get('status') == 'closed' and instance.status == 'open':
                from django.db import transaction
                from apps.pos.zreport_service import generate_zreport, post_zreport_journal

                actual_balance = validated_data.get('actual_balance')

                # Validate required field for closing
                if actual_balance is None:
                    raise serializers.ValidationError({
                        'actual_balance': 'This field is required when closing a session'
                    })

                commercial_printing_income = validated_data.get('commercial_printing_income')
                payouts = validated_data.get('payouts')
                closing_notes = validated_data.get('closing_notes')

                request = self.context.get('request')
                created_by = request.user if request else None

                with transaction.atomic():
                    # Call the model's close_session method which handles calculations
                    instance.close_session(
                        actual_balance=actual_balance,
                        commercial_printing_income=commercial_printing_income,
                        payouts=payouts,
                        closing_notes=closing_notes
                    )
                    zreport = generate_zreport(instance)
                    post_zreport_journal(zreport, created_by=created_by)
                return instance

            # For other updates, use default behavior
            return super().update(instance, validated_data)

        except serializers.ValidationError:
            raise
        except Exception as e:
            import traceback
            print(f"[ERROR] CashDrawerSessionSerializer.update failed: {str(e)}")
            print(traceback.format_exc())
            raise


# =============================================================================
# POS Product Management Serializers
# =============================================================================

class POSCategorySerializer(serializers.ModelSerializer):
    """Serializer for POS categories"""

    product_count = serializers.SerializerMethodField()

    class Meta:
        model = POSCategory
        fields = [
            'id', 'name', 'description', 'is_active',
            'display_order', 'product_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_product_count(self, obj):
        return obj.products.filter(is_active=True).count()


class POSLocationSerializer(serializers.ModelSerializer):
    """Serializer for POS locations"""

    class Meta:
        model = POSLocation
        fields = [
            'id', 'name', 'code', 'address', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class POSProductSerializer(serializers.ModelSerializer):
    """Full serializer for POS products"""

    category_name = serializers.CharField(source='category.name', read_only=True, allow_null=True)
    created_by_email = serializers.CharField(source='created_by.email', read_only=True, allow_null=True)
    low_stock = serializers.SerializerMethodField()

    class Meta:
        model = POSProduct
        fields = [
            'id', 'name', 'sku', 'description', 'category', 'category_name',
            'default_selling_price', 'unit_cost', 'tax_rate',
            'is_quick_access', 'default_quantity',
            'track_inventory', 'quantity_on_hand', 'allow_backorder', 'low_stock_threshold', 'low_stock',
            'is_active', 'sales_count', 'created_by', 'created_by_email',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'sales_count', 'created_at', 'updated_at']

    def get_low_stock(self, obj):
        """Check if product is below low stock threshold"""
        if obj.track_inventory and obj.low_stock_threshold > 0:
            return obj.quantity_on_hand <= obj.low_stock_threshold
        return False


class POSProductListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for product list views"""

    category_name = serializers.CharField(source='category.name', read_only=True, allow_null=True)
    low_stock = serializers.SerializerMethodField()

    class Meta:
        model = POSProduct
        fields = [
            'id', 'name', 'sku', 'category', 'category_name',
            'default_selling_price', 'is_quick_access', 'track_inventory',
            'quantity_on_hand', 'low_stock', 'is_active', 'sales_count'
        ]

    def get_low_stock(self, obj):
        """Check if product is below low stock threshold"""
        if obj.track_inventory and obj.low_stock_threshold > 0:
            return obj.quantity_on_hand <= obj.low_stock_threshold
        return False
