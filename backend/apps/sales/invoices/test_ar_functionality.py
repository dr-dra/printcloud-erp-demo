"""
Test suite for AR (Accounts Receivable) functionality.

Tests cover:
- Invoice payment journal creation
- Cheque handling and clearance
- Overpayments and customer advances
- Payment allocation
- Void payments with reversal
"""

from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from django.db import transaction
from decimal import Decimal
from datetime import datetime, timedelta, date

from apps.sales.invoices.models import (
    SalesInvoice, InvoicePayment, CustomerAdvance, PaymentAllocation
)
from apps.customers.models import Customer
from apps.accounting.models import JournalEntry, ChartOfAccounts, AccountCategory
from apps.users.models import User


class PaymentJournalCreationTest(TransactionTestCase):
    """Test invoice payment journal creation."""

    def setUp(self):
        """Create test data."""
        # Create user
        self.user = User.objects.create_user(
            email='test@example.com',
            password='testpass123'
        )

        # Create customer
        self.customer = Customer.objects.create(
            legacy_id=1001,
            name='Test Customer',
            email='customer@example.com'
        )

        # Create invoice
        self.invoice = SalesInvoice.objects.create(
            invoice_number='INV-2026-0001',
            customer=self.customer,
            net_total=Decimal('1000.00'),
            amount_paid=Decimal('0.00'),
            status='sent',
            created_by=self.user
        )

    def test_payment_creates_journal_entry(self):
        """Test that creating a payment creates a journal entry."""
        payment = InvoicePayment.objects.create(
            invoice=self.invoice,
            payment_date=timezone.now(),
            amount=Decimal('1000.00'),
            payment_method='bank_transfer',
            created_by=self.user
        )

        # Journal entry should be created by signal
        self.assertIsNotNone(payment.journal_entry)
        self.assertEqual(payment.journal_entry.source_id, payment.id)
        self.assertEqual(payment.journal_entry.event_type, 'payment_received')

    def test_payment_journal_has_two_lines(self):
        """Test that payment journal has debit and credit lines."""
        payment = InvoicePayment.objects.create(
            invoice=self.invoice,
            payment_date=timezone.now(),
            amount=Decimal('1000.00'),
            payment_method='bank_transfer',
            created_by=self.user
        )

        lines = payment.journal_entry.journal_lines.all()
        self.assertEqual(lines.count(), 2)

        # Check debit line (Bank account)
        debit_line = lines.get(debit__gt=0)
        self.assertEqual(debit_line.debit, Decimal('1000.00'))
        self.assertEqual(debit_line.credit, Decimal('0.00'))

        # Check credit line (AR account)
        credit_line = lines.get(credit__gt=0)
        self.assertEqual(credit_line.credit, Decimal('1000.00'))
        self.assertEqual(credit_line.debit, Decimal('0.00'))

    def test_cash_payment_uses_correct_account(self):
        """Test that cash payments use account 1000."""
        payment = InvoicePayment.objects.create(
            invoice=self.invoice,
            payment_date=timezone.now(),
            amount=Decimal('1000.00'),
            payment_method='cash',
            created_by=self.user
        )

        debit_line = payment.journal_entry.journal_lines.get(debit__gt=0)
        self.assertEqual(debit_line.account.account_code, '1000')

    def test_bank_payment_uses_correct_account(self):
        """Test that bank payments use account 1010."""
        payment = InvoicePayment.objects.create(
            invoice=self.invoice,
            payment_date=timezone.now(),
            amount=Decimal('1000.00'),
            payment_method='bank_transfer',
            created_by=self.user
        )

        debit_line = payment.journal_entry.journal_lines.get(debit__gt=0)
        self.assertEqual(debit_line.account.account_code, '1010')

    def test_cheque_payment_uncleared_uses_account_1040(self):
        """Test that uncleared cheques use account 1040."""
        payment = InvoicePayment.objects.create(
            invoice=self.invoice,
            payment_date=timezone.now(),
            amount=Decimal('1000.00'),
            payment_method='cheque',
            cheque_number='CHQ001',
            cheque_date=date.today(),
            created_by=self.user
        )

        debit_line = payment.journal_entry.journal_lines.get(debit__gt=0)
        self.assertEqual(debit_line.account.account_code, '1040')

    def test_payment_before_go_live_date_skipped(self):
        """Test that payments before go-live date don't create journals."""
        from django.conf import settings
        from datetime import datetime as dt

        # Set go-live date to today
        go_live_date = datetime.strptime(settings.ACCOUNTING_GO_LIVE_DATE, '%Y-%m-%d').date()

        # Create payment before go-live date
        old_date = go_live_date - timedelta(days=10)
        old_payment_date = timezone.make_aware(
            dt.combine(old_date, dt.min.time())
        )

        payment = InvoicePayment.objects.create(
            invoice=self.invoice,
            payment_date=old_payment_date,
            amount=Decimal('1000.00'),
            payment_method='cash',
            created_by=self.user
        )

        # Journal should not be created
        self.assertIsNone(payment.journal_entry)

    def test_duplicate_payment_creates_single_journal(self):
        """Test that duplicate payment signals don't create multiple journals."""
        # Create payment
        payment = InvoicePayment.objects.create(
            invoice=self.invoice,
            payment_date=timezone.now(),
            amount=Decimal('1000.00'),
            payment_method='cash',
            created_by=self.user
        )

        first_journal = payment.journal_entry
        initial_count = JournalEntry.objects.filter(
            source_type='invoice_payment',
            source_id=payment.id
        ).count()

        # Manually trigger signal again (simulating retry)
        from apps.accounting.services.journal_engine import JournalEngine
        journal = JournalEngine.handle_invoice_payment(payment)

        # Should get the existing journal (idempotent)
        final_count = JournalEntry.objects.filter(
            source_type='invoice_payment',
            source_id=payment.id
        ).count()

        self.assertEqual(initial_count, final_count)


