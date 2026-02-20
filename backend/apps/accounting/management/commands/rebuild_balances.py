"""
Management command to rebuild account balances from journal entries.

This command recalculates all account balances from scratch by summing up
all posted journal entries. Useful for:
- Fixing inconsistencies in account balances
- Recovering from data corruption
- Verifying balance calculations
"""

from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Sum
from apps.accounting.models import ChartOfAccounts, JournalLine


class Command(BaseCommand):
    help = 'Rebuild account balances from journal entries'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be updated without actually updating',
        )
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Show detailed output for each account',
        )
        parser.add_argument(
            '--account',
            type=str,
            help='Rebuild balance for a specific account code only',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        verbose = options['verbose']
        specific_account = options.get('account')

        if dry_run:
            self.stdout.write(
                self.style.WARNING('DRY RUN MODE - No changes will be saved')
            )

        # Get accounts to process
        if specific_account:
            try:
                accounts = [ChartOfAccounts.objects.get(account_code=specific_account)]
                self.stdout.write(f'Processing account: {specific_account}')
            except ChartOfAccounts.DoesNotExist:
                self.stdout.write(
                    self.style.ERROR(f'Account {specific_account} not found')
                )
                return
        else:
            accounts = ChartOfAccounts.objects.filter(is_active=True)
            self.stdout.write(f'Processing {accounts.count()} active accounts...')

        updated_count = 0
        error_count = 0
        total_difference = Decimal('0')

        with transaction.atomic():
            for account in accounts:
                try:
                    # Calculate balance from journal lines
                    result = JournalLine.objects.filter(
                        account=account,
                        journal_entry__is_posted=True,
                    ).aggregate(
                        total_debit=Sum('debit'),
                        total_credit=Sum('credit'),
                    )

                    total_debit = result['total_debit'] or Decimal('0')
                    total_credit = result['total_credit'] or Decimal('0')

                    # Calculate new balance based on account type
                    if account.category.account_type == 'debit_normal':
                        # Assets, Expenses: DR increases, CR decreases
                        new_balance = total_debit - total_credit
                    else:
                        # Liabilities, Equity, Income: CR increases, DR decreases
                        new_balance = total_credit - total_debit

                    old_balance = account.current_balance
                    difference = new_balance - old_balance

                    if difference != 0 or verbose:
                        self.stdout.write(
                            f'  {account.account_code} - {account.account_name}'
                        )
                        self.stdout.write(
                            f'    Old balance: {old_balance:,.2f}'
                        )
                        self.stdout.write(
                            f'    New balance: {new_balance:,.2f}'
                        )

                        if difference != 0:
                            style = self.style.WARNING if abs(difference) > 0 else self.style.SUCCESS
                            self.stdout.write(
                                style(f'    Difference: {difference:,.2f}')
                            )
                            total_difference += abs(difference)

                    if not dry_run and difference != 0:
                        account.current_balance = new_balance
                        account.save(update_fields=['current_balance'])
                        updated_count += 1

                except Exception as e:
                    error_count += 1
                    self.stdout.write(
                        self.style.ERROR(
                            f'Error processing {account.account_code}: {str(e)}'
                        )
                    )

            # Rollback if dry run
            if dry_run:
                transaction.set_rollback(True)

        # Summary
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('=== Summary ==='))
        self.stdout.write(f'Accounts processed: {accounts.count()}')

        if not dry_run:
            self.stdout.write(
                self.style.SUCCESS(f'Accounts updated: {updated_count}')
            )
            self.stdout.write(f'Total difference corrected: {total_difference:,.2f}')
        else:
            self.stdout.write(
                self.style.WARNING(f'Accounts that would be updated: {updated_count}')
            )
            self.stdout.write(
                self.style.WARNING(f'Total difference found: {total_difference:,.2f}')
            )

        if error_count > 0:
            self.stdout.write(
                self.style.ERROR(f'Errors encountered: {error_count}')
            )

        if dry_run:
            self.stdout.write('')
            self.stdout.write(
                self.style.WARNING('Run without --dry-run to save changes')
            )
        else:
            self.stdout.write('')
            self.stdout.write(
                self.style.SUCCESS('Balance rebuild completed successfully!')
            )
