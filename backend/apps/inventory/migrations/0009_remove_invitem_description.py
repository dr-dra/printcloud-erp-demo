from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('inventory', '0008_alter_invcategory_id_alter_invdispatchitem_id_and_more'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='invitem',
            name='description',
        ),
    ]
