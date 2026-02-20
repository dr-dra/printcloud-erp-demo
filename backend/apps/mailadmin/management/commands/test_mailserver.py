from django.core.management.base import BaseCommand
from django.db import connections

from apps.mailadmin.models import VirtualDomain, VirtualUser
from apps.mailadmin.utils import hash_password


class Command(BaseCommand):
    help = 'Test mailserver database connection and basic operations'

    def add_arguments(self, parser):
        parser.add_argument(
            '--create-test-data',
            action='store_true',
            help='Create test domain and user'
        )

    def handle(self, *args, **options):
        self.stdout.write("Testing mailserver database connection...")
        
        try:
            # Test database connection
            mailserver_db = connections['mailserver']
            with mailserver_db.cursor() as cursor:
                cursor.execute("SELECT 1")
                self.stdout.write(
                    self.style.SUCCESS("✓ Mailserver database connection successful")
                )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"✗ Database connection failed: {e}")
            )
            return

        # Test model operations
        try:
            domain_count = VirtualDomain.objects.using('mailserver').count()
            user_count = VirtualUser.objects.using('mailserver').count()
            
            self.stdout.write(f"Current domains: {domain_count}")
            self.stdout.write(f"Current users: {user_count}")
            
            if options['create_test_data']:
                self.create_test_data()
                
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"✗ Model operations failed: {e}")
            )

    def create_test_data(self):
        """Create test domain and user data."""
        try:
            # Create test domain
            test_domain, created = VirtualDomain.objects.using('mailserver').get_or_create(
                name='test.example.com'
            )
            
            if created:
                self.stdout.write(
                    self.style.SUCCESS(f"✓ Created test domain: {test_domain.name}")
                )
            else:
                self.stdout.write(f"Domain already exists: {test_domain.name}")

            # Create test user
            test_user, created = VirtualUser.objects.using('mailserver').get_or_create(
                email='test@test.example.com',
                defaults={
                    'domain': test_domain,
                    'password': hash_password('testpass123'),
                    'quota': 1073741824,  # 1GB
                    'is_active': True
                }
            )
            
            if created:
                self.stdout.write(
                    self.style.SUCCESS(f"✓ Created test user: {test_user.email}")
                )
            else:
                self.stdout.write(f"User already exists: {test_user.email}")
                
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"✗ Failed to create test data: {e}")
            )