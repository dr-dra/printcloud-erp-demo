"""
Django Signals for Automated Journal Entry Generation

This module connects business events (invoice creation, payments, etc.)
to the JournalEngine for automatic accounting entries.
"""

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.db import transaction

import logging

from apps.accounting.services.journal_failure import (
    record_journal_failure,
    resolve_journal_failure,
)
from apps.accounting.services.journal_context import should_skip_accounting_journal_signals

logger = logging.getLogger(__name__)


@receiver(pre_save, sender='invoices.SalesInvoice', dispatch_uid='accounting.signals.salesinvoice_pre')
def salesinvoice_pre_save(sender, instance, **kwargs):
    _load_old_values(sender, instance, ['status', 'invoice_type'])


@receiver(pre_save, sender='invoices.InvoicePayment', dispatch_uid='accounting.signals.invoicepayment_pre')
def invoicepayment_pre_save(sender, instance, **kwargs):
    _load_old_values(sender, instance, ['cheque_cleared', 'journal_entry_id', 'cheque_clearance_journal_entry_id'])


@receiver(pre_save, sender='invoices.SalesCreditNote', dispatch_uid='accounting.signals.salescreditnote_pre')
def salescreditnote_pre_save(sender, instance, **kwargs):
    _load_old_values(sender, instance, ['status'])


@receiver(pre_save, sender='purchases.SupplierBill', dispatch_uid='accounting.signals.supplierbill_pre')
def supplierbill_pre_save(sender, instance, **kwargs):
    _load_old_values(sender, instance, ['status'])


@receiver(pre_save, sender='purchases.SupplierCreditNote', dispatch_uid='accounting.signals.suppliercreditnote_pre')
def suppliercreditnote_pre_save(sender, instance, **kwargs):
    _load_old_values(sender, instance, ['status'])


@receiver(pre_save, sender='accounting.BankTransaction', dispatch_uid='accounting.signals.banktransaction_pre')
def banktransaction_pre_save(sender, instance, **kwargs):
    _load_old_values(sender, instance, ['status', 'journal_entry_id'])


@receiver(pre_save, sender='orders.OrderPayment', dispatch_uid='accounting.signals.orderpayment_pre')
def orderpayment_pre_save(sender, instance, **kwargs):
    _load_old_values(sender, instance, ['cheque_cleared', 'journal_entry_id', 'cheque_clearance_journal_entry_id'])


def _load_old_values(sender, instance, fields):
    if not instance.pk:
        for field in fields:
            setattr(instance, f"_old_{field}", None)
        return
    old = sender.objects.filter(pk=instance.pk).values(*fields).first()
    for field in fields:
        setattr(instance, f"_old_{field}", old.get(field) if old else None)


# ==============================================================================
# Sales Invoice Signals
# ==============================================================================

@receiver(post_save, sender='invoices.SalesInvoice', dispatch_uid='accounting.signals.salesinvoice_post')
def create_invoice_journal(sender, instance, created, **kwargs):
    """
    Create journal entry when invoice status changes to 'sent'.

    Note: We use status='sent' as the trigger because that's when
    the invoice becomes official and affects accounting.
    """
    # Avoid circular imports
    from apps.accounting.services.journal_engine import JournalEngine
    # Only create journal when invoice is sent (becomes official)
    if instance.status != 'sent':
        return
    if instance.invoice_type == 'proforma':
        return
    if getattr(instance, "_old_status", None) == 'sent':
        return

    def _create():
        try:
            JournalEngine.handle_invoice_created(instance)
            resolve_journal_failure('sales_invoice', instance.id, 'invoice_sent')
            logger.info(
                f"Created journal entry for invoice {instance.invoice_number}"
            )
        except Exception as e:
            record_journal_failure('sales_invoice', instance.id, 'invoice_sent', e)
            logger.error(
                f"Failed to create journal for invoice {instance.invoice_number}: {e}"
            )

    transaction.on_commit(_create)


