from django.core.management.base import BaseCommand
from apps.customers.models import Customer, CustomerAddress
import re
import os

class Command(BaseCommand):
    help = "Import customer addresses from SQL dump file"

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
        parser.add_argument(
            '--file-path',
            type=str,
            default='backend/data/pressmanager_db.sql',
            help='Path to the SQL dump file (default: backend/data/pressmanager_db.sql)',
        )

    def handle(self, *args, **kwargs):
        dry_run = kwargs.get('dry_run', False)
        customer_id_filter = kwargs.get('customer_id')
        file_path = kwargs.get('file_path')
        
        # Make file path absolute
        if not os.path.isabs(file_path):
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
            file_path = os.path.join(base_dir, file_path)
        
        if not os.path.exists(file_path):
            self.stdout.write(self.style.ERROR(f'❌ SQL dump file not found: {file_path}'))
            return
        
        if dry_run:
            self.stdout.write(self.style.WARNING('🧪 DRY RUN MODE - No changes will be made\n'))
        
        self.stdout.write(f'📄 Reading SQL dump from: {file_path}')
        
        try:
            # Parse customer data from SQL dump
            customer_data = self.parse_customer_data(file_path, customer_id_filter)
            
            if not customer_data:
                self.stdout.write('⚠️  No customer data found in SQL dump')
                return
            
            self.stdout.write(f'✅ Found {len(customer_data)} customers with address data\n')
            
            # Import addresses
            self.import_addresses(customer_data, dry_run)
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Error processing SQL dump: {e}'))
            return

    def parse_customer_data(self, file_path, customer_id_filter=None):
        """Parse customer data from SQL dump file"""
        customer_data = []
        
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as file:
            content = file.read()
        
        # Find all customer table INSERT statements
        pattern = r"INSERT INTO `customer`.*?VALUES\s*(.*?);"
        matches = re.findall(pattern, content, re.DOTALL)
        
        if not matches:
            self.stdout.write('❌ Could not find customer INSERT statements in SQL dump')
            return []
        
        self.stdout.write(f'✅ Found {len(matches)} customer INSERT statements')
        
        # Process all INSERT statements
        for i, values_section in enumerate(matches):
            self.stdout.write(f'📋 Processing INSERT statement {i+1}/{len(matches)}...')
            
            # Parse individual customer records
            # This regex matches each customer record in the VALUES clause
            record_pattern = r'\(([^)]+(?:\([^)]*\)[^)]*)*)\)'
            records = re.findall(record_pattern, values_section)
            
            self.parse_records(records, customer_data, customer_id_filter)
        
        return customer_data

    def parse_records(self, records, customer_data, customer_id_filter):
        """Parse individual customer records from VALUES section"""
        for record in records:
            try:
                # Split the record by commas, but handle quoted strings properly
                fields = self.parse_sql_values(record)
                
                if len(fields) < 36:  # Expected number of fields in customer table
                    continue
                
                customer_id = int(fields[0]) if fields[0] != 'NULL' else None
                if not customer_id:
                    continue
                
                # Filter by customer ID if specified
                if customer_id_filter and customer_id != customer_id_filter:
                    continue
                
                # Extract address fields
                customer_record = {
                    'id': customer_id,
                    'customer': self.clean_sql_value(fields[1]),
                    'email': self.clean_sql_value(fields[2]),
                    'contact': self.clean_sql_value(fields[3]),
                    'addressLine1': self.clean_sql_value(fields[8]),
                    'addressLine2': self.clean_sql_value(fields[9]),
                    'city': self.clean_sql_value(fields[10]),
                    'zipCode': self.clean_sql_value(fields[11]),
                    'province': self.clean_sql_value(fields[13]),
                    'shipAddress1': self.clean_sql_value(fields[19]),
                    'shipAddress2': self.clean_sql_value(fields[20]),
                    'shipCity': self.clean_sql_value(fields[21]),
                    'shipZip': self.clean_sql_value(fields[22]),
                    'shipProvince': self.clean_sql_value(fields[24]),
                    'shipPhone': self.clean_sql_value(fields[25]),
                    'shipDeliverIns': self.clean_sql_value(fields[26]),
                }
                
                # Only include customers with some address data
                if (customer_record['addressLine1'] or customer_record['city'] or 
                    customer_record['shipAddress1'] or customer_record['shipCity']):
                    customer_data.append(customer_record)
                
            except Exception as e:
                self.stdout.write(f'⚠️  Error parsing customer record: {e}')
                continue
        
        return customer_data

    def parse_sql_values(self, record_string):
        """Parse SQL VALUES string into individual fields"""
        fields = []
        current_field = ''
        in_quotes = False
        quote_char = None
        i = 0
        
        while i < len(record_string):
            char = record_string[i]
            
            if not in_quotes:
                if char in ("'", '"'):
                    in_quotes = True
                    quote_char = char
                    current_field += char
                elif char == ',':
                    fields.append(current_field.strip())
                    current_field = ''
                else:
                    current_field += char
            else:
                current_field += char
                if char == quote_char:
                    # Check if it's an escaped quote
                    if i + 1 < len(record_string) and record_string[i + 1] == quote_char:
                        current_field += record_string[i + 1]
                        i += 1
                    else:
                        in_quotes = False
                        quote_char = None
            
            i += 1
        
        # Add the last field
        if current_field:
            fields.append(current_field.strip())
        
        return fields

    def clean_sql_value(self, value):
        """Clean SQL value (remove quotes, handle NULL)"""
        if not value or value.strip().upper() == 'NULL':
            return None
        
        value = value.strip()
        if value.startswith("'") and value.endswith("'"):
            value = value[1:-1]
        elif value.startswith('"') and value.endswith('"'):
            value = value[1:-1]
        
        # Unescape quotes
        value = value.replace("''", "'").replace('""', '"')
        
        return value.strip() if value else None

    def import_addresses(self, customer_data, dry_run):
        """Import addresses into Django models"""
        imported_count = 0
        skipped_count = 0
        error_count = 0
        
        for i, data in enumerate(customer_data, 1):
            try:
                # Find the customer in our PostgreSQL database
                try:
                    customer = Customer.objects.get(legacy_id=data['id'])
                except Customer.DoesNotExist:
                    self.stdout.write(f'   [{i}/{len(customer_data)}] ⚠️  Customer with legacy_id {data["id"]} not found. Skipping.')
                    skipped_count += 1
                    continue
                
                addresses_created = 0
                
                # Create billing address if data exists
                if data['addressLine1'] or data['city']:
                    billing_data = {
                        'type': 'billing',
                        'line1': data['addressLine1'] or '',
                        'line2': data['addressLine2'] or '',
                        'city': data['city'] or '',
                        'zip_code': data['zipCode'] or '',
                        'province': data['province'] or '',
                        'country': 'Sri Lanka',
                        'phone': data['contact'] or '',
                    }
                    
                    if dry_run:
                        self.stdout.write(f'   [{i}/{len(customer_data)}] Would create billing address for {customer.name}:')
                        self.stdout.write(f'      {billing_data["line1"]}, {billing_data["city"]}')
                    else:
                        # Check if billing address already exists
                        existing = CustomerAddress.objects.filter(
                            customer=customer,
                            type='billing'
                        ).first()
                        
                        if not existing:
                            CustomerAddress.objects.create(customer=customer, **billing_data)
                            addresses_created += 1
                            self.stdout.write(f'   [{i}/{len(customer_data)}] ✅ Created billing address for {customer.name}')
                        else:
                            self.stdout.write(f'   [{i}/{len(customer_data)}] 🔁 Billing address already exists for {customer.name}')
                
                # Create shipping address if different from billing
                if (data['shipAddress1'] or data['shipCity']) and data['shipAddress1'] != data['addressLine1']:
                    shipping_data = {
                        'type': 'shipping',
                        'line1': data['shipAddress1'] or '',
                        'line2': data['shipAddress2'] or '',
                        'city': data['shipCity'] or '',
                        'zip_code': data['shipZip'] or '',
                        'province': data['shipProvince'] or '',
                        'country': 'Sri Lanka',
                        'phone': data['shipPhone'] or '',
                        'delivery_instructions': data['shipDeliverIns'] or '',
                    }
                    
                    if dry_run:
                        self.stdout.write(f'   [{i}/{len(customer_data)}] Would create shipping address for {customer.name}:')
                        self.stdout.write(f'      {shipping_data["line1"]}, {shipping_data["city"]}')
                    else:
                        # Check if shipping address already exists
                        existing = CustomerAddress.objects.filter(
                            customer=customer,
                            type='shipping'
                        ).first()
                        
                        if not existing:
                            CustomerAddress.objects.create(customer=customer, **shipping_data)
                            addresses_created += 1
                            self.stdout.write(f'   [{i}/{len(customer_data)}] ✅ Created shipping address for {customer.name}')
                        else:
                            self.stdout.write(f'   [{i}/{len(customer_data)}] 🔁 Shipping address already exists for {customer.name}')
                
                if not dry_run:
                    imported_count += addresses_created
                
                if addresses_created == 0 and not dry_run:
                    skipped_count += 1
                
            except Exception as e:
                self.stdout.write(f'   [{i}/{len(customer_data)}] ❌ Error processing customer {data.get("customer", "Unknown")}: {e}')
                error_count += 1
        
        # Summary
        self.stdout.write(f'\n🎉 Import complete!')
        if dry_run:
            self.stdout.write(f'   📊 Would import addresses for: {len(customer_data)} customers')
        else:
            self.stdout.write(f'   📊 Created: {imported_count} addresses')
        self.stdout.write(f'   ⚠️  Skipped: {skipped_count} customers')
        self.stdout.write(f'   ❌ Errors: {error_count} customers')