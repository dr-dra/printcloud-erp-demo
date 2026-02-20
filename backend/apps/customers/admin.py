from django.contrib import admin
from .models import Customer, CustomerAddress, CustomerDocument

# Register your models here.

class CustomerAddressInline(admin.TabularInline):
    model = CustomerAddress
    extra = 1

class CustomerDocumentInline(admin.TabularInline):
    model = CustomerDocument
    extra = 1
    readonly_fields = ('uploaded_at', 'uploaded_by')

@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ['name', 'customer_type', 'email', 'contact', 'is_active', 'created_at']
    list_filter = ['customer_type', 'is_active', 'created_at']
    search_fields = ['name', 'email', 'contact', 'account_no']
    readonly_fields = ['legacy_id', 'created_by', 'updated_by', 'created_at', 'updated_at']
    inlines = [CustomerAddressInline, CustomerDocumentInline]
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'customer_type', 'email', 'contact', 'is_active')
        }),
        ('Business Details', {
            'fields': ('account_no', 'website', 'fax')
        }),
        ('Payment Terms', {
            'fields': ('credit_limit', 'due_on_days', 'payment_term')
        }),
        ('System Information', {
            'fields': ('legacy_id', 'created_by', 'updated_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

@admin.register(CustomerAddress)
class CustomerAddressAdmin(admin.ModelAdmin):
    list_display = ['customer', 'type', 'line1', 'city', 'country']
    list_filter = ['type', 'country']
    search_fields = ['customer__name', 'line1', 'city']

@admin.register(CustomerDocument)
class CustomerDocumentAdmin(admin.ModelAdmin):
    list_display = ['title', 'customer', 'uploaded_by', 'uploaded_at']
    list_filter = ['uploaded_at', 'uploaded_by']
    search_fields = ['title', 'customer__name', 'description']
    readonly_fields = ['uploaded_at']
