from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.customers.models import Customer, CustomerAddress, CustomerAltContact
from django.contrib.auth import get_user_model
import random
from decimal import Decimal

class Command(BaseCommand):
    help = 'Create sample customer data for testing'

    def handle(self, *args, **options):
        # Get the first user as the created_by user
        try:
            user = get_user_model().objects.first()
        except get_user_model().DoesNotExist:
            self.stdout.write(self.style.ERROR('No users found. Please create a user first.'))
            return

        # Sample customer data
        customers_data = [
            {
                'legacy_id': 1001,
                'name': 'ABC Trading Company',
                'customer_type': 'business',
                'email': 'contact@abctrading.com',
                'contact': '+94 11 234 5678',
                'account_no': 'ACC001',
                'website': 'https://abctrading.com',
                'credit_limit': 50000.00,
                'due_on_days': 30,
                'payment_term': 30,
                'addresses': [
                    {
                        'type': 'billing',
                        'line1': '123 Main Street',
                        'line2': 'Suite 456',
                        'city': 'Colombo',
                        'zip_code': '10001',
                        'province': 'Western',
                        'country': 'Sri Lanka',
                        'phone': '+94 11 234 5678'
                    }
                ],
                'alt_contacts': [
                    {'number': '+94 77 123 4567', 'note': 'Manager Mobile'}
                ]
            },
            {
                'legacy_id': 1002,
                'name': 'John Doe',
                'customer_type': 'individual',
                'email': 'john.doe@email.com',
                'contact': '+94 71 987 6543',
                'account_no': 'ACC002',
                'credit_limit': 10000.00,
                'due_on_days': 15,
                'payment_term': 15,
                'addresses': [
                    {
                        'type': 'billing',
                        'line1': '456 Oak Avenue',
                        'city': 'Kandy',
                        'zip_code': '20000',
                        'province': 'Central',
                        'country': 'Sri Lanka',
                        'phone': '+94 71 987 6543'
                    }
                ]
            },
            {
                'legacy_id': 1003,
                'name': 'XYZ Corporation',
                'customer_type': 'business',
                'email': 'info@xyzcorp.lk',
                'contact': '+94 11 765 4321',
                'account_no': 'ACC003',
                'website': 'https://xyzcorp.lk',
                'credit_limit': 75000.00,
                'due_on_days': 45,
                'payment_term': 45,
                'addresses': [
                    {
                        'type': 'billing',
                        'line1': '789 Business Park',
                        'city': 'Gampaha',
                        'zip_code': '11000',
                        'province': 'Western',
                        'country': 'Sri Lanka',
                        'phone': '+94 11 765 4321'
                    },
                    {
                        'type': 'shipping',
                        'line1': '321 Warehouse Road',
                        'city': 'Kelaniya',
                        'zip_code': '11300',
                        'province': 'Western',
                        'country': 'Sri Lanka',
                        'phone': '+94 11 555 0123'
                    }
                ]
            },
            {
                'legacy_id': 1004,
                'name': 'Jane Smith',
                'customer_type': 'individual',
                'email': 'jane.smith@gmail.com',
                'contact': '+94 70 111 2222',
                'account_no': 'ACC004',
                'credit_limit': 5000.00,
                'due_on_days': 7,
                'payment_term': 7,
                'addresses': [
                    {
                        'type': 'billing',
                        'line1': '654 Pine Street',
                        'city': 'Negombo',
                        'zip_code': '11500',
                        'province': 'Western',
                        'country': 'Sri Lanka',
                        'phone': '+94 70 111 2222'
                    }
                ]
            },
            {
                'legacy_id': 1005,
                'name': 'Tech Solutions Ltd',
                'customer_type': 'business',
                'email': 'admin@techsolutions.lk',
                'contact': '+94 11 555 6789',
                'account_no': 'ACC005',
                'website': 'https://techsolutions.lk',
                'credit_limit': 100000.00,
                'due_on_days': 60,
                'payment_term': 60,
                'addresses': [
                    {
                        'type': 'billing',
                        'line1': '147 Technology Lane',
                        'city': 'Moratuwa',
                        'zip_code': '10400',
                        'province': 'Western',
                        'country': 'Sri Lanka',
                        'phone': '+94 11 555 6789'
                    }
                ]
            }
        ]

        created_count = 0
        for customer_data in customers_data:
            # Check if customer already exists
            if Customer.objects.filter(legacy_id=customer_data['legacy_id']).exists():
                self.stdout.write(f"Customer with legacy_id {customer_data['legacy_id']} already exists, skipping...")
                continue

            # Extract addresses and alt_contacts
            addresses = customer_data.pop('addresses', [])
            alt_contacts = customer_data.pop('alt_contacts', [])

            # Create customer
            customer = Customer.objects.create(
                **customer_data,
                created_by=user,
                updated_by=user,
                created_at=timezone.now(),
                updated_at=timezone.now()
            )

            # Create addresses
            for address_data in addresses:
                CustomerAddress.objects.create(
                    customer=customer,
                    **address_data
                )

            # Create alternative contacts
            for alt_contact_data in alt_contacts:
                CustomerAltContact.objects.create(
                    customer=customer,
                    **alt_contact_data
                )

            created_count += 1
            self.stdout.write(
                self.style.SUCCESS(f'Successfully created customer: {customer.name}')
            )

        self.stdout.write(
            self.style.SUCCESS(f'Successfully created {created_count} customers')
        ) 