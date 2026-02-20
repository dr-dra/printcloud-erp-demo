from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('invoices', '0012_credit_note_workflow'),
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='InvoiceShare',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('token', models.CharField(max_length=50, unique=True)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('expires_at', models.DateTimeField()),
                ('view_count', models.IntegerField(default=0)),
                ('last_viewed_at', models.DateTimeField(blank=True, null=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_invoice_shares', to='users.user')),
                ('invoice', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='share_links', to='invoices.salesinvoice')),
            ],
            options={
                'verbose_name': 'Invoice Share',
                'verbose_name_plural': 'Invoice Shares',
                'db_table': 'sales_invoice_shares',
                'ordering': ['-created_at'],
            },
        ),
    ]
