"""
Management command to set up opening balances for the accounting system.

This command analyzes existing data (invoices, customers, POS transactions) and creates
opening balance journal entries to establish starting balances for all accounts.

Usage:
    python manage.py setup_opening_balances [--date YYYY-MM-DD] [--dry-run]

Options:
    --date: Opening balance date (default: earliest invoice date or today)
    --dry-run: Preview changes without committing to database
"""

from decimal import Decimal
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from datetime import datetime, date
from apps.accounting.models import ChartOfAccounts, JournalEntry, JournalLine
from apps.accounting.services.journal_engine import JournalEngine


class Command(BaseCommand):
    help = 'Set up opening balances for the accounting system'

    def add_arguments(self, parser):
        parser.add_argument(
            '--date',
            type=str,
            help='Opening balance date (YYYY-MM-DD format). Default: earliest invoice date',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview changes without committing to database',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        opening_date_str = options.get('date')

        # Header
        self.stdout.write(self.style.SUCCESS('='*70))
        self.stdout.write(self.style.SUCCESS('PrintCloud Accounting - Opening Balance Setup'))
        self.stdout.write(self.style.SUCCESS('='*70))
        self.stdout.write('')

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No changes will be committed'))
            self.stdout.write('')

        # Determine opening balance date
        if opening_date_str:
            try:
                opening_date = datetime.strptime(opening_date_str, '%Y-%m-%d').date()
            except ValueError:
                raise CommandError('Invalid date format. Use YYYY-MM-DD')
        else:
            # Use earliest invoice date or today
            opening_date = self._get_earliest_transaction_date()

        self.stdout.write(f'Opening Balance Date: {opening_date}')
        self.stdout.write('')

        # Calculate balances
        self.stdout.write(self.style.HTTP_INFO('Step 1: Analyzing existing data...'))
        balances = self._calculate_balances(opening_date)

        # Display summary
        self._display_balance_summary(balances)

        # Create journal entries
        if not dry_run:
            self._create_opening_journal_entries(opening_date, balances)
        else:
            self.stdout.write('')
            self.stdout.write(self.style.WARNING('DRY RUN: Journal entries NOT created'))

        # Final summary
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('='*70))
        if not dry_run:
            self.stdout.write(self.style.SUCCESS('Opening balances set up successfully!'))
        else:
            self.stdout.write(self.style.WARNING('DRY RUN completed. Run without --dry-run to commit changes.'))
        self.stdout.write(self.style.SUCCESS('='*70))

    def _get_earliest_transaction_date(self):
        """Get the earliest transaction date from invoices"""
        try:
            from apps.sales.invoices.models import SalesInvoice
            earliest_invoice = SalesInvoice.objects.order_by('invoice_date').first()
            if earliest_invoice:
                # Use one day before earliest invoice to establish opening balances
                from datetime import timedelta
                return earliest_invoice.invoice_date - timedelta(days=1)
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'Could not determine earliest invoice date: {e}'))

        # Default to beginning of current year
        today = date.today()
        return date(today.year, 1, 1)

    def _calculate_balances(self, as_of_date):
        """Calculate opening balances from existing data"""
        balances = {
            'accounts_receivable': Decimal('0'),
            'accounts_payable': Decimal('0'),
            'cash_in_hand': Decimal('0'),
            'sales_revenue': Decimal('0'),
            'owner_capital': Decimal('0'),
        }

        # Calculate AR from unpaid invoices
        try:
            from apps.sales.invoices.models import SalesInvoice
            unpaid_invoices = SalesInvoice.objects.filter(
                invoice_date__lte=as_of_date,
                status__in=['sent', 'partially_paid', 'overdue']
            )
            ar_total = sum(
                Decimal(str(inv.balance_due))
                for inv in unpaid_invoices
            )
            balances['accounts_receivable'] = ar_total
            self.stdout.write(f'  - Found {unpaid_invoices.count()} unpaid invoices')
            self.stdout.write(f'  - Total AR: {ar_total:,.2f}')
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'Could not calculate AR: {e}'))

        # Calculate Cash from POS
        try:
            from apps.pos.models import CashDrawerSession
            closed_sessions = CashDrawerSession.objects.filter(
                closed_at__date__lte=as_of_date,
                status='closed'
            )
            cash_total = sum(
                Decimal(str(session.actual_balance))
                for session in closed_sessions
            )
            balances['cash_in_hand'] = cash_total
            self.stdout.write(f'  - Found {closed_sessions.count()} closed cash drawer sessions')
            self.stdout.write(f'  - Total Cash: {cash_total:,.2f}')
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'Could not calculate Cash: {e}'))

        # Calculate total assets and liabilities
        total_assets = (
            balances['accounts_receivable'] +
            balances['cash_in_hand']
        )
        total_liabilities = balances['accounts_payable']

        # Owner's equity = Assets - Liabilities
        balances['owner_capital'] = total_assets - total_liabilities

        self.stdout.write('')
        return balances

    def _display_balance_summary(self, balances):
        """Display a summary of calculated balances"""
        self.stdout.write(self.style.HTTP_INFO('Step 2: Balance Summary'))
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('ASSETS:'))
        self.stdout.write(f'  Accounts Receivable:  {balances["accounts_receivable"]:>15,.2f}')
        self.stdout.write(f'  Cash in Hand:         {balances["cash_in_hand"]:>15,.2f}')
        self.stdout.write(f'  {"-"*40}')
        total_assets = balances['accounts_receivable'] + balances['cash_in_hand']
        self.stdout.write(f'  Total Assets:         {total_assets:>15,.2f}')
        self.stdout.write('')

        self.stdout.write(self.style.WARNING('LIABILITIES:'))
        self.stdout.write(f'  Accounts Payable:     {balances["accounts_payable"]:>15,.2f}')
        self.stdout.write(f'  {"-"*40}')
        self.stdout.write(f'  Total Liabilities:    {balances["accounts_payable"]:>15,.2f}')
        self.stdout.write('')

        self.stdout.write(self.style.HTTP_INFO('EQUITY:'))
        self.stdout.write(f'  Owner Capital:        {balances["owner_capital"]:>15,.2f}')
        self.stdout.write(f'  {"-"*40}')
        self.stdout.write(f'  Total Equity:         {balances["owner_capital"]:>15,.2f}')
        self.stdout.write('')

        # Verify accounting equation
        balance_check = total_assets - (balances['accounts_payable'] + balances['owner_capital'])
        if abs(balance_check) < Decimal('0.01'):
            self.stdout.write(self.style.SUCCESS('✓ Accounting equation balanced: Assets = Liabilities + Equity'))
        else:
            self.stdout.write(self.style.ERROR(f'✗ Unbalanced! Difference: {balance_check:,.2f}'))

    @transaction.atomic
    def _create_opening_journal_entries(self, opening_date, balances):
        """Create journal entries for opening balances"""
        self.stdout.write('')
        self.stdout.write(self.style.HTTP_INFO('Step 3: Creating opening balance journal entries...'))

        # Check if opening balance entries already exist
        existing = JournalEntry.objects.filter(
            source_type='opening_balance',
            event_type='opening_balance',
            entry_date=opening_date
        )
        if existing.exists():
            self.stdout.write(self.style.WARNING(f'Warning: {existing.count()} opening balance entries already exist for {opening_date}'))
            confirm = input('Do you want to delete and recreate them? (yes/no): ')
            if confirm.lower() != 'yes':
                self.stdout.write(self.style.ERROR('Aborted.'))
                return
            existing.delete()
            self.stdout.write('Deleted existing opening balance entries.')

        lines_data = []

        # Accounts Receivable (Asset - Debit)
        if balances['accounts_receivable'] > 0:
            lines_data.append({
                'account_code': '1100',
                'debit': balances['accounts_receivable'],
                'credit': 0,
                'description': 'Opening balance - Accounts Receivable',
            })

        # Cash in Hand (Asset - Debit)
        if balances['cash_in_hand'] > 0:
            lines_data.append({
                'account_code': '1000',
                'debit': balances['cash_in_hand'],
                'credit': 0,
                'description': 'Opening balance - Cash in Hand',
            })

        # Accounts Payable (Liability - Credit)
        if balances['accounts_payable'] > 0:
            lines_data.append({
                'account_code': '2000',
                'debit': 0,
                'credit': balances['accounts_payable'],
                'description': 'Opening balance - Accounts Payable',
            })

        # Owner Capital (Equity - Credit)
        if balances['owner_capital'] != 0:
            lines_data.append({
                'account_code': '3000',
                'debit': 0 if balances['owner_capital'] > 0 else abs(balances['owner_capital']),
                'credit': balances['owner_capital'] if balances['owner_capital'] > 0 else 0,
                'description': 'Opening balance - Owner Capital',
            })

        # Create the journal entry
        if lines_data:
            try:
                journal = JournalEngine.create_journal_entry(
                    entry_date=opening_date,
                    source_type='opening_balance',
                    source_id=None,
                    event_type='opening_balance',
                    description='Opening balances for PrintCloud Accounting System',
                    lines_data=lines_data,
                    created_by=None,
                    auto_post=True,
                )
                self.stdout.write(self.style.SUCCESS(f'✓ Created journal entry: {journal.journal_number}'))
                self.stdout.write(f'  Total Debit:  {journal.total_debit:,.2f}')
                self.stdout.write(f'  Total Credit: {journal.total_credit:,.2f}')
                self.stdout.write(f'  Posted: {journal.is_posted}')
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'✗ Error creating journal entry: {e}'))
                raise
        else:
            self.stdout.write(self.style.WARNING('No opening balances to record (all balances are zero)'))
