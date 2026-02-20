from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0006_remove_category_parent'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='invitem',
            name='grain_direction',
        ),
    ]
