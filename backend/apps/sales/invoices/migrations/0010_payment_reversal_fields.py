from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        ('accounting', '0009_account_mappings'),
        ('invoices', '0009_customeradvance_idempotency'),
    ]

    operations = [
        migrations.AddField(
            model_name='invoicepayment',
            name='is_reversed',
            field=models.BooleanField(default=False, help_text='Has this payment been reversed'),
        ),
        migrations.AddField(
            model_name='invoicepayment',
            name='reversed_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='reversed_invoice_payments', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='invoicepayment',
            name='reversed_at',
            field=models.DateTimeField(blank=True, help_text='When payment was reversed', null=True),
        ),
        migrations.AddField(
            model_name='invoicepayment',
            name='reversal_journal_entry',
            field=models.ForeignKey(blank=True, help_text='Journal entry that reverses this payment', null=True, on_delete=django.db.models.deletion.PROTECT, related_name='invoice_payment_reversals', to='accounting.journalentry'),
        ),
    ]
