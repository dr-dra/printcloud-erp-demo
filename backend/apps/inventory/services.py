from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from .models import (
    InvStockBatch,
    InvStockMovement,
    InvStockAllocation,
    InvStockBatchIssue,
    PriceHistory,
)


def get_current_stock(item):
    result = item.batches.filter(is_active=True).aggregate(total=Sum('quantity_remaining'))
    return result['total'] or Decimal('0')


def get_latest_unit_cost(item):
    latest_batch = item.batches.order_by('-received_date', '-id').first()
    return latest_batch.unit_cost if latest_batch else Decimal('0')


def deduct_from_batches(item, quantity, reference_type, reference_id, user, create_batch_issues=False, gin_item=None):
    remaining = quantity
    total_cost = Decimal('0')

    batches = item.batches.filter(is_active=True, quantity_remaining__gt=0).order_by('received_date', 'id')
    for batch in batches:
        if remaining <= 0:
            break
        take_qty = min(batch.quantity_remaining, remaining)
        remaining -= take_qty

        batch.quantity_remaining -= take_qty
        if batch.quantity_remaining <= 0:
            batch.quantity_remaining = Decimal('0')
            batch.is_active = False
        batch.save(update_fields=['quantity_remaining', 'is_active'])

        total_cost += take_qty * batch.unit_cost

        if create_batch_issues and gin_item is not None:
            InvStockBatchIssue.objects.create(
                gin_item=gin_item,
                batch=batch,
                quantity=take_qty,
                unit_cost=batch.unit_cost
            )

    if remaining > 0:
        raise ValueError(f"Insufficient stock for item {item.sku}")

    return total_cost


def allocate_mrn(mrn, user):
    with transaction.atomic():
        for mrn_item in mrn.items.select_related('item'):
            InvStockAllocation.objects.filter(mrn_item=mrn_item, status='active').update(
                status='released',
                released_at=timezone.now()
            )

            available = get_current_stock(mrn_item.item)
            allocated_qty = min(available, mrn_item.required_qty)

            if allocated_qty > 0:
                InvStockAllocation.objects.create(
                    mrn_item=mrn_item,
                    item=mrn_item.item,
                    quantity=allocated_qty,
                    created_by=user
                )

            mrn_item.available_qty = available
            mrn_item.allocated_qty = allocated_qty
            mrn_item.to_order_qty = mrn_item.required_qty - allocated_qty
            if allocated_qty >= mrn_item.required_qty:
                mrn_item.status = 'stock_available'
            elif allocated_qty > 0:
                mrn_item.status = 'partial_stock'
            else:
                mrn_item.status = 'to_order'
            mrn_item.save(update_fields=['available_qty', 'allocated_qty', 'to_order_qty', 'status'])

        mrn.status = 'approved'
        mrn.approved_by = user
        mrn.approved_at = timezone.now()
        mrn.save(update_fields=['status', 'approved_by', 'approved_at'])


def issue_gin(gin, user):
    if gin.status != 'draft':
        raise ValueError("Only draft GINs can be issued")

    with transaction.atomic():
        for gin_item in gin.items.select_related('item'):
            before_qty = get_current_stock(gin_item.item)
            total_cost = deduct_from_batches(
                gin_item.item,
                gin_item.quantity_issued,
                reference_type='gin',
                reference_id=gin.id,
                user=user,
                create_batch_issues=True,
                gin_item=gin_item
            )
            after_qty = before_qty - gin_item.quantity_issued

            unit_cost = Decimal('0')
            if gin_item.quantity_issued > 0:
                unit_cost = total_cost / gin_item.quantity_issued

            gin_item.unit_cost = unit_cost
            gin_item.total_cost = total_cost
            gin_item.save(update_fields=['unit_cost', 'total_cost'])

            InvStockMovement.objects.create(
                item=gin_item.item,
                movement_type='gin',
                quantity=-gin_item.quantity_issued,
                quantity_before=before_qty,
                quantity_after=after_qty,
                unit_cost=unit_cost,
                total_value=total_cost,
                reference_type='gin',
                reference_id=gin.id,
                notes=f"GIN {gin.gin_number}",
                created_by=user
            )

        gin.status = 'issued'
        gin.issued_by = user
        gin.save(update_fields=['status', 'issued_by', 'updated_at'])


