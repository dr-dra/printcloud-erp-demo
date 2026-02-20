from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0002_add_prepared_by_legacy_id'),
    ]

    operations = [
        migrations.AddField(
            model_name='salesorder',
            name='production_stage',
            field=models.CharField(
                blank=True,
                choices=[('pre_press', 'Pre-Press'), ('press', 'Press'), ('post_press', 'Post-Press')],
                help_text='Production stage when order is in production',
                max_length=20,
                null=True
            ),
        ),
    ]
