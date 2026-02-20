from decimal import Decimal, InvalidOperation

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.inventory.models import PriceHistory
from .models import PurchaseOrderItem, GoodsReceivedNote


def _to_stock_unit_price(unit_price, item):
    factor = item.purchase_to_stock_factor
    if factor in (None, 0, Decimal('0')):
        factor = Decimal('1')
    try:
        factor = Decimal(factor)
    except (TypeError, InvalidOperation):
        factor = Decimal('1')
    if factor <= 0:
        factor = Decimal('1')
    return unit_price / factor


@receiver(post_save, sender=PurchaseOrderItem)
def capture_price_from_po(sender, instance, **kwargs):
    if not instance.item:
        return

    purchase_order = instance.purchase_order
    supplier = purchase_order.supplier
    stock_unit_price = _to_stock_unit_price(instance.unit_price, instance.item)

    PriceHistory.record_price(
        item_id=instance.item_id,
        supplier_id=supplier.id,
        unit_price=stock_unit_price,
        effective_date=purchase_order.order_date,
        source_type='PO',
        source_ref=purchase_order.po_number,
        source_id=purchase_order.id,
        quantity=instance.quantity,
        created_by=purchase_order.created_by,
    )


@receiver(post_save, sender=GoodsReceivedNote)
def capture_price_from_grn(sender, instance, **kwargs):
    if instance.status != 'accepted':
        return

    for grn_item in instance.items.select_related('purchase_order_item__item'):
        po_item = grn_item.purchase_order_item
        if not po_item or not po_item.item:
            continue

        stock_unit_price = _to_stock_unit_price(po_item.unit_price, po_item.item)

        PriceHistory.record_price(
            item_id=po_item.item_id,
            supplier_id=instance.supplier_id,
            unit_price=stock_unit_price,
            effective_date=instance.received_date,
            source_type='GRN',
            source_ref=instance.grn_number,
            source_id=instance.id,
            quantity=grn_item.quantity_received,
            created_by=instance.received_by,
        )