def apply_stock_adjustment(adjustment, user):
    if adjustment.status != 'pending':
        raise ValueError("Only pending adjustments can be approved")

    with transaction.atomic():
        for item_line in adjustment.items.select_related('item'):
            qty = item_line.quantity_change
            if qty == 0:
                continue

            if qty > 0:
                before_qty = get_current_stock(item_line.item)
                after_qty = before_qty + qty
                InvStockBatch.objects.create(
                    item=item_line.item,
                    received_date=adjustment.adjustment_date,
                    source_type='adjustment',
                    source_reference=adjustment.adjustment_number,
                    quantity_received=qty,
                    quantity_remaining=qty,
                    unit_cost=item_line.unit_cost,
                    notes=f"Adjustment {adjustment.adjustment_number}"
                )
                InvStockMovement.objects.create(
                    item=item_line.item,
                    movement_type='adjustment',
                    quantity=qty,
                    quantity_before=before_qty,
                    quantity_after=after_qty,
                    unit_cost=item_line.unit_cost,
                    total_value=qty * item_line.unit_cost,
                    reference_type='adjustment',
                    reference_id=adjustment.id,
                    notes=f"Adjustment {adjustment.adjustment_number}",
                    created_by=user
                )
            else:
                before_qty = get_current_stock(item_line.item)
                total_cost = deduct_from_batches(
                    item_line.item,
                    abs(qty),
                    reference_type='adjustment',
                    reference_id=adjustment.id,
                    user=user
                )
                after_qty = before_qty + qty
                unit_cost = Decimal('0')
                if qty != 0:
                    unit_cost = total_cost / abs(qty)
                InvStockMovement.objects.create(
                    item=item_line.item,
                    movement_type='adjustment',
                    quantity=qty,
                    quantity_before=before_qty,
                    quantity_after=after_qty,
                    unit_cost=unit_cost,
                    total_value=total_cost,
                    reference_type='adjustment',
                    reference_id=adjustment.id,
                    notes=f"Adjustment {adjustment.adjustment_number}",
                    created_by=user
                )

        adjustment.status = 'approved'
        adjustment.approved_by = user
        adjustment.approved_at = timezone.now()
        adjustment.save(update_fields=['status', 'approved_by', 'approved_at', 'updated_at'])


def apply_usage_returns(usage_report, user):
    with transaction.atomic():
        for usage_item in usage_report.items.select_related('item'):
            if usage_item.returned_qty <= 0:
                continue

            unit_cost = get_latest_unit_cost(usage_item.item)
            before_qty = get_current_stock(usage_item.item)
            after_qty = before_qty + usage_item.returned_qty

            InvStockBatch.objects.create(
                item=usage_item.item,
                received_date=usage_report.report_date,
                source_type='return',
                source_reference=usage_report.report_number,
                quantity_received=usage_item.returned_qty,
                quantity_remaining=usage_item.returned_qty,
                unit_cost=unit_cost,
                notes=f"Return from usage {usage_report.report_number}"
            )
            InvStockMovement.objects.create(
                item=usage_item.item,
                movement_type='return',
                quantity=usage_item.returned_qty,
                quantity_before=before_qty,
                quantity_after=after_qty,
                unit_cost=unit_cost,
                total_value=usage_item.returned_qty * unit_cost,
                reference_type='usage_report',
                reference_id=usage_report.id,
                notes=f"Return from usage {usage_report.report_number}",
                created_by=user
            )


def accept_grn(grn, user):
    if grn.status != 'inspected':
        raise ValueError("GRN must be inspected before acceptance")

    if not grn.quality_passed:
        raise ValueError("Cannot accept GRN that failed quality inspection")

    with transaction.atomic():
        if not grn.items.exists():
            raise ValueError("Cannot accept GRN without items")

        any_accepted = False
        for grn_item in grn.items.select_related('item', 'purchase_order_item'):
            accepted_qty = grn_item.quantity_accepted
            if accepted_qty <= 0:
                accepted_qty = grn_item.quantity_received - grn_item.quantity_rejected
            if accepted_qty <= 0:
                continue
            any_accepted = True

            item = grn_item.item
            before_qty = get_current_stock(item)
            after_qty = before_qty + accepted_qty

            InvStockBatch.objects.create(
                item=item,
                received_date=grn.received_date,
                source_type='grn',
                source_reference=grn.grn_number,
                quantity_received=accepted_qty,
                quantity_remaining=accepted_qty,
                unit_cost=grn_item.unit_cost,
                notes=f"GRN {grn.grn_number}"
            )

            InvStockMovement.objects.create(
                item=item,
                movement_type='grn',
                quantity=accepted_qty,
                quantity_before=before_qty,
                quantity_after=after_qty,
                unit_cost=grn_item.unit_cost,
                total_value=accepted_qty * grn_item.unit_cost,
                reference_type='grn',
                reference_id=grn.id,
                notes=f"GRN {grn.grn_number}",
                created_by=user
            )

            po_item = grn_item.purchase_order_item
            po_item.quantity_received += accepted_qty
            po_item.save(update_fields=['quantity_received'])

            PriceHistory.record_price(
                item_id=item.id,
                supplier_id=grn.supplier_id,
                unit_price=grn_item.unit_cost,
                effective_date=grn.received_date,
                source_type='GRN',
                source_ref=grn.grn_number,
                source_id=grn.id,
                quantity=accepted_qty,
                created_by=user,
            )

        if not any_accepted:
            raise ValueError("Cannot accept GRN without accepted quantities")

        grn.status = 'accepted'
        grn.save(update_fields=['status'])

        po = grn.purchase_order
        all_received = all(item.is_fully_received for item in po.items.all())
        if all_received:
            po.status = 'received'
            po.actual_delivery_date = grn.received_date
        else:
            po.status = 'partially_received'
        po.save(update_fields=['status', 'actual_delivery_date', 'updated_at'])
