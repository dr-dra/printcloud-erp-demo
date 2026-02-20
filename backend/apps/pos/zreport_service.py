from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.db import transaction, IntegrityError
from django.db.models import Sum
from django.utils import timezone

from apps.accounting.services.journal_engine import JournalEngine
from apps.pos.models import POSPayment, POSTransaction, POSZReport


DECIMAL_PLACES = Decimal('0.01')


def _to_decimal(value):
    return Decimal(str(value or 0))


def _quantize(value):
    return value.quantize(DECIMAL_PLACES, rounding=ROUND_HALF_UP)


def _get_go_live_date():
    return datetime.strptime(settings.VAT_GO_LIVE_DATE, '%Y-%m-%d').date()


def generate_zreport(session):
    existing = POSZReport.objects.filter(cash_drawer_session=session).first()
    if existing:
        return existing

    transactions = POSTransaction.objects.filter(
        cash_drawer_session=session,
        status='completed'
    )

    totals = transactions.aggregate(
        subtotal_sum=Sum('subtotal'),
        tax_sum=Sum('tax_amount'),
        discount_sum=Sum('discount_amount')
    )

    subtotal_sum = _to_decimal(totals.get('subtotal_sum'))
    tax_sum = _to_decimal(totals.get('tax_sum'))
    discount_sum = _to_decimal(totals.get('discount_sum'))

    gross_sales = subtotal_sum + tax_sum
    discounts_total = discount_sum
    net_sales = gross_sales - discounts_total

    vat_rate = Decimal(str(settings.VAT_RATE))
    if net_sales > 0 and vat_rate > 0:
        vat_amount = net_sales - (net_sales / (Decimal('1') + vat_rate))
    else:
        vat_amount = Decimal('0.00')

    payments = POSPayment.objects.filter(
        transaction__cash_drawer_session=session,
        transaction__status='completed'
    ).values('payment_method').annotate(total=Sum('amount'))

    cash_total = Decimal('0.00')
    card_total = Decimal('0.00')
    on_account_total = Decimal('0.00')

    for payment in payments:
        method = payment['payment_method']
        amount = _to_decimal(payment['total'])
        if method == 'cash':
            cash_total += amount
        elif method == 'account':
            on_account_total += amount
        else:
            # Treat all other tender types as bank/card for Phase 1
            card_total += amount

    # cash_drawer_session is OneToOne; concurrent closes can race. Use a safe get-or-create
    # pattern so the losing transaction returns the existing report instead of raising 500.
    defaults = {
        'gross_sales': _quantize(gross_sales),
        'net_sales': _quantize(net_sales),
        'vat_amount': _quantize(vat_amount),
        'discounts_total': _quantize(discounts_total),
        'cash_total': _quantize(cash_total),
        'card_total': _quantize(card_total),
        'on_account_total': _quantize(on_account_total),
    }

    with transaction.atomic():
        try:
            report, _created = POSZReport.objects.get_or_create(
                cash_drawer_session=session,
                defaults=defaults,
            )
            return report
        except IntegrityError:
            return POSZReport.objects.get(cash_drawer_session=session)


def post_zreport_journal(zreport, created_by=None):
    if zreport.journal_entry_id or zreport.posted_at:
        return zreport.journal_entry

    session = zreport.cash_drawer_session
    if not session.closed_at:
        return None

    if zreport.net_sales <= 0:
        return None

    go_live_date = _get_go_live_date()
    if session.closed_at.date() < go_live_date:
        return None

    net_sales_ex_vat = zreport.net_sales - zreport.vat_amount
    if net_sales_ex_vat < 0:
        return None

    lines_data = []
    if zreport.cash_total > 0:
        lines_data.append({
            'account_code': '1000',
            'debit': zreport.cash_total,
            'credit': Decimal('0.00'),
            'description': 'POS cash receipts',
        })
    if zreport.card_total > 0:
        lines_data.append({
            'account_code': '1010',
            'debit': zreport.card_total,
            'credit': Decimal('0.00'),
            'description': 'POS card/bank receipts',
        })
    if zreport.on_account_total > 0:
        lines_data.append({
            'account_code': '1110',
            'debit': zreport.on_account_total,
            'credit': Decimal('0.00'),
            'description': 'POS on-account sales',
        })

    lines_data.append({
        'account_code': '4100',
        'debit': Decimal('0.00'),
        'credit': net_sales_ex_vat,
        'description': 'POS sales (net of VAT)',
    })
    lines_data.append({
        'account_code': '2400',
        'debit': Decimal('0.00'),
        'credit': zreport.vat_amount,
        'description': 'VAT payable on POS sales',
    })

    with transaction.atomic():
        journal = JournalEngine.create_or_get_journal(
            entry_date=session.closed_at.date(),
            source_type='pos_zreport',
            source_id=zreport.id,
            event_type='posted',
            description=f"POS Z-Report {session.session_number}",
            lines_data=lines_data,
            created_by=created_by,
        )

        if not zreport.journal_entry_id:
            zreport.journal_entry = journal
            zreport.posted_at = timezone.now()
            zreport.save(update_fields=['journal_entry', 'posted_at'])

        return journal
