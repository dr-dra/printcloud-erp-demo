from django.core.management.base import BaseCommand
from apps.accounting.models import AccountCategory, ChartOfAccounts


class Command(BaseCommand):
    help = 'Fix account categories based on account code ranges'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Fixing account categories...'))

        # Get categories
        try:
            asset_cat = AccountCategory.objects.get(code='ASSET')
            liability_cat = AccountCategory.objects.get(code='LIABILITY')
            equity_cat = AccountCategory.objects.get(code='EQUITY')
            income_cat = AccountCategory.objects.get(code='INCOME')
            expense_cat = AccountCategory.objects.get(code='EXPENSE')
        except AccountCategory.DoesNotExist as e:
            self.stdout.write(self.style.ERROR(
                f'Missing account category: {e}. Please run seed_chart_of_accounts first.'
            ))
            return

        # Get all accounts
        accounts = ChartOfAccounts.objects.all()
        fixed_count = 0
        error_count = 0

        for account in accounts:
            try:
                # Determine correct category based on account code
                code_num = int(account.account_code)
                correct_category = None

                if 1000 <= code_num < 2000:
                    correct_category = asset_cat
                elif 2000 <= code_num < 3000:
                    correct_category = liability_cat
                elif 3000 <= code_num < 4000:
                    correct_category = equity_cat
                elif 4000 <= code_num < 5000:
                    correct_category = income_cat
                elif 5000 <= code_num < 6000:
                    correct_category = expense_cat
                else:
                    self.stdout.write(self.style.WARNING(
                        f'Account {account.account_code} has unusual code range. Skipping.'
                    ))
                    continue

                # Update if category is wrong
                if account.category != correct_category:
                    old_category = account.category.name if account.category else 'None'
                    account.category = correct_category
                    account.save(update_fields=['category', 'updated_at'])
                    fixed_count += 1
                    self.stdout.write(
                        f'  ✓ Fixed {account.account_code} - {account.account_name}: '
                        f'{old_category} → {correct_category.name}'
                    )

            except ValueError:
                error_count += 1
                self.stdout.write(self.style.ERROR(
                    f'Invalid account code format: {account.account_code}. Skipping.'
                ))
            except Exception as e:
                error_count += 1
                self.stdout.write(self.style.ERROR(
                    f'Error processing account {account.account_code}: {str(e)}'
                ))

        self.stdout.write(self.style.SUCCESS(
            f'\n✅ Category fix completed! '
            f'{fixed_count} accounts fixed, {error_count} errors'
        ))

        # Show summary by category
        self.stdout.write('\nCurrent account distribution:')
        for category in [asset_cat, liability_cat, equity_cat, income_cat, expense_cat]:
            count = ChartOfAccounts.objects.filter(category=category).count()
            self.stdout.write(f'  {category.name}: {count} accounts')
