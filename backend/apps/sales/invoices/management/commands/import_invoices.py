from django.core.management.base import BaseCommand
from apps.sales.invoices.models import SalesInvoice, SalesInvoiceItem, SalesInvoiceTimeline
from apps.sales.orders.models import SalesOrder
from apps.customers.models import Customer
from django.contrib.auth import get_user_model
from django.db import connections, transaction
from django.utils import timezone
from datetime import datetime
from decimal import Decimal
import os

User = get_user_model()

# Legacy status code mapping for invoices
LEGACY_STATUS_MAP = {
    0: 'draft',
    1: 'sent',
    2: 'paid',
    3: 'void',
    # Adjust based on data findings if needed
}

def safe_decimal(value, default=0):
    if value is None or value == '':
        return Decimal(str(default))
    try:
        return Decimal(str(value))
    except:
        return Decimal(str(default))

class Command(BaseCommand):
    help = "Import invoices from legacy MySQL database into PostgreSQL"

    def add_arguments(self, parser):
        parser.add_argument(
            '--limit',
            type=int,
            default=None,
            help='Limit the number of invoices to import',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview import without saving to database',
        )
        parser.add_argument(
            '--skip-existing',
            action='store_true',
            help='Skip invoices that already exist (by invoice_number)',
        )

    def handle(self, *args, **options):
        limit = options.get('limit')
        dry_run = options.get('dry_run')
        skip_existing = options.get('skip_existing')

        if dry_run:
            self.stdout.write(self.style.WARNING('🔍 DRY RUN MODE - No data will be saved\n'))

        try:
            cursor = connections['mysql'].cursor()
            self.stdout.write('🔍 Connected to MySQL legacy database.')
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ MySQL connection failed: {e}'))
            return

        # Fetch invoices
        self.stdout.write('📥 Fetching records from `invoice` table...')
        query = "SELECT * FROM `invoice`"
        if limit:
            query += f" LIMIT {limit}"

        cursor.execute(query)
        rows = cursor.fetchall()
        columns = [col[0] for col in cursor.description]
        total = len(rows)

        self.stdout.write(self.style.SUCCESS(f'✅ Fetched {total} invoice records.\n'))

        stats = {'created': 0, 'updated': 0, 'skipped': 0, 'errors': 0}

        for index, row in enumerate(rows, start=1):
            data = dict(zip(columns, row))
            invoice_number = data.get('invoiceNo')

            try:
                if skip_existing and SalesInvoice.objects.filter(invoice_number=invoice_number).exists():
                    stats['skipped'] += 1
                    continue

                with transaction.atomic():
                    # Lookups
                    customer = None
                    if data.get('customerId'):
                        customer = Customer.objects.filter(legacy_id=data.get('customerId')).first()
                    
                    order = None
                    if data.get('orderId'):
                        order = SalesOrder.objects.filter(order_number=data.get('orderId')).first()
                        if not order:
                            order = SalesOrder.objects.filter(legacy_order_id=data.get('orderId')).first()

                    # Dates
                    inv_date = data.get('invoiceDate') or data.get('createdDate') or datetime.now()
                    due_date = data.get('invoiceDueDate') or inv_date

                    # Create or update invoice
                    invoice, created = SalesInvoice.objects.update_or_create(
                        invoice_number=invoice_number,
                        defaults={
                            'customer': customer,
                            'order': order,
                            'invoice_date': inv_date,
                            'due_date': due_date,
                            'status': LEGACY_STATUS_MAP.get(data.get('status'), 'draft'),
                            'po_so_number': data.get('poSoNo'),
                            'notes': data.get('notes'),
                            'customer_notes': data.get('publicNotes'),
                            'subtotal': safe_decimal(data.get('totalBeforeTax')),
                            'discount': safe_decimal(data.get('invoiceDiscount')),
                            'net_total': safe_decimal(data.get('invoiceTotal')),
                            'amount_paid': safe_decimal(data.get('amountPaid')),
                            'legacy_invoice_id': data.get('id'),
                            'prepared_by_legacy_id': data.get('createdBy'),
                            'created_date': data.get('createdDate') or timezone.now(),
                        }
                    )

                    if created:
                        stats['created'] += 1
                    else:
                        stats['updated'] += 1

                    # Import items
                    invoice.items.all().delete()
                    cursor.execute("SELECT * FROM `invoice_ext` WHERE `invoiceId` = %s", [data.get('id')])
                    item_rows = cursor.fetchall()
                    item_columns = [col[0] for col in cursor.description]

                    for i_row in item_rows:
                        i_data = dict(zip(item_columns, i_row))
                        SalesInvoiceItem.objects.create(
                            invoice=invoice,
                            item_name=i_data.get('item') or "Legacy Item",
                            description=i_data.get('description'),
                            quantity=safe_decimal(i_data.get('quantity'), 1),
                            unit_price=safe_decimal(i_data.get('unitPrice')),
                            amount=safe_decimal(i_data.get('quantity', 1)) * safe_decimal(i_data.get('unitPrice'))
                        )

                    if dry_run:
                        transaction.set_rollback(True)

                if index % 100 == 0:
                    self.stdout.write(f"Processed {index}/{total}...")

            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Error importing {invoice_number}: {e}"))
                stats['errors'] += 1

        self.stdout.write(self.style.SUCCESS(f"\nImport finished: {stats}"))
