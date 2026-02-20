from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0005_add_vat_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='salesorder',
            name='project_name',
            field=models.CharField(
                blank=True,
                help_text='Order project name',
                max_length=255,
                null=True,
            ),
        ),
    ]
