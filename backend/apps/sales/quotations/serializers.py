import logging
from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from apps.costing.models import CostingEstimating, CostingSheet
from apps.customers.serializers import CustomerListSerializer, CustomerSerializer
from apps.sales.models import FinishedProduct
from apps.users.serializers import UserSerializer

from .models import SalesQuotation, SalesQuotationItem, SalesQuotationTimeline

logger = logging.getLogger(__name__)


class SalesQuotationTimelineSerializer(serializers.ModelSerializer):
    """Serializer for quotation timeline entries"""
    
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    event_type_display = serializers.CharField(source='get_event_type_display', read_only=True)
    
    class Meta:
        model = SalesQuotationTimeline
        fields = [
            'id', 'event_type', 'event_type_display', 'message', 
            'created_at', 'created_by', 'created_by_name'
        ]
        read_only_fields = ['id', 'created_at', 'created_by']


class SalesQuotationItemSerializer(serializers.ModelSerializer):
    """Serializer for quotation items"""

    costing_sheet_name = serializers.CharField(source='costing_sheet.name', read_only=True, allow_null=True)
    costing_estimating_id = serializers.SerializerMethodField()
    finished_product_name = serializers.CharField(source='finished_product.name', read_only=True, allow_null=True)
    finished_product_category = serializers.CharField(source='finished_product.category.category_name', read_only=True, allow_null=True)
    finished_product_dimensions = serializers.SerializerMethodField()

    # Allow both ForeignKey objects and _id integer values to be passed
    costing_sheet_id = serializers.IntegerField(required=False, allow_null=True, write_only=True)
    finished_product_id = serializers.IntegerField(required=False, allow_null=True, write_only=True)

    class Meta:
        model = SalesQuotationItem
        fields = [
            'id', 'item_id', 'item', 'description', 'quantity',
            'unit_price', 'price', 'finished_product', 'finished_product_id', 'finished_product_name',
            'finished_product_category', 'finished_product_dimensions',
            'costing_sheet', 'costing_sheet_id', 'costing_sheet_name', 'costing_estimating_id',
            'cs_profit_margin', 'cs_profit', 'cs_total'
        ]

    def get_costing_estimating_id(self, obj):
        """Get the parent CostingEstimating ID for the URL"""
        if obj.costing_sheet:
            # Get the CostingEstimating record by costingId
            estimating = CostingEstimating.objects.filter(costingId=obj.costing_sheet.costingId).first()
            if estimating:
                return estimating.id
        return None

    def get_finished_product_dimensions(self, obj):
        """Get formatted dimensions display from finished product"""
        if obj.finished_product and obj.finished_product.width and obj.finished_product.height:
            width = int(obj.finished_product.width) if obj.finished_product.width == int(obj.finished_product.width) else obj.finished_product.width
            height = int(obj.finished_product.height) if obj.finished_product.height == int(obj.finished_product.height) else obj.finished_product.height
            return f"{width}mm x {height}mm"
        return ""

    def create(self, validated_data):
        # Handle _id fields explicitly if provided
        costing_sheet_id = validated_data.pop('costing_sheet_id', None)
        finished_product_id = validated_data.pop('finished_product_id', None)

        if costing_sheet_id:
            validated_data['costing_sheet_id'] = costing_sheet_id
        if finished_product_id:
            validated_data['finished_product_id'] = finished_product_id

        return super().create(validated_data)


class SalesQuotationListSerializer(serializers.ModelSerializer):
    """Serializer for quotation list view - minimal fields for performance"""
    
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    customer_id = serializers.IntegerField(source='customer.id', read_only=True)
    item_count = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    number_type_display = serializers.CharField(source='get_number_type_display', read_only=True)
    
    class Meta:
        model = SalesQuotation
        fields = [
            'id', 'quot_number', 'number_type', 'number_type_display',
            'customer_id', 'customer_name', 'date', 'required_date', 
            'total', 'vat_rate', 'vat_amount', 'finalized', 'is_active', 'created_by_name',
            'created_date', 'item_count'
        ]
    
    def get_item_count(self, obj):
        """Get the number of items in this quotation"""
        return obj.items.count()

    def get_created_by_name(self, obj):
        """Return the name of the user who created the quotation"""
        if obj.created_by:
            return obj.created_by.get_full_name()
        return "System"


class SalesQuotationDetailSerializer(serializers.ModelSerializer):
    """Serializer for quotation detail view - full data"""
    
    customer = CustomerSerializer(read_only=True)
    items = SalesQuotationItemSerializer(many=True, read_only=True)
    timeline = SalesQuotationTimelineSerializer(source='timeline_entries', many=True, read_only=True)
    created_by = UserSerializer(read_only=True)
    costing_name = serializers.CharField(source='costing.name', read_only=True)
    
    class Meta:
        model = SalesQuotation
        fields = [
            'id', 'quot_number', 'number_type', 'customer', 
            'date', 'required_date', 'terms', 'notes', 'private_notes',
            'delivery_charge', 'discount', 'total', 'vat_rate', 'vat_amount',
            'total_applied', 'delivery_applied', 
            'costing', 'costing_name', 'finalized', 'is_active',
            'show_subtotal', 'show_delivery_charges',
            'created_by', 'created_date', 'updated_date', 
            'items', 'timeline'
        ]
        read_only_fields = [
            'id', 'created_by', 'created_date', 'updated_date', 'timeline'
        ]


class SalesQuotationCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new quotations"""
    
    items = SalesQuotationItemSerializer(many=True, required=False)
    
    class Meta:
        model = SalesQuotation
        fields = [
            'id', 'quot_number', 'number_type', 'customer', 'date', 'required_date',
            'terms', 'notes', 'private_notes', 'delivery_charge', 'discount', 'total',
            'vat_rate', 'vat_amount',
            'total_applied', 'delivery_applied', 'costing', 'finalized',
            'show_subtotal', 'show_delivery_charges',
            'items'
        ]
        read_only_fields = ['id']

    def validate(self, attrs):
        items_data = self.initial_data.get('items', [])
        vat_rate_value = attrs.get('vat_rate', None)
        if vat_rate_value is None:
            vat_rate_value = Decimal(str(self.initial_data.get('vat_rate', '0')))

        has_exempt = False
        has_taxable = False
        has_unknown = False

        for item_data in items_data:
            finished_product = item_data.get('finished_product')
            finished_product_id = item_data.get('finished_product_id')

            if finished_product is None and finished_product_id:
                finished_product = FinishedProduct.objects.filter(
                    id=finished_product_id,
                    is_active=True
                ).first()

            if finished_product is None and item_data.get('item'):
                finished_product = FinishedProduct.objects.filter(
                    name__iexact=item_data.get('item'),
                    is_active=True
                ).first()

            if finished_product is None:
                has_unknown = True
                continue

            if finished_product.is_vat_exempt:
                has_exempt = True
            else:
                has_taxable = True

        if has_exempt and has_taxable:
            raise serializers.ValidationError({
                'items': 'Cannot mix VAT-exempt and VATable items in the same quotation.'
            })

        if has_exempt and Decimal(vat_rate_value) > 0:
            raise serializers.ValidationError({
                'vat_rate': 'VAT rate must be 0 for VAT-exempt quotations.'
            })

        if has_taxable and Decimal(vat_rate_value) <= 0:
            raise serializers.ValidationError({
                'vat_rate': 'VAT rate must be greater than 0 for VATable quotations.'
            })

        if has_unknown and (has_exempt or has_taxable):
            raise serializers.ValidationError({
                'items': 'All items must use a Finished Product to enforce VAT exemption rules.'
            })

        return attrs
    
    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        
        with transaction.atomic():
            quotation = SalesQuotation.objects.create(**validated_data)
            
            # Track costing sheets to lock
            costing_sheets_to_lock = []
            
            # Create items if provided
            for item_data in items_data:
                # Auto-link FinishedProduct if item name matches
                finished_product = None
                item_name = item_data.get('item', '')

                if item_name:
                    try:
                        # Try to find FinishedProduct by exact name match
                        finished_product = FinishedProduct.objects.filter(
                            name__iexact=item_name,
                            is_active=True
                        ).first()

                        if finished_product:
                            item_data['finished_product'] = finished_product
                            # Enhance description with FinishedProduct details if available
                            if finished_product.description and not item_data.get('description'):
                                item_data['description'] = finished_product.description
                            elif finished_product.description and item_data.get('description'):
                                # Append FinishedProduct description to existing description
                                item_data['description'] = f"{item_data['description']}\n{finished_product.description}"

                    except Exception as e:
                        # Log the error but don't fail the creation
                        logger.warning(f"Failed to auto-link FinishedProduct for item '{item_name}': {e}")

                item = SalesQuotationItem.objects.create(quotation=quotation, **item_data)

                # Collect costing sheets to lock
                if item.costing_sheet_id:
                    costing_sheets_to_lock.append(item.costing_sheet_id)
            
            # Lock costing sheets that were used in this quotation
            if costing_sheets_to_lock:
                CostingSheet.objects.filter(
                    id__in=costing_sheets_to_lock
                ).update(is_locked=1)
                
                # Create timeline entry about locking
                locked_sheet_names = list(
                    CostingSheet.objects.filter(
                        id__in=costing_sheets_to_lock
                    ).values_list('id', flat=True)
                )
                SalesQuotationTimeline.objects.create(
                    quotation=quotation,
                    event_type='created',
                    message=f"Quotation created from costing sheets. Locked sheets: {', '.join(map(str, locked_sheet_names))}",
                    created_by=self.context.get('request').user if self.context.get('request') else None
                )
            else:
                # Create initial timeline entry (no costing sheets)
                SalesQuotationTimeline.objects.create(
                    quotation=quotation,
                    event_type='created',
                    message=f"Quotation created via API",
                    created_by=self.context.get('request').user if self.context.get('request') else None
                )
        
        return quotation
    
    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', [])
        
        # Update quotation fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Delete existing items and create new ones
        instance.items.all().delete()
        for item_data in items_data:
            SalesQuotationItem.objects.create(quotation=instance, **item_data)
        
        # Create timeline entry for update
        SalesQuotationTimeline.objects.create(
            quotation=instance,
            event_type='updated',
            message=f"Quotation updated via API",
            created_by=self.context.get('request').user if self.context.get('request') else None
        )
        
        return instance
