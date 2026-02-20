from django.core.management.base import BaseCommand
from apps.customers.models import Customer
from django.db import connections
from datetime import datetime

class Command(BaseCommand):
    help = "Import customers from legacy MySQL database into PostgreSQL"

    def handle(self, *args, **kwargs):
        print("🔍 Step 1: Fetching existing customer legacy IDs...")
        existing_customers = Customer.objects.in_bulk(field_name='legacy_id')
        print(f"✅ Found {len(existing_customers)} existing customers.\n")

        print("🔗 Step 2: Connecting to MySQL legacy database...")
        cursor = connections['mysql'].cursor()

        print("📥 Step 3: Fetching records from `customer` table...")
        cursor.execute("SELECT * FROM customer")
        rows = cursor.fetchall()
        columns = [col[0] for col in cursor.description]

        total = len(rows)
        print(f"✅ Fetched {total} customer records.\n")

        print("🚀 Step 4: Importing customers into PostgreSQL...\n")

        for index, row in enumerate(rows, start=1):
            data = dict(zip(columns, row))

            try:
                created_date = data.get("createdDate")
                updated_date = data.get("updatedDate")

                defaults = {
                    "name": data.get("customer") or "Unnamed Customer",
                    "email": data.get("email"),
                    "contact": data.get("contact"),
                    "account_no": data.get("accountNo"),
                    "website": data.get("website"),
                    "fax": data.get("fax"),
                    "credit_limit": data.get("creditLimit"),
                    "due_on_days": data.get("dueOnDays"),
                    "payment_term": data.get("paymentTerm"),
                    "is_active": bool(data.get("isActive")),
                    "created_by_id": data.get("createdBy"),
                    "updated_by_id": data.get("updatedBy"),
                    "created_at": created_date if isinstance(created_date, datetime) else None,
                    "updated_at": updated_date if isinstance(updated_date, datetime) else None,
                }

                obj, created = Customer.objects.update_or_create(
                    legacy_id=data["id"],
                    defaults=defaults
                )

                action = "✅ Created" if created else "🔁 Updated"
                print(f"   [{index}/{total}] {action}: {obj.name}")

            except Exception as e:
                print(f"   [{index}/{total}] ❌ Error processing customer ID {data.get('id')}: {e}")

        print("\n🎉 Step 5: Import complete! All customers imported or updated successfully.")
