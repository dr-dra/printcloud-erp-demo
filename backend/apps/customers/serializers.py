from decimal import Decimal
from datetime import timedelta

from django.db.models import Sum
from django.utils import timezone
from rest_framework import serializers

from apps.sales.invoices.models import CustomerAdvance, InvoicePayment
from apps.sales.orders.models import SalesOrder
from .models import Customer, CustomerAddress, CustomerDocument

class CustomerListSerializer(serializers.ModelSerializer):
    """Serializer for customer list view with essential fields"""
    contact = serializers.CharField(read_only=True)
    address = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = ['id', 'name', 'contact', 'email', 'address']
    
    def get_address(self, obj):
        """Return the primary address (billing address preferred, or first available)"""
        try:
            # Get billing address first, fallback to first address
            billing_address = obj.addresses.filter(type='billing').first()
            if billing_address:
                return f"{billing_address.line1}, {billing_address.city}"
            
            # If no billing address, get first available address
            first_address = obj.addresses.first()
            if first_address:
                return f"{first_address.line1}, {first_address.city}"
            
            return "No address"
        except Exception as e:
            # If there's any error accessing addresses, return a safe default
            return "No address"

class CustomerAddressSerializer(serializers.ModelSerializer):
    """Serializer for customer addresses"""
    class Meta:
        model = CustomerAddress
        fields = ['type', 'line1', 'line2', 'city', 'zip_code', 'province', 'country', 'phone', 'delivery_instructions']

class CustomerDocumentSerializer(serializers.ModelSerializer):
    """Serializer for customer documents/files"""
    class Meta:
        model = CustomerDocument
        fields = ['id', 'file', 'title', 'description', 'uploaded_at']
        read_only_fields = ['id', 'uploaded_by', 'uploaded_at']

class CustomerSerializer(serializers.ModelSerializer):
    """Full customer serializer for detailed operations"""
    addresses = CustomerAddressSerializer(many=True, required=False)
    documents = CustomerDocumentSerializer(many=True, read_only=True)
    address = serializers.SerializerMethodField()
    advance_summary = serializers.SerializerMethodField()
    total_spend_lifetime = serializers.SerializerMethodField()
    total_spend_12m = serializers.SerializerMethodField()
    recent_orders = serializers.SerializerMethodField()
    
    class Meta:
        model = Customer
        fields = [
            'id', 'name', 'customer_type', 'email', 'contact', 'account_no', 
            'website', 'fax', 'bank_account_name', 'bank_name', 'bank_account_number',
            'credit_limit', 'due_on_days', 'payment_term',
            'pos_customer', 'is_active', 'address', 'addresses', 'documents',
            'advance_summary', 'total_spend_lifetime', 'total_spend_12m', 'recent_orders'
        ]
        read_only_fields = ['id', 'legacy_id', 'created_by', 'updated_by', 'created_at', 'updated_at']
    
    def get_address(self, obj):
        """Return the primary address (billing address preferred, or first available)"""
        try:
            # Get billing address first, fallback to first address
            billing_address = obj.addresses.filter(type='billing').first()
            if billing_address:
                return f"{billing_address.line1}, {billing_address.city}"
            
            # If no billing address, get first available address
            first_address = obj.addresses.first()
            if first_address:
                return f"{first_address.line1}, {first_address.city}"
            
            return "No address"
        except Exception as e:
            # If there's any error accessing addresses, return a safe default
            return "No address"
    
    def create(self, validated_data):
        addresses_data = validated_data.pop('addresses', [])
        customer = Customer.objects.create(**validated_data)
        
        # Create addresses
        for address_data in addresses_data:
            CustomerAddress.objects.create(customer=customer, **address_data)
        
        return customer

    def get_advance_summary(self, obj):
        available_balance = CustomerAdvance.objects.filter(
            customer=obj,
            status='available'
        ).aggregate(total=Sum('balance'))['total'] or Decimal('0.00')

        total_amount = CustomerAdvance.objects.filter(
            customer=obj
        ).exclude(status='voided').aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        return {
            'available_balance': available_balance,
            'total_amount': total_amount,
        }

    def get_total_spend_lifetime(self, obj):
        total = InvoicePayment.objects.filter(
            invoice__customer=obj,
            is_void=False
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        return total

    def get_total_spend_12m(self, obj):
        cutoff = timezone.now() - timedelta(days=365)
        total = InvoicePayment.objects.filter(
            invoice__customer=obj,
            is_void=False,
            payment_date__gte=cutoff
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        return total

    def get_recent_orders(self, obj):
        orders = SalesOrder.objects.filter(customer=obj).order_by('-order_date', '-id')[:5]
        return [
            {
                'id': order.id,
                'order_number': order.order_number,
                'order_date': order.order_date,
                'status': order.status,
                'net_total': order.net_total,
            }
            for order in orders
        ]


class CustomerAdvanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerAdvance
        fields = [
            'id', 'advance_date', 'amount', 'balance',
            'status', 'source_type', 'notes',
            'source_payment_id', 'journal_entry_id'
        ]
        read_only_fields = fields
