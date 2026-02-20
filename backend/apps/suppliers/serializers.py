"""
Serializers for Suppliers Module

Provides REST API serialization for:
- Suppliers
- Supplier Contacts
- Supplier Documents
"""

from rest_framework import serializers
from .models import Supplier, SupplierContact, SupplierDocument


class SupplierContactSerializer(serializers.ModelSerializer):
    """Serializer for SupplierContact model."""

    class Meta:
        model = SupplierContact
        fields = [
            'id',
            'supplier',
            'name',
            'position',
            'email',
            'phone',
            'mobile',
            'is_primary',
            'notes',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class SupplierDocumentSerializer(serializers.ModelSerializer):
    """Serializer for SupplierDocument model."""

    uploaded_by_name = serializers.CharField(
        source='uploaded_by.get_full_name',
        read_only=True
    )
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = SupplierDocument
        fields = [
            'id',
            'supplier',
            'file',
            'file_url',
            'title',
            'document_type',
            'description',
            'file_size',
            'uploaded_by',
            'uploaded_by_name',
            'uploaded_at',
        ]
        read_only_fields = [
            'id',
            'file_size',
            'uploaded_by',
            'uploaded_by_name',
            'uploaded_at',
        ]

    def get_file_url(self, obj):
        """Get the file URL."""
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None


class SupplierSerializer(serializers.ModelSerializer):
    """Full serializer for Supplier model with nested contacts and documents."""

    contacts = SupplierContactSerializer(many=True, read_only=True)
    documents = SupplierDocumentSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(
        source='created_by.get_full_name',
        read_only=True
    )

    class Meta:
        model = Supplier
        fields = [
            'id',
            'supplier_code',
            'name',
            'company_name',
            'email',
            'phone',
            'mobile',
            'website',
            'address_line1',
            'address_line2',
            'city',
            'state',
            'postal_code',
            'country',
            'payment_terms_days',
            'credit_limit',
            'current_balance',
            'tax_id',
            'bank_name',
            'bank_account_number',
            'bank_account_name',
            'bank_branch',
            'notes',
            'is_active',
            'created_by',
            'created_by_name',
            'created_at',
            'updated_at',
            'contacts',
            'documents',
        ]
        read_only_fields = [
            'id',
            'created_by',
            'current_balance',
            'created_by_name',
            'created_at',
            'updated_at',
            'contacts',
            'documents',
        ]

    def validate_supplier_code(self, value):
        """Ensure supplier code is unique."""
        if self.instance:
            # Update - exclude self from uniqueness check
            if Supplier.objects.exclude(
                pk=self.instance.pk
            ).filter(supplier_code=value).exists():
                raise serializers.ValidationError(
                    "Supplier code must be unique"
                )
        else:
            # Create - check if code already exists
            if Supplier.objects.filter(supplier_code=value).exists():
                raise serializers.ValidationError(
                    "Supplier code must be unique"
                )
        return value


class SupplierListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for supplier lists."""

    class Meta:
        model = Supplier
        fields = [
            'id',
            'supplier_code',
            'name',
            'email',
            'phone',
            'current_balance',
            'payment_terms_days',
            'is_active',
        ]
