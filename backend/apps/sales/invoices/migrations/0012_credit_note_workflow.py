from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        ('accounting', '0009_account_mappings'),
        ('orders', '0009_order_payment_refund_fields'),
        ('invoices', '0011_payment_refund_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='salescreditnote',
            name='credit_note_type',
            field=models.CharField(choices=[('ar_credit', 'AR Credit'), ('payment_reverse', 'Payment Reverse'), ('payment_refund', 'Payment Refund')], db_index=True, default='ar_credit', help_text='Type of credit note', max_length=20),
        ),
        migrations.AddField(
            model_name='salescreditnote',
            name='detail_note',
            field=models.TextField(default='', help_text='Detailed reason note (required)'),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='salescreditnote',
            name='invoice_payment',
            field=models.ForeignKey(blank=True, help_text='Invoice payment being reversed/refunded', null=True, on_delete=django.db.models.deletion.PROTECT, related_name='credit_notes', to='invoices.invoicepayment'),
        ),
        migrations.AddField(
            model_name='salescreditnote',
            name='journal_entry',
            field=models.ForeignKey(blank=True, help_text='Journal entry created for this credit note', null=True, on_delete=django.db.models.deletion.PROTECT, related_name='sales_credit_notes', to='accounting.journalentry'),
        ),
        migrations.AddField(
            model_name='salescreditnote',
            name='order',
            field=models.ForeignKey(blank=True, help_text='Original order being credited (optional)', null=True, on_delete=django.db.models.deletion.PROTECT, related_name='credit_notes', to='orders.salesorder'),
        ),
        migrations.AddField(
            model_name='salescreditnote',
            name='order_payment',
            field=models.ForeignKey(blank=True, help_text='Order payment being reversed/refunded', null=True, on_delete=django.db.models.deletion.PROTECT, related_name='credit_notes', to='orders.orderpayment'),
        ),
        migrations.AddField(
            model_name='salescreditnote',
            name='payout_account',
            field=models.ForeignKey(blank=True, help_text='Cash/Bank account used for refund payout', null=True, on_delete=django.db.models.deletion.PROTECT, related_name='credit_note_payouts', to='accounting.chartofaccounts'),
        ),
        migrations.AddField(
            model_name='salescreditnote',
            name='payout_cheque_number',
            field=models.CharField(blank=True, help_text='Cheque number (if refund by cheque)', max_length=50, null=True),
        ),
        migrations.AddField(
            model_name='salescreditnote',
            name='payout_method',
            field=models.CharField(blank=True, choices=[('cash', 'Cash'), ('bank_transfer', 'Bank Transfer'), ('cheque', 'Cheque')], help_text='Refund payout method', max_length=20, null=True),
        ),
        migrations.AddField(
            model_name='salescreditnote',
            name='payout_voucher_number',
            field=models.CharField(blank=True, help_text='Payout voucher number', max_length=50, null=True),
        ),
        migrations.AddField(
            model_name='salescreditnote',
            name='customer_bank_account_name',
            field=models.CharField(blank=True, help_text='Customer bank account name for refund', max_length=255, null=True),
        ),
        migrations.AddField(
            model_name='salescreditnote',
            name='customer_bank_account_number',
            field=models.CharField(blank=True, help_text='Customer bank account number for refund', max_length=255, null=True),
        ),
        migrations.AddField(
            model_name='salescreditnote',
            name='customer_bank_name',
            field=models.CharField(blank=True, help_text='Customer bank name for refund', max_length=255, null=True),
        ),
        migrations.AlterField(
            model_name='salescreditnote',
            name='reason',
            field=models.CharField(choices=[('bounced_cheque', 'Bounced Cheque'), ('overpayment', 'Overpayment'), ('less_quantity', 'Less Quantity'), ('canceled_item', 'Canceled Item'), ('customer_change', 'Customer Change'), ('price_correction', 'Price Correction'), ('service_not_delivered', 'Service not delivered'), ('other', 'Other')], help_text='Reason for credit note (returns, adjustment, discount, etc.)', max_length=255),
        ),
        migrations.CreateModel(
            name='CreditNoteSequence',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(default='default', max_length=50, unique=True)),
                ('prefix', models.CharField(default='', max_length=5)),
                ('last_number', models.PositiveIntegerField(default=0)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'sales_credit_note_sequence',
            },
        ),
    ]