@receiver(post_save, sender='invoices.InvoicePayment', dispatch_uid='accounting.signals.invoicepayment_post')
def create_payment_journal(sender, instance, created, **kwargs):
    """
    Create journal entry for invoice payment.

    SAFEGUARDS:
    - Only runs on creation (created=True)
    - Skips if already has journal_entry (idempotent)
    - Skips if payment is void
    - Skips if payment_date < ACCOUNTING_GO_LIVE_DATE (prevents backdating)
    """
    if should_skip_accounting_journal_signals():
        return

    from apps.accounting.services.journal_events import schedule_invoice_payment_journal
    from django.conf import settings
    from datetime import datetime

    # SAFEGUARD 1: Only on creation
    if not created:
        return

    # SAFEGUARD 2: Skip void or reversed payments
    if instance.is_void or getattr(instance, 'is_reversed', False):
        return

    # SAFEGUARD 4: Enforce go-live date
    go_live_date = datetime.strptime(settings.ACCOUNTING_GO_LIVE_DATE, '%Y-%m-%d').date()
    payment_date = instance.payment_date.date() if hasattr(instance.payment_date, 'date') else instance.payment_date

    if payment_date < go_live_date:
        logger.info(f"Skipping journal for payment {instance.id} (before go-live date)")
        return

    schedule_invoice_payment_journal(instance.pk)


@receiver(post_save, sender='orders.OrderPayment', dispatch_uid='accounting.signals.orderpayment_post')
def create_order_payment_journal(sender, instance, created, **kwargs):
    """
    Create journal entry for order advance payment.
    """
    if should_skip_accounting_journal_signals():
        return
    from apps.accounting.services.journal_events import schedule_order_advance_received

    if not created:
        return

    if instance.is_void or getattr(instance, 'is_reversed', False):
        return

    schedule_order_advance_received(instance.pk)


@receiver(post_save, sender='invoices.InvoicePayment', dispatch_uid='accounting.signals.invoicepayment_cheque_clear_post')
def create_cheque_clearance_journal(sender, instance, created, **kwargs):
    """
    Create journal when cheque is cleared.

    CRITICAL: Only runs when cheque_cleared transitions from False → True
    Uses update_fields to detect state change
    """
    if should_skip_accounting_journal_signals():
        return
    from apps.accounting.services.journal_events import schedule_invoice_payment_cheque_cleared

    # Skip if this is creation (not an update)
    if created:
        return

    # Skip if not a cheque payment
    if instance.payment_method != 'cheque':
        return

    # Skip if not cleared
    if not instance.cheque_cleared:
        return

    # Only run on False -> True transitions
    if getattr(instance, "_old_cheque_cleared", None) is True:
        return

    # Skip if already has clearance journal (idempotent)
    if instance.cheque_clearance_journal_entry:
        return

    schedule_invoice_payment_cheque_cleared(instance.pk)


@receiver(post_save, sender='orders.OrderPayment', dispatch_uid='accounting.signals.orderpayment_cheque_clear_post')
def create_order_cheque_clearance_journal(sender, instance, created, **kwargs):
    """
    Create journal when order cheque is cleared.
    """
    if should_skip_accounting_journal_signals():
        return
    from apps.accounting.services.journal_events import schedule_order_payment_cheque_cleared

    if created:
        return

    if instance.payment_method != 'cheque':
        return

    if not instance.cheque_cleared:
        return

    if getattr(instance, "_old_cheque_cleared", None) is True:
        return

    if instance.cheque_clearance_journal_entry:
        return

    schedule_order_payment_cheque_cleared(instance.pk)


@receiver(post_save, sender='invoices.SalesCreditNote', dispatch_uid='accounting.signals.salescreditnote_post')
def create_sales_credit_note_journal(sender, instance, **kwargs):
    """Create journal entry when sales credit note is approved."""
    from apps.accounting.services.journal_engine import JournalEngine
    if instance.status != 'approved':
        return
    if getattr(instance, "_old_status", None) == 'approved':
        return
    if getattr(instance, "credit_note_type", "ar_credit") != 'ar_credit':
        return

    def _create():
        try:
            JournalEngine.handle_sales_credit_note_approved(instance)
            resolve_journal_failure('sales_credit_note', instance.id, 'sales_credit_note_approved')
            logger.info(
                f"Created journal entry for sales credit note {instance.credit_note_number}"
            )
        except Exception as e:
            record_journal_failure('sales_credit_note', instance.id, 'sales_credit_note_approved', e)
            logger.error(
                f"Failed to create journal for sales credit note {instance.id}: {e}"
            )

    transaction.on_commit(_create)


