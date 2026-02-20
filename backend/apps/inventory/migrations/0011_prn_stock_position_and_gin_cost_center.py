from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('purchases', '0006_purchaseorderitem_inventory_item'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('inventory', '0010_price_history'),
    ]

    operations = [
        migrations.CreateModel(
            name='InvPRN',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('prn_number', models.CharField(max_length=50, unique=True)),
                ('request_date', models.DateField(default=django.utils.timezone.now)),
                ('needed_by', models.DateField(blank=True, null=True)),
                ('status', models.CharField(choices=[('draft', 'Draft'), ('approved', 'Approved'), ('partially_ordered', 'Partially Ordered'), ('ordered', 'Ordered'), ('closed', 'Closed'), ('cancelled', 'Cancelled')], default='draft', max_length=30)),
                ('job_ticket_id', models.IntegerField(blank=True, null=True)),
                ('notes', models.TextField(blank=True)),
                ('approved_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('approved_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='approved_prns', to=settings.AUTH_USER_MODEL)),
                ('requested_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='requested_prns', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Purchase Requisition Note',
                'verbose_name_plural': 'Purchase Requisition Notes',
                'ordering': ['-request_date', '-prn_number'],
                'db_table': 'inv_prn',
            },
        ),
        migrations.CreateModel(
            name='InvPRNItem',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('required_qty', models.DecimalField(decimal_places=2, max_digits=12)),
                ('ordered_qty', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('received_qty', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('status', models.CharField(choices=[('draft', 'Draft'), ('approved', 'Approved'), ('partially_ordered', 'Partially Ordered'), ('ordered', 'Ordered'), ('partially_received', 'Partially Received'), ('received', 'Received'), ('closed', 'Closed'), ('cancelled', 'Cancelled')], default='draft', max_length=30)),
                ('item', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='prn_items', to='inventory.invitem')),
                ('prn', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='items', to='inventory.invprn')),
            ],
            options={
                'verbose_name': 'PRN Item',
                'verbose_name_plural': 'PRN Items',
                'db_table': 'inv_prn_item',
            },
        ),
        migrations.CreateModel(
            name='InvPRNItemPOLink',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('ordered_qty', models.DecimalField(decimal_places=2, max_digits=12)),
                ('prn_item', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='po_links', to='inventory.invprnitem')),
                ('purchase_order_item', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='prn_links', to='purchases.purchaseorderitem')),
            ],
            options={
                'verbose_name': 'PRN Item PO Link',
                'verbose_name_plural': 'PRN Item PO Links',
                'db_table': 'inv_prn_item_po_link',
            },
        ),
        migrations.AddField(
            model_name='invgoodsissuenote',
            name='cost_center',
            field=models.CharField(blank=True, choices=[('PREPRESS', 'Pre-Press'), ('PRESS', 'Press'), ('POSTPRESS', 'Post-Press'), ('MAINT', 'Maintenance'), ('GENERAL', 'General')], max_length=20, null=True),
        ),
        migrations.AddField(
            model_name='invgoodsissuenote',
            name='prn',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='gins', to='inventory.invprn'),
        ),
    ]
