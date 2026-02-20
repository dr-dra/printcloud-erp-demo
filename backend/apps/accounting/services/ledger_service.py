"""
Ledger Service for Accounting Module

Provides query services for:
- Account balances
- Account transactions
- Cash book
- AR/AP aging
- Financial reports
"""

from decimal import Decimal
from datetime import timedelta
from django.db.models import Sum, Q, F
from django.utils import timezone
from apps.accounting.models import ChartOfAccounts, JournalEntry, JournalLine


class LedgerService:
    """
    Query service for ledger and financial reports.
    """

    @staticmethod
    def get_account_balance(account_code, as_of_date=None):
        """
        Get current balance for an account as of a specific date.

        Args:
            account_code: Account code to query
            as_of_date: Date to calculate balance up to (default: today)

        Returns:
            Decimal balance amount
        """
        try:
            account = ChartOfAccounts.objects.get(account_code=account_code)
        except ChartOfAccounts.DoesNotExist:
            raise ValueError(f"Account {account_code} not found")

        query = JournalLine.objects.filter(
            account=account,
            journal_entry__is_posted=True,
        )

        if as_of_date:
            query = query.filter(journal_entry__entry_date__lte=as_of_date)

        result = query.aggregate(
            total_debit=Sum('debit'),
            total_credit=Sum('credit'),
        )

        total_debit = result['total_debit'] or Decimal('0')
        total_credit = result['total_credit'] or Decimal('0')

        # Calculate balance based on account type
        if account.category.account_type == 'debit_normal':
            # Assets, Expenses: DR increases, CR decreases
            balance = total_debit - total_credit
        else:
            # Liabilities, Equity, Income: CR increases, DR decreases
            balance = total_credit - total_debit

        return balance

    @staticmethod
    def get_account_transactions(account_code, start_date=None, end_date=None, limit=None):
        """
        Get all transactions for an account.

        Args:
            account_code: Account code to query
            start_date: Start date filter (optional)
            end_date: End date filter (optional)
            limit: Maximum number of transactions to return (optional)

        Returns:
            QuerySet of JournalLine objects
        """
        try:
            account = ChartOfAccounts.objects.get(account_code=account_code)
        except ChartOfAccounts.DoesNotExist:
            raise ValueError(f"Account {account_code} not found")

        query = JournalLine.objects.filter(
            account=account,
            journal_entry__is_posted=True,
        ).select_related('journal_entry', 'journal_entry__created_by')

        if start_date:
            query = query.filter(journal_entry__entry_date__gte=start_date)
        if end_date:
            query = query.filter(journal_entry__entry_date__lte=end_date)

        query = query.order_by('journal_entry__entry_date', 'journal_entry__journal_number')

        if limit:
            query = query[:limit]

        return query

    @staticmethod
    def get_cash_book(start_date, end_date, cash_account_code='1000'):
        """
        Generate cash book report (all cash transactions).

        Args:
            start_date: Report start date
            end_date: Report end date
            cash_account_code: Cash account code (default: 1000)

        Returns:
            Dictionary with opening balance, closing balance, and transactions
        """
        # Get opening balance (balance before start_date)
        opening_balance = LedgerService.get_account_balance(
            cash_account_code,
            as_of_date=start_date - timedelta(days=1)
        )

        # Get transactions for the period
        transactions_query = LedgerService.get_account_transactions(
            cash_account_code,
            start_date=start_date,
            end_date=end_date
        )

        # Build transaction list with running balance
        result = []
        running_balance = opening_balance

        for line in transactions_query:
            if line.debit > 0:
                running_balance += line.debit
                transaction_type = 'receipt'
                amount = line.debit
            else:
                running_balance -= line.credit
                transaction_type = 'payment'
                amount = line.credit

            result.append({
                'date': line.journal_entry.entry_date,
                'journal_entry_id': line.journal_entry.id,
                'journal_number': line.journal_entry.journal_number,
                'description': line.description or line.journal_entry.description,
                'source_type': line.journal_entry.source_type,
                'source_reference': line.journal_entry.source_reference,
                'type': transaction_type,
                'debit': line.debit,
                'credit': line.credit,
                'amount': amount,
                'balance': running_balance,
            })

        return {
            'period': {
                'start_date': start_date,
                'end_date': end_date,
            },
            'opening_balance': opening_balance,
            'closing_balance': running_balance,
            'transactions': result,
            'total_receipts': sum(t['debit'] for t in result),
            'total_payments': sum(t['credit'] for t in result),
        }

    @staticmethod
    def get_accounts_receivable_aging(as_of_date=None):
        """
        AR aging report - shows outstanding invoices by age.

        Args:
            as_of_date: Date to calculate aging from (default: today)

        Returns:
            List of dictionaries with invoice aging information
        """
        from apps.sales.invoices.models import SalesInvoice

        if not as_of_date:
            as_of_date = timezone.now().date()

        # Get unpaid/partially paid invoices
        unpaid_invoices = SalesInvoice.objects.filter(
            status__in=['sent', 'partially_paid', 'overdue'],
            balance_due__gt=0,
        ).select_related('customer')

        result = []
        total_current = Decimal('0')
        total_30 = Decimal('0')
        total_60 = Decimal('0')
        total_90 = Decimal('0')
        total_90_plus = Decimal('0')

        for invoice in unpaid_invoices:
            days_outstanding = (as_of_date - invoice.invoice_date).days

            # Age buckets
            if days_outstanding <= 30:
                age_bucket = 'Current (0-30 days)'
                bucket_amount = invoice.balance_due
                total_current += bucket_amount
            elif days_outstanding <= 60:
                age_bucket = '31-60 days'
                bucket_amount = invoice.balance_due
                total_30 += bucket_amount
            elif days_outstanding <= 90:
                age_bucket = '61-90 days'
                bucket_amount = invoice.balance_due
                total_60 += bucket_amount
            else:
                age_bucket = '90+ days'
                bucket_amount = invoice.balance_due
                total_90_plus += bucket_amount

            result.append({
                'customer_id': invoice.customer.id if invoice.customer else None,
                'customer_name': invoice.customer.name if invoice.customer else 'Walk-in Customer',
                'invoice_number': invoice.invoice_number,
                'invoice_date': invoice.invoice_date,
                'due_date': invoice.due_date,
                'days_outstanding': days_outstanding,
                'age_bucket': age_bucket,
                'invoice_total': invoice.net_total,
                'amount_paid': invoice.amount_paid,
                'balance_due': invoice.balance_due,
            })

        # Sort by customer name, then by invoice date
        result.sort(key=lambda x: (x['customer_name'], x['invoice_date']))

        return {
            'as_of_date': as_of_date,
            'invoices': result,
            'summary': {
                'current': total_current,
                '31_60_days': total_30,
                '61_90_days': total_60,
                '90_plus_days': total_90_plus,
                'total': total_current + total_30 + total_60 + total_90_plus,
            }
        }

    @staticmethod
    def get_accounts_payable_aging(as_of_date=None):
        """
        AP aging report - shows outstanding bills by age.

        Args:
            as_of_date: Date to calculate aging from (default: today)

        Returns:
            List of dictionaries with bill aging information
        """
        from apps.purchases.models import SupplierBill

        if not as_of_date:
            as_of_date = timezone.now().date()

        # Get unpaid/partially paid bills
        unpaid_bills = SupplierBill.objects.filter(
            status__in=['approved', 'partially_paid'],
            balance_due__gt=0,
        ).select_related('supplier')

        result = []
        total_current = Decimal('0')
        total_30 = Decimal('0')
        total_60 = Decimal('0')
        total_90_plus = Decimal('0')

        for bill in unpaid_bills:
            days_outstanding = (as_of_date - bill.bill_date).days

            # Age buckets
            if days_outstanding <= 30:
                age_bucket = 'Current (0-30 days)'
                bucket_amount = bill.balance_due
                total_current += bucket_amount
            elif days_outstanding <= 60:
                age_bucket = '31-60 days'
                bucket_amount = bill.balance_due
                total_30 += bucket_amount
            elif days_outstanding <= 90:
                age_bucket = '61-90 days'
                bucket_amount = bill.balance_due
                total_60 += bucket_amount
            else:
                age_bucket = '90+ days'
                bucket_amount = bill.balance_due
                total_90_plus += bucket_amount

            result.append({
                'bill_id': bill.id,
                'supplier_id': bill.supplier.id,
                'supplier_name': bill.supplier.name,
                'bill_number': bill.bill_number,
                'internal_reference': bill.internal_reference,
                'bill_date': bill.bill_date,
                'due_date': bill.due_date,
                'days_outstanding': days_outstanding,
                'age_bucket': age_bucket,
                'bill_total': bill.total,
                'amount_paid': bill.amount_paid,
                'balance_due': bill.balance_due,
            })

        # Sort by supplier name, then by bill date
        result.sort(key=lambda x: (x['supplier_name'], x['bill_date']))

        return {
            'as_of_date': as_of_date,
            'bills': result,
            'summary': {
                'current': total_current,
                '31_60_days': total_30,
                '61_90_days': total_60,
                '90_plus_days': total_90_plus,
                'total': total_current + total_30 + total_60 + total_90_plus,
            }
        }

    @staticmethod
    def get_profit_and_loss(start_date, end_date):
        """
        Basic P&L statement for a period.

        Args:
            start_date: Report start date
            end_date: Report end date

        Returns:
            Dictionary with income, expenses, and net profit
        """
        # Income accounts (4000-4999)
        income_accounts = ChartOfAccounts.objects.filter(
            account_code__startswith='4',
            is_active=True,
            allow_transactions=True,
        )

        # Expense accounts (5000-5999)
        expense_accounts = ChartOfAccounts.objects.filter(
            account_code__startswith='5',
            is_active=True,
            allow_transactions=True,
        )

        income_items = []
        total_income = Decimal('0')

        for account in income_accounts:
            balance = LedgerService.get_account_balance_for_period(
                account.account_code, start_date, end_date
            )
            if balance != 0:
                income_items.append({
                    'account_code': account.account_code,
                    'account_name': account.account_name,
                    'amount': balance,
                })
                total_income += balance

        expense_items = []
        total_expenses = Decimal('0')

        for account in expense_accounts:
            balance = LedgerService.get_account_balance_for_period(
                account.account_code, start_date, end_date
            )
            if balance != 0:
                expense_items.append({
                    'account_code': account.account_code,
                    'account_name': account.account_name,
                    'amount': balance,
                })
                total_expenses += balance

        net_profit = total_income - total_expenses

        return {
            'period': {
                'start_date': start_date,
                'end_date': end_date,
            },
            'income': {
                'items': income_items,
                'total': total_income,
            },
            'expenses': {
                'items': expense_items,
                'total': total_expenses,
            },
            'net_profit': net_profit,
        }

    @staticmethod
    def get_account_balance_for_period(account_code, start_date, end_date):
        """
        Get balance movement for a specific period (used in P&L).

        Args:
            account_code: Account code to query
            start_date: Period start date
            end_date: Period end date

        Returns:
            Decimal balance amount for the period
        """
        try:
            account = ChartOfAccounts.objects.get(account_code=account_code)
        except ChartOfAccounts.DoesNotExist:
            raise ValueError(f"Account {account_code} not found")

        query = JournalLine.objects.filter(
            account=account,
            journal_entry__is_posted=True,
            journal_entry__entry_date__gte=start_date,
            journal_entry__entry_date__lte=end_date,
        )

        result = query.aggregate(
            total_debit=Sum('debit'),
            total_credit=Sum('credit'),
        )

        total_debit = result['total_debit'] or Decimal('0')
        total_credit = result['total_credit'] or Decimal('0')

        # For income/expense accounts, return the net movement
        if account.category.account_type == 'debit_normal':
            # Expense accounts: DR increases expense
            return total_debit - total_credit
        else:
            # Income accounts: CR increases income
            return total_credit - total_debit

    @staticmethod
    def get_trial_balance(as_of_date=None):
        """
        Generate trial balance report.

        Args:
            as_of_date: Date to generate trial balance (default: today)

        Returns:
            Dictionary with all account balances and totals
        """
        if not as_of_date:
            as_of_date = timezone.now().date()

        accounts = ChartOfAccounts.objects.filter(
            is_active=True,
            allow_transactions=True,
        ).order_by('account_code')

        result = []
        total_debit = Decimal('0')
        total_credit = Decimal('0')

        for account in accounts:
            balance = LedgerService.get_account_balance(
                account.account_code,
                as_of_date=as_of_date
            )

            if balance != 0:  # Only show accounts with balances
                if account.category.account_type == 'debit_normal':
                    debit_balance = balance if balance > 0 else Decimal('0')
                    credit_balance = abs(balance) if balance < 0 else Decimal('0')
                else:
                    debit_balance = abs(balance) if balance < 0 else Decimal('0')
                    credit_balance = balance if balance > 0 else Decimal('0')

                result.append({
                    'account_code': account.account_code,
                    'account_name': account.account_name,
                    'category': account.category.name,
                    'debit': debit_balance,
                    'credit': credit_balance,
                })

                total_debit += debit_balance
                total_credit += credit_balance

        return {
            'as_of_date': as_of_date,
            'accounts': result,
            'totals': {
                'debit': total_debit,
                'credit': total_credit,
                'difference': total_debit - total_credit,
                'balanced': total_debit == total_credit,
            }
        }

    @staticmethod
    def get_balance_sheet(as_of_date=None):
        """
        Generate balance sheet report.

        Args:
            as_of_date: Date to generate balance sheet (default: today)

        Returns:
            Dictionary with assets, liabilities, equity
        """
        if not as_of_date:
            as_of_date = timezone.now().date()

        # Assets (1000-1999)
        asset_accounts = ChartOfAccounts.objects.filter(
            account_code__startswith='1',
            is_active=True,
            allow_transactions=True,
        ).order_by('account_code')

        # Liabilities (2000-2999)
        liability_accounts = ChartOfAccounts.objects.filter(
            account_code__startswith='2',
            is_active=True,
            allow_transactions=True,
        ).order_by('account_code')

        # Equity (3000-3999)
        equity_accounts = ChartOfAccounts.objects.filter(
            account_code__startswith='3',
            is_active=True,
            allow_transactions=True,
        ).order_by('account_code')

        assets = []
        total_assets = Decimal('0')

        for account in asset_accounts:
            balance = LedgerService.get_account_balance(
                account.account_code,
                as_of_date=as_of_date
            )
            if balance != 0:
                assets.append({
                    'account_code': account.account_code,
                    'account_name': account.account_name,
                    'amount': balance,
                })
                total_assets += balance

        liabilities = []
        total_liabilities = Decimal('0')

        for account in liability_accounts:
            balance = LedgerService.get_account_balance(
                account.account_code,
                as_of_date=as_of_date
            )
            if balance != 0:
                liabilities.append({
                    'account_code': account.account_code,
                    'account_name': account.account_name,
                    'amount': balance,
                })
                total_liabilities += balance

        equity = []
        total_equity = Decimal('0')

        for account in equity_accounts:
            balance = LedgerService.get_account_balance(
                account.account_code,
                as_of_date=as_of_date
            )
            if balance != 0:
                equity.append({
                    'account_code': account.account_code,
                    'account_name': account.account_name,
                    'amount': balance,
                })
                total_equity += balance

        return {
            'as_of_date': as_of_date,
            'assets': {
                'items': assets,
                'total': total_assets,
            },
            'liabilities': {
                'items': liabilities,
                'total': total_liabilities,
            },
            'equity': {
                'items': equity,
                'total': total_equity,
            },
            'totals': {
                'assets': total_assets,
                'liabilities_and_equity': total_liabilities + total_equity,
                'difference': total_assets - (total_liabilities + total_equity),
                'balanced': total_assets == (total_liabilities + total_equity),
            }
        }
