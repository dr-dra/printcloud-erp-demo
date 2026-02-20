from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):

    dependencies = [
        ('invoices', '0008_add_vat_fields_to_invoice'),
    ]

    operations = [
        migrations.AddConstraint(
            model_name='customeradvance',
            constraint=models.UniqueConstraint(
                fields=('source_payment', 'source_type'),
                condition=Q(source_payment__isnull=False),
                name='uniq_customeradvance_source_payment_type',
            ),
        ),
    ]
