from django.utils import timezone

from .models import (
    InvGoodsReceivedNote,
    InvMRN,
    InvPRN,
    InvGoodsIssueNote,
    InvStockAdjustment,
    InvUsageReport,
    InvDispatchNote,
)


def _generate_number(model, field_name, prefix):
    latest = (
        model.objects.filter(**{f"{field_name}__startswith": prefix})
        .order_by(f"-{field_name}")
        .values_list(field_name, flat=True)
        .first()
    )
    next_seq = 1
    if latest:
        try:
            next_seq = int(latest.split('-')[-1]) + 1
        except ValueError:
            next_seq = 1
    return f"{prefix}{next_seq:04d}"


def generate_grn_number():
    year = timezone.now().strftime('%y')
    return _generate_number(InvGoodsReceivedNote, 'grn_number', f"GRN-{year}-")


def generate_mrn_number():
    year = timezone.now().strftime('%y')
    return _generate_number(InvMRN, 'mrn_number', f"MRN-{year}-")


def generate_prn_number():
    year = timezone.now().strftime('%Y')
    return _generate_number(InvPRN, 'prn_number', f"PRN-{year}-")


def generate_gin_number():
    year = timezone.now().strftime('%y')
    return _generate_number(InvGoodsIssueNote, 'gin_number', f"GIN-{year}-")


def generate_adjustment_number():
    year = timezone.now().strftime('%y')
    return _generate_number(InvStockAdjustment, 'adjustment_number', f"ADJ-{year}-")


def generate_usage_number():
    year = timezone.now().strftime('%y')
    return _generate_number(InvUsageReport, 'report_number', f"USG-{year}-")


def generate_dispatch_number():
    year = timezone.now().strftime('%y')
    return _generate_number(InvDispatchNote, 'dispatch_number', f"DSN-{year}-")
