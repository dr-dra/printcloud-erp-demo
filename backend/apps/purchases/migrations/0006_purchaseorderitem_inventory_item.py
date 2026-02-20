from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0005_inventory_overhaul'),
        ('purchases', '0005_billscan_summary'),
    ]

    operations = [
        migrations.AddField(
            model_name='purchaseorderitem',
            name='item',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='purchase_order_items',
                to='inventory.invitem',
                help_text='Linked inventory item (optional)'
            ),
        ),
    ]
