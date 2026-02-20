from django.core.management.base import BaseCommand
from apps.sales.orders.models import SalesOrder, SalesOrderItem, SalesOrderTimeline, OrderAttachment
from apps.customers.models import Customer
from apps.costing.models import CostingEstimating, CostingSheet
from django.contrib.auth import get_user_model
from django.db import connections, transaction
from datetime import datetime
from decimal import Decimal
import os

User = get_user_model()

# Legacy status code mapping
LEGACY_STATUS_MAP = {
    0: 'draft',
    1: 'confirmed',
    2: 'production',
    3: 'ready',
    4: 'delivered',
    5: 'invoiced',
    6: 'completed',
    9: 'cancelled',
}


class Command(BaseCommand):
    help = "Import orders from legacy MySQL database into PostgreSQL"

    def add_arguments(self, parser):
        parser.add_argument(
            '--limit',
            type=int,
            default=None,
            help='Limit the number of orders to import',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview import without saving to database',
        )
        parser.add_argument(
            '--import-attachments',
            action='store_true',
            help='Import attachment files from legacy system',
        )
        parser.add_argument(
            '--skip-existing',
            action='store_true',
            help='Skip orders that already exist (by order_number)',
        )

    def handle(self, *args, **options):
        limit = options.get('limit')
        dry_run = options.get('dry_run')
        import_attachments = options.get('import_attachments')
        skip_existing = options.get('skip_existing')

        if dry_run:
            self.stdout.write(self.style.WARNING('🔍 DRY RUN MODE - No data will be saved\n'))

        # Check if MySQL legacy database is available
        try:
            from django.db import connections
            self.stdout.write('🔍 Step 1: Connecting to MySQL legacy database...')
            cursor = connections['mysql'].cursor()
        except Exception as e:
            self.stdout.write(self.style.ERROR(
                '\n❌ MySQL legacy database connection not available.\n'
                'Please enable it by setting ENABLE_MYSQL_LEGACY=True in your environment.\n'
                f'Error: {e}\n'
            ))
            return

        # Fetch orders from legacy database
        self.stdout.write('📥 Step 2: Fetching orders from `order` table...')
        order_query = "SELECT * FROM `order`"
        if limit:
            order_query += f" LIMIT {limit}"

        cursor.execute(order_query)
        order_rows = cursor.fetchall()
        order_columns = [col[0] for col in cursor.description]

        total_orders = len(order_rows)
        self.stdout.write(self.style.SUCCESS(f'✅ Fetched {total_orders} order records.\n'))

        # Statistics
        stats = {
            'created': 0,
            'updated': 0,
            'skipped': 0,
            'errors': 0,
        }

        self.stdout.write('🚀 Step 3: Importing orders...\n')

        for index, row in enumerate(order_rows, start=1):
            data = dict(zip(order_columns, row))

            try:
                order_number = data.get('orderId')

                # Check if order exists
                if skip_existing and SalesOrder.objects.filter(order_number=order_number).exists():
                    self.stdout.write(f'   [{index}/{total_orders}] ⏭️  Skipped: {order_number} (already exists)')
                    stats['skipped'] += 1
                    continue

                # Get customer
                customer = None
                customer_legacy_id = data.get('customerId')
                if customer_legacy_id:
                    try:
                        customer = Customer.objects.get(legacy_id=customer_legacy_id)
                    except Customer.DoesNotExist:
                        self.stdout.write(self.style.WARNING(
                            f'   ⚠️  Customer with legacy_id {customer_legacy_id} not found for order {order_number}'
                        ))

                # Get created/updated/prepared by users
                created_by = None
                updated_by = None
                prepared_by_user = None
                prepared_by_legacy_id = None
                created_by_id = data.get('createdBy')
                updated_by_id = data.get('updatedBy')
                prepared_by_id = data.get('preparedBy')

                # Store the legacy prepared_by ID for correct mapping in serializers
                if prepared_by_id:
                    prepared_by_legacy_id = prepared_by_id
                    # Try to map to new User via Employee.legacy_id
                    try:
                        from apps.employees.models import Employee
                        employee = Employee.objects.filter(legacy_id=prepared_by_id).first()
                        if employee and employee.user:
                            prepared_by_user = employee.user
                    except Exception:
                        pass

                if created_by_id:
                    try:
                        from apps.employees.models import Employee
                        employee = Employee.objects.filter(legacy_id=created_by_id).first()
                        if employee and employee.user:
                            created_by = employee.user
                    except Exception:
                        pass

                if updated_by_id:
                    try:
                        from apps.employees.models import Employee
                        employee = Employee.objects.filter(legacy_id=updated_by_id).first()
                        if employee and employee.user:
                            updated_by = employee.user
                    except Exception:
                        pass

                # Get costing if available
                costing = None
                costing_id = data.get('costingId')
                if costing_id:
                    try:
                        costing = CostingEstimating.objects.get(id=costing_id)
                    except CostingEstimating.DoesNotExist:
                        pass

                # Map status
                legacy_status = data.get('status', 0)
                status = LEGACY_STATUS_MAP.get(legacy_status, 'draft')

                # Parse dates
                order_date = data.get('orderDate')
                required_date = data.get('requiredDate')
                created_date = data.get('createdDate')
                updated_date = data.get('updatedDate')

                # Fallback for missing order_date (use created_date or current date)
                if not order_date or not isinstance(order_date, datetime):
                    if created_date and isinstance(created_date, datetime):
                        order_date = created_date
                    else:
                        order_date = datetime.now()

                # Helper function to safely convert to Decimal
                def safe_decimal(value, default=0):
                    if value is None or value == '':
                        return Decimal(str(default))
                    try:
                        return Decimal(str(value))
                    except (ValueError, TypeError, Exception):
                        return Decimal(str(default))

                # Prepare order data
                order_defaults = {
                    'number_type': data.get('numberType', 1),
                    'customer': customer,
                    'quotation': None,  # Will be linked manually if needed
                    'order_date': order_date if isinstance(order_date, datetime) else None,
                    'required_date': required_date if isinstance(required_date, datetime) else None,
                    'status': status,
                    'po_so_number': data.get('poSoNo'),
                    'notes': data.get('notes'),
                    'subtotal': safe_decimal(data.get('subTotal')),
                    'discount': safe_decimal(data.get('discount')),
                    'delivery_charge': safe_decimal(data.get('deliveryCharge')),
                    'net_total': safe_decimal(data.get('netTotal')),
                    'costing': costing,
                    'prepared_by': prepared_by_user,
                    'prepared_by_legacy_id': prepared_by_legacy_id,  # Store legacy ID for correct name mapping
                    'prepared_from': data.get('preparedFrom'),
                    'prepared_reff': data.get('preparedReff'),
                    'is_active': bool(data.get('isActive', True)),
                    'created_by': created_by,
                    'created_date': created_date if isinstance(created_date, datetime) else None,
                    'updated_by': updated_by,
                    'updated_date': updated_date if isinstance(updated_date, datetime) else None,
                }

                if not dry_run:
                    # Create or update order
                    with transaction.atomic():
                        order, created = SalesOrder.objects.update_or_create(
                            legacy_order_id=data['id'],
                            defaults={**order_defaults, 'order_number': order_number}
                        )

                        # Import order items from order_ext table
                        items_cursor = connections['mysql'].cursor()
                        items_cursor.execute(
                            "SELECT * FROM order_ext WHERE orderId = %s",
                            [data['id']]
                        )
                        item_rows = items_cursor.fetchall()
                        item_columns = [col[0] for col in items_cursor.description]

                        # Clear existing items if updating
                        if not created:
                            order.items.all().delete()

                        # Create items
                        for item_row in item_rows:
                            item_data = dict(zip(item_columns, item_row))

                            # Get costing sheet if available
                            costing_sheet = None
                            costing_sheet_id = item_data.get('costingSheet')
                            if costing_sheet_id:
                                try:
                                    costing_sheet = CostingSheet.objects.get(id=costing_sheet_id)
                                except CostingSheet.DoesNotExist:
                                    pass

                            # Build description from item and service
                            description_parts = []
                            if item_data.get('service'):
                                description_parts.append(item_data.get('service'))
                            description = '\n'.join(description_parts) if description_parts else None

                            SalesOrderItem.objects.create(
                                order=order,
                                item_name=item_data.get('item') or 'Item',
                                description=description,
                                quantity=safe_decimal(item_data.get('quantity')),
                                unit_price=safe_decimal(item_data.get('unitPrice')),
                                amount=safe_decimal(item_data.get('amount')),
                                costing_sheet=costing_sheet,
                                cs_profit_margin=safe_decimal(item_data.get('cSProfitMargin')) if item_data.get('cSProfitMargin') else None,
                                cs_profit=safe_decimal(item_data.get('cSProfit')) if item_data.get('cSProfit') else None,
                                cs_total=safe_decimal(item_data.get('cSTotal')) if item_data.get('cSTotal') else None,
                                job_ticket_generated=bool(item_data.get('jobCard', False)),
                            )

                        # Create initial timeline entry
                        if created:
                            SalesOrderTimeline.objects.create(
                                order=order,
                                event_type='created',
                                message=f'Order imported from legacy system',
                                created_by=created_by,
                                created_at=created_date if isinstance(created_date, datetime) else datetime.now(),
                            )

                        # Import attachments if requested
                        if import_attachments:
                            attachments_cursor = connections['mysql'].cursor()
                            try:
                                attachments_cursor.execute(
                                    "SELECT * FROM order_attachments WHERE order_id = %s",
                                    [data['id']]
                                )
                                attachment_rows = attachments_cursor.fetchall()
                                attachment_columns = [col[0] for col in attachments_cursor.description]

                                for attach_row in attachment_rows:
                                    attach_data = dict(zip(attachment_columns, attach_row))

                                    # TODO: Copy file from legacy path to S3
                                    # For now, just store the reference
                                    file_path = attach_data.get('path')

                                    if file_path and os.path.exists(file_path):
                                        # File copying logic would go here
                                        pass
                            except Exception as e:
                                self.stdout.write(self.style.WARNING(
                                    f'   ⚠️  Error importing attachments for order {order_number}: {e}'
                                ))

                    action = "✅ Created" if created else "🔁 Updated"
                    stats['created' if created else 'updated'] += 1
                else:
                    action = "👁️  Would create/update"
                    stats['created'] += 1

                self.stdout.write(f'   [{index}/{total_orders}] {action}: {order_number}')

            except Exception as e:
                self.stdout.write(self.style.ERROR(
                    f'   [{index}/{total_orders}] ❌ Error processing order ID {data.get("id")}: {e}'
                ))
                stats['errors'] += 1

        # Print summary
        self.stdout.write('\n' + '='*60)
        self.stdout.write(self.style.SUCCESS('🎉 Import Complete!\n'))
        self.stdout.write(f'📊 Summary:')
        self.stdout.write(f'   ✅ Created: {stats["created"]}')
        self.stdout.write(f'   🔁 Updated: {stats["updated"]}')
        self.stdout.write(f'   ⏭️  Skipped: {stats["skipped"]}')
        self.stdout.write(f'   ❌ Errors: {stats["errors"]}')
        self.stdout.write('='*60 + '\n')

        if dry_run:
            self.stdout.write(self.style.WARNING('🔍 DRY RUN MODE - No data was saved'))
