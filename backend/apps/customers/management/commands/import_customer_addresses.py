from django.core.management.base import BaseCommand
from apps.customers.models import Customer, CustomerAddress
from django.db import connections
from datetime import datetime
import traceback

class Command(BaseCommand):
    help = "Import customer addresses from legacy MySQL database into PostgreSQL"

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be imported without actually doing it',
        )
        parser.add_argument(
            '--customer-id',
            type=int,
            help='Import addresses for a specific customer legacy ID only',
        )

    def handle(self, *args, **kwargs):
        dry_run = kwargs.get('dry_run', False)
        customer_id_filter = kwargs.get('customer_id')
        
        if dry_run:
            self.stdout.write(self.style.WARNING('🧪 DRY RUN MODE - No changes will be made\n'))
        
        try:
            print("🔍 Step 1: Checking existing customer addresses...")
            existing_addresses_count = CustomerAddress.objects.count()
            print(f"✅ Found {existing_addresses_count} existing addresses in PostgreSQL.\n")

            print("🔗 Step 2: Connecting to MySQL legacy database...")
            cursor = connections['mysql'].cursor()

            # First, let's check what address-related tables exist
            print("📋 Step 2.1: Checking for address tables...")
            cursor.execute("SHOW TABLES LIKE '%address%'")
            address_tables = cursor.fetchall()
            if address_tables:
                for table in address_tables:
                    print(f"   Found address table: {table[0]}")
            else:
                print("   No dedicated address tables found. Checking customer table for address fields...")
            
            # Check customer table structure for address fields
            cursor.execute("DESCRIBE customer")
            customer_columns = cursor.fetchall()
            address_fields = [col[0] for col in customer_columns if 'address' in col[0].lower() or 'city' in col[0].lower() or 'zip' in col[0].lower() or 'phone' in col[0].lower()]
            
            if address_fields:
                print(f"   Found address fields in customer table: {', '.join(address_fields)}")
                return self.import_from_customer_table(cursor, dry_run, customer_id_filter, address_fields)
            
            # Check for separate address table
            cursor.execute("SHOW TABLES")
            all_tables = [table[0] for table in cursor.fetchall()]
            
            # Common address table names to check
            possible_address_tables = [
                'customer_address', 'customer_addresses', 'addresses', 
                'billing_address', 'shipping_address', 'customeraddress'
            ]
            
            found_table = None
            for table_name in possible_address_tables:
                if table_name in all_tables:
                    found_table = table_name
                    break
            
            if found_table:
                print(f"   Found address table: {found_table}")
                return self.import_from_address_table(cursor, dry_run, customer_id_filter, found_table)
            else:
                print("❌ No address data found in legacy database.")
                print("   Please check the legacy database structure manually.")
                return

        except Exception as e:
            print(f"❌ Error connecting to legacy database: {e}")
            print("   Make sure the MySQL legacy database is running and accessible.")
            return

    def import_from_customer_table(self, cursor, dry_run, customer_id_filter, address_fields):
        """Import addresses from customer table fields"""
        print(f"\n📥 Step 3: Importing addresses from customer table fields...")
        
        # Build the query
        where_clause = ""
        if customer_id_filter:
            where_clause = f" WHERE id = {customer_id_filter}"
        
        cursor.execute(f"SELECT id, customer, {', '.join(address_fields)} FROM customer{where_clause}")
        rows = cursor.fetchall()
        columns = ['id', 'customer'] + address_fields
        
        total = len(rows)
        print(f"✅ Fetched {total} customer records.\n")

        if dry_run:
            print("🚀 Step 4: DRY RUN - Would import the following addresses:\n")
        else:
            print("🚀 Step 4: Importing addresses into PostgreSQL...\n")

        imported_count = 0
        skipped_count = 0
        error_count = 0

        for index, row in enumerate(rows, start=1):
            data = dict(zip(columns, row))
            
            try:
                # Try to find the customer in our PostgreSQL database
                try:
                    customer = Customer.objects.get(legacy_id=data['id'])
                except Customer.DoesNotExist:
                    print(f"   [{index}/{total}] ⚠️  Customer with legacy_id {data['id']} not found. Skipping.")
                    skipped_count += 1
                    continue
                
                # Extract address information from various possible field names
                address_info = self.extract_address_info(data, address_fields)
                
                if not address_info.get('line1'):
                    print(f"   [{index}/{total}] ⚠️  No address data for {customer.name}. Skipping.")
                    skipped_count += 1
                    continue
                
                if dry_run:
                    print(f"   [{index}/{total}] Would create address for {customer.name}:")
                    print(f"      Line 1: {address_info.get('line1', 'N/A')}")
                    print(f"      City: {address_info.get('city', 'N/A')}")
                    print(f"      Phone: {address_info.get('phone', 'N/A')}")
                else:
                    # Check if address already exists
                    existing_address = CustomerAddress.objects.filter(
                        customer=customer,
                        line1=address_info['line1']
                    ).first()
                    
                    if existing_address:
                        print(f"   [{index}/{total}] 🔁 Address already exists for {customer.name}")
                    else:
                        # Create the address
                        CustomerAddress.objects.create(
                            customer=customer,
                            type='billing',  # Default to billing address
                            line1=address_info['line1'],
                            line2=address_info.get('line2', ''),
                            city=address_info.get('city', ''),
                            zip_code=address_info.get('zip_code', ''),
                            province=address_info.get('province', ''),
                            country=address_info.get('country', 'Sri Lanka'),
                            phone=address_info.get('phone', ''),
                        )
                        print(f"   [{index}/{total}] ✅ Created address for {customer.name}")
                        imported_count += 1

            except Exception as e:
                print(f"   [{index}/{total}] ❌ Error processing customer ID {data.get('id')}: {e}")
                error_count += 1

        # Summary
        print(f"\n🎉 Step 5: Import complete!")
        if dry_run:
            print(f"   📊 Would import: {total - skipped_count - error_count} addresses")
        else:
            print(f"   📊 Imported: {imported_count} addresses")
        print(f"   ⚠️  Skipped: {skipped_count} records")
        print(f"   ❌ Errors: {error_count} records")

    def import_from_address_table(self, cursor, dry_run, customer_id_filter, table_name):
        """Import addresses from dedicated address table"""
        print(f"\n📥 Step 3: Importing addresses from {table_name} table...")
        
        # Get table structure
        cursor.execute(f"DESCRIBE {table_name}")
        columns_info = cursor.fetchall()
        columns = [col[0] for col in columns_info]
        print(f"   Table columns: {', '.join(columns)}")
        
        # Build the query
        where_clause = ""
        if customer_id_filter:
            # Try to find customer ID field
            customer_id_field = None
            for col in columns:
                if 'customer' in col.lower() and 'id' in col.lower():
                    customer_id_field = col
                    break
            
            if customer_id_field:
                where_clause = f" WHERE {customer_id_field} = {customer_id_filter}"
        
        cursor.execute(f"SELECT * FROM {table_name}{where_clause}")
        rows = cursor.fetchall()
        
        total = len(rows)
        print(f"✅ Fetched {total} address records.\n")

        if dry_run:
            print("🚀 Step 4: DRY RUN - Would import the following addresses:\n")
            # Show first few records for preview
            for i, row in enumerate(rows[:5], start=1):
                data = dict(zip(columns, row))
                print(f"   [{i}] Sample record: {data}")
            if total > 5:
                print(f"   ... and {total-5} more records")
        else:
            print("🚀 Step 4: Importing addresses into PostgreSQL...\n")
            print("   This would require mapping the table columns to our address model.")
            print("   Please implement the specific mapping logic for your address table structure.")
        
        return

    def extract_address_info(self, data, address_fields):
        """Extract address information from customer data fields"""
        address_info = {}
        
        # Common field mappings
        field_mappings = {
            'line1': ['address', 'address1', 'address_line1', 'street', 'street_address'],
            'line2': ['address2', 'address_line2', 'street2'],
            'city': ['city', 'town', 'locality'],
            'zip_code': ['zip', 'zipcode', 'zip_code', 'postal_code', 'postcode'],
            'province': ['province', 'state', 'region'],
            'country': ['country'],
            'phone': ['phone', 'telephone', 'contact', 'mobile'],
        }
        
        for target_field, possible_fields in field_mappings.items():
            for field in possible_fields:
                if field in address_fields and data.get(field):
                    address_info[target_field] = str(data[field]).strip()
                    break
        
        return address_info