from django.core.management.base import BaseCommand
from apps.customers.models import Customer, CustomerAddress
import random

class Command(BaseCommand):
    help = "Create sample addresses for existing customers (for testing purposes)"

    def add_arguments(self, parser):
        parser.add_argument(
            '--count',
            type=int,
            default=50,
            help='Number of customers to add sample addresses for (default: 50)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be created without actually doing it',
        )

    def handle(self, *args, **kwargs):
        count = kwargs.get('count', 50)
        dry_run = kwargs.get('dry_run', False)
        
        if dry_run:
            self.stdout.write(self.style.WARNING('🧪 DRY RUN MODE - No changes will be made\n'))

        # Sample address data for Sri Lankan context
        sample_addresses = [
            {
                'line1': '123 Kandy Road',
                'line2': 'Apartment 4B',
                'city': 'Kandy',
                'zip_code': '20000',
                'province': 'Central Province',
                'phone': '081-2234567'
            },
            {
                'line1': '456 Galle Road',
                'city': 'Colombo',
                'zip_code': '00300',
                'province': 'Western Province',
                'phone': '011-2345678'
            },
            {
                'line1': '789 Peradeniya Road',
                'line2': 'Near University',
                'city': 'Peradeniya',
                'zip_code': '20400',
                'province': 'Central Province',
                'phone': '081-2387654'
            },
            {
                'line1': '321 Main Street',
                'city': 'Negombo',
                'zip_code': '11500',
                'province': 'Western Province',
                'phone': '031-2234567'
            },
            {
                'line1': '654 Temple Road',
                'line2': 'Floor 2',
                'city': 'Matara',
                'zip_code': '81000',
                'province': 'Southern Province',
                'phone': '041-2234567'
            },
            {
                'line1': '987 Hill Street',
                'city': 'Nuwara Eliya',
                'zip_code': '22200',
                'province': 'Central Province',
                'phone': '052-2234567'
            },
            {
                'line1': '147 Lake Road',
                'line2': 'Villa 12',
                'city': 'Kurunegala',
                'zip_code': '60000',
                'province': 'North Western Province',
                'phone': '037-2234567'
            },
            {
                'line1': '258 Station Road',
                'city': 'Anuradhapura',
                'zip_code': '50000',
                'province': 'North Central Province',
                'phone': '025-2234567'
            },
            {
                'line1': '369 Beach Road',
                'line2': 'Hotel Complex',
                'city': 'Hikkaduwa',
                'zip_code': '80240',
                'province': 'Southern Province',
                'phone': '091-2234567'
            },
            {
                'line1': '741 Market Street',
                'city': 'Ratnapura',
                'zip_code': '70000',
                'province': 'Sabaragamuwa Province',
                'phone': '045-2234567'
            },
        ]

        # Get customers that don't have addresses yet
        customers_without_addresses = Customer.objects.filter(addresses__isnull=True).distinct()[:count]
        
        if not customers_without_addresses.exists():
            self.stdout.write("⚠️  No customers without addresses found. All customers already have addresses.")
            return

        total_customers = customers_without_addresses.count()
        self.stdout.write(f"🔍 Found {total_customers} customers without addresses")
        
        if dry_run:
            self.stdout.write("\n🧪 DRY RUN - Would create the following addresses:")
        else:
            self.stdout.write("\n🚀 Creating sample addresses...")

        created_count = 0
        
        for i, customer in enumerate(customers_without_addresses, 1):
            # Randomly select an address template
            address_template = random.choice(sample_addresses)
            
            # Create both billing and shipping addresses (randomly choose one or both)
            address_types = ['billing']
            if random.choice([True, False]):  # 50% chance to also add shipping address
                address_types.append('shipping')
            
            for addr_type in address_types:
                address_data = address_template.copy()
                
                # Modify slightly for shipping addresses
                if addr_type == 'shipping' and len(address_types) > 1:
                    address_data['line1'] = f"Delivery: {address_data['line1']}"
                
                if dry_run:
                    self.stdout.write(
                        f"   [{i}/{total_customers}] {customer.name} ({addr_type}):\n"
                        f"      {address_data['line1']}\n"
                        f"      {address_data.get('line2', '')}\n"
                        f"      {address_data['city']}, {address_data['zip_code']}\n"
                        f"      Phone: {address_data['phone']}"
                    )
                else:
                    CustomerAddress.objects.create(
                        customer=customer,
                        type=addr_type,
                        line1=address_data['line1'],
                        line2=address_data.get('line2', ''),
                        city=address_data['city'],
                        zip_code=address_data['zip_code'],
                        province=address_data['province'],
                        country='Sri Lanka',
                        phone=address_data['phone']
                    )
                    created_count += 1
                    
                    self.stdout.write(
                        f"   [{i}/{total_customers}] ✅ Created {addr_type} address for {customer.name}"
                    )

        if not dry_run:
            self.stdout.write(f"\n🎉 Successfully created {created_count} addresses for {total_customers} customers!")
        else:
            self.stdout.write(f"\n🧪 Would create {len(address_types)} address(es) each for {total_customers} customers")
            
        self.stdout.write("💡 You can now test the address display in quotation views and PDF exports.")