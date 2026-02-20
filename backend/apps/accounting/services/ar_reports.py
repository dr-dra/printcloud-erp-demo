"""
AR (Accounts Receivable) Reporting Service

This module provides comprehensive AR reporting functionality including:
- Aging reports (bucketing invoices by days overdue)
- Customer statements (running balance)
- Customer balance summaries
"""

from decimal import Decimal
from datetime import date
from django.db.models import Sum, Q
from apps.sales.invoices.models import SalesInvoice


class ARReportService:
    """Service for generating AR reports and statements."""

    @staticmethod
    def get_ar_aging(as_of_date=None, customer_id=None):
        """
        Generate AR aging report.
        Buckets: Current, 1-30, 31-60, 61-90, 90+ days overdue

        IMPORTANT LIMITATION:
        - Uses current balance_due from invoices
        - Does NOT recalculate balances as-of specific date
        - For true as-of-date reporting, need to sum payments <= as_of_date
        - This is acceptable for Phase 1, enhance in Phase 2

        Args:
            as_of_date (date, optional): Report date (defaults to today)
            customer_id (int, optional): Filter by specific customer

        Returns:
            list: List of customer aging buckets with totals
        """
        if not as_of_date:
            as_of_date = date.today()

        # Get unpaid/partially paid invoices
        invoices = SalesInvoice.objects.filter(
            Q(status='sent') | Q(status='partially_paid') | Q(status='overdue')
        ).filter(balance_due__gt=0)

        if customer_id:
            invoices = invoices.filter(customer_id=customer_id)

        # Calculate aging buckets
        report_data = {}
        for invoice in invoices:
            days_overdue = (as_of_date - invoice.due_date).days if invoice.due_date else 0
            cust_id = invoice.customer_id

            if cust_id not in report_data:
                report_data[cust_id] = {
                    'customer_id': cust_id,
                    'customer_name': invoice.customer.name if invoice.customer else 'Unknown',
                    'current': Decimal('0.00'),
                    'days_1_30': Decimal('0.00'),
                    'days_31_60': Decimal('0.00'),
                    'days_61_90': Decimal('0.00'),
                    'days_90_plus': Decimal('0.00'),
                    'total': Decimal('0.00'),
                    'invoice_count': 0
                }

            # Use Decimal (NOT float!) for precision
            balance = invoice.balance_due

            if days_overdue <= 0:
                report_data[cust_id]['current'] += balance
            elif days_overdue <= 30:
                report_data[cust_id]['days_1_30'] += balance
            elif days_overdue <= 60:
                report_data[cust_id]['days_31_60'] += balance
            elif days_overdue <= 90:
                report_data[cust_id]['days_61_90'] += balance
            else:
                report_data[cust_id]['days_90_plus'] += balance

            report_data[cust_id]['total'] += balance
            report_data[cust_id]['invoice_count'] += 1

        # Convert Decimals to strings for JSON serialization
        for customer in report_data.values():
            customer['current'] = str(customer['current'])
            customer['days_1_30'] = str(customer['days_1_30'])
            customer['days_31_60'] = str(customer['days_31_60'])
            customer['days_61_90'] = str(customer['days_61_90'])
            customer['days_90_plus'] = str(customer['days_90_plus'])
            customer['total'] = str(customer['total'])

        return list(report_data.values())

    @staticmethod
    def get_customer_statement(customer_id, start_date=None, end_date=None):
        """
        Generate customer statement with running balance.

        Args:
            customer_id (int): Customer ID
            start_date (date, optional): Start of date range
            end_date (date, optional): End of date range

        Returns:
            dict: Customer info and transaction list with running balance
        """
        from apps.customers.models import Customer
        from decimal import Decimal

        transactions = []
        balance = Decimal('0.00')

        # Get all invoices for customer
        invoices = SalesInvoice.objects.filter(customer_id=customer_id)

        if start_date:
            invoices = invoices.filter(invoice_date__gte=start_date)
        if end_date:
            invoices = invoices.filter(invoice_date__lte=end_date)

        for invoice in invoices.order_by('invoice_date'):
            balance += invoice.net_total  # Already Decimal
            transactions.append({
                'date': invoice.invoice_date,
                'type': 'invoice',
                'reference': invoice.invoice_number,
                'debit': str(invoice.net_total),
                'credit': '0.00',
                'balance': str(balance)
            })

            # Add payments (non-void only)
            for payment in invoice.payments.filter(is_void=False).order_by('payment_date'):
                balance -= payment.amount  # Already Decimal
                transactions.append({
                    'date': payment.payment_date.date() if hasattr(payment.payment_date, 'date') else payment.payment_date,
                    'type': 'payment',
                    'reference': f"PMT-{payment.id}",
                    'debit': '0.00',
                    'credit': str(payment.amount),
                    'balance': str(balance)
                })

        # Get customer
        try:
            customer = Customer.objects.get(id=customer_id)
        except Customer.DoesNotExist:
            customer = None

        return {
            'customer': customer,
            'transactions': transactions,
            'balance': str(balance),
            'statement_date': date.today().isoformat()
        }

    @staticmethod
    def get_customer_balance(customer_id):
        """
        Get total outstanding balance for a customer.

        Args:
            customer_id (int): Customer ID

        Returns:
            dict: Balance information
        """
        invoices = SalesInvoice.objects.filter(
            customer_id=customer_id,
            balance_due__gt=0
        ).exclude(status='cancelled')

        total_balance = invoices.aggregate(
            total=Sum('balance_due')
        )['total'] or Decimal('0.00')

        overdue_invoices = invoices.filter(
            due_date__lt=date.today()
        )

        overdue_balance = overdue_invoices.aggregate(
            total=Sum('balance_due')
        )['total'] or Decimal('0.00')

        return {
            'customer_id': customer_id,
            'total_outstanding': str(total_balance),
            'overdue_balance': str(overdue_balance),
            'invoice_count': invoices.count(),
            'overdue_count': overdue_invoices.count()
        }
