from django.db import migrations, models


def create_default_mappings(apps, schema_editor):
    ChartOfAccounts = apps.get_model('accounting', 'ChartOfAccounts')
    AccountingAccountMapping = apps.get_model('accounting', 'AccountingAccountMapping')

    defaults = {
        'cash': '1000',
        'bank': '1010',
        'bank_savings': '1020',
        'ar': '1100',
        'ap': '2000',
        'sales': '4000',
        'expense': '5000',
        'customer_advances': '2100',
        'vat_payable': '2400',
        'cheques_received': '1040',
        'cheques_pending': '2200',
        'bank_charges': '5210',
        'other_income': '4900',
        'operating_expenses': '5200',
    }

    for key, code in defaults.items():
        account = ChartOfAccounts.objects.filter(account_code=code).first()
        if not account:
            continue
        AccountingAccountMapping.objects.update_or_create(
            key=key,
            defaults={'account_id': account.id, 'is_active': True},
        )


class Migration(migrations.Migration):

    dependencies = [
        ('accounting', '0008_journal_failure'),
    ]

    operations = [
        migrations.CreateModel(
            name='AccountingAccountMapping',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('key', models.CharField(choices=[('cash', 'Cash'), ('bank', 'Bank (Default)'), ('bank_savings', 'Bank Savings'), ('ar', 'Accounts Receivable'), ('ap', 'Accounts Payable'), ('sales', 'Sales Revenue'), ('expense', 'Expense / Purchases'), ('customer_advances', 'Customer Advances'), ('vat_payable', 'VAT Payable'), ('cheques_received', 'Cheques Received'), ('cheques_pending', 'Cheques Pending'), ('bank_charges', 'Bank Charges'), ('other_income', 'Other Income'), ('operating_expenses', 'Operating Expenses')], db_index=True, max_length=50, unique=True)),
                ('is_active', models.BooleanField(default=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('account', models.ForeignKey(on_delete=models.deletion.PROTECT, related_name='role_mappings', to='accounting.chartofaccounts')),
            ],
            options={
                'verbose_name': 'Accounting Account Mapping',
                'verbose_name_plural': 'Accounting Account Mappings',
                'ordering': ['key'],
            },
        ),
        migrations.RunPython(create_default_mappings, migrations.RunPython.noop),
    ]
