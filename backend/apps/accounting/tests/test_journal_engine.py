from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from apps.accounting.models import AccountCategory, ChartOfAccounts, FiscalPeriod, JournalEntry, AccountingAccountMapping
from apps.accounting.services.journal_engine import JournalEngine
from apps.customers.models import Customer
from apps.sales.invoices.models import SalesInvoice, InvoicePayment
from apps.suppliers.models import Supplier
from apps.purchases.models import SupplierBill, BillPayment
from apps.sales.orders.models import SalesOrder, OrderPayment
from unittest.mock import patch


class JournalEngineTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        cls.user = User.objects.create_user(email='journal@example.com', password='pass1234')

        asset = AccountCategory.objects.create(code='AS', name='Assets', account_type='debit_normal')
        liability = AccountCategory.objects.create(code='LI', name='Liabilities', account_type='credit_normal')
        income = AccountCategory.objects.create(code='IN', name='Income', account_type='credit_normal')
        expense = AccountCategory.objects.create(code='EX', name='Expense', account_type='debit_normal')

        cash = ChartOfAccounts.objects.create(account_code='1000', account_name='Cash', category=asset, created_by=cls.user)
        bank = ChartOfAccounts.objects.create(account_code='1010', account_name='Bank', category=asset, created_by=cls.user)
        ar = ChartOfAccounts.objects.create(account_code='1100', account_name='AR', category=asset, created_by=cls.user)
        cheques_received = ChartOfAccounts.objects.create(account_code='1040', account_name='Cheques Received', category=asset, created_by=cls.user)

        ap = ChartOfAccounts.objects.create(account_code='2000', account_name='AP', category=liability, created_by=cls.user)
        customer_advances = ChartOfAccounts.objects.create(account_code='2100', account_name='Customer Advances', category=liability, created_by=cls.user)
        cheques_pending = ChartOfAccounts.objects.create(account_code='2200', account_name='Cheques Pending', category=liability, created_by=cls.user)
        vat_payable = ChartOfAccounts.objects.create(account_code='2400', account_name='VAT Payable', category=liability, created_by=cls.user)

        sales = ChartOfAccounts.objects.create(account_code='4000', account_name='Sales', category=income, created_by=cls.user)
        expense_acct = ChartOfAccounts.objects.create(account_code='5000', account_name='Expense', category=expense, created_by=cls.user)

        AccountingAccountMapping.objects.create(key='cash', account=cash, is_active=True)
        AccountingAccountMapping.objects.create(key='bank', account=bank, is_active=True)
        AccountingAccountMapping.objects.create(key='ar', account=ar, is_active=True)
        AccountingAccountMapping.objects.create(key='ap', account=ap, is_active=True)
        AccountingAccountMapping.objects.create(key='sales', account=sales, is_active=True)
        AccountingAccountMapping.objects.create(key='expense', account=expense_acct, is_active=True)
        AccountingAccountMapping.objects.create(key='customer_advances', account=customer_advances, is_active=True)
        AccountingAccountMapping.objects.create(key='vat_payable', account=vat_payable, is_active=True)
        AccountingAccountMapping.objects.create(key='cheques_received', account=cheques_received, is_active=True)
        AccountingAccountMapping.objects.create(key='cheques_pending', account=cheques_pending, is_active=True)

        today = timezone.now().date()
        FiscalPeriod.objects.create(
            name='Test Period',
            start_date=today - timedelta(days=5),
            end_date=today + timedelta(days=5),
            status='open',
            created_by=cls.user,
        )

    def test_invoice_created_balanced(self):
        customer = Customer.objects.create(legacy_id=1, name='ACME')
        invoice = SalesInvoice.objects.create(
            invoice_number='INV-001',
            customer=customer,
            invoice_date=timezone.now().date(),
            status='sent',
            net_total=Decimal('150.00'),
            subtotal=Decimal('150.00'),
            balance_due=Decimal('150.00'),
            amount_paid=Decimal('0'),
            created_by=self.user,
        )

        journal = JournalEngine.handle_invoice_created(invoice)
        self.assertEqual(journal.total_debit, journal.total_credit)
        self.assertEqual(journal.event_type, 'invoice_sent')

    def test_invoice_payment_cash_account(self):
        customer = Customer.objects.create(legacy_id=2, name='Beta')
        invoice = SalesInvoice.objects.create(
            invoice_number='INV-002',
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
            payment_method='cash',
            created_by=self.user,
        )

        journal = JournalEngine.handle_invoice_payment(payment)
        debit_accounts = {line.account.account_code for line in journal.lines.all() if line.debit > 0}
        self.assertIn('1000', debit_accounts)

    def test_bill_payment_cheque_pending(self):
        supplier = Supplier.objects.create(
            supplier_code='SUP-001',
            name='Paper Co',
            created_by=self.user,
        )
        bill = SupplierBill.objects.create(
            internal_reference='BILL-001',
            bill_number='SUP-INV-001',
            supplier=supplier,
            bill_date=timezone.now().date(),
            due_date=timezone.now().date(),
            status='approved',
            subtotal=Decimal('100.00'),
            tax_amount=Decimal('0.00'),
            discount_amount=Decimal('0.00'),
            total=Decimal('100.00'),
            amount_paid=Decimal('0.00'),
            balance_due=Decimal('100.00'),
            created_by=self.user,
        )
        payment = BillPayment.objects.create(
            bill=bill,
            payment_date=timezone.now().date(),
            amount=Decimal('50.00'),
            payment_method='cheque',
            cheque_number='CHQ-001',
            cheque_cleared=False,
            created_by=self.user,
        )

        journal = JournalEngine.handle_bill_payment(payment)
        credit_accounts = {line.account.account_code for line in journal.lines.all() if line.credit > 0}
        self.assertIn('2200', credit_accounts)

    def test_reversal_swaps_lines(self):
        journal = JournalEngine.create_journal_entry(
            entry_date=timezone.now().date(),
            source_type='manual',
            source_id=None,
            event_type='manual_entry',
            description='Reversal test',
            lines_data=[
                {'account_code': '1000', 'debit': 80, 'credit': 0},
                {'account_code': '4000', 'debit': 0, 'credit': 80},
            ],
            created_by=self.user,
            auto_post=True,
        )

        reversal = journal.reverse(user=self.user)
        self.assertEqual(reversal.total_debit, reversal.total_credit)
        debit_accounts = {line.account.account_code for line in reversal.lines.all() if line.debit > 0}
        self.assertIn('4000', debit_accounts)

    def test_idempotency_per_event_type(self):
        customer = Customer.objects.create(legacy_id=3, name='Gamma')
        invoice = SalesInvoice.objects.create(
            invoice_number='INV-003',
            customer=customer,
            invoice_date=timezone.now().date(),
            status='sent',
            net_total=Decimal('75.00'),
            subtotal=Decimal('75.00'),
            balance_due=Decimal('75.00'),
            amount_paid=Decimal('0'),
            created_by=self.user,
        )

        JournalEngine.handle_invoice_created(invoice)
        JournalEngine.handle_invoice_created(invoice)

        count = JournalEntry.objects.filter(
            source_type='sales_invoice',
            source_id=invoice.id,
            event_type='invoice_sent',
        ).count()
        self.assertEqual(count, 1)

    def test_journal_number_retry_on_conflict(self):
        existing = JournalEngine.create_journal_entry(
            entry_date=timezone.now().date(),
            source_type='manual',
            source_id=None,
            event_type='manual_entry',
            description='Existing',
            lines_data=[
                {'account_code': '1000', 'debit': 10, 'credit': 0},
                {'account_code': '4000', 'debit': 0, 'credit': 10},
            ],
            created_by=self.user,
            auto_post=False,
        )

        with patch(
            'apps.accounting.services.journal_engine.JournalEngine.generate_journal_number',
            side_effect=[existing.journal_number, 'JE-TEST-RETRY-0002'],
        ):
            journal = JournalEngine.create_journal_entry(
                entry_date=timezone.now().date(),
                source_type='manual',
                source_id=None,
                event_type='manual_entry',
                description='Retry entry',
                lines_data=[
                    {'account_code': '1000', 'debit': 20, 'credit': 0},
                    {'account_code': '4000', 'debit': 0, 'credit': 20},
                ],
                created_by=self.user,
                auto_post=False,
            )

        self.assertEqual(journal.journal_number, 'JE-TEST-RETRY-0002')

    def test_entry_blocked_in_closed_period(self):
        FiscalPeriod.objects.update(status='closed')

        with self.assertRaises(Exception):
            JournalEngine.create_journal_entry(
                entry_date=timezone.now().date(),
                source_type='manual',
                source_id=None,
                event_type='manual_entry',
                description='Closed period test',
                lines_data=[
                    {'account_code': '1000', 'debit': 10, 'credit': 0},
                    {'account_code': '4000', 'debit': 0, 'credit': 10},
                ],
                created_by=self.user,
                auto_post=False,
            )

    def test_order_advance_payment_vat_split(self):
        order = SalesOrder.objects.create(
            order_number='ORD-001',
            net_total=Decimal('0.00'),
            created_by=self.user,
        )
        payment = OrderPayment.objects.create(
            order=order,
            payment_date=timezone.now(),
            amount=Decimal('118.00'),
            payment_method='cash',
            created_by=self.user,
        )

        journal = JournalEngine.handle_order_advance_payment(payment, vat_rate=Decimal('0.18'))
        lines = {(line.account.account_code, str(line.debit), str(line.credit)) for line in journal.lines.all()}

        # DR 1000 118.00, CR 2100 100.00, CR 2400 18.00
        self.assertIn(('1000', '118.00', '0.00'), lines)
        self.assertIn(('2100', '0.00', '100.00'), lines)
        self.assertIn(('2400', '0.00', '18.00'), lines)

    def test_proforma_advance_payment_vat_split(self):
        customer = Customer.objects.create(legacy_id=99, name='VAT Customer')
        invoice = SalesInvoice.objects.create(
            invoice_number='PRO-001',
            customer=customer,
            invoice_date=timezone.now().date(),
            status='sent',
            invoice_type='proforma',
            net_total=Decimal('0.00'),
            subtotal=Decimal('0.00'),
            balance_due=Decimal('0.00'),
            amount_paid=Decimal('0.00'),
            created_by=self.user,
        )
        payment = InvoicePayment.objects.create(
            invoice=invoice,
            payment_date=timezone.now(),
            amount=Decimal('118.00'),
            payment_method='cash',
            created_by=self.user,
        )

        journal = JournalEngine.handle_proforma_advance_payment(payment, vat_rate=Decimal('0.18'))
        lines = {(line.account.account_code, str(line.debit), str(line.credit)) for line in journal.lines.all()}
        self.assertIn(('1000', '118.00', '0.00'), lines)
        self.assertIn(('2100', '0.00', '100.00'), lines)
        self.assertIn(('2400', '0.00', '18.00'), lines)

    def test_tax_invoice_created_applies_advances_and_vat(self):
        customer = Customer.objects.create(legacy_id=100, name='Tax Customer')
        invoice = SalesInvoice.objects.create(
            invoice_number='TAX-001',
            customer=customer,
            invoice_date=timezone.now().date(),
            status='sent',
            invoice_type='tax_invoice',
            vat_rate=Decimal('0.18'),
            subtotal=Decimal('100.00'),
            tax_amount=Decimal('18.00'),
            net_total=Decimal('118.00'),
            amount_paid=Decimal('118.00'),
            advances_applied=Decimal('118.00'),
            created_by=self.user,
        )
        # Ensure at least one item, otherwise journal lines would be incomplete/unbalanced.
        invoice.items.create(
            item_name='Taxable Item',
            description='',
            quantity=Decimal('1.00'),
            unit_price=Decimal('100.00'),
            amount=Decimal('100.00'),
            is_vat_exempt=False,
            tax_rate=Decimal('0.18'),
            tax_amount=Decimal('18.00'),
        )

        journal = JournalEngine.handle_tax_invoice_created(invoice)
        debit_by_code = {line.account.account_code: line.debit for line in journal.lines.all()}
        credit_by_code = {line.account.account_code: line.credit for line in journal.lines.all()}

        # Fully covered by advance: no AR line, VAT already recorded on advance, so remaining VAT is 0.
        self.assertEqual(debit_by_code.get('2100'), Decimal('100.00'))
        self.assertEqual(credit_by_code.get('4000'), Decimal('100.00'))
        self.assertNotIn('1100', debit_by_code)  # No AR
        self.assertNotIn('2400', credit_by_code)  # Remaining VAT is 0
