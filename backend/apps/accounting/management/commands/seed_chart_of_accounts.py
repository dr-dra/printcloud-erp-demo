from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.accounting.models import AccountCategory, ChartOfAccounts

User = get_user_model()


class Command(BaseCommand):
    help = 'Create default chart of accounts for PrintCloud ERP'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Starting chart of accounts setup...'))

        # Get or create system user for created_by field
        system_user = self.get_system_user()

        # Create account categories
        self.create_account_categories()

        # Create default chart of accounts
        self.create_default_accounts(system_user)

        self.stdout.write(self.style.SUCCESS('✅ Chart of accounts setup completed!'))

    def get_system_user(self):
        """Get or create a system user for automatic entries"""
        try:
            # Try to get the first superuser
            system_user = User.objects.filter(is_superuser=True).first()
            if system_user:
                self.stdout.write(f'Using superuser: {system_user.username}')
                return system_user

            # Otherwise get the first user
            system_user = User.objects.first()
            if system_user:
                self.stdout.write(f'Using first user: {system_user.username}')
                return system_user

            # If no users exist, we need to create one
            self.stdout.write(self.style.WARNING(
                'No users found. Please create a superuser first using: python manage.py createsuperuser'
            ))
            raise Exception('No users found in database')
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error getting system user: {e}'))
            raise

    def create_account_categories(self):
        """Create the main account categories"""
        self.stdout.write('Creating account categories...')

        categories = [
            {
                'code': 'ASSET',
                'name': 'Assets',
                'account_type': 'debit_normal',
                'display_order': 1,
            },
            {
                'code': 'LIABILITY',
                'name': 'Liabilities',
                'account_type': 'credit_normal',
                'display_order': 2,
            },
            {
                'code': 'EQUITY',
                'name': 'Equity',
                'account_type': 'credit_normal',
                'display_order': 3,
            },
            {
                'code': 'INCOME',
                'name': 'Income',
                'account_type': 'credit_normal',
                'display_order': 4,
            },
            {
                'code': 'EXPENSE',
                'name': 'Expenses',
                'account_type': 'debit_normal',
                'display_order': 5,
            },
        ]

        for cat_data in categories:
            defaults = {
                **cat_data,
                'is_active': cat_data.get('is_active', True),
            }
            category, created = AccountCategory.objects.get_or_create(
                code=cat_data['code'],
                defaults=defaults
            )
            if not created:
                updated = False
                for field in ['name', 'account_type', 'display_order', 'is_active']:
                    if field == 'is_active':
                        desired_value = cat_data.get(field, True)
                    else:
                        if field not in cat_data:
                            continue
                        desired_value = cat_data[field]
                    if getattr(category, field) != desired_value:
                        setattr(category, field, desired_value)
                        updated = True
                if updated:
                    category.save(update_fields=['name', 'account_type', 'display_order', 'is_active'])
            if created:
                self.stdout.write(f'  ✓ Created category: {category.code} - {category.name}')
            else:
                self.stdout.write(f'  → Category exists: {category.code} - {category.name}')

    def create_default_accounts(self, system_user):
        """Create default chart of accounts"""
        self.stdout.write('Creating default accounts...')

        # Get categories
        asset_cat = AccountCategory.objects.get(code='ASSET')
        liability_cat = AccountCategory.objects.get(code='LIABILITY')
        equity_cat = AccountCategory.objects.get(code='EQUITY')
        income_cat = AccountCategory.objects.get(code='INCOME')
        expense_cat = AccountCategory.objects.get(code='EXPENSE')

        # Define default accounts
        accounts = [
            # Assets (1000-1999)
            {
                'account_code': '1000',
                'account_name': 'Cash in Hand (POS Drawer)',
                'category': asset_cat,
                'is_system_account': True,
                'allow_transactions': True,
            },
            {
                'account_code': '1010',
                'account_name': 'Bank - DFCC Current',
                'category': asset_cat,
                'is_system_account': True,
                'allow_transactions': True,
            },
            {
                'account_code': '1020',
                'account_name': 'Bank - DFCC Savings',
                'category': asset_cat,
                'is_system_account': True,
                'allow_transactions': True,
            },
            {
                'account_code': '1030',
                'account_name': 'Bank - Sampath',
                'category': asset_cat,
                'is_system_account': True,
                'allow_transactions': True,
            },
            {
                'account_code': '1100',
                'account_name': 'Accounts Receivable - Trade',
                'category': asset_cat,
                'is_system_account': True,
                'allow_transactions': True,
            },
            {
                'account_code': '1110',
                'account_name': 'Accounts Receivable - POS Customer Accounts',
                'category': asset_cat,
                'is_system_account': True,
                'allow_transactions': True,
            },
            {
                'account_code': '1200',
                'account_name': 'Inventory - Raw Materials',
                'category': asset_cat,
                'is_system_account': True,
                'allow_transactions': True,
            },

            # Liabilities (2000-2999)
            {
                'account_code': '2000',
                'account_name': 'Accounts Payable - Trade',
                'category': liability_cat,
                'is_system_account': True,
                'allow_transactions': True,
            },
            {
                'account_code': '2100',
                'account_name': 'Customer Advances',
                'category': liability_cat,
                'is_system_account': True,
                'allow_transactions': True,
            },
            {
                'account_code': '2200',
                'account_name': 'Cheques Issued - Pending Clearance',
                'category': liability_cat,
                'is_system_account': True,
                'allow_transactions': True,
            },
            {
                'account_code': '2400',
                'account_name': 'VAT Payable',
                'category': liability_cat,
                'is_system_account': True,
                'allow_transactions': True,
            },

            # Equity (3000-3999)
            {
                'account_code': '3000',
                'account_name': 'Owner Capital',
                'category': equity_cat,
                'is_system_account': True,
                'allow_transactions': True,
            },
            {
                'account_code': '3100',
                'account_name': 'Retained Earnings',
                'category': equity_cat,
                'is_system_account': True,
                'allow_transactions': True,
            },
            {
                'account_code': '3900',
                'account_name': 'Current Year Profit/Loss',
                'category': equity_cat,
                'is_system_account': True,
                'allow_transactions': True,
            },

            # Income (4000-4999)
            {
                'account_code': '4000',
                'account_name': 'Sales - Commercial Printing',
                'category': income_cat,
                'is_system_account': True,
                'allow_transactions': True,
            },
            {
                'account_code': '4100',
                'account_name': 'Sales - POS Products',
                'category': income_cat,
                'is_system_account': True,
                'allow_transactions': True,
            },
            {
                'account_code': '4200',
                'account_name': 'Sales - Design Services',
                'category': income_cat,
                'is_system_account': True,
                'allow_transactions': True,
            },
            {
                'account_code': '4900',
                'account_name': 'Other Income',
                'category': income_cat,
                'is_system_account': True,
                'allow_transactions': True,
            },

            # Expenses (5000-5999)
            {
                'account_code': '5000',
                'account_name': 'Material Costs',
                'category': expense_cat,
                'is_system_account': True,
                'allow_transactions': True,
            },
            {
                'account_code': '5100',
                'account_name': 'Labor Costs',
                'category': expense_cat,
                'is_system_account': True,
                'allow_transactions': True,
            },
            {
                'account_code': '5200',
                'account_name': 'Operating Expenses',
                'category': expense_cat,
                'is_system_account': True,
                'allow_transactions': True,
            },
            {
                'account_code': '5210',
                'account_name': 'Bank Charges',
                'category': expense_cat,
                'is_system_account': True,
                'allow_transactions': True,
            },
            {
                'account_code': '5300',
                'account_name': 'Payout Expenses',
                'category': expense_cat,
                'is_system_account': True,
                'allow_transactions': True,
            },
        ]

        # Create accounts
        created_count = 0
        exists_count = 0
        updated_count = 0

        for acc_data in accounts:
            account, created = ChartOfAccounts.objects.get_or_create(
                account_code=acc_data['account_code'],
                defaults={
                    'account_name': acc_data['account_name'],
                    'category': acc_data['category'],
                    'is_system_account': acc_data['is_system_account'],
                    'is_active': True,
                    'allow_transactions': acc_data['allow_transactions'],
                    'current_balance': 0,
                    'created_by': system_user,
                }
            )

            if created:
                created_count += 1
                self.stdout.write(f'  ✓ Created: {account.account_code} - {account.account_name}')
            else:
                exists_count += 1
                updated = False
                for field in [
                    'account_name',
                    'category',
                    'is_system_account',
                    'is_active',
                    'allow_transactions',
                ]:
                    if field == 'is_active':
                        desired_value = acc_data.get(field, True)
                    else:
                        if field not in acc_data:
                            continue
                        desired_value = acc_data[field]
                    if getattr(account, field) != desired_value:
                        setattr(account, field, desired_value)
                        updated = True
                if updated:
                    updated_count += 1
                    account.save(update_fields=[
                        'account_name',
                        'category',
                        'is_system_account',
                        'is_active',
                        'allow_transactions',
                        'updated_at',
                    ])
                self.stdout.write(f'  → Exists: {account.account_code} - {account.account_name}')

        self.stdout.write(self.style.SUCCESS(
            f'\nSummary: {created_count} accounts created, {exists_count} already existed, '
            f'{updated_count} updated'
        ))
