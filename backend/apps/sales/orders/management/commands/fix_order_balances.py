from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.sales.orders.models import SalesOrder


class Command(BaseCommand):
    help = "Recalculate amount_paid/balance_due for recent orders"

    def add_arguments(self, parser):
        parser.add_argument(
            '--limit',
            type=int,
            default=100,
            help='Number of most recent orders to update',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview changes without saving',
        )

    def handle(self, *args, **options):
        limit = options['limit']
        dry_run = options['dry_run']

        orders = SalesOrder.objects.order_by('-id')[:limit]
        updated = 0

        if dry_run:
            self.stdout.write(self.style.WARNING('🔍 DRY RUN - no updates will be saved'))

        for order in orders:
            amount_paid = order.amount_paid or Decimal('0.00')
            net_total = order.net_total or Decimal('0.00')
            new_balance = net_total - amount_paid

            if order.balance_due != new_balance:
                updated += 1
                self.stdout.write(
                    f'Order {order.order_number}: balance_due {order.balance_due} -> {new_balance}'
                )
                if not dry_run:
                    order.balance_due = new_balance
                    order.save(update_fields=['balance_due'])

        self.stdout.write(self.style.SUCCESS(f'Updated {updated} order(s)'))
