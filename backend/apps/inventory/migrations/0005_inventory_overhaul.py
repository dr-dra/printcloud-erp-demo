from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


def seed_inventory_data(apps, schema_editor):
    InvCategory = apps.get_model('inventory', 'InvCategory')
    InvUnitMeasure = apps.get_model('inventory', 'InvUnitMeasure')
    InvWastageCategory = apps.get_model('inventory', 'InvWastageCategory')

    category_data = [
        ('PAPER', 'Paper & Board', None),
        ('PAPER_ART', 'Art Paper', 'PAPER'),
        ('PAPER_MATT', 'Matt Paper', 'PAPER'),
        ('PAPER_BOND', 'Bond Paper', 'PAPER'),
        ('PAPER_NCR', 'NCR Paper', 'PAPER'),
        ('BOARD', 'Board', 'PAPER'),
        ('OFFCUT', 'Offcuts', 'PAPER'),
        ('PLATES', 'Printing Plates', None),
        ('INK', 'Inks', None),
        ('INK_PROCESS', 'Process Inks', 'INK'),
        ('INK_SPECIAL', 'Special/Pantone Inks', 'INK'),
        ('CHEMICAL', 'Chemicals', None),
        ('CONSUMABLE', 'Consumables', None),
        ('LARGE_FORMAT', 'Large Format Materials', None),
        ('MACHINE_PART', 'Machine Parts', None),
        ('FINISHED', 'Finished Goods', None),
    ]

    category_map = {}
    for code, name, _parent in category_data:
        category_map[code] = InvCategory.objects.create(
            code=code,
            name=name,
            parent_category=None
        )

    for code, _name, parent_code in category_data:
        if parent_code:
            InvCategory.objects.filter(code=code).update(
                parent_category=category_map[parent_code]
            )

    uom_data = [
        ('SHEET', 'Sheet', 'sht', None, 1),
        ('REAM', 'Ream', 'rm', 'SHEET', 500),
        ('PACKET', 'Packet', 'pkt', 'SHEET', 100),
        ('KG', 'Kilogram', 'kg', None, 1),
        ('GRAM', 'Gram', 'g', 'KG', 0.001),
        ('TIN', 'Tin', 'tin', 'KG', 1),
        ('LITRE', 'Litre', 'L', None, 1),
        ('ML', 'Millilitre', 'ml', 'LITRE', 0.001),
        ('UNIT', 'Unit', 'pcs', None, 1),
        ('BOX', 'Box', 'box', 'UNIT', 1),
        ('ROLL', 'Roll', 'roll', 'UNIT', 1),
        ('SQM', 'Square Meter', 'm2', None, 1),
        ('LM', 'Linear Meter', 'm', None, 1),
    ]

    uom_map = {}
    for code, name, symbol, _base_code, factor in uom_data:
        uom_map[code] = InvUnitMeasure.objects.create(
            code=code,
            name=name,
            symbol=symbol,
            base_unit=None,
            conversion_factor=factor
        )

    for code, _name, _symbol, base_code, _factor in uom_data:
        if base_code:
            InvUnitMeasure.objects.filter(code=code).update(
                base_unit=uom_map[base_code]
            )

    wastage_data = [
        ('MAKEREADY', 'Makeready/Setup', 'Waste during press setup and registration'),
        ('RUNNING', 'Running Waste', 'Spoilage during production run'),
        ('FINISHING', 'Finishing Waste', 'Waste during post-press operations'),
        ('DAMAGED', 'Damaged Stock', 'Stock damaged before or during handling'),
    ]

    for code, name, description in wastage_data:
        InvWastageCategory.objects.create(
            code=code,
            name=name,
            description=description
        )


