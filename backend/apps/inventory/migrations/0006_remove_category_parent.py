from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0005_inventory_overhaul'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='invcategory',
            name='parent_category',
        ),
    ]