class OverpaymentHandlingTest(TransactionTestCase):
    """Test overpayment handling and customer advances."""

    def setUp(self):
        """Create test data."""
        self.user = User.objects.create_user(
            email='test@example.com',
            password='testpass123'
        )

        self.customer = Customer.objects.create(
            legacy_id=1001,
            name='Test Customer',
            email='customer@example.com'
        )

        self.invoice = SalesInvoice.objects.create(
            invoice_number='INV-2026-0001',
            customer=self.customer,
            net_total=Decimal('1000.00'),
            amount_paid=Decimal('0.00'),
            status='sent',
            created_by=self.user
        )

    def test_overpayment_creates_customer_advance(self):
        """Test that overpayment creates a customer advance."""
        payment = InvoicePayment.objects.create(
            invoice=self.invoice,
            payment_date=timezone.now(),
            amount=Decimal('1500.00'),  # More than invoice balance
            payment_method='cash',
            created_by=self.user
        )

        # Check customer advance was created
        advance = CustomerAdvance.objects.filter(source_payment=payment).first()
        self.assertIsNotNone(advance)
        self.assertEqual(advance.amount, Decimal('500.00'))  # Overpayment amount
        self.assertEqual(advance.balance, Decimal('500.00'))
        self.assertEqual(advance.source_type, 'overpayment')

    def test_overpayment_journal_has_three_lines(self):
        """Test overpayment journal splits credits between AR and advances."""
        payment = InvoicePayment.objects.create(
            invoice=self.invoice,
            payment_date=timezone.now(),
            amount=Decimal('1500.00'),
            payment_method='cash',
            created_by=self.user
        )

        lines = payment.journal_entry.journal_lines.all()
        self.assertEqual(lines.count(), 3)

        # Check totals balance
        total_debit = sum(line.debit for line in lines)
        total_credit = sum(line.credit for line in lines)
        self.assertEqual(total_debit, total_credit)
        self.assertEqual(total_debit, Decimal('1500.00'))

    def test_overpayment_journals_advances(self):
        """Test that overpayment is recorded in journal and advance."""
        payment = InvoicePayment.objects.create(
            invoice=self.invoice,
            payment_date=timezone.now(),
            amount=Decimal('1500.00'),
            payment_method='cash',
            created_by=self.user
        )

        # Check journal links to advance
        advance = CustomerAdvance.objects.filter(source_payment=payment).first()
        self.assertIsNotNone(advance.journal_entry)
        self.assertEqual(advance.journal_entry, payment.journal_entry)


