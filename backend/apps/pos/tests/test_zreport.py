from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from django.test.utils import override_settings
from rest_framework.test import APIRequestFactory

from apps.accounting.models import AccountCategory, ChartOfAccounts, FiscalPeriod, JournalEntry
from apps.pos.models import CashDrawerSession, POSLocation, POSTransaction, POSPayment
from apps.pos.serializers import CashDrawerSessionSerializer
from apps.pos.zreport_service import generate_zreport, post_zreport_journal


class POSZReportTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        cls.user = User.objects.create_user(email='posz@example.com', password='pass1234')

        asset = AccountCategory.objects.create(code='AS', name='Assets', account_type='debit_normal')
        liability = AccountCategory.objects.create(code='LI', name='Liabilities', account_type='credit_normal')
        income = AccountCategory.objects.create(code='IN', name='Income', account_type='credit_normal')

        ChartOfAccounts.objects.create(account_code='1000', account_name='Cash', category=asset, created_by=cls.user)
        ChartOfAccounts.objects.create(account_code='1010', account_name='Bank', category=asset, created_by=cls.user)
        ChartOfAccounts.objects.create(account_code='1110', account_name='AR POS', category=asset, created_by=cls.user)
        ChartOfAccounts.objects.create(account_code='2400', account_name='VAT Payable', category=liability, created_by=cls.user)
        ChartOfAccounts.objects.create(account_code='4100', account_name='Sales POS', category=income, created_by=cls.user)

        today = timezone.now().date()
        FiscalPeriod.objects.create(
            name='POS Test Period',
            start_date=today - timedelta(days=5),
            end_date=today + timedelta(days=5),
            status='open',
            created_by=cls.user,
        )

    def _create_session_with_transactions(self):
        location = POSLocation.objects.create(name='Main', code='MAIN', address='HQ')
        session = CashDrawerSession.objects.create(
            session_number='CD-MAIN-20260401-001',
            user=self.user,
            location=location,
            opening_balance=Decimal('0.00'),
            expected_balance=Decimal('0.00'),
            status='open',
        )

        tx1 = POSTransaction.objects.create(
            receipt_number='MAIN-20260401-0001',
            cash_drawer_session=session,
            location=location,
            subtotal=Decimal('100.00'),
            tax_amount=Decimal('18.00'),
            discount_amount=Decimal('10.00'),
            total=Decimal('108.00'),
            status='completed',
            created_by=self.user,
        )
        tx2 = POSTransaction.objects.create(
            receipt_number='MAIN-20260401-0002',
            cash_drawer_session=session,
            location=location,
            subtotal=Decimal('50.00'),
            tax_amount=Decimal('9.00'),
            discount_amount=Decimal('0.00'),
            total=Decimal('59.00'),
            status='completed',
            created_by=self.user,
        )

        POSPayment.objects.create(transaction=tx1, payment_method='cash', amount=Decimal('100.00'), created_by=self.user)
        POSPayment.objects.create(transaction=tx1, payment_method='card', amount=Decimal('8.00'), created_by=self.user)
        POSPayment.objects.create(transaction=tx2, payment_method='card', amount=Decimal('42.00'), created_by=self.user)
        POSPayment.objects.create(transaction=tx2, payment_method='account', amount=Decimal('17.00'), created_by=self.user)

        return session

    def test_zreport_created_on_session_close(self):
        session = self._create_session_with_transactions()
        factory = APIRequestFactory()
        request = factory.patch('/api/pos/cash-drawer-sessions/')
        request.user = self.user

        serializer = CashDrawerSessionSerializer(
            instance=session,
            data={'status': 'closed', 'actual_balance': '167.00'},
            partial=True,
            context={'request': request},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()

        session.refresh_from_db()
        self.assertIsNotNone(session.z_report)

    def test_zreport_totals_match(self):
        session = self._create_session_with_transactions()
        session.close_session(actual_balance=Decimal('167.00'))

        zreport = generate_zreport(session)
        self.assertEqual(zreport.gross_sales, Decimal('177.00'))
        self.assertEqual(zreport.discounts_total, Decimal('10.00'))
        self.assertEqual(zreport.net_sales, Decimal('167.00'))
        self.assertEqual(zreport.cash_total, Decimal('100.00'))
        self.assertEqual(zreport.card_total, Decimal('50.00'))
        self.assertEqual(zreport.on_account_total, Decimal('17.00'))

        expected_vat = zreport.net_sales - (zreport.net_sales / (Decimal('1') + Decimal('0.18')))
        expected_vat = expected_vat.quantize(Decimal('0.01'))
        self.assertEqual(zreport.vat_amount, expected_vat)

    def test_journal_created_once(self):
        session = self._create_session_with_transactions()
        session.close_session(actual_balance=Decimal('167.00'))

        zreport = generate_zreport(session)
        journal_first = post_zreport_journal(zreport, created_by=self.user)
        journal_second = post_zreport_journal(zreport, created_by=self.user)

        self.assertIsNotNone(journal_first)
        self.assertEqual(journal_first.id, journal_second.id)
        self.assertEqual(JournalEntry.objects.filter(source_type='pos_zreport', source_id=zreport.id).count(), 1)

    @override_settings(VAT_GO_LIVE_DATE='2099-01-01')
    def test_journal_not_created_before_go_live(self):
        session = self._create_session_with_transactions()
        session.close_session(actual_balance=Decimal('167.00'))

        zreport = generate_zreport(session)
        journal = post_zreport_journal(zreport, created_by=self.user)

        self.assertIsNone(journal)
        self.assertIsNone(zreport.journal_entry_id)

    def test_journal_lines_map_correctly(self):
        session = self._create_session_with_transactions()
        session.close_session(actual_balance=Decimal('167.00'))

        zreport = generate_zreport(session)
        journal = post_zreport_journal(zreport, created_by=self.user)

        self.assertEqual(journal.total_debit, journal.total_credit)

        debit_lines = {line.account.account_code: line.debit for line in journal.lines.all() if line.debit > 0}
        credit_lines = {line.account.account_code: line.credit for line in journal.lines.all() if line.credit > 0}

        self.assertEqual(debit_lines.get('1000'), zreport.cash_total)
        self.assertEqual(debit_lines.get('1010'), zreport.card_total)
        self.assertEqual(debit_lines.get('1110'), zreport.on_account_total)

        net_sales_ex_vat = zreport.net_sales - zreport.vat_amount
        self.assertEqual(credit_lines.get('4100'), net_sales_ex_vat)
        self.assertEqual(credit_lines.get('2400'), zreport.vat_amount)
