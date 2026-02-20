from __future__ import annotations

import threading
import unittest

from decimal import Decimal
from django.contrib.auth import get_user_model
from django.db import connection, close_old_connections
from django.test import TransactionTestCase
from django.utils import timezone

from apps.accounting.models import (
    AccountCategory,
    AccountingAccountMapping,
    ChartOfAccounts,
    FiscalPeriod,
    JournalEntry,
    BankTransaction,
)
from apps.customers.models import Customer
from apps.sales.invoices.models import SalesInvoice


@unittest.skipIf(
    connection.vendor == 'sqlite',
    "Concurrency tests require a DB that supports row-level locks (not sqlite).",
)
class ConcurrencyTests(TransactionTestCase):
    reset_sequences = True

    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        cls.user = User.objects.create_user(email='concurrency@example.com', password='pass1234')

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
            name='Concurrency Period',
            start_date=today.replace(day=1),
            end_date=today.replace(day=28),
            status='open',
            created_by=cls.user,
        )

    def test_concurrent_proforma_conversion_one_winner(self):
        customer = Customer.objects.create(legacy_id=555, name='Concurrent Customer')
        invoice = SalesInvoice.objects.create(
            invoice_number='PRO-CONC-001',
            customer=customer,
            invoice_date=timezone.now().date(),
            status='sent',
            invoice_type='proforma',
            vat_rate=Decimal('0.18'),
            subtotal=Decimal('100.00'),
            tax_amount=Decimal('18.00'),
            net_total=Decimal('118.00'),
            amount_paid=Decimal('118.00'),
            created_by=self.user,
        )
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

        barrier = threading.Barrier(2)
        errors = [None, None]

        def worker(ix: int):
            close_old_connections()
            try:
                barrier.wait()
                inv = SalesInvoice.objects.get(pk=invoice.pk)
                inv.convert_proforma_to_tax_invoice(user=self.user)
            except Exception as e:
                errors[ix] = e
            finally:
                close_old_connections()

        t1 = threading.Thread(target=worker, args=(0,))
        t2 = threading.Thread(target=worker, args=(1,))
        t1.start()
        t2.start()
        t1.join()
        t2.join()

        if errors[0] or errors[1]:
            raise errors[0] or errors[1]

        invoice.refresh_from_db()
        self.assertEqual(invoice.invoice_type, 'tax_invoice')

        count = JournalEntry.objects.filter(
            source_type='sales_invoice',
            source_id=invoice.id,
            event_type='tax_invoice_created',
        ).count()
        self.assertEqual(count, 1)

    def test_concurrent_bank_approve_one_winner(self):
        bank_account = ChartOfAccounts.objects.get(account_code='1010')
        contra = ChartOfAccounts.objects.get(account_code='1000')

        txn = BankTransaction.objects.create(
            transaction_date=timezone.now().date(),
            transaction_type='deposit',
            amount=Decimal('50.00'),
            description='Concurrent bank post',
            reference_number='REF-1',
            status='pending',
            bank_account=bank_account,
            contra_account=contra,
            created_by=self.user,
        )

        barrier = threading.Barrier(2)
        errors = [None, None]

        def worker(ix: int):
            close_old_connections()
            try:
                barrier.wait()
                tx = BankTransaction.objects.get(pk=txn.pk)
                tx.approve(self.user)
            except Exception as e:
                errors[ix] = e
            finally:
                close_old_connections()

        t1 = threading.Thread(target=worker, args=(0,))
        t2 = threading.Thread(target=worker, args=(1,))
        t1.start()
        t2.start()
        t1.join()
        t2.join()

        if errors[0] or errors[1]:
            raise errors[0] or errors[1]

        txn.refresh_from_db()
        self.assertEqual(txn.status, 'posted')
        self.assertIsNotNone(txn.journal_entry_id)

        count = JournalEntry.objects.filter(
            source_type='bank_transaction',
            source_id=txn.id,
            event_type='bank_txn_approved',
        ).count()
        self.assertEqual(count, 1)