class ChequeHandlingTest(TransactionTestCase):
    """Test cheque payment and clearance."""

    def setUp(self):
        """Create test data."""
        self.user = User.objects.create_user(
            email='test@example.com',
            password='testpass123'
        )

        self.customer = Customer.objects.create(
            legacy_id=1001,
            name='Test Customer',
            email='customer@example.com'
        )

        self.invoice = SalesInvoice.objects.create(
            invoice_number='INV-2026-0001',
            customer=self.customer,
            net_total=Decimal('1000.00'),
            amount_paid=Decimal('0.00'),
            status='sent',
            created_by=self.user
        )

    def test_cheque_clearance_creates_second_journal(self):
        """Test that clearing a cheque creates a second journal entry."""
        payment = InvoicePayment.objects.create(
            invoice=self.invoice,
            payment_date=timezone.now(),
            amount=Decimal('1000.00'),
            payment_method='cheque',
            cheque_number='CHQ001',
            cheque_date=date.today(),
            created_by=self.user
        )

        # Should have first journal
        self.assertIsNotNone(payment.journal_entry)
        first_journal_id = payment.journal_entry.id

        # Clear cheque
        payment.cheque_cleared = True
        payment.cheque_cleared_date = date.today()
        payment.save(update_fields=['cheque_cleared', 'cheque_cleared_date'])

        # Should have second journal
        payment.refresh_from_db()
        self.assertIsNotNone(payment.cheque_clearance_journal_entry)
        self.assertNotEqual(
            payment.cheque_clearance_journal_entry.id,
            first_journal_id
        )

    def test_cheque_clearance_moves_from_1040_to_1010(self):
        """Test cheque clearance journal moves from account 1040 to 1010."""
        payment = InvoicePayment.objects.create(
            invoice=self.invoice,
            payment_date=timezone.now(),
            amount=Decimal('1000.00'),
            payment_method='cheque',
            cheque_number='CHQ001',
            cheque_date=date.today(),
            created_by=self.user
        )

        # Clear cheque
        payment.cheque_cleared = True
        payment.cheque_cleared_date = date.today()
        payment.save(update_fields=['cheque_cleared', 'cheque_cleared_date'])

        # Check clearance journal has correct accounts
        lines = payment.cheque_clearance_journal_entry.journal_lines.all()
        debit_line = lines.get(debit__gt=0)
        credit_line = lines.get(credit__gt=0)

        self.assertEqual(debit_line.account.account_code, '1010')  # Bank
        self.assertEqual(credit_line.account.account_code, '1040')  # Cheques


class VoidPaymentTest(TransactionTestCase):
    """Test void payment functionality."""

    def setUp(self):
        """Create test data."""
        self.user = User.objects.create_user(
            email='test@example.com',
            password='testpass123'
        )

        self.customer = Customer.objects.create(
            legacy_id=1001,
            name='Test Customer',
            email='customer@example.com'
        )

        self.invoice = SalesInvoice.objects.create(
            invoice_number='INV-2026-0001',
            customer=self.customer,
            net_total=Decimal('1000.00'),
            amount_paid=Decimal('0.00'),
            status='sent',
            created_by=self.user
        )

    def test_void_payment_marks_as_void(self):
        """Test that void payment marks payment as void."""
        from apps.sales.invoices.views import VoidPaymentView
        from rest_framework.test import APIRequestFactory

        payment = InvoicePayment.objects.create(
            invoice=self.invoice,
            payment_date=timezone.now(),
            amount=Decimal('1000.00'),
            payment_method='cash',
            created_by=self.user
        )

        # Void the payment via API
        factory = APIRequestFactory()
        request = factory.post(f'/invoices/payments/{payment.id}/void/', {'reason': 'Test void'})
        request.user = self.user

        view = VoidPaymentView.as_view()
        response = view(request, pk=payment.id)

        # Check payment is marked void
        payment.refresh_from_db()
        self.assertTrue(payment.is_void)
        self.assertIsNotNone(payment.voided_at)
        self.assertEqual(payment.void_reason, 'Test void')


