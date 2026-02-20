from decimal import Decimal

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounting', '0007_ar_payment_accounting'),
        ('pos', '0010_cashdrawersession_commercial_printing_income_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='POSZReport',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('gross_sales', models.DecimalField(decimal_places=2, default=Decimal('0.00'), help_text='Subtotal + tax for completed transactions', max_digits=12)),
                ('net_sales', models.DecimalField(decimal_places=2, default=Decimal('0.00'), help_text='Gross sales minus discounts', max_digits=12)),
                ('vat_amount', models.DecimalField(decimal_places=2, default=Decimal('0.00'), help_text='VAT portion calculated from VAT-inclusive net sales', max_digits=12)),
                ('discounts_total', models.DecimalField(decimal_places=2, default=Decimal('0.00'), help_text='Total discounts applied', max_digits=12)),
                ('cash_total', models.DecimalField(decimal_places=2, default=Decimal('0.00'), help_text='Total cash payments', max_digits=12)),
                ('card_total', models.DecimalField(decimal_places=2, default=Decimal('0.00'), help_text='Total card/bank payments', max_digits=12)),
                ('on_account_total', models.DecimalField(decimal_places=2, default=Decimal('0.00'), help_text='Total on-account payments', max_digits=12)),
                ('posted_at', models.DateTimeField(blank=True, help_text='When this Z-report was posted to accounting', null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('cash_drawer_session', models.OneToOneField(help_text='Closed cash drawer session for this Z-report', on_delete=django.db.models.deletion.PROTECT, related_name='z_report', to='pos.cashdrawersession')),
                ('journal_entry', models.ForeignKey(blank=True, help_text='Accounting journal entry for this Z-report', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='pos_z_reports', to='accounting.journalentry')),
            ],
            options={
                'verbose_name': 'POS Z Report',
                'verbose_name_plural': 'POS Z Reports',
                'db_table': 'pos_z_reports',
                'ordering': ['-created_at'],
            },
        ),
    ]
