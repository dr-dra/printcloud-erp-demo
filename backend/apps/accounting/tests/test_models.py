from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone

from apps.accounting.models import (
    AccountCategory,
    ChartOfAccounts,
    FiscalPeriod,
    JournalEntry,
    JournalLine,
    BankTransaction,
)
from apps.accounting.services.journal_engine import JournalEngine


class AccountingModelTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        cls.user = User.objects.create_user(email='tester@example.com', password='pass1234')

        cls.asset = AccountCategory.objects.create(code='AS', name='Assets', account_type='debit_normal')
        cls.liability = AccountCategory.objects.create(code='LI', name='Liabilities', account_type='credit_normal')
        cls.income = AccountCategory.objects.create(code='IN', name='Income', account_type='credit_normal')
        cls.expense = AccountCategory.objects.create(code='EX', name='Expenses', account_type='debit_normal')

        cls.cash = ChartOfAccounts.objects.create(
            account_code='1000',
            account_name='Cash',
            category=cls.asset,
            created_by=cls.user,
        )
        cls.bank = ChartOfAccounts.objects.create(
            account_code='1010',
            account_name='Bank',
            category=cls.asset,
            created_by=cls.user,
        )
        cls.ar = ChartOfAccounts.objects.create(
            account_code='1100',
            account_name='Accounts Receivable',
            category=cls.asset,
            created_by=cls.user,
        )
        cls.ap = ChartOfAccounts.objects.create(
            account_code='2000',
            account_name='Accounts Payable',
            category=cls.liability,
            created_by=cls.user,
        )
        cls.sales = ChartOfAccounts.objects.create(
            account_code='4000',
            account_name='Sales',
            category=cls.income,
            created_by=cls.user,
        )
        cls.expense_account = ChartOfAccounts.objects.create(
            account_code='5000',
            account_name='Expense',
            category=cls.expense,
            created_by=cls.user,
        )

        today = timezone.now().date()
        cls.period = FiscalPeriod.objects.create(
            name='Test Period',
            start_date=today - timedelta(days=5),
            end_date=today + timedelta(days=5),
            status='open',
            created_by=cls.user,
        )

    def test_journal_entry_requires_balance(self):
        entry = JournalEntry(
            journal_number='JE-TEST-0001',
            entry_date=timezone.now().date(),
            entry_type='manual',
            source_type='manual',
            event_type='manual_entry',
            description='Unbalanced entry',
            total_debit=Decimal('100.00'),
            total_credit=Decimal('90.00'),
            created_by=self.user,
        )

        with self.assertRaises(ValidationError):
            entry.full_clean()

    def test_journal_line_requires_single_side(self):
        entry = JournalEntry.objects.create(
            journal_number='JE-TEST-0002',
            entry_date=timezone.now().date(),
            entry_type='manual',
            source_type='manual',
            event_type='manual_entry',
            description='Header',
            total_debit=Decimal('0.00'),
            total_credit=Decimal('0.00'),
            created_by=self.user,
        )

        line = JournalLine(
            journal_entry=entry,
            account=self.cash,
            debit=Decimal('10.00'),
            credit=Decimal('10.00'),
        )

        with self.assertRaises(ValidationError):
            line.full_clean()

    def test_posted_journal_immutable(self):
        journal = JournalEngine.create_journal_entry(
            entry_date=timezone.now().date(),
            source_type='manual',
            source_id=None,
            event_type='manual_entry',
            description='Test entry',
            lines_data=[
                {'account_code': '1000', 'debit': 50, 'credit': 0},
                {'account_code': '4000', 'debit': 0, 'credit': 50},
            ],
            created_by=self.user,
            auto_post=True,
        )

        journal.description = 'Updated description'
        with self.assertRaises(ValidationError):
            journal.save()

    def test_fiscal_period_validation_and_transitions(self):
        invalid_period = FiscalPeriod(
            name='Invalid',
            start_date=timezone.now().date(),
            end_date=timezone.now().date(),
            created_by=self.user,
        )
        with self.assertRaises(ValidationError):
            invalid_period.full_clean()

        period = FiscalPeriod.objects.create(
            name='Closable',
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timedelta(days=10),
            status='open',
            created_by=self.user,
        )
        period.close_period(self.user)
        self.assertEqual(period.status, 'closed')

        period.lock_period()
        self.assertEqual(period.status, 'locked')

    def test_bank_transaction_validation(self):
        non_bank_account = ChartOfAccounts.objects.create(
            account_code='3000',
            account_name='Equity',
            category=self.liability,
            created_by=self.user,
        )

        transaction = BankTransaction(
            transaction_date=timezone.now().date(),
            transaction_type='receipt',
            description='Invalid bank account',
            bank_account=non_bank_account,
            contra_account=self.sales,
            amount=Decimal('100.00'),
            created_by=self.user,
        )

        with self.assertRaises(ValidationError):
            transaction.full_clean()
