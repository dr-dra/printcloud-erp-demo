import re

from django.db.models import Q
from django.utils import timezone

from .models import PurchaseOrder


def get_financial_year_start(reference_date):
    if reference_date.month >= 4:
        return reference_date.year
    return reference_date.year - 1


def build_po_number(year_suffix, sequence):
    return f"PO{year_suffix}{sequence:04d}"


def get_next_po_sequence(year_suffix):
    pattern = re.compile(rf'^PO-?{year_suffix}-?(\d+)$')
    candidates = PurchaseOrder.objects.filter(
        Q(po_number__startswith=f"PO{year_suffix}")
        | Q(po_number__startswith=f"PO-{year_suffix}-")
    ).values_list('po_number', flat=True)

    max_seq = 0
    for po_number in candidates:
        match = pattern.match(po_number or '')
        if match:
            try:
                max_seq = max(max_seq, int(match.group(1)))
            except (TypeError, ValueError):
                continue

    return max_seq + 1


def generate_po_number(reference_date=None):
    current_date = reference_date or timezone.localdate()
    fy_start_year = get_financial_year_start(current_date)
    year_suffix = str(fy_start_year)[-2:]
    next_seq = get_next_po_sequence(year_suffix)
    return build_po_number(year_suffix, next_seq)
