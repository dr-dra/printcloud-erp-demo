from django.contrib import admin
from .models import FinishedProduct, FinishedProductCategory


@admin.register(FinishedProductCategory)
class FinishedProductCategoryAdmin(admin.ModelAdmin):
    list_display = ['category_name', 'parent_category', 'income_account_id', 'is_active', 'created_at']
    list_filter = ['is_active', 'parent_category', 'created_at']
    search_fields = ['category_name', 'description', 'income_account_id']
    ordering = ['category_name']
    
    fieldsets = (
        (None, {
            'fields': ('category_name', 'description', 'parent_category')
        }),
        ('Accounting', {
            'fields': ('income_account_id',)
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
    )
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('parent_category')


@admin.register(FinishedProduct)
class FinishedProductAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'dimensions_display', 'is_active', 'created_at']
    list_filter = ['is_active', 'category', 'category__parent_category', 'created_at']
    search_fields = ['name', 'description', 'category__category_name']
    ordering = ['name']
    
    fieldsets = (
        (None, {
            'fields': ('name', 'category', 'description')
        }),
        ('Dimensions', {
            'fields': ('width', 'height'),
            'description': 'Dimensions in millimeters'
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
    )
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('category', 'category__parent_category')
    
    def dimensions_display(self, obj):
        """Display formatted dimensions"""
        if obj.width and obj.height:
            return f"{obj.width}mm x {obj.height}mm"
        return "-"
    dimensions_display.short_description = "Dimensions"


# Legacy SalesItem admin - commented out since model is removed
# @admin.register(SalesItem)
# class SalesItemAdmin(admin.ModelAdmin):
#     list_display = ['item_name', 'is_active', 'created_at']
#     list_filter = ['is_active', 'created_at']
#     search_fields = ['item_name']
#     ordering = ['item_name']
#     
#     fieldsets = (
#         (None, {
#             'fields': ('item_name',)
#         }),
#         ('Status', {
#             'fields': ('is_active',)
#         }),
#     )