# ==============================================================================
# Supplier Bill & Payment Signals
# ==============================================================================

@receiver(post_save, sender='purchases.SupplierBill', dispatch_uid='accounting.signals.supplierbill_post')
def create_bill_journal(sender, instance, **kwargs):
    """Create journal entry when supplier bill is approved."""
    from apps.accounting.services.journal_engine import JournalEngine
    if instance.status != 'approved':
        return
    if getattr(instance, "_old_status", None) == 'approved':
        return

    def _create():
        try:
            JournalEngine.handle_supplier_bill_approved(instance)
            resolve_journal_failure('supplier_bill', instance.id, 'bill_approved')
            logger.info(
                f"Created journal entry for supplier bill {instance.bill_number}"
            )
        except Exception as e:
            record_journal_failure('supplier_bill', instance.id, 'bill_approved', e)
            logger.error(
                f"Failed to create journal for supplier bill {instance.id}: {e}"
            )

    transaction.on_commit(_create)


@receiver(post_save, sender='purchases.BillPayment', dispatch_uid='accounting.signals.billpayment_post')
def create_bill_payment_journal(sender, instance, created, **kwargs):
    """Create journal entry for bill payment."""
    from apps.accounting.services.journal_engine import JournalEngine
    if not created:
        return

    def _create():
        try:
            JournalEngine.handle_bill_payment(instance)
            resolve_journal_failure('bill_payment', instance.id, 'bill_payment_created')
            logger.info(
                f"Created journal entry for payment to {instance.bill.supplier.name}"
            )
        except Exception as e:
            record_journal_failure('bill_payment', instance.id, 'bill_payment_created', e)
            logger.error(
                f"Failed to create journal for bill payment {instance.id}: {e}"
            )

    transaction.on_commit(_create)


@receiver(post_save, sender='purchases.SupplierCreditNote', dispatch_uid='accounting.signals.suppliercreditnote_post')
def create_supplier_credit_note_journal(sender, instance, **kwargs):
    """Create journal entry when supplier credit note is approved."""
    from apps.accounting.services.journal_engine import JournalEngine
    if instance.status != 'approved':
        return
    if getattr(instance, "_old_status", None) == 'approved':
        return

    def _create():
        try:
            JournalEngine.handle_supplier_credit_note_approved(instance)
            resolve_journal_failure('supplier_credit_note', instance.id, 'supplier_credit_note_approved')
            logger.info(
                f"Created journal entry for supplier credit note {instance.credit_note_number}"
            )
        except Exception as e:
            record_journal_failure('supplier_credit_note', instance.id, 'supplier_credit_note_approved', e)
            logger.error(
                f"Failed to create journal for supplier credit note {instance.id}: {e}"
            )

    transaction.on_commit(_create)


# ==============================================================================
# Bank Transaction Signals
# ==============================================================================

@receiver(post_save, sender='accounting.BankTransaction', dispatch_uid='accounting.signals.banktransaction_post')
def create_bank_transaction_journal(sender, instance, **kwargs):
    """Create journal entry when bank transaction is approved."""
    if should_skip_accounting_journal_signals():
        return

    from apps.accounting.services.journal_engine import JournalEngine
    if instance.status != 'posted':
        return
    if getattr(instance, "_old_status", None) == 'posted':
        return
    if instance.journal_entry_id or getattr(instance, "_old_journal_entry_id", None):
        return

    def _create():
        try:
            JournalEngine.handle_bank_transaction(instance)
            resolve_journal_failure('bank_transaction', instance.id, 'bank_txn_approved')
            logger.info(
                f"Created journal entry for bank transaction {instance.id}"
            )
        except Exception as e:
            record_journal_failure('bank_transaction', instance.id, 'bank_txn_approved', e)
            logger.error(
                f"Failed to create journal for bank transaction {instance.id}: {e}"
            )

    transaction.on_commit(_create)
