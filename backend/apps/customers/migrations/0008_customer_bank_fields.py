from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('customers', '0007_customer_pos_customer'),
    ]

    operations = [
        migrations.AddField(
            model_name='customer',
            name='bank_account_name',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name='customer',
            name='bank_name',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name='customer',
            name='bank_account_number',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
    ]
