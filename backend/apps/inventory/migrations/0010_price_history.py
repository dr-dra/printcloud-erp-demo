from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('inventory', '0009_remove_invitem_description'),
        ('suppliers', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='PriceHistory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('unit_price', models.DecimalField(decimal_places=4, max_digits=15)),
                ('currency', models.CharField(default='LKR', max_length=3)),
                ('effective_date', models.DateField()),
                ('source_type', models.CharField(choices=[('PO', 'Purchase Order'), ('GRN', 'Goods Received Note'), ('QUOTATION', 'Supplier Quotation'), ('MANUAL', 'Manual Entry')], max_length=20)),
                ('source_ref', models.CharField(blank=True, max_length=50, null=True)),
                ('source_id', models.BigIntegerField(blank=True, null=True)),
                ('quantity', models.DecimalField(blank=True, decimal_places=3, help_text='Quantity at which this price was quoted', max_digits=15, null=True)),
                ('remarks', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='price_history_entries', to=settings.AUTH_USER_MODEL)),
                ('item', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='price_history', to='inventory.invitem')),
                ('supplier', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='price_history', to='suppliers.supplier')),
            ],
            options={
                'db_table': 'inv_price_history',
                'ordering': ['-effective_date', '-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='pricehistory',
            index=models.Index(fields=['item', 'supplier', 'effective_date', 'created_at'], name='inv_price_current_idx'),
        ),
        migrations.AddIndex(
            model_name='pricehistory',
            index=models.Index(fields=['supplier', 'effective_date'], name='inv_price_supplier_idx'),
        ),
        migrations.AddIndex(
            model_name='pricehistory',
            index=models.Index(fields=['item', 'effective_date'], name='inv_price_item_idx'),
        ),
    ]
