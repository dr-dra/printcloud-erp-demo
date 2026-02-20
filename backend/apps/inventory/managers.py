from calendar import monthrange
from datetime import date

from django.db import models
from django.db.models import Avg, Count, Max, Min, OuterRef, Subquery
from django.db.models.functions import TruncDay, TruncMonth, TruncWeek
from django.utils import timezone


def _subtract_months(base_date: date, months: int) -> date:
    year = base_date.year
    month = base_date.month - months
    while month <= 0:
        year -= 1
        month += 12
    day = min(base_date.day, monthrange(year, month)[1])
    return date(year, month, day)


class PriceHistoryManager(models.Manager):
    def get_current_price(self, item_id, supplier_id):
        return (
            self.filter(item_id=item_id, supplier_id=supplier_id)
            .order_by('-effective_date', '-created_at')
            .first()
        )

    def get_current_prices_for_item(self, item_id):
        latest = (
            self.filter(item_id=item_id, supplier_id=OuterRef('supplier_id'))
            .order_by('-effective_date', '-created_at')
        )

        return (
            self.filter(item_id=item_id, id__in=Subquery(latest.values('id')[:1]))
            .select_related('supplier', 'item')
            .order_by('unit_price')
        )

    def get_supplier_comparison(self, item_id):
        prices = list(
            self.get_current_prices_for_item(item_id).values(
                'supplier_id',
                'supplier__name',
                'unit_price',
                'effective_date',
                'source_type',
            )
        )

        if not prices:
            return []

        all_prices = [entry['unit_price'] for entry in prices]
        avg_price = sum(all_prices) / len(all_prices)
        min_price = min(all_prices)

        for index, entry in enumerate(prices):
            entry['price_rank'] = index + 1
            entry['is_lowest'] = entry['unit_price'] == min_price
            entry['diff_from_avg'] = entry['unit_price'] - avg_price

        return prices

    def get_price_trend(self, item_id, supplier_id=None, months=12, period='monthly'):
        if months is None or months <= 0:
            months = 12

        base_date = timezone.now().date()
        start_date = _subtract_months(base_date, months)

        qs = self.filter(item_id=item_id, effective_date__gte=start_date)
        if supplier_id:
            qs = qs.filter(supplier_id=supplier_id)

        if period == 'weekly':
            trunc = TruncWeek
        elif period == 'daily':
            trunc = TruncDay
        else:
            trunc = TruncMonth

        return (
            qs.annotate(period=trunc('effective_date'))
            .values('period')
            .annotate(
                avg_price=Avg('unit_price'),
                min_price=Min('unit_price'),
                max_price=Max('unit_price'),
                count=Count('id'),
            )
            .order_by('period')
        )
