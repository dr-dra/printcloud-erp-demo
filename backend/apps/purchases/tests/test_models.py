from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone

from apps.suppliers.models import Supplier
from apps.purchases.models import SupplierBill


class SupplierBillModelTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        cls.user = User.objects.create_user(email='purchases@example.com', password='pass1234')
        cls.supplier = Supplier.objects.create(
            supplier_code='SUP-TEST',
            name='Supplier Test',
            created_by=cls.user,
        )

    def _create_bill(self, total=Decimal('100.00')):
        return SupplierBill.objects.create(
            internal_reference='BILL-TEST',
            bill_number='SUP-BILL-1',
            supplier=self.supplier,
            bill_date=timezone.now().date(),
            due_date=timezone.now().date(),
            status='draft',
            subtotal=total,
            tax_amount=Decimal('0.00'),
            discount_amount=Decimal('0.00'),
            total=total,
            amount_paid=Decimal('0.00'),
            balance_due=total,
            created_by=self.user,
        )

    def test_approve_bill_updates_status(self):
        bill = self._create_bill()
        bill.approve(self.user)
        self.assertEqual(bill.status, 'approved')
        self.assertEqual(bill.approved_by, self.user)

    def test_payment_cannot_overpay(self):
        bill = self._create_bill(total=Decimal('50.00'))
        bill.approve(self.user)

        with self.assertRaises(ValidationError):
            bill.record_payment(
                amount=Decimal('60.00'),
                payment_method='cash',
                user=self.user,
                payment_date=timezone.now().date(),
            )

    def test_payment_updates_status(self):
        bill = self._create_bill(total=Decimal('80.00'))
        bill.approve(self.user)

        payment = bill.record_payment(
            amount=Decimal('30.00'),
            payment_method='cash',
            user=self.user,
            payment_date=timezone.now().date(),
        )
        self.assertEqual(payment.amount, Decimal('30.00'))
        bill.refresh_from_db()
        self.assertEqual(bill.status, 'partially_paid')

        bill.record_payment(
            amount=Decimal('50.00'),
            payment_method='cash',
            user=self.user,
            payment_date=timezone.now().date(),
        )
        bill.refresh_from_db()
        self.assertEqual(bill.status, 'paid')
