from django.core.management.base import BaseCommand
from django.db import connections
from django.utils.dateparse import parse_datetime
from django.utils.timezone import make_aware
import datetime

from apps.users.models import User
from apps.employees.models import Employee


class Command(BaseCommand):
    help = "Import users and employees from legacy MySQL `user` table"

    def handle(self, *args, **kwargs):
        print("🧹 Deleting existing employee records...")
        Employee.objects.all().delete()

        print("🔗 Connecting to MySQL (pressmanager_db)...")
        cursor = connections['mysql_legacy'].cursor()

        print("📥 Fetching records from `user` table...")
        cursor.execute("SELECT * FROM user")
        rows = cursor.fetchall()
        col_names = [desc[0] for desc in cursor.description]
        print(f"✅ Found {len(rows)} user records.\n")

        created_count = 0
        skipped = 0

        for idx, row in enumerate(rows, start=1):
            row_data = dict(zip(col_names, row))
            email = row_data.get("email")
            first_name = row_data.get("firstName") or ""
            last_name = row_data.get("lastName") or ""
            username = row_data.get("username") or ""
            is_active = bool(row_data.get("isActive"))
            legacy_id = row_data.get("id")

            if not email:
                print(f"⚠️ Skipping row {legacy_id} (no email)")
                skipped += 1
                continue

            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    "password": "changeme123",
                    "username": username,
                    "is_active": is_active,
                    "role": "production",
                    "theme": "dark",
                }
            )

            if not created:
                print(f"⚠️ User with email {email} already exists — using existing record.")

            # Default to Jan 1, 2000 for required non-null field
            date_of_joining = make_aware(datetime.datetime(2000, 1, 1))

            employee = Employee.objects.create(
                user=user,
                full_name=f"{first_name} {last_name}".strip() or username or email,
                address="",
                phone=row_data.get("contact") or "",
                emergency_contact="",
                nic="NIC-" + str(legacy_id),
                department="Unknown",
                designation=row_data.get("jobTitle") or "Unknown",
                date_of_joining=date_of_joining,
                date_of_birth="2000-01-01",  # Placeholder
                bank_account_no="",
                bank_name="",
                legacy_id=legacy_id,
            )

            print(f"✅ [{idx}] Imported: {employee.full_name} ({email}) → legacy_id: {legacy_id}")
            created_count += 1

        print(f"\n🎉 DONE! Imported {created_count} employees. Skipped {skipped} rows.")
