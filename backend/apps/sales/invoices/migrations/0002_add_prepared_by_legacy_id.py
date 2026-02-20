# Generated migration to add prepared_by_legacy_id field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('invoices', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='salesinvoice',
            name='prepared_by_legacy_id',
            field=models.IntegerField(
                blank=True,
                null=True,
                help_text='Legacy employee ID from old system for prepared_by mapping'
            ),
        ),
    ]
