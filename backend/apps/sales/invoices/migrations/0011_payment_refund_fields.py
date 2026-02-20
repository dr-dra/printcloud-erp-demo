from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        ('accounting', '0009_account_mappings'),
        ('invoices', '0010_payment_reversal_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='invoicepayment',
            name='is_refunded',
            field=models.BooleanField(default=False, help_text='Has this payment been refunded'),
        ),
        migrations.AddField(
            model_name='invoicepayment',
            name='refunded_at',
            field=models.DateTimeField(blank=True, help_text='When payment was refunded', null=True),
        ),
        migrations.AddField(
            model_name='invoicepayment',
            name='refunded_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='refunded_invoice_payments',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='invoicepayment',
            name='refund_journal_entry',
            field=models.ForeignKey(
                blank=True,
                help_text='Journal entry that refunds this payment',
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='invoice_payment_refunds',
                to='accounting.journalentry',
            ),
        ),
    ]
