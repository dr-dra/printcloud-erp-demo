from django.contrib import admin

from .models import (
    InvCategory,
    InvUnitMeasure,
    InvItem,
    InvStockBatch,
    InvStockMovement,
    InvWastageCategory,
    InvMRN,
    InvMRNItem,
    InvGoodsReceivedNote,
    InvGRNItem,
    InvGoodsIssueNote,
    InvGINItem,
    InvUsageReport,
    InvUsageItem,
    InvStockAdjustment,
    InvStockAdjustmentItem,
    InvDispatchNote,
    InvDispatchItem,
)


@admin.register(InvCategory)
class InvCategoryAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'is_active')
    search_fields = ('code', 'name')
    list_filter = ('is_active',)


@admin.register(InvUnitMeasure)
class InvUnitMeasureAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'symbol', 'base_unit', 'conversion_factor', 'is_active')
    search_fields = ('code', 'name')
    list_filter = ('is_active',)


@admin.register(InvItem)
class InvItemAdmin(admin.ModelAdmin):
    list_display = ('sku', 'name', 'category', 'stock_uom', 'is_active', 'is_offcut')
    search_fields = ('sku', 'name')
    list_filter = ('is_active', 'category', 'is_offcut')


@admin.register(InvStockBatch)
class InvStockBatchAdmin(admin.ModelAdmin):
    list_display = ('item', 'received_date', 'quantity_remaining', 'unit_cost', 'source_type')
    list_filter = ('source_type',)
    search_fields = ('item__sku', 'item__name', 'source_reference')


@admin.register(InvStockMovement)
class InvStockMovementAdmin(admin.ModelAdmin):
    list_display = ('item', 'movement_type', 'quantity', 'quantity_after', 'created_at')
    list_filter = ('movement_type',)
    search_fields = ('item__sku', 'notes', 'reference_type')
    readonly_fields = ('created_at',)

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(InvWastageCategory)
class InvWastageCategoryAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'is_active')
    search_fields = ('code', 'name')
    list_filter = ('is_active',)


class InvMRNItemInline(admin.TabularInline):
    model = InvMRNItem
    extra = 0


@admin.register(InvMRN)
class InvMRNAdmin(admin.ModelAdmin):
    list_display = ('mrn_number', 'status', 'request_date', 'required_date')
    list_filter = ('status',)
    search_fields = ('mrn_number', 'job_reference')
    inlines = [InvMRNItemInline]


class InvGRNItemInline(admin.TabularInline):
    model = InvGRNItem
    extra = 0


@admin.register(InvGoodsReceivedNote)
class InvGoodsReceivedNoteAdmin(admin.ModelAdmin):
    list_display = ('grn_number', 'status', 'received_date', 'purchase_order')
    list_filter = ('status',)
    search_fields = ('grn_number', 'purchase_order__po_number')
    inlines = [InvGRNItemInline]


class InvGINItemInline(admin.TabularInline):
    model = InvGINItem
    extra = 0


@admin.register(InvGoodsIssueNote)
class InvGoodsIssueNoteAdmin(admin.ModelAdmin):
    list_display = ('gin_number', 'status', 'issue_date')
    list_filter = ('status',)
    search_fields = ('gin_number', 'job_reference')
    inlines = [InvGINItemInline]


class InvUsageItemInline(admin.TabularInline):
    model = InvUsageItem
    extra = 0


@admin.register(InvUsageReport)
class InvUsageReportAdmin(admin.ModelAdmin):
    list_display = ('report_number', 'report_date', 'job_reference')
    search_fields = ('report_number', 'job_reference')
    inlines = [InvUsageItemInline]


class InvStockAdjustmentItemInline(admin.TabularInline):
    model = InvStockAdjustmentItem
    extra = 0


@admin.register(InvStockAdjustment)
class InvStockAdjustmentAdmin(admin.ModelAdmin):
    list_display = ('adjustment_number', 'status', 'adjustment_date')
    list_filter = ('status',)
    search_fields = ('adjustment_number', 'reason')
    inlines = [InvStockAdjustmentItemInline]


class InvDispatchItemInline(admin.TabularInline):
    model = InvDispatchItem
    extra = 0


@admin.register(InvDispatchNote)
class InvDispatchNoteAdmin(admin.ModelAdmin):
    list_display = ('dispatch_number', 'status', 'dispatch_date')
    list_filter = ('status',)
    search_fields = ('dispatch_number', 'invoice_reference')
    inlines = [InvDispatchItemInline]
