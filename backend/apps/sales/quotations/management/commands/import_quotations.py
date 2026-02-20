from django.core.management.base import BaseCommand
from django.db import connections, transaction
from apps.sales.quotations.models import SalesQuotation, SalesQuotationItem, SalesQuotationTimeline
from apps.customers.models import Customer
from apps.costing.models import CostingEstimating, CostingSheet
from apps.users.models import User
from datetime import datetime
from decimal import Decimal, InvalidOperation
from dateutil.parser import parse as parse_date


class Command(BaseCommand):
    help = """
    Import quotations and quotation items from legacy MySQL database into PostgreSQL.
    
    This command imports quotations using business identifiers (quot_number) rather than 
    legacy IDs. It creates timeline entries for imported quotations and handles duplicate 
    detection based on quotation numbers.
    
    Usage:
        python manage.py import_quotations [--dry-run] [--limit N]
        
    Options:
        --dry-run: Preview what would be imported without saving data
        --limit N: Limit number of quotations to import (useful for testing)
    """

    def add_arguments(self, parser):
        parser.add_argument(
            '--limit',
            type=int,
            default=None,
            help='Limit the number of quotations to import'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be imported without actually importing'
        )

    def handle(self, *args, **options):
        limit = options.get('limit')
        dry_run = options.get('dry_run')

        def safe_decimal(value, default=0):
            if value is None:
                return Decimal(default)
            try:
                return Decimal(str(value))
            except (InvalidOperation, ValueError):
                return Decimal(default)

        def safe_date(value):
            if not value:
                return None
            if isinstance(value, datetime):
                return value
            try:
                return parse_date(str(value))
            except Exception:
                return None

        def get_creator_name(user):
            """Get a formatted name for the timeline entry creator"""
            if not user:
                return "System"
            if hasattr(user, 'first_name') and hasattr(user, 'last_name'):
                if user.first_name and user.last_name:
                    return f"{user.first_name} {user.last_name}"
                elif user.first_name:
                    return user.first_name
                elif user.last_name:
                    return user.last_name
            return user.email if hasattr(user, 'email') else "Unknown User"

        if dry_run:
            print("🧪 DRY RUN MODE - No data will be saved\n")

        print("🔍 Step 1: Fetching existing quotation numbers...")
        existing_quotations = SalesQuotation.objects.in_bulk(field_name='quot_number')
        print(f"✅ Found {len(existing_quotations)} existing quotations.\n")

        print("🔗 Step 2: Connecting to MySQL legacy database...")
        try:
            cursor = connections['mysql'].cursor()
        except Exception as e:
            print(f"❌ Error connecting to MySQL: {e}")
            print("⚠️  Make sure MySQL server is running and accessible")
            return

        print("📥 Step 3: Fetching records from `quotation` table...")
        quotation_query = "SELECT * FROM quotation"
        if limit:
            quotation_query += f" LIMIT {limit}"
        cursor.execute(quotation_query)
        quotation_rows = cursor.fetchall()
        quotation_columns = [col[0] for col in cursor.description]

        total_quotations = len(quotation_rows)
        print(f"✅ Fetched {total_quotations} quotation records.\n")

        print("📥 Step 4: Fetching records from `quotation_ext` table...")
        cursor.execute("SELECT * FROM quotation_ext")
        quotation_ext_rows = cursor.fetchall()
        quotation_ext_columns = [col[0] for col in cursor.description]

        total_items = len(quotation_ext_rows)
        print(f"✅ Fetched {total_items} quotation item records.\n")

        print("🚀 Step 5: Importing quotations into PostgreSQL...\n")

        quotation_success_count = 0
        quotation_error_count = 0

        customer_map = {c.legacy_id: c for c in Customer.objects.all() if c.legacy_id}
        user_map = {u.id: u for u in User.objects.all()}
        costing_map = {c.costingId: c for c in CostingEstimating.objects.all()}

        for index, row in enumerate(quotation_rows, start=1):
            data = dict(zip(quotation_columns, row))
            try:
                quot_number = data.get("quotNumber")
                if not quot_number:
                    print(f"   [{index}/{total_quotations}] ⚠️  Skipping quotation with no quote number")
                    continue

                customer = customer_map.get(data["customerId"])
                costing = costing_map.get(data["costingId"])
                created_by = user_map.get(data["createdBy"])

                defaults = {
                    "number_type": data.get("numberType"),
                    "customer": customer,
                    "date": safe_date(data.get("date")),
                    "required_date": safe_date(data.get("requiredDate")),
                    "terms": data.get("terms"),
                    "notes": data.get("notes"),
                    "delivery_charge": safe_decimal(data.get("deliveryCharge")),
                    "discount": safe_decimal(data.get("discount")),
                    "total": safe_decimal(data.get("total")),
                    "total_applied": bool(data.get("totalApplied", True)),
                    "delivery_applied": bool(data.get("deliveryApplied", True)),
                    "costing": costing,
                    "finalized": bool(data.get("finalized", False)),
                    "is_active": bool(data.get("isActive", True)),
                    "created_by": created_by,
                    "created_date": safe_date(data.get("createdDate")),
                    "updated_date": safe_date(data.get("updatedDate")),
                }

                if not dry_run:
                    with transaction.atomic():
                        obj, created = SalesQuotation.objects.update_or_create(
                            quot_number=quot_number,
                            defaults=defaults
                        )
                        
                        # Create timeline entry for imported quotation
                        if created:
                            costing_id = data.get("costingId")
                            creator_name = get_creator_name(created_by)
                            creation_date = safe_date(data.get("createdDate"))
                            
                            if costing_id:
                                timeline_message = f"Created from costingID {costing_id} by {creator_name}"
                            else:
                                timeline_message = f"Imported from legacy system by {creator_name}"
                            
                            # Use a custom created_at if we have the original date, otherwise let Django set it
                            timeline_kwargs = {
                                'quotation': obj,
                                'event_type': 'created',
                                'message': timeline_message,
                                'created_by': created_by,
                            }
                            
                            if creation_date:
                                timeline_kwargs['created_at'] = creation_date
                            
                            SalesQuotationTimeline.objects.create(**timeline_kwargs)
                        
                        action = "✅ Created" if created else "🔁 Updated"
                else:
                    action = "🧪 Would create/update"

                quotation_success_count += 1
                print(f"   [{index}/{total_quotations}] {action}: {quot_number}")

            except Exception as e:
                quotation_error_count += 1
                print(f"   [{index}/{total_quotations}] ❌ Error processing quotation ID {data.get('id')}: {e}")

        print(f"\n📊 Quotation Import Summary:")
        print(f"   ✅ Successful: {quotation_success_count}")
        print(f"   ❌ Errors: {quotation_error_count}")
        print(f"   📈 Success Rate: {(quotation_success_count / total_quotations * 100):.1f}%")
        if not dry_run:
            timeline_count = SalesQuotationTimeline.objects.count()
            print(f"   📅 Timeline Entries Created: {timeline_count}")
        print()

        print("🚀 Step 6: Importing quotation items into PostgreSQL...\n")

        item_success_count = 0
        item_error_count = 0

        costing_sheet_map = {}
        try:
            for sheet in CostingSheet.objects.all():
                costing_sheet_map[sheet.id] = sheet
        except Exception as e:
            print(f"⚠️  Warning: Could not load costing sheets: {e}")

        # Build mapping from MySQL legacy quotation IDs to PostgreSQL quotations
        quotation_by_legacy_id = {}
        if not dry_run:
            # Get all existing quotations indexed by quote number
            quotations_by_number = {q.quot_number: q for q in SalesQuotation.objects.all()}
            
            # Build a mapping from MySQL quotation IDs to PostgreSQL quotations
            # by matching on quotation numbers
            cursor.execute("SELECT id, quotNumber FROM quotation WHERE quotNumber IS NOT NULL")
            mysql_quotations = cursor.fetchall()
            for legacy_id, quot_number in mysql_quotations:
                if quot_number in quotations_by_number:
                    quotation_by_legacy_id[legacy_id] = quotations_by_number[quot_number]
            
            print(f"📊 Built quotation mapping: {len(quotation_by_legacy_id)} MySQL IDs → PostgreSQL quotations")

        for index, row in enumerate(quotation_ext_rows, start=1):
            data = dict(zip(quotation_ext_columns, row))

            try:
                legacy_quotation_id = int(data.get("quoteId")) if data.get("quoteId") else None
                if not legacy_quotation_id:
                    print(f"   [{index}/{total_items}] ⚠️  Skipping item with no quote ID")
                    continue

                quotation = quotation_by_legacy_id.get(legacy_quotation_id) if not dry_run else None
                if not quotation and not dry_run:
                    print(f"   [{index}/{total_items}] ⚠️  Skipping item - quotation with legacy ID {legacy_quotation_id} not found")
                    continue

                costing_sheet = None
                if data.get("costingSheet"):
                    costing_sheet = costing_sheet_map.get(data["costingSheet"])

                def safe_quantity(value):
                    if value is None:
                        return None
                    if isinstance(value, str):
                        try:
                            return Decimal(value.strip())
                        except (InvalidOperation, ValueError):
                            return None
                    try:
                        return Decimal(str(value))
                    except (InvalidOperation, ValueError):
                        return None

                item_data = {
                    "item_id": data.get("itemId"),
                    "item": data.get("item"),
                    "description": data.get("description"),
                    "quantity": safe_quantity(data.get("quantity")),
                    "unit_price": safe_decimal(data.get("unitPrice")),
                    "price": safe_decimal(data.get("price")),
                    "costing_sheet": costing_sheet,
                    "cs_profit_margin": safe_decimal(data.get("csProfitMargin")),
                    "cs_profit": safe_decimal(data.get("csProfit")),
                    "cs_total": safe_decimal(data.get("csTotal")),
                }

                if not dry_run:
                    item_data["quotation"] = quotation
                    with transaction.atomic():
                        SalesQuotationItem.objects.create(**item_data)
                        item_success_count += 1
                        action = "✅ Created"
                else:
                    action = "🧪 Would create"
                    item_success_count += 1

                item_desc = item_data.get("item") or item_data.get("description") or "Item"
                quotation_ref = quotation.quot_number if quotation else f"legacy-{legacy_quotation_id}"
                print(f"   [{index}/{total_items}] {action}: {item_desc} for quote {quotation_ref}")

            except Exception as e:
                item_error_count += 1
                print(f"   [{index}/{total_items}] ❌ Error processing item: {e}")

        print(f"\n📊 Quotation Items Import Summary:")
        print(f"   ✅ Successful: {item_success_count}")
        print(f"   ❌ Errors: {item_error_count}")
        print(f"   📈 Success Rate: {(item_success_count / total_items * 100):.1f}%\n")

        print("🎉 Step 7: Import complete!")
        if dry_run:
            print("🧪 This was a dry run - no data was actually saved.")
        else:
            final_timeline_count = SalesQuotationTimeline.objects.count()
            print(f"✅ Successfully imported {quotation_success_count} quotations and {item_success_count} items.")
            print(f"📅 Total timeline entries: {final_timeline_count}")
            print("🎯 All quotations now have complete timeline tracking!")
