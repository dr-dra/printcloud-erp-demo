from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from apps.accounting.models import AccountCategory, ChartOfAccounts, FiscalPeriod, JournalEntry, BankTransaction
from apps.accounting.services.journal_engine import JournalEngine
from apps.customers.models import Customer
from apps.sales.invoices.models import SalesInvoice, InvoicePayment
from apps.suppliers.models import Supplier
from apps.purchases.models import SupplierBill


class AccountingIntegrationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        cls.user = User.objects.create_user(email='integration@example.com', password='pass1234')

        asset = AccountCategory.objects.create(code='AS', name='Assets', account_type='debit_normal')
        liability = AccountCategory.objects.create(code='LI', name='Liabilities', account_type='credit_normal')
        income = AccountCategory.objects.create(code='IN', name='Income', account_type='credit_normal')
        expense = AccountCategory.objects.create(code='EX', name='Expense', account_type='debit_normal')

        cls.cash = ChartOfAccounts.objects.create(account_code='1000', account_name='Cash', category=asset, created_by=cls.user)
        cls.bank = ChartOfAccounts.objects.create(account_code='1010', account_name='Bank', category=asset, created_by=cls.user)
        cls.ar = ChartOfAccounts.objects.create(account_code='1100', account_name='AR', category=asset, created_by=cls.user)
        cls.ap = ChartOfAccounts.objects.create(account_code='2000', account_name='AP', category=liability, created_by=cls.user)
        cls.cheques_pending = ChartOfAccounts.objects.create(
            account_code='2200', account_name='Cheques Pending', category=liability, created_by=cls.user
        )
        cls.sales = ChartOfAccounts.objects.create(account_code='4000', account_name='Sales', category=income, created_by=cls.user)
        cls.expense_account = ChartOfAccounts.objects.create(account_code='5000', account_name='Expense', category=expense, created_by=cls.user)
        ChartOfAccounts.objects.create(account_code='5210', account_name='Bank Charges', category=expense, created_by=cls.user)

        today = timezone.now().date()
        FiscalPeriod.objects.create(
            name='Open Period',
            start_date=today - timedelta(days=10),
            end_date=today + timedelta(days=10),
            status='open',
            created_by=cls.user,
        )

    def test_invoice_to_journal_flow(self):
        customer = Customer.objects.create(legacy_id=10, name='Invoice Customer')
        invoice = SalesInvoice.objects.create(
            invoice_number='INV-100',
            customer=customer,
            invoice_date=timezone.now().date(),
            status='sent',
            net_total=Decimal('500.00'),
            subtotal=Decimal('500.00'),
            balance_due=Decimal('500.00'),
            amount_paid=Decimal('0'),
            created_by=self.user,
        )

        journal = JournalEntry.objects.get(
            source_type='sales_invoice',
            source_id=invoice.id,
            event_type='invoice_sent',
        )
        self.assertTrue(journal.is_posted)

    def test_invoice_payment_flow(self):
        customer = Customer.objects.create(legacy_id=11, name='Payment Customer')
        invoice = SalesInvoice.objects.create(
            invoice_number='INV-101',
            customer=customer,
            invoice_date=timezone.now().date(),
            status='sent',
            net_total=Decimal('200.00'),
            subtotal=Decimal('200.00'),
            balance_due=Decimal('200.00'),
            amount_paid=Decimal('0'),
            created_by=self.user,
        )
        payment = InvoicePayment.objects.create(
            invoice=invoice,
            payment_date=timezone.now(),
            amount=Decimal('200.00'),
            payment_method='bank_transfer',
            created_by=self.user,
        )

        journal = JournalEntry.objects.get(
            source_type='invoice_payment',
            source_id=payment.id,
            event_type='payment_received',
        )
        self.assertTrue(journal.is_posted)

    def test_supplier_bill_and_payment_flow(self):
        supplier = Supplier.objects.create(
            supplier_code='SUP-200',
            name='Stationery',
            created_by=self.user,
        )
        bill = SupplierBill.objects.create(
            internal_reference='BILL-200',
            bill_number='SUP-200',
            supplier=supplier,
            bill_date=timezone.now().date(),
            due_date=timezone.now().date() + timedelta(days=5),
            status='draft',
            subtotal=Decimal('300.00'),
            tax_amount=Decimal('0.00'),
            discount_amount=Decimal('0.00'),
            total=Decimal('300.00'),
            amount_paid=Decimal('0.00'),
            balance_due=Decimal('300.00'),
            created_by=self.user,
        )

        bill.approve(self.user)
        journal = JournalEntry.objects.get(
            source_type='supplier_bill',
            source_id=bill.id,
            event_type='bill_approved',
        )
        self.assertTrue(journal.is_posted)

        payment = bill.record_payment(
            amount=Decimal('100.00'),
            payment_method='cash',
            user=self.user,
            payment_date=timezone.now().date(),
        )

        payment_journal = JournalEntry.objects.get(
            source_type='bill_payment',
            source_id=payment.id,
            event_type='bill_payment_created',
        )
        self.assertTrue(payment_journal.is_posted)

    def test_bank_transaction_flow(self):
        transaction = BankTransaction.objects.create(
            transaction_date=timezone.now().date(),
            transaction_type='receipt',
            description='Bank receipt',
            bank_account=self.bank,
            contra_account=self.sales,
            amount=Decimal('250.00'),
            created_by=self.user,
        )
        transaction.approve(self.user)

        journal = JournalEntry.objects.get(
            source_type='bank_transaction',
            source_id=transaction.id,
            event_type='bank_txn_approved',
        )
        self.assertTrue(journal.is_posted)

    def test_reversal_restores_balances(self):
        journal = JournalEngine.create_journal_entry(
            entry_date=timezone.now().date(),
            source_type='manual',
            source_id=None,
            event_type='manual_entry',
            description='Balance test',
            lines_data=[
                {'account_code': '1000', 'debit': 60, 'credit': 0},
                {'account_code': '4000', 'debit': 0, 'credit': 60},
            ],
            created_by=self.user,
            auto_post=True,
        )

        cash_before = ChartOfAccounts.objects.get(account_code='1000').current_balance
        self.assertEqual(cash_before, Decimal('60.00'))

        journal.reverse(user=self.user)

        cash_after = ChartOfAccounts.objects.get(account_code='1000').current_balance
        self.assertEqual(cash_after, Decimal('0.00'))
