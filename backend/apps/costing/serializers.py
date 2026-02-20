import logging

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.customers.models import Customer
from apps.employees.models import Employee
from apps.sales.quotations.models import SalesQuotationItem
from apps.sales.orders.models import SalesOrderItem

from .models import CostingEstimating, CostingSheet

logger = logging.getLogger(__name__)


class CostingSheetSerializer(serializers.ModelSerializer):
    """Serializer for individual costing sheets"""
    linked_quotation_id = serializers.SerializerMethodField()
    linked_quotation_number = serializers.SerializerMethodField()
    linked_order_id = serializers.SerializerMethodField()
    linked_order_number = serializers.SerializerMethodField()

    class Meta:
        model = CostingSheet
        fields = ['id', 'costingId', 'name', 'finished_product_id', 'quantity', 'subTotal', 'profitMargin',
                 'profitAmount', 'taxPercentage', 'taxProfitAmount', 'total',
                 'unitPrice', 'formulas', 'activeSheet', 'is_locked',
                 'linked_quotation_id', 'linked_quotation_number',
                 'linked_order_id', 'linked_order_number']

    def get_linked_quotation_id(self, obj):
        """Get the ID of the quotation that locked this costing sheet"""
        if obj.is_locked:
            # Find the quotation item that references this costing sheet
            quotation_item = SalesQuotationItem.objects.filter(costing_sheet_id=obj.id).first()
            if quotation_item:
                return quotation_item.quotation.id
        return None

    def get_linked_quotation_number(self, obj):
        """Get the quotation number that locked this costing sheet"""
        if obj.is_locked:
            # Find the quotation item that references this costing sheet
            quotation_item = SalesQuotationItem.objects.filter(costing_sheet_id=obj.id).first()
            if quotation_item:
                return quotation_item.quotation.quot_number
        return None

    def get_linked_order_id(self, obj):
        """Get the ID of the order that locked this costing sheet"""
        if obj.is_locked:
            # Find the order item that references this costing sheet
            order_item = SalesOrderItem.objects.filter(costing_sheet_id=obj.id).first()
            if order_item:
                return order_item.order.id
        return None

    def get_linked_order_number(self, obj):
        """Get the order number that locked this costing sheet"""
        if obj.is_locked:
            # Find the order item that references this costing sheet
            order_item = SalesOrderItem.objects.filter(costing_sheet_id=obj.id).first()
            if order_item:
                return order_item.order.order_number
        return None


class CostingEstimatingDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for estimating records with related sheets"""
    sheets = serializers.SerializerMethodField()
    customer_data = serializers.SerializerMethodField()
    sales_person_data = serializers.SerializerMethodField()
    
    class Meta:
        model = CostingEstimating
        fields = ['id', 'costingId', 'customerId', 'customerName', 'projectName',
                 'notes', 'isOutbound', 'isActive', 'companyId', 'createdBy',
                 'createdDate', 'updatedBy', 'updatedDate', 'sheets', 
                 'customer_data', 'sales_person_data']
    
    def get_sheets(self, obj):
        """Get all sheets for this costing"""
        sheets = CostingSheet.objects.filter(costingId=obj.costingId)
        return CostingSheetSerializer(sheets, many=True).data
    
    def get_customer_data(self, obj):
        """Get customer data using legacy_id mapping"""
        if obj.customerId:
            try:
                # Map customerId to Customer.legacy_id
                customer = Customer.objects.filter(legacy_id=obj.customerId).first()
                if customer:
                    return {
                        'id': customer.id,
                        'name': customer.name,
                        'email': customer.email,
                        'contact': customer.contact
                    }
            except Exception:
                pass
        return None
    
    def get_sales_person_data(self, obj):
        """Get sales person data using legacy_id mapping"""
        if obj.createdBy:
            try:
                # Map createdBy to Employee.legacy_id
                employee = Employee.objects.filter(legacy_id=obj.createdBy).first()
                if employee:
                    return {
                        'id': employee.id,
                        'name': employee.full_name,
                        'user': employee.user.email if employee.user else None
                    }
            except Exception:
                pass
        return None


class CostingListSerializer(serializers.ModelSerializer):
    """Serializer for costing list view - matches frontend expectations"""
    date = serializers.SerializerMethodField()
    customer_name = serializers.SerializerMethodField()
    project_name = serializers.CharField(source="projectName", read_only=True) 
    sales_person_name = serializers.SerializerMethodField()

    class Meta:
        model = CostingEstimating
        fields = ['id', 'date', 'customer_name', 'project_name', 'sales_person_name']
    
    def get_date(self, obj):
        """Format date for display"""
        if obj.createdDate:
            return obj.createdDate.strftime("%b %d, %Y")
        return None
    
    def get_customer_name(self, obj):
        """Get customer name from customerId field"""
        if obj.customerId:
            try:
                # First try to find by legacy_id
                customer = Customer.objects.filter(legacy_id=obj.customerId).first()
                if customer:
                    return customer.name
                # Fallback to customerName field if no match found
                return obj.customerName or "Unknown Customer"
            except Exception:
                return obj.customerName or "Unknown Customer"
        return obj.customerName or "No Customer"
    
    def get_sales_person_name(self, obj):
        """Get sales person name from createdBy field"""
        if obj.createdBy:
            try:
                # First try to find by legacy_id
                employee = Employee.objects.filter(legacy_id=obj.createdBy).first()
                if employee:
                    # Return only the first name
                    first_name = employee.full_name.split()[0] if employee.full_name else "Unknown"
                    return first_name
                # Fallback to user ID if no employee found
                return f"User {obj.createdBy}"
            except Exception:
                return f"User {obj.createdBy}"
        return "Unknown"


class CostingVariantCreateSerializer(serializers.Serializer):
    """Serializer for costing variant/sheet creation from frontend"""
    name = serializers.CharField(max_length=255)
    quantity = serializers.DecimalField(max_digits=20, decimal_places=2, default=0)
    sub_total = serializers.DecimalField(max_digits=20, decimal_places=2, default=0)
    profit_margin = serializers.DecimalField(max_digits=20, decimal_places=2, default=0)
    profit_amount = serializers.DecimalField(max_digits=20, decimal_places=2, default=0)
    tax_percentage = serializers.DecimalField(max_digits=20, decimal_places=2, default=0)
    tax_profit_amount = serializers.DecimalField(max_digits=20, decimal_places=2, default=0)
    total = serializers.DecimalField(max_digits=20, decimal_places=2, default=0)
    unit_price = serializers.DecimalField(max_digits=20, decimal_places=2, default=0)
    is_included = serializers.BooleanField(default=True)
    is_locked = serializers.BooleanField(default=False)
    sort_order = serializers.IntegerField(default=0)
    components = serializers.ListField(required=False)  # Raw components data


class CostingSheetCreateSerializer(serializers.Serializer):
    """Serializer for creating new costing sheets from frontend data structure"""
    project_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    customer = serializers.IntegerField(required=False, allow_null=True)
    sales_person = serializers.IntegerField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    is_outbound = serializers.BooleanField(default=False)
    is_active = serializers.BooleanField(default=True)
    variants = CostingVariantCreateSerializer(many=True, write_only=True)

    def create(self, validated_data):
        variants_data = validated_data.pop('variants', [])

        # Map employee ID to legacy_id for createdBy
        created_by_legacy_id = None
        if validated_data.get('sales_person'):
            try:
                employee = Employee.objects.get(id=validated_data['sales_person'])
                created_by_legacy_id = employee.legacy_id
                logger.info(f'Mapped sales_person ID {validated_data["sales_person"]} to legacy_id {created_by_legacy_id}')
            except Employee.DoesNotExist:
                logger.warning(f'Employee with ID {validated_data["sales_person"]} not found')

        # Map customer ID to legacy_id for customerId
        customer_legacy_id = None
        if validated_data.get('customer'):
            try:
                customer = Customer.objects.get(id=validated_data['customer'])
                customer_legacy_id = customer.legacy_id
                logger.info(f'Mapped customer ID {validated_data["customer"]} to legacy_id {customer_legacy_id}')
            except Customer.DoesNotExist:
                logger.warning(f'Customer with ID {validated_data["customer"]} not found')

        # Map frontend field names to backend field names
        estimating_data = {
            'costingId': 0,  # Placeholder, will be updated to actual ID after creation
            'projectName': validated_data.get('project_name', ''),
            'customerId': customer_legacy_id,
            'notes': validated_data.get('notes', ''),
            'isOutbound': 1 if validated_data.get('is_outbound', False) else 0,
            'isActive': 1 if validated_data.get('is_active', True) else 0,
            'createdBy': created_by_legacy_id,
            'createdDate': timezone.now(),
            'updatedDate': timezone.now(),
        }

        with transaction.atomic():
            # Create the main CostingEstimating record with placeholder costingId
            costing_estimating = CostingEstimating.objects.create(**estimating_data)

            # Update costingId to match the auto-generated ID
            costing_estimating.costingId = costing_estimating.id
            costing_estimating.save()

            logger.info(f'Created CostingEstimating with ID {costing_estimating.id}')

            # Create CostingSheet records for each variant
            for idx, variant_data in enumerate(variants_data):
                logger.info(f'Processing variant {idx}: {variant_data}')

                # Process components data to create formulas JSON
                components = variant_data.get('components', [])
                logger.info(f'Variant {idx} has {len(components)} components')
                formulas_json = {}

                for component in components:
                    component_type = component.get('component_type', '')
                    if component_type:
                        formulas_json[component_type] = {
                            'name': component.get('name', ''),
                            'formula': component.get('formula', ''),
                            'calculated_cost': component.get('calculated_cost', 0),
                            'sort_order': component.get('sort_order', 0),
                            'is_active': component.get('is_active', True)
                        }
                        logger.info(f'Added component {component_type}: formula={component.get("formula")}, cost={component.get("calculated_cost")}')

                logger.info(f'Final formulas_json: {formulas_json}')

                sheet_data = {
                    'costingId': costing_estimating.costingId,
                    'name': variant_data.get('name', ''),  # Store the variant/sheet name
                    'finished_product_id': variant_data.get('finished_product_id'),  # Store the finished product ID
                    'quantity': variant_data.get('quantity', 0),
                    'subTotal': variant_data.get('sub_total', 0),
                    'profitMargin': variant_data.get('profit_margin', 0),
                    'profitAmount': variant_data.get('profit_amount', 0),
                    'taxPercentage': variant_data.get('tax_percentage', 0),
                    'taxProfitAmount': variant_data.get('tax_profit_amount', 0),
                    'total': variant_data.get('total', 0),
                    'unitPrice': variant_data.get('unit_price', 0),
                    'formulas': formulas_json,
                    'activeSheet': 1 if variant_data.get('is_included', True) else 0,
                    'is_locked': 1 if variant_data.get('is_locked', False) else 0,
                }

                logger.info(f'Sheet data to save: {sheet_data}')
                costing_sheet = CostingSheet.objects.create(**sheet_data)
                logger.info(f'Created CostingSheet with ID {costing_sheet.id} for costing {costing_estimating.costingId}')

            return costing_estimating


class CostingActivitySerializer(serializers.Serializer):
    """Serializer for costing activity charts"""
    labels = serializers.ListField(child=serializers.CharField())
    current = serializers.ListField(child=serializers.IntegerField())
    previous = serializers.ListField(child=serializers.IntegerField(), required=False)
