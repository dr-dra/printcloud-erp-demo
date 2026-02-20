# Generated migration for creating Misc./Custom product

from django.db import migrations


def create_misc_product(apps, schema_editor):
    """Create the Misc./Custom product for POS"""
    POSCategory = apps.get_model('pos', 'POSCategory')
    POSProduct = apps.get_model('pos', 'POSProduct')

    # Get or create "Misc." category
    misc_category, _ = POSCategory.objects.get_or_create(
        name='Misc.',
        defaults={
            'description': 'Miscellaneous items and custom products',
            'is_active': True,
            'display_order': 999  # Show at bottom
        }
    )

    # Create "Misc. / Custom" product if it doesn't exist
    POSProduct.objects.get_or_create(
        sku='MISC-CUSTOM',
        defaults={
            'name': 'Misc. / Custom',
            'description': 'Custom item with editable name and price',
            'category': misc_category,
            'default_selling_price': 0.00,  # Default price is 0
            'unit_cost': 0.00,
            'tax_rate': 0.00,  # Default tax rate (can be customized)
            'is_quick_access': False,  # Don't show in quick access
            'default_quantity': 1,
            'track_inventory': False,  # No inventory tracking for misc items
            'allow_backorder': True,
            'is_active': True
        }
    )


def reverse_misc_product(apps, schema_editor):
    """Remove the Misc./Custom product"""
    POSProduct = apps.get_model('pos', 'POSProduct')
    POSProduct.objects.filter(sku='MISC-CUSTOM').delete()
    # Note: We don't delete the category as other products might use it


class Migration(migrations.Migration):

    dependencies = [
        ('pos', '0008_remove_posproduct_button_color_and_more'),
    ]

    operations = [
        migrations.RunPython(create_misc_product, reverse_misc_product),
    ]
