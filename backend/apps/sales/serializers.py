from rest_framework import serializers
from .models import FinishedProduct, FinishedProductCategory


# Legacy SalesItem serializers - commented out since model is removed
# class SalesItemSerializer(serializers.ModelSerializer):
#     """Serializer for sales items (shared across quotations, orders, invoices)"""
#     
#     class Meta:
#         model = SalesItem
#         fields = [
#             'id', 'item_name', 'created_at', 
#             'updated_at', 'is_active'
#         ]
#         read_only_fields = ['id', 'created_at', 'updated_at']
# 
# 
# class SalesItemListSerializer(serializers.ModelSerializer):
#     """Lightweight serializer for listing sales items"""
#     
#     class Meta:
#         model = SalesItem
#         fields = ['id', 'item_name']
# 
# 
# class SalesItemCreateSerializer(serializers.ModelSerializer):
#     """Serializer for creating new sales items"""
#     
#     class Meta:
#         model = SalesItem
#         fields = ['item_name', 'is_active']
#         
#     def validate_item_name(self, value):
#         """Ensure item name is not empty and unique"""
#         if not value or not value.strip():
#             raise serializers.ValidationError("Item name cannot be empty.")
#         return value.strip()


class FinishedProductCategorySerializer(serializers.ModelSerializer):
    """Serializer for finished product categories"""
    
    parent_category_name = serializers.CharField(source='parent_category.category_name', read_only=True)
    subcategories_count = serializers.SerializerMethodField()
    products_count = serializers.SerializerMethodField()
    
    class Meta:
        model = FinishedProductCategory
        fields = [
            'id', 'category_name', 'description', 'parent_category', 'parent_category_name',
            'income_account_id', 'is_active', 'created_at', 'updated_at',
            'subcategories_count', 'products_count'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'parent_category_name']
    
    def get_subcategories_count(self, obj):
        return obj.subcategories.filter(is_active=True).count()
    
    def get_products_count(self, obj):
        return obj.products.filter(is_active=True).count()
    
    def validate_category_name(self, value):
        """Ensure category name is not empty"""
        if not value or not value.strip():
            raise serializers.ValidationError("Category name cannot be empty.")
        return value.strip()


class FinishedProductCategoryListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing categories"""
    
    parent_category_name = serializers.CharField(source='parent_category.category_name', read_only=True)
    
    class Meta:
        model = FinishedProductCategory
        fields = ['id', 'category_name', 'parent_category_name', 'income_account_id']


class FinishedProductSerializer(serializers.ModelSerializer):
    """Serializer for finished products"""
    
    category_name = serializers.CharField(source='category.category_name', read_only=True)
    category_full_path = serializers.SerializerMethodField()
    dimensions_display = serializers.SerializerMethodField()
    
    class Meta:
        model = FinishedProduct
        fields = [
            'id', 'name', 'width', 'height', 'description', 'category', 'category_name',
            'category_full_path', 'dimensions_display', 'is_active', 'is_vat_exempt',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'category_name', 'category_full_path', 'dimensions_display']
    
    def get_category_full_path(self, obj):
        """Get full category path for hierarchical display"""
        return str(obj.category)
    
    def get_dimensions_display(self, obj):
        """Get formatted dimensions display"""
        if obj.width and obj.height:
            width = int(obj.width) if obj.width == int(obj.width) else obj.width
            height = int(obj.height) if obj.height == int(obj.height) else obj.height
            return f"{width}mm x {height}mm"
        return ""
    
    def validate_name(self, value):
        """Ensure product name is not empty"""
        if not value or not value.strip():
            raise serializers.ValidationError("Product name cannot be empty.")
        return value.strip()


class FinishedProductListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing finished products"""

    category_name = serializers.CharField(source='category.category_name', read_only=True)
    dimensions_display = serializers.SerializerMethodField()

    class Meta:
        model = FinishedProduct
        fields = ['id', 'name', 'category_name', 'dimensions_display', 'description', 'is_vat_exempt']
    
    def get_dimensions_display(self, obj):
        """Get formatted dimensions display"""
        if obj.width and obj.height:
            width = int(obj.width) if obj.width == int(obj.width) else obj.width
            height = int(obj.height) if obj.height == int(obj.height) else obj.height
            return f"{width}mm x {height}mm"
        return ""


class FinishedProductCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new finished products"""

    class Meta:
        model = FinishedProduct
        fields = ['name', 'width', 'height', 'description', 'category', 'is_active', 'is_vat_exempt']

    def validate_name(self, value):
        """Ensure product name is not empty"""
        if not value or not value.strip():
            raise serializers.ValidationError("Product name cannot be empty.")
        return value.strip()