class PaymentRecordingAPITest(TransactionTestCase):
    """Test payment recording via API endpoint with auto-mapping."""

    def setUp(self):
        """Create test data."""
        from rest_framework.test import APIClient
        from rest_framework_simplejwt.tokens import RefreshToken

        self.client = APIClient()

        # Create user
        self.user = User.objects.create_user(
            email='test@example.com',
            password='testpass123'
        )

        # Setup JWT token
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')

        # Create account categories
        asset_category, _ = AccountCategory.objects.get_or_create(
            name='Assets',
            defaults={
                'code': 'ASSET',
                'account_type': 'debit_normal'
            }
        )

        # Create necessary chart of accounts
        self.account_1000, _ = ChartOfAccounts.objects.get_or_create(
            account_code='1000',
            defaults={
                'account_name': 'Cash in Hand',
                'category': asset_category,
                'created_by': self.user,
                'is_active': True
            }
        )
        self.account_1010, _ = ChartOfAccounts.objects.get_or_create(
            account_code='1010',
            defaults={
                'account_name': 'Bank',
                'category': asset_category,
                'created_by': self.user,
                'is_active': True
            }
        )
        self.account_1040, _ = ChartOfAccounts.objects.get_or_create(
            account_code='1040',
            defaults={
                'account_name': 'Cheques Received',
                'category': asset_category,
                'created_by': self.user,
                'is_active': True
            }
        )
        self.account_1100, _ = ChartOfAccounts.objects.get_or_create(
            account_code='1100',
            defaults={
                'account_name': 'Accounts Receivable',
                'category': asset_category,
                'created_by': self.user,
                'is_active': True
            }
        )

        # Create customer
        self.customer = Customer.objects.create(
            legacy_id=1001,
            name='Test Customer',
            email='customer@example.com'
        )

        # Create invoice
        self.invoice = SalesInvoice.objects.create(
            invoice_number='INV-2026-0001',
            customer=self.customer,
            net_total=Decimal('1000.00'),
            amount_paid=Decimal('0.00'),
            status='sent',
            created_by=self.user
        )

    def test_record_cash_payment_auto_maps_to_account_1000(self):
        """Test cash payment auto-maps to account 1000."""
        payload = {
            'amount': '500.00',
            'payment_method': 'cash',
            'payment_date': timezone.now().isoformat(),
        }

        response = self.client.post(
            f'/api/sales/invoices/{self.invoice.id}/record-payment/',
            payload,
            format='json'
        )

        if response.status_code != 201:
            print(f"\n[DEBUG] Cash payment failed with status {response.status_code}")
            print(f"[DEBUG] Response: {response.data}")

        self.assertEqual(response.status_code, 201)

        # View returns invoice detail, payment is in response.data['payments'][0]
        self.assertIn('payments', response.data)
        payment_data = response.data['payments'][0]

        payment = InvoicePayment.objects.get(id=payment_data['id'])
        self.assertEqual(payment.deposit_account.account_code, '1000')
        self.assertEqual(payment.payment_method, 'cash')

    def test_record_bank_transfer_with_reference_auto_maps_to_account_1010(self):
        """Test bank transfer payment with reference auto-maps to account 1010."""
        payload = {
            'amount': '500.00',
            'payment_method': 'bank_transfer',
            'payment_date': timezone.now().isoformat(),
            'reference_number': 'TXN123456',
            'bank_account_id': str(self.account_1010.id),  # Use actual account ID
        }

        response = self.client.post(
            f'/api/sales/invoices/{self.invoice.id}/record-payment/',
            payload,
            format='json'
        )

        self.assertEqual(response.status_code, 201)

        # View returns invoice detail, payment is in response.data['payments'][0]
        self.assertIn('payments', response.data)
        payment_data = response.data['payments'][0]
        self.assertEqual(payment_data['payment_method'], 'bank_transfer')
        self.assertEqual(payment_data['reference_number'], 'TXN123456')

        # Verify payment was created in DB
        payment = InvoicePayment.objects.get(id=payment_data['id'])
        self.assertEqual(payment.deposit_account.account_code, '1010')
        self.assertEqual(payment.reference_number, 'TXN123456')

    def test_record_card_payment_with_reference_auto_maps_to_account_1010(self):
        """Test card payment with reference auto-maps to account 1010."""
        payload = {
            'amount': '500.00',
            'payment_method': 'card',
            'payment_date': timezone.now().isoformat(),
            'reference_number': 'AUTH789',
            'bank_account_id': str(self.account_1010.id),
        }

        response = self.client.post(
            f'/api/sales/invoices/{self.invoice.id}/record-payment/',
            payload,
            format='json'
        )

        self.assertEqual(response.status_code, 201)
        payment = InvoicePayment.objects.get(id=response.data['id'])
        self.assertEqual(payment.deposit_account.account_code, '1010')
        self.assertEqual(payment.reference_number, 'AUTH789')

    def test_record_cheque_payment_auto_maps_to_account_1040(self):
        """Test cheque payment auto-maps to account 1040."""
        payload = {
            'amount': '500.00',
            'payment_method': 'cheque',
            'payment_date': timezone.now().isoformat(),
            'cheque_number': 'CHQ001',
            'cheque_date': date.today().isoformat(),
            'cheque_deposit_account': str(self.account_1010.id),  # Where to deposit after clearing
        }

        response = self.client.post(
            f'/api/sales/invoices/{self.invoice.id}/record-payment/',
            payload,
            format='json'
        )

        self.assertEqual(response.status_code, 201)

        # View returns invoice detail, payment is in response.data['payments'][0]
        self.assertIn('payments', response.data)
        payment_data = response.data['payments'][0]

        payment = InvoicePayment.objects.get(id=payment_data['id'])
        self.assertEqual(payment.deposit_account.account_code, '1040')
        self.assertEqual(payment.cheque_number, 'CHQ001')
        self.assertEqual(payment.cheque_deposit_account.account_code, '1010')

    def test_bank_transfer_without_reference_fails(self):
        """Test bank transfer without reference number fails validation."""
        payload = {
            'amount': '500.00',
            'payment_method': 'bank_transfer',
            'payment_date': timezone.now().isoformat(),
            'bank_account_id': str(self.account_1010.id),
            # Missing reference_number
        }

        response = self.client.post(
            f'/api/sales/invoices/{self.invoice.id}/record-payment/',
            payload,
            format='json'
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('reference_number', response.data)

    def test_cheque_without_cheque_number_fails(self):
        """Test cheque payment without cheque number fails validation."""
        payload = {
            'amount': '500.00',
            'payment_method': 'cheque',
            'payment_date': timezone.now().isoformat(),
            'cheque_deposit_account': str(self.account_1010.id),
            # Missing cheque_number
        }

        response = self.client.post(
            f'/api/sales/invoices/{self.invoice.id}/record-payment/',
            payload,
            format='json'
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('cheque_number', response.data)

    def test_empty_string_fields_are_cleaned(self):
        """Test that empty string optional fields don't cause validation errors."""
        payload = {
            'amount': '500.00',
            'payment_method': 'cheque',
            'payment_date': timezone.now().isoformat(),
            'cheque_number': 'CHQ001',
            'cheque_date': '',  # Empty string should be cleaned
            'cheque_deposit_account': str(self.account_1010.id),
            'notes': '',  # Empty string should be cleaned
        }

        response = self.client.post(
            f'/api/sales/invoices/{self.invoice.id}/record-payment/',
            payload,
            format='json'
        )

        # Should succeed (empty strings cleaned before validation)
        self.assertEqual(response.status_code, 201)

        # View returns invoice detail, payment is in response.data['payments'][0]
        self.assertIn('payments', response.data)
        payment_data = response.data['payments'][0]

        payment = InvoicePayment.objects.get(id=payment_data['id'])
        self.assertIsNone(payment.cheque_date)
        # Notes field will be None if empty string was cleaned before save
        self.assertIn(payment.notes, [None, ''])

    def test_payment_invoice_auto_set(self):
        """Test that invoice is auto-set by view, not required in request."""
        payload = {
            'amount': '500.00',
            'payment_method': 'cash',
            'payment_date': timezone.now().isoformat(),
            # Not sending 'invoice' field - should be auto-set by view
        }

        response = self.client.post(
            f'/api/sales/invoices/{self.invoice.id}/record-payment/',
            payload,
            format='json'
        )

        self.assertEqual(response.status_code, 201)

        # View returns invoice detail, payment is in response.data['payments'][0]
        self.assertIn('payments', response.data)
        payment_data = response.data['payments'][0]

        payment = InvoicePayment.objects.get(id=payment_data['id'])
        self.assertEqual(payment.invoice.id, self.invoice.id)

    def test_payment_created_by_auto_set(self):
        """Test that created_by is auto-set to request.user."""
        payload = {
            'amount': '500.00',
            'payment_method': 'cash',
            'payment_date': timezone.now().isoformat(),
        }

        response = self.client.post(
            f'/api/sales/invoices/{self.invoice.id}/record-payment/',
            payload,
            format='json'
        )

        self.assertEqual(response.status_code, 201)

        # View returns invoice detail, payment is in response.data['payments'][0]
        self.assertIn('payments', response.data)
        payment_data = response.data['payments'][0]

        payment = InvoicePayment.objects.get(id=payment_data['id'])
        self.assertEqual(payment.created_by.id, self.user.id)

    def test_custom_bank_account_for_transfer(self):
        """Test custom bank account selection for bank transfer."""
        # Use the already created account_1020 or create one
        alt_bank = ChartOfAccounts.objects.filter(account_code='1020').first()
        if not alt_bank:
            asset_category = AccountCategory.objects.get(name='Assets')
            alt_bank = ChartOfAccounts.objects.create(
                account_code='1020',
                account_name='Bank - Secondary',
                category=asset_category,
                created_by=self.user,
                is_active=True
            )

        payload = {
            'amount': '500.00',
            'payment_method': 'bank_transfer',
            'payment_date': timezone.now().isoformat(),
            'reference_number': 'TXN123',
            'bank_account_id': str(alt_bank.id),
        }

        response = self.client.post(
            f'/api/sales/invoices/{self.invoice.id}/record-payment/',
            payload,
            format='json'
        )

        self.assertEqual(response.status_code, 201)

        # View returns invoice detail, payment is in response.data['payments'][0]
        self.assertIn('payments', response.data)
        payment_data = response.data['payments'][0]

        payment = InvoicePayment.objects.get(id=payment_data['id'])
        self.assertEqual(payment.deposit_account.id, alt_bank.id)
        self.assertEqual(payment.deposit_account.account_code, '1020')

    def test_cheque_clearance_uses_selected_deposit_account(self):
        """Test cheque clearance uses the selected cheque_deposit_account."""
        # Use the already created account_1020 or create one
        alt_bank = ChartOfAccounts.objects.filter(account_code='1020').first()
        if not alt_bank:
            asset_category = AccountCategory.objects.get(name='Assets')
            alt_bank = ChartOfAccounts.objects.create(
                account_code='1020',
                account_name='Bank - Secondary',
                category=asset_category,
                created_by=self.user,
                is_active=True
            )

        # Record cheque with specific deposit account
        payload = {
            'amount': '500.00',
            'payment_method': 'cheque',
            'payment_date': timezone.now().isoformat(),
            'cheque_number': 'CHQ001',
            'cheque_deposit_account': str(alt_bank.id),
        }

        response = self.client.post(
            f'/api/sales/invoices/{self.invoice.id}/record-payment/',
            payload,
            format='json'
        )

        self.assertEqual(response.status_code, 201)

        # View returns invoice detail, payment is in response.data['payments'][0]
        self.assertIn('payments', response.data)
        payment_data = response.data['payments'][0]

        payment = InvoicePayment.objects.get(id=payment_data['id'])

        # Clear the cheque
        payment.cheque_cleared = True
        payment.cheque_cleared_date = date.today()
        payment.save(update_fields=['cheque_cleared', 'cheque_cleared_date'])

        # Check clearance journal uses the selected bank account
        lines = payment.cheque_clearance_journal_entry.journal_lines.all()
        debit_line = lines.get(debit__gt=0)
        self.assertEqual(debit_line.account.id, alt_bank.id)


class ARAgingReportTest(TestCase):
    """Test AR aging report generation."""

    def setUp(self):
        """Create test data."""
        self.user = User.objects.create_user(
            email='test@example.com',
            password='testpass123'
        )

        self.customer = Customer.objects.create(
            legacy_id=1001,
            name='Test Customer',
            email='customer@example.com'
        )

    def test_ar_aging_calculates_current_invoices(self):
        """Test AR aging correctly buckets current invoices."""
        from apps.accounting.services.ar_reports import ARReportService

        # Create invoice due in future
        invoice = SalesInvoice.objects.create(
            invoice_number='INV-2026-0001',
            customer=self.customer,
            net_total=Decimal('1000.00'),
            amount_paid=Decimal('0.00'),
            due_date=date.today() + timedelta(days=30),
            status='sent',
            created_by=self.user
        )

        report = ARReportService.get_ar_aging()
        self.assertEqual(len(report), 1)
        self.assertEqual(Decimal(report[0]['current']), Decimal('1000.00'))

    def test_ar_aging_calculates_overdue_invoices(self):
        """Test AR aging correctly buckets overdue invoices."""
        from apps.accounting.services.ar_reports import ARReportService

        # Create invoice overdue by 45 days
        invoice = SalesInvoice.objects.create(
            invoice_number='INV-2026-0001',
            customer=self.customer,
            net_total=Decimal('1000.00'),
            amount_paid=Decimal('0.00'),
            due_date=date.today() - timedelta(days=45),
            status='sent',
            created_by=self.user
        )

        report = ARReportService.get_ar_aging()
        self.assertEqual(len(report), 1)
        self.assertEqual(Decimal(report[0]['days_31_60']), Decimal('1000.00'))
        self.assertEqual(Decimal(report[0]['current']), Decimal('0.00'))
