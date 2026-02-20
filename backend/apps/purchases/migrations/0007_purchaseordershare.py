from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('purchases', '0006_purchaseorderitem_inventory_item'),
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='PurchaseOrderShare',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('token', models.CharField(max_length=50, unique=True)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('expires_at', models.DateTimeField()),
                ('view_count', models.IntegerField(default=0)),
                ('last_viewed_at', models.DateTimeField(blank=True, null=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_purchase_order_shares', to='users.user')),
                ('purchase_order', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='share_links', to='purchases.purchaseorder')),
            ],
            options={
                'verbose_name': 'Purchase Order Share',
                'verbose_name_plural': 'Purchase Order Shares',
                'db_table': 'purchase_order_shares',
                'ordering': ['-created_at'],
            },
        ),
    ]
