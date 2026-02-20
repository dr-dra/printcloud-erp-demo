from __future__ import annotations

import logging
from datetime import datetime

from django.conf import settings
from django.db import transaction

from apps.accounting.services.journal_failure import record_journal_failure, resolve_journal_failure

logger = logging.getLogger(__name__)


def schedule_order_advance_received(payment_id: int) -> None:
    def _create() -> None:
        from apps.accounting.services.journal_engine import JournalEngine
        from apps.sales.orders.models import OrderPayment

        try:
            payment = OrderPayment.objects.select_related('order').get(pk=payment_id)
            if payment.journal_entry_id:
                return
            if payment.is_void or getattr(payment, "is_reversed", False):
                return

            journal = JournalEngine.handle_order_advance_payment(payment)
            OrderPayment.objects.filter(pk=payment.pk, journal_entry__isnull=True).update(
                journal_entry=journal
            )
            resolve_journal_failure('order_payment', payment.id, 'advance_received')
        except Exception as e:
            record_journal_failure('order_payment', payment_id, 'advance_received', e)
            logger.exception("Failed to create order advance journal (payment_id=%s)", payment_id)

    transaction.on_commit(_create)


def schedule_invoice_payment_journal(
    payment_id: int,
    *,
    invoice_type_at_payment: str | None = None,
    invoice_balance_before: str | None = None,
) -> None:
    """
    Authoritative scheduler for InvoicePayment journals.
    Handles both:
    - tax invoice payment: event_type=payment_received
    - proforma advance: event_type=proforma_advance_received
    Mirrors safeguards previously implemented in signals.
    """

    def _create() -> None:
        from apps.accounting.services.journal_engine import JournalEngine
        from apps.sales.invoices.models import InvoicePayment

        try:
            payment = InvoicePayment.objects.select_related('invoice').get(pk=payment_id)
            if payment.journal_entry_id:
                return
            if payment.is_void or getattr(payment, "is_reversed", False):
                return

            go_live_date = datetime.strptime(settings.ACCOUNTING_GO_LIVE_DATE, '%Y-%m-%d').date()
            payment_date = payment.payment_date.date() if hasattr(payment.payment_date, 'date') else payment.payment_date
            if payment_date < go_live_date:
                logger.info("Skipping journal for payment %s (before go-live date)", payment_id)
                return

            # IMPORTANT:
            # Do not infer the invoice type at on_commit time if the same request auto-converted
            # a proforma into a tax invoice. The payment must be journaled based on the invoice
            # type at the moment the payment was recorded.
            invoice_type = invoice_type_at_payment or payment.invoice.invoice_type

            if invoice_type == 'proforma':
                journal = JournalEngine.handle_proforma_advance_payment(payment)
                event_type = 'proforma_advance_received'
            else:
                journal = JournalEngine.handle_invoice_payment(
                    payment,
                    invoice_balance_before=invoice_balance_before,
                )
                event_type = 'payment_received'

            InvoicePayment.objects.filter(pk=payment.pk, journal_entry__isnull=True).update(
                journal_entry=journal
            )
            resolve_journal_failure('invoice_payment', payment.id, event_type)
        except Exception as e:
            # Best-effort classify for failure tracking
            event_type = 'payment_received'
            try:
                from apps.sales.invoices.models import InvoicePayment

                p = InvoicePayment.objects.select_related('invoice').only('id', 'invoice__invoice_type').get(pk=payment_id)
                if p.invoice.invoice_type == 'proforma':
                    event_type = 'proforma_advance_received'
            except Exception:
                pass
            record_journal_failure('invoice_payment', payment_id, event_type, e)
            logger.exception("Failed to create invoice payment journal (payment_id=%s)", payment_id)

    transaction.on_commit(_create)


def schedule_invoice_payment_cheque_cleared(payment_id: int) -> None:
    def _create() -> None:
        from apps.accounting.services.journal_engine import JournalEngine
        from apps.sales.invoices.models import InvoicePayment

        try:
            payment = InvoicePayment.objects.select_related('invoice').get(pk=payment_id)
            if payment.cheque_clearance_journal_entry_id:
                return
            if not payment.cheque_cleared:
                return
            journal = JournalEngine.handle_invoice_payment_cheque_cleared(payment)
            InvoicePayment.objects.filter(
                pk=payment.pk,
                cheque_clearance_journal_entry__isnull=True
            ).update(cheque_clearance_journal_entry=journal)
            resolve_journal_failure('invoice_payment', payment.id, 'cheque_cleared')
        except Exception as e:
            record_journal_failure('invoice_payment', payment_id, 'cheque_cleared', e)
            logger.exception("Failed to create invoice cheque clearance journal (payment_id=%s)", payment_id)

    transaction.on_commit(_create)


def schedule_order_payment_cheque_cleared(payment_id: int) -> None:
    def _create() -> None:
        from apps.accounting.services.journal_engine import JournalEngine
        from apps.sales.orders.models import OrderPayment

        try:
            payment = OrderPayment.objects.select_related('order').get(pk=payment_id)
            if payment.cheque_clearance_journal_entry_id:
                return
            if not payment.cheque_cleared:
                return
            journal = JournalEngine.handle_order_payment_cheque_cleared(payment)
            OrderPayment.objects.filter(
                pk=payment.pk,
                cheque_clearance_journal_entry__isnull=True
            ).update(cheque_clearance_journal_entry=journal)
            resolve_journal_failure('order_payment', payment.id, 'cheque_cleared')
        except Exception as e:
            record_journal_failure('order_payment', payment_id, 'cheque_cleared', e)
            logger.exception("Failed to create order cheque clearance journal (payment_id=%s)", payment_id)

    transaction.on_commit(_create)


def schedule_tax_invoice_created(invoice_id: int) -> None:
    def _create() -> None:
        from apps.accounting.services.journal_engine import JournalEngine
        from apps.sales.invoices.models import SalesInvoice

        try:
            invoice = SalesInvoice.objects.get(pk=invoice_id)
            if invoice.invoice_type != 'tax_invoice':
                return
            JournalEngine.handle_tax_invoice_created(invoice)
            resolve_journal_failure('sales_invoice', invoice_id, 'tax_invoice_created')
        except Exception as e:
            record_journal_failure('sales_invoice', invoice_id, 'tax_invoice_created', e)
            logger.exception("Failed to create tax invoice journal (invoice_id=%s)", invoice_id)

    transaction.on_commit(_create)