def unseed_inventory_data(apps, schema_editor):
    InvCategory = apps.get_model('inventory', 'InvCategory')
    InvUnitMeasure = apps.get_model('inventory', 'InvUnitMeasure')
    InvWastageCategory = apps.get_model('inventory', 'InvWastageCategory')

    InvWastageCategory.objects.all().delete()
    InvUnitMeasure.objects.all().delete()
    InvCategory.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('suppliers', '0001_initial'),
        ('purchases', '0005_billscan_summary'),
        # POS app originally referenced inventory.StockItem/InventoryLocation. Ensure POS has
        # removed those relationships before we delete the legacy models, otherwise state
        # rendering for RunPython will fail on unresolved lazy references.
        ('pos', '0007_remove_inventory_dependencies'),
        ('inventory', '0004_migrate_quick_service_items'),
    ]

    operations = [
        migrations.DeleteModel(
            name='StockMovement',
        ),
        migrations.DeleteModel(
            name='StockLevel',
        ),
        migrations.DeleteModel(
            name='StockItem',
        ),
        migrations.DeleteModel(
            name='InventoryLocation',
        ),
        migrations.CreateModel(
            name='InvCategory',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(max_length=50, unique=True)),
                ('name', models.CharField(max_length=255)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('parent_category', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='subcategories', to='inventory.invcategory')),
            ],
            options={
                'verbose_name': 'Inventory Category',
                'verbose_name_plural': 'Inventory Categories',
                'db_table': 'inv_category',
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='InvUnitMeasure',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(max_length=30, unique=True)),
                ('name', models.CharField(max_length=100)),
                ('symbol', models.CharField(blank=True, max_length=20)),
                ('conversion_factor', models.DecimalField(decimal_places=6, default=1, help_text='Multiply by this factor to convert to base unit', max_digits=12)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('base_unit', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='derived_units', to='inventory.invunitmeasure')),
            ],
            options={
                'verbose_name': 'Unit of Measure',
                'verbose_name_plural': 'Units of Measure',
                'db_table': 'inv_unit_measure',
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='InvWastageCategory',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(max_length=30, unique=True)),
                ('name', models.CharField(max_length=100)),
                ('description', models.TextField(blank=True)),
                ('is_active', models.BooleanField(default=True)),
            ],
            options={
                'verbose_name': 'Wastage Category',
                'verbose_name_plural': 'Wastage Categories',
                'db_table': 'inv_wastage_category',
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='InvItem',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('sku', models.CharField(max_length=100, unique=True)),
                ('name', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True)),
                ('purchase_to_stock_factor', models.DecimalField(decimal_places=6, default=1, help_text='Multiply purchase quantity to get stock quantity', max_digits=12)),
                ('gsm', models.IntegerField(blank=True, null=True)),
                ('width_mm', models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ('height_mm', models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ('grain_direction', models.CharField(blank=True, choices=[('long', 'Long Grain'), ('short', 'Short Grain')], max_length=10, null=True)),
                ('is_offcut', models.BooleanField(default=False)),
                ('exclude_from_valuation', models.BooleanField(default=False, help_text='Exclude from inventory valuation reports')),
                ('reorder_level', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('reorder_quantity', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('category', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='items', to='inventory.invcategory')),
                ('parent_item', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='offcuts', to='inventory.invitem')),
                ('preferred_supplier', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='inventory_items', to='suppliers.supplier')),
                ('purchase_uom', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='purchase_items', to='inventory.invunitmeasure')),
                ('stock_uom', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='stock_items', to='inventory.invunitmeasure')),
            ],
            options={
                'verbose_name': 'Inventory Item',
                'verbose_name_plural': 'Inventory Items',
                'db_table': 'inv_item',
                'ordering': ['sku'],
            },
        ),
        migrations.CreateModel(
            name='InvStockBatch',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('received_date', models.DateField(default=django.utils.timezone.now)),
                ('source_type', models.CharField(choices=[('grn', 'Goods Received'), ('adjustment', 'Stock Adjustment'), ('return', 'Return'), ('opening', 'Opening Balance')], max_length=20)),
                ('source_reference', models.CharField(blank=True, max_length=100)),
                ('quantity_received', models.DecimalField(decimal_places=2, max_digits=12)),
                ('quantity_remaining', models.DecimalField(decimal_places=2, max_digits=12)),
                ('unit_cost', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('is_active', models.BooleanField(default=True)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('item', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='batches', to='inventory.invitem')),
            ],
            options={
                'verbose_name': 'Stock Batch',
                'verbose_name_plural': 'Stock Batches',
                'db_table': 'inv_stock_batch',
                'ordering': ['received_date', 'id'],
            },
        ),
        migrations.CreateModel(
            name='InvStockMovement',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('movement_type', models.CharField(choices=[('grn', 'Goods Received'), ('gin', 'Goods Issue'), ('adjustment', 'Stock Adjustment'), ('allocation', 'Allocation'), ('release', 'Allocation Release'), ('return', 'Return')], max_length=20)),
                ('quantity', models.DecimalField(decimal_places=2, max_digits=12)),
                ('quantity_before', models.DecimalField(decimal_places=2, max_digits=12)),
                ('quantity_after', models.DecimalField(decimal_places=2, max_digits=12)),
                ('unit_cost', models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ('total_value', models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True)),
                ('reference_type', models.CharField(blank=True, max_length=50)),
                ('reference_id', models.IntegerField(blank=True, null=True)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='inv_stock_movements', to=settings.AUTH_USER_MODEL)),
                ('item', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='movements', to='inventory.invitem')),
            ],
            options={
                'verbose_name': 'Stock Movement',
                'verbose_name_plural': 'Stock Movements',
                'db_table': 'inv_stock_movement',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='InvMRN',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('mrn_number', models.CharField(max_length=50, unique=True)),
                ('request_date', models.DateField(default=django.utils.timezone.now)),
                ('required_date', models.DateField(blank=True, null=True)),
                ('status', models.CharField(choices=[('draft', 'Draft'), ('pending', 'Pending Approval'), ('approved', 'Approved'), ('cancelled', 'Cancelled'), ('completed', 'Completed')], default='draft', max_length=20)),
                ('job_reference', models.CharField(blank=True, max_length=100)),
                ('notes', models.TextField(blank=True)),
                ('approved_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('approved_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='approved_mrns', to=settings.AUTH_USER_MODEL)),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_mrns', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Material Requisition Note',
                'verbose_name_plural': 'Material Requisition Notes',
                'db_table': 'inv_mrn',
                'ordering': ['-request_date', '-mrn_number'],
            },
        ),
        migrations.CreateModel(
            name='InvGoodsReceivedNote',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('grn_number', models.CharField(max_length=50, unique=True)),
                ('received_date', models.DateField(default=django.utils.timezone.now)),
                ('inspection_date', models.DateField(blank=True, null=True)),
                ('status', models.CharField(choices=[('draft', 'Draft'), ('received', 'Received'), ('inspected', 'Quality Inspected'), ('accepted', 'Accepted'), ('rejected', 'Rejected')], default='draft', max_length=20)),
                ('inspection_notes', models.TextField(blank=True)),
                ('quality_passed', models.BooleanField(default=True)),
                ('delivery_note_number', models.CharField(blank=True, max_length=100)),
                ('vehicle_number', models.CharField(blank=True, max_length=50)),
                ('driver_name', models.CharField(blank=True, max_length=255)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('inspected_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='inspected_inventory_grns', to=settings.AUTH_USER_MODEL)),
                ('purchase_order', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='inventory_grns', to='purchases.purchaseorder')),
                ('received_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='received_inventory_grns', to=settings.AUTH_USER_MODEL)),
                ('supplier', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='inventory_grns', to='suppliers.supplier')),
            ],
            options={
                'verbose_name': 'Goods Received Note',
                'verbose_name_plural': 'Goods Received Notes',
                'db_table': 'inv_grn',
                'ordering': ['-received_date', '-grn_number'],
            },
        ),
        migrations.CreateModel(
            name='InvGoodsIssueNote',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('gin_number', models.CharField(max_length=50, unique=True)),
                ('issue_date', models.DateField(default=django.utils.timezone.now)),
                ('status', models.CharField(choices=[('draft', 'Draft'), ('issued', 'Issued'), ('cancelled', 'Cancelled')], default='draft', max_length=20)),
                ('job_reference', models.CharField(blank=True, max_length=100)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('issued_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='issued_gins', to=settings.AUTH_USER_MODEL)),
                ('received_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='received_gins', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Goods Issue Note',
                'verbose_name_plural': 'Goods Issue Notes',
                'db_table': 'inv_gin',
                'ordering': ['-issue_date', '-gin_number'],
            },
        ),
        migrations.CreateModel(
            name='InvUsageReport',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('report_number', models.CharField(max_length=50, unique=True)),
                ('report_date', models.DateField(default=django.utils.timezone.now)),
                ('job_reference', models.CharField(blank=True, max_length=100)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_usage_reports', to=settings.AUTH_USER_MODEL)),
                ('gin', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='usage_reports', to='inventory.invgoodsissuenote')),
            ],
            options={
                'verbose_name': 'Usage Report',
                'verbose_name_plural': 'Usage Reports',
                'db_table': 'inv_usage_report',
                'ordering': ['-report_date', '-report_number'],
            },
        ),
        migrations.CreateModel(
            name='InvStockAdjustment',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('adjustment_number', models.CharField(max_length=50, unique=True)),
                ('adjustment_date', models.DateField(default=django.utils.timezone.now)),
                ('status', models.CharField(choices=[('draft', 'Draft'), ('pending', 'Pending Approval'), ('approved', 'Approved'), ('rejected', 'Rejected')], default='draft', max_length=20)),
                ('reason', models.CharField(max_length=255)),
                ('notes', models.TextField(blank=True)),
                ('approved_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('approved_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='approved_adjustments', to=settings.AUTH_USER_MODEL)),
                ('requested_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='requested_adjustments', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Stock Adjustment',
                'verbose_name_plural': 'Stock Adjustments',
                'db_table': 'inv_stock_adjustment',
                'ordering': ['-adjustment_date', '-adjustment_number'],
            },
        ),
        migrations.CreateModel(
            name='InvDispatchNote',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('dispatch_number', models.CharField(max_length=50, unique=True)),
                ('dispatch_date', models.DateField(default=django.utils.timezone.now)),
                ('status', models.CharField(choices=[('draft', 'Draft'), ('dispatched', 'Dispatched'), ('cancelled', 'Cancelled')], default='draft', max_length=20)),
                ('invoice_reference', models.CharField(blank=True, max_length=100)),
                ('job_reference', models.CharField(blank=True, max_length=100)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_dispatch_notes', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Dispatch Note',
                'verbose_name_plural': 'Dispatch Notes',
                'db_table': 'inv_dispatch_note',
                'ordering': ['-dispatch_date', '-dispatch_number'],
            },
        ),
        migrations.CreateModel(
            name='InvMRNItem',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('required_qty', models.DecimalField(decimal_places=2, max_digits=12)),
                ('available_qty', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('allocated_qty', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('to_order_qty', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('status', models.CharField(choices=[('stock_available', 'Stock Available'), ('partial_stock', 'Partial Stock'), ('to_order', 'To Order')], default='to_order', max_length=20)),
                ('item', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='mrn_items', to='inventory.invitem')),
                ('mrn', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='items', to='inventory.invmrn')),
            ],
            options={
                'verbose_name': 'MRN Item',
                'verbose_name_plural': 'MRN Items',
                'db_table': 'inv_mrn_item',
            },
        ),
        migrations.CreateModel(
            name='InvGRNItem',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('quantity_received', models.DecimalField(decimal_places=2, max_digits=12)),
                ('quantity_accepted', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('quantity_rejected', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('unit_cost', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('notes', models.TextField(blank=True)),
                ('grn', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='items', to='inventory.invgoodsreceivednote')),
                ('item', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='grn_items', to='inventory.invitem')),
                ('purchase_order_item', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='inventory_grn_items', to='purchases.purchaseorderitem')),
            ],
            options={
                'verbose_name': 'GRN Item',
                'verbose_name_plural': 'GRN Items',
                'db_table': 'inv_grn_item',
            },
        ),
        migrations.CreateModel(
            name='InvStockAllocation',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('quantity', models.DecimalField(decimal_places=2, max_digits=12)),
                ('status', models.CharField(choices=[('active', 'Active'), ('released', 'Released')], default='active', max_length=20)),
                ('allocated_at', models.DateTimeField(auto_now_add=True)),
                ('released_at', models.DateTimeField(blank=True, null=True)),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_allocations', to=settings.AUTH_USER_MODEL)),
                ('item', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='allocations', to='inventory.invitem')),
                ('mrn_item', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='allocations', to='inventory.invmrnitem')),
            ],
            options={
                'verbose_name': 'Stock Allocation',
                'verbose_name_plural': 'Stock Allocations',
                'db_table': 'inv_stock_allocation',
            },
        ),
        migrations.CreateModel(
            name='InvGINItem',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('quantity_issued', models.DecimalField(decimal_places=2, max_digits=12)),
                ('unit_cost', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('total_cost', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('gin', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='items', to='inventory.invgoodsissuenote')),
                ('item', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='gin_items', to='inventory.invitem')),
            ],
            options={
                'verbose_name': 'GIN Item',
                'verbose_name_plural': 'GIN Items',
                'db_table': 'inv_gin_item',
            },
        ),
        migrations.CreateModel(
            name='InvStockBatchIssue',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('quantity', models.DecimalField(decimal_places=2, max_digits=12)),
                ('unit_cost', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('batch', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='issues', to='inventory.invstockbatch')),
                ('gin_item', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='batch_issues', to='inventory.invginitem')),
            ],
            options={
                'verbose_name': 'Stock Batch Issue',
                'verbose_name_plural': 'Stock Batch Issues',
                'db_table': 'inv_stock_batch_issue',
            },
        ),
        migrations.CreateModel(
            name='InvUsageItem',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('issued_qty', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('used_qty', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('returned_qty', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('spoiled_qty', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('notes', models.TextField(blank=True)),
                ('item', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='usage_items', to='inventory.invitem')),
                ('usage_report', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='items', to='inventory.invusagereport')),
                ('wastage_category', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='usage_items', to='inventory.invwastagecategory')),
            ],
            options={
                'verbose_name': 'Usage Item',
                'verbose_name_plural': 'Usage Items',
                'db_table': 'inv_usage_item',
            },
        ),
        migrations.CreateModel(
            name='InvStockAdjustmentItem',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('quantity_change', models.DecimalField(decimal_places=2, max_digits=12)),
                ('unit_cost', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('notes', models.TextField(blank=True)),
                ('adjustment', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='items', to='inventory.invstockadjustment')),
                ('item', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='adjustment_items', to='inventory.invitem')),
            ],
            options={
                'verbose_name': 'Stock Adjustment Item',
                'verbose_name_plural': 'Stock Adjustment Items',
                'db_table': 'inv_stock_adjustment_item',
            },
        ),
        migrations.CreateModel(
            name='InvDispatchItem',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('item_description', models.CharField(max_length=255)),
                ('quantity', models.DecimalField(decimal_places=2, max_digits=12)),
                ('parcels', models.IntegerField(default=0)),
                ('dispatch_note', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='items', to='inventory.invdispatchnote')),
            ],
            options={
                'verbose_name': 'Dispatch Item',
                'verbose_name_plural': 'Dispatch Items',
                'db_table': 'inv_dispatch_item',
            },
        ),
        migrations.RunPython(seed_inventory_data, unseed_inventory_data),
    ]
