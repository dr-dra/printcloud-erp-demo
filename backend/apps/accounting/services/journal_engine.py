"""
Journal Engine Service

Automated journal entry generation from business events.
Provides the core functionality for double-entry bookkeeping automation.
"""

from decimal import Decimal
from django.db import transaction, IntegrityError
from django.utils import timezone
from django.core.exceptions import ValidationError


class JournalEngine:
    """
    Automated journal entry generation service.

    This service handles:
    - Journal number generation
    - Journal entry creation and validation
    - Automatic posting
    - Event-driven journal generation from business transactions
    """

    @staticmethod
    def generate_journal_number():
        """
        Generate sequential journal number in format: JE-YYYYMMDD-####

        Returns:
            str: Unique journal number

        Examples:
            JE-20260104-0001
            JE-20260104-0002
        """
        from apps.accounting.models import JournalEntry

        today = timezone.now().date()
        prefix = f"JE-{today.strftime('%Y%m%d')}"

        # Find last journal number for today
        last_entry = JournalEntry.objects.filter(
            journal_number__startswith=prefix
        ).order_by('-journal_number').first()

        if last_entry:
            # Extract sequence number and increment
            last_num = int(last_entry.journal_number.split('-')[-1])
            new_num = last_num + 1
        else:
            new_num = 1

        return f"{prefix}-{new_num:04d}"

    @staticmethod
    def _resolve_fiscal_period(entry_date, fiscal_period):
        from apps.accounting.models import FiscalPeriod

        if fiscal_period:
            if fiscal_period.status != 'open':
                raise ValidationError(
                    f'Cannot post entry in {fiscal_period.status} period {fiscal_period.name}'
                )
            if not (fiscal_period.start_date <= entry_date <= fiscal_period.end_date):
                raise ValidationError('Entry date is outside the assigned fiscal period')
            return fiscal_period

        if FiscalPeriod.objects.exists():
            open_period = FiscalPeriod.get_open_period_for_date(entry_date)
            if not open_period:
                raise ValidationError('No open fiscal period for entry date')
            return open_period

        return None

    @staticmethod
    def create_or_get_journal(
        entry_date,
        source_type,
        source_id,
        event_type,
        description,
        lines_data,
        created_by=None,
        auto_post=True,
        fiscal_period=None,
        source_reference=None,
    ):
        """
        Create a journal entry if one does not already exist for the source event.
        """
        from apps.accounting.models import JournalEntry

        if not source_id:
            return JournalEngine.create_journal_entry(
                entry_date=entry_date,
                source_type=source_type,
                source_id=source_id,
                event_type=event_type,
                description=description,
                lines_data=lines_data,
                created_by=created_by,
                auto_post=auto_post,
                fiscal_period=fiscal_period,
                source_reference=source_reference,
            )

        existing = JournalEntry.objects.filter(
            source_type=source_type,
            source_id=source_id,
            event_type=event_type
        ).first()
        if existing:
            return existing

        try:
            return JournalEngine.create_journal_entry(
                entry_date=entry_date,
                source_type=source_type,
                source_id=source_id,
                event_type=event_type,
                description=description,
                lines_data=lines_data,
                created_by=created_by,
                auto_post=auto_post,
                fiscal_period=fiscal_period,
                source_reference=source_reference,
            )
        except IntegrityError:
            if source_id:
                return JournalEntry.objects.get(
                    source_type=source_type,
                    source_id=source_id,
                    event_type=event_type
                )
            if source_reference:
                return JournalEntry.objects.get(
                    source_type=source_type,
                    source_reference=source_reference,
                    event_type=event_type
                )
            raise

    @staticmethod
    def create_journal_entry(
        entry_date,
        source_type,
        source_id,
        event_type,
        description,
        lines_data,
        created_by=None,
        auto_post=True,
        fiscal_period=None,
        source_reference=None,
    ):
        """
        Create and optionally post a journal entry.

        Args:
            entry_date (date): Date of the entry
            source_type (str): Type of source document (e.g., 'sales_invoice')
            source_id (int): ID of source document (None for manual entries)
            description (str): Entry description
            lines_data (list): List of line dictionaries with:
                - account_code (str): Account code
                - debit (Decimal): Debit amount
                - credit (Decimal): Credit amount
                - description (str, optional): Line description
            created_by (User, optional): User creating the entry
            auto_post (bool): Whether to automatically post the entry (default: True)
            fiscal_period (FiscalPeriod, optional): Fiscal period for the entry

        Returns:
            JournalEntry: The created (and optionally posted) journal entry

        Raises:
            ValidationError: If entry is unbalanced or validation fails
            ValueError: If account codes are invalid

        Example:
            journal = JournalEngine.create_journal_entry(
                entry_date=date(2026, 1, 4),
                source_type='sales_invoice',
                source_id=123,
                description="Sales Invoice INV-001",
                lines_data=[
                    {'account_code': '1100', 'debit': 1000, 'credit': 0},
                    {'account_code': '4000', 'debit': 0, 'credit': 1000},
                ]
            )
        """
        from apps.accounting.models import JournalEntry, JournalLine, ChartOfAccounts

        if not event_type:
            raise ValidationError('event_type is required for journal entries')

        resolved_period = JournalEngine._resolve_fiscal_period(entry_date, fiscal_period)

        for _ in range(5):
            try:
                with transaction.atomic():
                    journal = JournalEntry.objects.create(
                        journal_number=JournalEngine.generate_journal_number(),
                        entry_date=entry_date,
                        entry_type='system' if source_id else 'manual',
                        source_type=source_type,
                        source_id=source_id,
                        event_type=event_type,
                        source_reference=source_reference,
                        description=description,
                        created_by=created_by,
                        fiscal_period=resolved_period,
                    )

                    # Create journal lines
                    total_debit = Decimal('0')
                    total_credit = Decimal('0')

                    for line_data in lines_data:
                        account = ChartOfAccounts.objects.get(
                            account_code=line_data['account_code']
                        )

                        debit = Decimal(str(line_data.get('debit', 0)))
                        credit = Decimal(str(line_data.get('credit', 0)))

                        JournalLine.objects.create(
                            journal_entry=journal,
                            account=account,
                            debit=debit,
                            credit=credit,
                            description=line_data.get('description', ''),
                        )

                        total_debit += debit
                        total_credit += credit

                    # Update totals
                    journal.total_debit = total_debit
                    journal.total_credit = total_credit
                    journal.save(update_fields=['total_debit', 'total_credit'])

                    # Validate balance
                    if total_debit != total_credit:
                        raise ValueError(
                            f"Unbalanced entry: DR={total_debit}, CR={total_credit}"
                        )

                    # Auto-post if requested
                    if auto_post:
                        journal.post()

                    return journal
            except IntegrityError:
                if source_id:
                    existing = JournalEntry.objects.filter(
                        source_type=source_type,
                        source_id=source_id,
                        event_type=event_type
                    ).first()
                    if existing:
                        return existing
                if source_reference:
                    existing = JournalEntry.objects.filter(
                        source_type=source_type,
                        source_reference=source_reference,
                        event_type=event_type
                    ).first()
                    if existing:
                        return existing
                continue

        raise IntegrityError('Failed to generate unique journal number after retries')

    # ============================================================================
    # Event Handlers for Business Transactions
    # ============================================================================

    @staticmethod
    def handle_invoice_created(invoice):
        """
        Generate journal for sales invoice creation.

        DR: Accounts Receivable
        CR: Sales Revenue

        Args:
            invoice: SalesInvoice instance

        Returns:
            JournalEntry instance
        """
        from apps.accounting.services.account_mapping import get_account_code

        return JournalEngine.create_or_get_journal(
            entry_date=invoice.invoice_date,
            source_type='sales_invoice',
            source_id=invoice.id,
            event_type='invoice_sent',
            description=f"Sales Invoice {invoice.invoice_number}" +
                       (f" - {invoice.customer.name}" if invoice.customer else ""),
            lines_data=[
                {
                    'account_code': get_account_code('ar'),
                    'debit': invoice.net_total,
                    'credit': 0,
                    'description': f"Invoice {invoice.invoice_number}",
                },
                {
                    'account_code': get_account_code('sales'),
                    'debit': 0,
                    'credit': invoice.net_total,
                    'description': f"Sales" + (f" to {invoice.customer.name}" if invoice.customer else ""),
                },
            ],
            created_by=invoice.created_by,
        )

    @staticmethod
    def handle_invoice_payment(payment, invoice_balance_before=None):
        """
        Create journal entry for invoice payment.

        Handles both normal payments and overpayments with correct accounting:
        - Normal: DR Deposit Account, CR AR
        - Overpayment: DR Deposit Account, CR AR (applied), CR Customer Advances (excess)

        Cash: DR 1000 Cash, CR 1100 AR
        Bank: DR 1010 Bank, CR 1100 AR
        Cheque (uncleared): DR 1040 Cheques Received, CR 1100 AR

        Args:
            payment: InvoicePayment instance
            invoice_balance_before: Optional decimal-like value representing the invoice balance
                before this payment was applied. This avoids incorrect journals when the
                payment is recorded and the invoice is auto-updated (or auto-converted) in the
                same transaction prior to on_commit.

        Returns:
            JournalEntry instance
        """
        from decimal import Decimal

        from apps.accounting.services.account_mapping import get_account_code

        # Determine deposit account
        if payment.deposit_account:
            deposit_account_code = payment.deposit_account.account_code
        else:
            # Fallback defaults based on payment method
            if payment.payment_method == 'cash':
                deposit_account_code = get_account_code('cash')
            elif payment.payment_method == 'cheque' and not payment.cheque_cleared:
                deposit_account_code = get_account_code('cheques_received')
            else:
                deposit_account_code = get_account_code('bank')

        # Calculate applied vs overpayment amounts
        invoice = payment.invoice
        if invoice_balance_before is None:
            balance_before = Decimal(str(invoice.balance_due))
        else:
            balance_before = Decimal(str(invoice_balance_before))
        applied_to_ar = min(Decimal(str(payment.amount)), balance_before)
        overpayment = Decimal(str(payment.amount)) - applied_to_ar

        # Build journal lines
        lines_data = [
            {
                'account_code': deposit_account_code,
                'debit': payment.amount,
                'credit': Decimal('0.00'),
                'description': f"{payment.get_payment_method_display()} payment",
            },
        ]

        # Credit AR for applied amount
        if applied_to_ar > 0:
            lines_data.append({
                'account_code': get_account_code('ar'),
                'debit': Decimal('0.00'),
                'credit': applied_to_ar,
                'description': f"Payment for {invoice.invoice_number}",
            })

        # Credit Customer Advances for overpayment
        if overpayment > 0:
            lines_data.append({
                'account_code': get_account_code('customer_advances'),
                'debit': Decimal('0.00'),
                'credit': overpayment,
                'description': f"Overpayment on {invoice.invoice_number}",
            })

        # Create journal entry FIRST
        journal = JournalEngine.create_or_get_journal(
            entry_date=payment.payment_date.date() if hasattr(payment.payment_date, 'date') else payment.payment_date,
            source_type='invoice_payment',
            source_id=payment.id,
            event_type='payment_received',
            description=f"Payment for Invoice {invoice.invoice_number}",
            lines_data=lines_data,
            created_by=payment.created_by,
        )

        # CRITICAL FIX: Create CustomerAdvance record AFTER journal, with journal linkage
        if overpayment > 0:
            from apps.sales.invoices.models import CustomerAdvance
            defaults = {
                'customer': invoice.customer,
                'advance_date': payment.payment_date.date() if hasattr(payment.payment_date, 'date') else payment.payment_date,
                'amount': overpayment,
                'balance': overpayment,
                'journal_entry': journal,  # Link advance to journal for audit trail
                'created_by': payment.created_by,
                'notes': f"Overpayment on invoice {invoice.invoice_number}",
            }
            advance, created = CustomerAdvance.objects.get_or_create(
                source_type='overpayment',
                source_payment=payment,
                defaults=defaults,
            )
            if not created and not advance.journal_entry:
                CustomerAdvance.objects.filter(pk=advance.pk).update(
                    journal_entry=journal
                )

        return journal

    @staticmethod
    def handle_invoice_payment_refund(payment, refund_amount=None, payout_account_code=None):
        """
        Refund an overpayment (Customer Advance) back to the customer.

        Journal Entry:
            DR: Customer Advances
            CR: Cash/Bank (or Cheques Received if originally recorded as such)

        Args:
            payment: InvoicePayment instance
            refund_amount: Decimal amount to refund (defaults to payment.amount)

        Returns:
            JournalEntry instance
        """
        from apps.accounting.services.account_mapping import get_account_code

        if refund_amount is None:
            refund_amount = payment.amount

        if not payout_account_code:
            if payment.deposit_account:
                payout_account_code = payment.deposit_account.account_code
            else:
                if payment.payment_method == 'cash':
                    payout_account_code = get_account_code('cash')
                elif payment.payment_method == 'cheque' and not payment.cheque_cleared:
                    payout_account_code = get_account_code('cheques_received')
                else:
                    payout_account_code = get_account_code('bank')

        lines_data = [
            {
                'account_code': get_account_code('customer_advances'),
                'debit': refund_amount,
                'credit': Decimal('0.00'),
                'description': f"Refund of advance for Invoice {payment.invoice.invoice_number}",
            },
            {
                'account_code': payout_account_code,
                'debit': Decimal('0.00'),
                'credit': refund_amount,
                'description': f"Refund payout ({payment.get_payment_method_display()})",
            },
        ]

        return JournalEngine.create_or_get_journal(
            entry_date=timezone.now().date(),
            source_type='invoice_payment',
            source_id=payment.id,
            event_type='payment_refunded',
            description=f"Refund for Invoice Payment {payment.id}",
            lines_data=lines_data,
            created_by=payment.created_by,
        )

    @staticmethod
    def handle_supplier_bill_approved(bill):
        """
        Generate journal for supplier bill approval.

        DR: Expense/Asset
        CR: Accounts Payable

        Args:
            bill: SupplierBill instance

        Returns:
            JournalEntry instance
        """
        from apps.accounting.services.account_mapping import get_account_code

        return JournalEngine.create_or_get_journal(
            entry_date=bill.bill_date,
            source_type='supplier_bill',
            source_id=bill.id,
            event_type='bill_approved',
            description=f"Supplier Bill {bill.bill_number} - {bill.supplier.name}",
            lines_data=[
                {
                    'account_code': get_account_code('expense'),
                    'debit': bill.total,
                    'credit': 0,
                    'description': f"Bill {bill.bill_number}",
                },
                {
                    'account_code': get_account_code('ap'),
                    'debit': 0,
                    'credit': bill.total,
                    'description': f"Payable to {bill.supplier.name}",
                },
            ],
            created_by=bill.approved_by,
        )

    @staticmethod
    def handle_bill_payment(payment):
        """
        Generate journal for supplier bill payment.

        DR: Accounts Payable
        CR: Cash/Bank

        Args:
            payment: BillPayment instance

        Returns:
            JournalEntry instance
        """
        from apps.accounting.services.account_mapping import get_account_code

        # Determine payment account
        if payment.payment_method == 'cheque' and not payment.cheque_cleared:
            # Cheque not cleared yet - use cheques pending account
            payment_account = get_account_code('cheques_pending')
        else:
            # Other payment methods or cleared cheque
            payment_account_map = {
                'cash': get_account_code('cash'),
                'bank_transfer': get_account_code('bank'),
                'cheque': get_account_code('bank'),  # Cleared cheque
                'card': get_account_code('bank'),
            }
            payment_account = payment_account_map.get(payment.payment_method, get_account_code('bank'))

        return JournalEngine.create_or_get_journal(
            entry_date=payment.payment_date,
            source_type='bill_payment',
            source_id=payment.id,
            event_type='bill_payment_created',
            description=f"Payment to {payment.bill.supplier.name} for Bill {payment.bill.bill_number}",
            lines_data=[
                {
                    'account_code': get_account_code('ap'),
                    'debit': payment.amount,
                    'credit': 0,
                    'description': f"Payment for {payment.bill.bill_number}",
                },
                {
                    'account_code': payment_account,
                    'debit': 0,
                    'credit': payment.amount,
                    'description': f"{payment.get_payment_method_display()} payment",
                },
            ],
            created_by=payment.created_by,
        )

    @staticmethod
    def handle_supplier_credit_note_approved(credit_note):
        """
        Generate journal for supplier credit note approval.

        DR: Accounts Payable
        CR: Expense/Asset

        Args:
            credit_note: SupplierCreditNote instance

        Returns:
            JournalEntry instance
        """
        from apps.accounting.services.account_mapping import get_account_code

        return JournalEngine.create_or_get_journal(
            entry_date=credit_note.credit_note_date,
            source_type='supplier_credit_note',
            source_id=credit_note.id,
            event_type='supplier_credit_note_approved',
            description=f"Supplier Credit Note {credit_note.credit_note_number} - {credit_note.supplier.name}",
            lines_data=[
                {
                    'account_code': get_account_code('ap'),
                    'debit': credit_note.amount,
                    'credit': 0,
                    'description': f"Credit note {credit_note.credit_note_number}",
                },
                {
                    'account_code': get_account_code('expense'),
                    'debit': 0,
                    'credit': credit_note.amount,
                    'description': f"Credit from {credit_note.supplier.name}",
                },
            ],
            created_by=credit_note.approved_by,
        )

    @staticmethod
    def handle_sales_credit_note_approved(credit_note):
        """
        Generate journal for sales credit note approval.

        DR: Sales Revenue
        CR: Accounts Receivable

        Args:
            credit_note: SalesCreditNote instance

        Returns:
            JournalEntry instance
        """
        from apps.accounting.services.account_mapping import get_account_code

        return JournalEngine.create_or_get_journal(
            entry_date=credit_note.credit_note_date,
            source_type='sales_credit_note',
            source_id=credit_note.id,
            event_type='sales_credit_note_approved',
            description=f"Sales Credit Note {credit_note.credit_note_number} - {credit_note.customer.name}",
            lines_data=[
                {
                    'account_code': get_account_code('sales'),
                    'debit': credit_note.amount,
                    'credit': 0,
                    'description': f"Credit note {credit_note.credit_note_number}",
                },
                {
                    'account_code': get_account_code('ar'),
                    'debit': 0,
                    'credit': credit_note.amount,
                    'description': f"Credit to {credit_note.customer.name}",
                },
            ],
            created_by=credit_note.approved_by,
        )

    @staticmethod
    def handle_bank_transaction(transaction):
        """
        Generate journal for bank transaction.

        The journal lines depend on the transaction type:
        - deposit: DR Bank, CR (varies by type)
        - withdrawal: DR (varies), CR Bank
        - transfer: DR To Bank, CR From Bank
        - fee: DR Bank Charges, CR Bank
        - interest: DR Bank, CR Other Income
        - other: DR/CR varies

        Args:
            transaction: BankTransaction instance

        Returns:
            JournalEntry instance
        """
        from django.core.exceptions import ValidationError

        if transaction.transaction_type != 'transfer' and not transaction.contra_account:
            raise ValidationError('Contra account is required for this transaction type')

        lines_data = []
        bank_code = transaction.bank_account.account_code

        if transaction.transaction_type == 'deposit':
            # DR: Bank, CR: Cash/Revenue/Other
            lines_data = [
                {
                    'account_code': bank_code,
                    'debit': transaction.amount,
                    'credit': 0,
                    'description': transaction.description,
                },
                {
                    'account_code': transaction.contra_account.account_code,
                    'debit': 0,
                    'credit': transaction.amount,
                    'description': transaction.description,
                },
            ]

        elif transaction.transaction_type == 'withdrawal':
            # DR: Expense/Cash, CR: Bank
            lines_data = [
                {
                    'account_code': transaction.contra_account.account_code,
                    'debit': transaction.amount,
                    'credit': 0,
                    'description': transaction.description,
                },
                {
                    'account_code': bank_code,
                    'debit': 0,
                    'credit': transaction.amount,
                    'description': transaction.description,
                },
            ]

        elif transaction.transaction_type == 'transfer':
            # DR: To Bank, CR: From Bank
            # For now, assume transfer within same bank accounts
            lines_data = [
                {
                    'account_code': transaction.transfer_to_account.account_code,
                    'debit': transaction.amount,
                    'credit': 0,
                    'description': transaction.description,
                },
                {
                    'account_code': bank_code,
                    'debit': 0,
                    'credit': transaction.amount,
                    'description': transaction.description,
                },
            ]

        elif transaction.transaction_type == 'fee':
            # DR: Bank Charges, CR: Bank
            lines_data = [
                {
                    'account_code': transaction.contra_account.account_code,
                    'debit': transaction.amount,
                    'credit': 0,
                    'description': transaction.description,
                },
                {
                    'account_code': bank_code,
                    'debit': 0,
                    'credit': transaction.amount,
                    'description': transaction.description,
                },
            ]

        elif transaction.transaction_type == 'interest':
            # DR: Bank, CR: Other Income
            lines_data = [
                {
                    'account_code': bank_code,
                    'debit': transaction.amount,
                    'credit': 0,
                    'description': transaction.description,
                },
                {
                    'account_code': transaction.contra_account.account_code,
                    'debit': 0,
                    'credit': transaction.amount,
                    'description': transaction.description,
                },
            ]

        else:  # 'other'
            # Default: DR Bank, CR Cash
            lines_data = [
                {
                    'account_code': bank_code,
                    'debit': transaction.amount,
                    'credit': 0,
                    'description': transaction.description,
                },
                {
                    'account_code': transaction.contra_account.account_code,
                    'debit': 0,
                    'credit': transaction.amount,
                    'description': transaction.description,
                },
            ]

        return JournalEngine.create_or_get_journal(
            entry_date=transaction.transaction_date,
            source_type='bank_transaction',
            source_id=transaction.id,
            event_type='bank_txn_approved',
            description=f"Bank Transaction: {transaction.description}",
            lines_data=lines_data,
            created_by=transaction.created_by,
        )

    @staticmethod
    def handle_bill_payment_cheque_cleared(payment):
        """
        Move cheque payments from Cheques Pending to Bank when cleared.
        """
        from apps.accounting.services.account_mapping import get_account_code

        return JournalEngine.create_or_get_journal(
            entry_date=payment.cheque_cleared_date or timezone.now().date(),
            source_type='bill_payment',
            source_id=payment.id,
            event_type='cheque_cleared',
            description=f"Cheque cleared for Bill {payment.bill.bill_number}",
            lines_data=[
                {
                    'account_code': get_account_code('bank'),
                    'debit': payment.amount,
                    'credit': 0,
                    'description': f"Cheque cleared to bank ({payment.cheque_number})",
                },
                {
                    'account_code': get_account_code('cheques_pending'),
                    'debit': 0,
                    'credit': payment.amount,
                    'description': f"Cheque pending cleared ({payment.cheque_number})",
                },
            ],
            created_by=payment.created_by,
        )

    @staticmethod
    def handle_invoice_payment_cheque_cleared(payment):
        """
        Move cheque from Undeposited to Bank when cleared.
        DR [selected bank account] CR 1040 Cheques Received

        Uses payment.cheque_deposit_account if set, otherwise defaults to 1010.

        Args:
            payment: InvoicePayment instance (cheque payment)

        Returns:
            JournalEntry instance
        """
        from decimal import Decimal
        from django.utils import timezone

        from apps.accounting.services.account_mapping import get_account_code

        # Determine deposit account: use cheque_deposit_account if set, otherwise default bank
        deposit_account_code = get_account_code('bank')
        if payment.cheque_deposit_account:
            deposit_account_code = payment.cheque_deposit_account.account_code

        journal = JournalEngine.create_or_get_journal(
            entry_date=payment.cheque_cleared_date or timezone.now().date(),
            source_type='invoice_payment',
            source_id=payment.id,
            event_type='cheque_cleared',
            description=f"Cheque cleared for Invoice {payment.invoice.invoice_number}",
            lines_data=[
                {
                    'account_code': deposit_account_code,  # Selected bank account
                    'debit': payment.amount,
                    'credit': Decimal('0.00'),
                    'description': f"Cheque {payment.cheque_number} cleared",
                },
                {
                    'account_code': get_account_code('cheques_received'),
                    'debit': Decimal('0.00'),
                    'credit': payment.amount,
                    'description': f"Cheque {payment.cheque_number} deposited",
                },
            ],
            created_by=payment.created_by,
        )
        return journal

    @staticmethod
    def handle_order_payment_cheque_cleared(payment):
        """
        Move order cheque from Undeposited to Bank when cleared.
        DR [selected bank account] CR 1040 Cheques Received

        Uses payment.cheque_deposit_account if set, otherwise defaults to 1010.

        Args:
            payment: OrderPayment instance (cheque payment)

        Returns:
            JournalEntry instance
        """
        from decimal import Decimal
        from django.utils import timezone

        from apps.accounting.services.account_mapping import get_account_code

        deposit_account_code = get_account_code('bank')
        if payment.cheque_deposit_account:
            deposit_account_code = payment.cheque_deposit_account.account_code

        journal = JournalEngine.create_or_get_journal(
            entry_date=payment.cheque_cleared_date or timezone.now().date(),
            source_type='order_payment',
            source_id=payment.id,
            event_type='cheque_cleared',
            description=f"Cheque cleared for Order {payment.order.order_number}",
            lines_data=[
                {
                    'account_code': deposit_account_code,
                    'debit': payment.amount,
                    'credit': Decimal('0.00'),
                    'description': f"Cheque {payment.cheque_number} cleared",
                },
                {
                    'account_code': get_account_code('cheques_received'),
                    'debit': Decimal('0.00'),
                    'credit': payment.amount,
                    'description': f"Cheque {payment.cheque_number} deposited",
                },
            ],
            created_by=payment.created_by,
        )
        return journal

    # ============================================================================
    # VAT / Advance Payment Handlers
    # ============================================================================

    @staticmethod
    def handle_order_advance_payment(payment, vat_rate=None):
        """
        Record advance payment received on an Order.

        Order payments go to Customer Advances (NOT AR or Sales).
        VAT is calculated on the advance and credited to VAT Payable.

        Journal Entry:
            DR: Cash/Bank               = payment_amount
            CR: Customer Advances (2100) = payment_amount - vat_on_advance
            CR: VAT Payable (2400)       = vat_on_advance

        VAT Calculation:
            vat_on_advance = payment_amount * vat_rate / (1 + vat_rate)
            Example: Rs 11,800 at 18% VAT
            VAT = 11800 * 0.18 / 1.18 = Rs 1,800
            Advance = 11800 - 1800 = Rs 10,000

        Args:
            payment: OrderPayment instance
            vat_rate: VAT rate (default from settings.VAT_RATE)

        Returns:
            JournalEntry instance
        """
        from django.conf import settings

        if vat_rate is None:
            vat_rate = getattr(settings, 'VAT_RATE', Decimal('0.18'))

        # Calculate VAT on advance (VAT-inclusive calculation)
        vat_on_advance = payment.amount * vat_rate / (1 + vat_rate)
        advance_amount = payment.amount - vat_on_advance

        from apps.accounting.services.account_mapping import get_account_code

        # Determine deposit account
        if payment.deposit_account:
            deposit_account_code = payment.deposit_account.account_code
        else:
            # Fallback defaults based on payment method
            if payment.payment_method == 'cash':
                deposit_account_code = get_account_code('cash')
            elif payment.payment_method == 'cheque' and not payment.cheque_cleared:
                deposit_account_code = get_account_code('cheques_received')
            else:
                deposit_account_code = get_account_code('bank')

        lines_data = [
            {
                'account_code': deposit_account_code,
                'debit': payment.amount,
                'credit': Decimal('0.00'),
                'description': f"{payment.get_payment_method_display()} advance payment",
            },
            {
                'account_code': get_account_code('customer_advances'),
                'debit': Decimal('0.00'),
                'credit': advance_amount,
                'description': f"Advance for Order {payment.order.order_number}",
            },
        ]

        # Only add VAT line if there's VAT to record
        if vat_on_advance > 0:
            lines_data.append({
                'account_code': get_account_code('vat_payable'),
                'debit': Decimal('0.00'),
                'credit': vat_on_advance,
                'description': f"VAT on advance - Order {payment.order.order_number}",
            })

        return JournalEngine.create_or_get_journal(
            entry_date=payment.payment_date.date() if hasattr(payment.payment_date, 'date') else payment.payment_date,
            source_type='order_payment',
            source_id=payment.id,
            event_type='advance_received',
            description=f"Advance payment for Order {payment.order.order_number}",
            lines_data=lines_data,
            created_by=payment.created_by,
        )

    @staticmethod
    def handle_order_advance_refund(payment, vat_rate=None, payout_account_code=None):
        """
        Refund an advance payment on an Order.

        Journal Entry:
            DR: Customer Advances (net of VAT)
            DR: VAT Payable (VAT portion)
            CR: Cash/Bank (payment amount)

        Args:
            payment: OrderPayment instance
            vat_rate: VAT rate (default from settings.VAT_RATE)

        Returns:
            JournalEntry instance
        """
        from django.conf import settings
        from apps.accounting.services.account_mapping import get_account_code

        if vat_rate is None:
            vat_rate = getattr(settings, 'VAT_RATE', Decimal('0.18'))

        vat_on_advance = payment.amount * vat_rate / (1 + vat_rate)
        advance_amount = payment.amount - vat_on_advance

        if not payout_account_code:
            if payment.deposit_account:
                payout_account_code = payment.deposit_account.account_code
            else:
                if payment.payment_method == 'cash':
                    payout_account_code = get_account_code('cash')
                elif payment.payment_method == 'cheque' and not payment.cheque_cleared:
                    payout_account_code = get_account_code('cheques_received')
                else:
                    payout_account_code = get_account_code('bank')

        lines_data = [
            {
                'account_code': get_account_code('customer_advances'),
                'debit': advance_amount,
                'credit': Decimal('0.00'),
                'description': f"Refund of advance for Order {payment.order.order_number}",
            },
        ]

        if vat_on_advance > 0:
            lines_data.append({
                'account_code': get_account_code('vat_payable'),
                'debit': vat_on_advance,
                'credit': Decimal('0.00'),
                'description': f"VAT reversal on advance - Order {payment.order.order_number}",
            })

        lines_data.append({
            'account_code': payout_account_code,
            'debit': Decimal('0.00'),
            'credit': payment.amount,
            'description': f"Refund payout ({payment.get_payment_method_display()})",
        })

        return JournalEngine.create_or_get_journal(
            entry_date=timezone.now().date(),
            source_type='order_payment',
            source_id=payment.id,
            event_type='advance_refunded',
            description=f"Refund for Order Payment {payment.id}",
            lines_data=lines_data,
            created_by=payment.created_by,
        )

    @staticmethod
    def handle_proforma_advance_payment(payment, vat_rate=None):
        """
        Record advance payment received on a Proforma Invoice.

        Proforma invoice payments go to Customer Advances (NOT AR or Sales).
        Same logic as order advance payments.

        Args:
            payment: InvoicePayment instance (on a proforma invoice)
            vat_rate: VAT rate (default from settings.VAT_RATE)

        Returns:
            JournalEntry instance
        """
        from django.conf import settings

        if vat_rate is None:
            vat_rate = getattr(settings, 'VAT_RATE', Decimal('0.18'))

        # Calculate VAT on advance (VAT-inclusive calculation)
        vat_on_advance = payment.amount * vat_rate / (1 + vat_rate)
        advance_amount = payment.amount - vat_on_advance

        from apps.accounting.services.account_mapping import get_account_code

        # Determine deposit account
        if payment.deposit_account:
            deposit_account_code = payment.deposit_account.account_code
        else:
            if payment.payment_method == 'cash':
                deposit_account_code = get_account_code('cash')
            elif payment.payment_method == 'cheque' and not payment.cheque_cleared:
                deposit_account_code = get_account_code('cheques_received')
            else:
                deposit_account_code = get_account_code('bank')

        lines_data = [
            {
                'account_code': deposit_account_code,
                'debit': payment.amount,
                'credit': Decimal('0.00'),
                'description': f"{payment.get_payment_method_display()} advance payment",
            },
            {
                'account_code': get_account_code('customer_advances'),
                'debit': Decimal('0.00'),
                'credit': advance_amount,
                'description': f"Advance for Proforma {payment.invoice.invoice_number}",
            },
        ]

        if vat_on_advance > 0:
            lines_data.append({
                'account_code': get_account_code('vat_payable'),
                'debit': Decimal('0.00'),
                'credit': vat_on_advance,
                'description': f"VAT on advance - Proforma {payment.invoice.invoice_number}",
            })

        return JournalEngine.create_or_get_journal(
            entry_date=payment.payment_date.date() if hasattr(payment.payment_date, 'date') else payment.payment_date,
            source_type='invoice_payment',
            source_id=payment.id,
            event_type='proforma_advance_received',
            description=f"Advance payment for Proforma Invoice {payment.invoice.invoice_number}",
            lines_data=lines_data,
            created_by=payment.created_by,
        )

    @staticmethod
    def handle_proforma_advance_refund(payment, vat_rate=None, payout_account_code=None):
        """
        Refund an advance payment on a Proforma Invoice.

        Journal Entry:
            DR: Customer Advances (net of VAT)
            DR: VAT Payable (VAT portion)
            CR: Cash/Bank (payment amount)

        Args:
            payment: InvoicePayment instance (proforma)
            vat_rate: VAT rate (default from settings.VAT_RATE)

        Returns:
            JournalEntry instance
        """
        from django.conf import settings
        from apps.accounting.services.account_mapping import get_account_code

        if vat_rate is None:
            vat_rate = getattr(settings, 'VAT_RATE', Decimal('0.18'))

        vat_on_advance = payment.amount * vat_rate / (1 + vat_rate)
        advance_amount = payment.amount - vat_on_advance

        if not payout_account_code:
            if payment.deposit_account:
                payout_account_code = payment.deposit_account.account_code
            else:
                if payment.payment_method == 'cash':
                    payout_account_code = get_account_code('cash')
                elif payment.payment_method == 'cheque' and not payment.cheque_cleared:
                    payout_account_code = get_account_code('cheques_received')
                else:
                    payout_account_code = get_account_code('bank')

        lines_data = [
            {
                'account_code': get_account_code('customer_advances'),
                'debit': advance_amount,
                'credit': Decimal('0.00'),
                'description': f"Refund of advance for Proforma {payment.invoice.invoice_number}",
            },
        ]

        if vat_on_advance > 0:
            lines_data.append({
                'account_code': get_account_code('vat_payable'),
                'debit': vat_on_advance,
                'credit': Decimal('0.00'),
                'description': f"VAT reversal on advance - Proforma {payment.invoice.invoice_number}",
            })

        lines_data.append({
            'account_code': payout_account_code,
            'debit': Decimal('0.00'),
            'credit': payment.amount,
            'description': f"Refund payout ({payment.get_payment_method_display()})",
        })

        return JournalEngine.create_or_get_journal(
            entry_date=timezone.now().date(),
            source_type='invoice_payment',
            source_id=payment.id,
            event_type='proforma_advance_refunded',
            description=f"Refund for Proforma Payment {payment.id}",
            lines_data=lines_data,
            created_by=payment.created_by,
        )

    @staticmethod
    def handle_tax_invoice_created(invoice):
        """
        Generate journal for Tax Invoice creation (VAT trigger).

        This is called when:
        1. A proforma invoice is converted to tax invoice
        2. A tax invoice is created directly

        Journal Entry:
            DR: 2100 Customer Advances    = advances_applied (net of VAT already paid)
            DR: 1100 Accounts Receivable  = balance_due
            CR: 4000 Sales Revenue        = subtotal (VAT-exclusive)
            CR: 2400 VAT Payable          = remaining_vat (total VAT - VAT on advances)

        Args:
            invoice: SalesInvoice instance (must be invoice_type='tax_invoice')

        Returns:
            JournalEntry instance
        """
        from django.conf import settings

        if invoice.invoice_type != 'tax_invoice':
            raise ValidationError('This method only handles tax invoices')

        vat_rate = invoice.vat_rate or getattr(settings, 'VAT_RATE', Decimal('0.18'))

        # Calculate taxable vs exempt totals from items
        taxable_total = Decimal('0.00')
        exempt_total = Decimal('0.00')

        for item in invoice.items.all():
            if item.is_vat_exempt:
                exempt_total += item.amount
            else:
                taxable_total += item.amount

        # Calculate VAT on taxable items
        vat_on_taxable = taxable_total * vat_rate

        # Calculate VAT already paid on advances
        # Advances include VAT, so: vat_on_advances = advances * rate / (1 + rate)
        advances_applied = invoice.advances_applied or Decimal('0.00')
        vat_on_advances = advances_applied * vat_rate / (1 + vat_rate) if advances_applied > 0 else Decimal('0.00')
        advances_net_of_vat = advances_applied - vat_on_advances

        # Remaining VAT to record (total VAT minus VAT already paid on advances)
        remaining_vat = vat_on_taxable - vat_on_advances

        # Build journal lines
        lines_data = []

        from apps.accounting.services.account_mapping import get_account_code

        # DR Customer Advances (net of VAT) if any advances were applied
        if advances_net_of_vat > 0:
            lines_data.append({
                'account_code': get_account_code('customer_advances'),
                'debit': advances_net_of_vat,
                'credit': Decimal('0.00'),
                'description': f"Apply advances to Invoice {invoice.invoice_number}",
            })

        # DR Accounts Receivable for balance due
        if invoice.balance_due > 0:
            lines_data.append({
                'account_code': get_account_code('ar'),
                'debit': invoice.balance_due,
                'credit': Decimal('0.00'),
                'description': f"Invoice {invoice.invoice_number}",
            })

        # CR Sales Revenue (VAT-exclusive amount = taxable + exempt)
        sales_revenue = taxable_total + exempt_total
        if sales_revenue > 0:
            lines_data.append({
                'account_code': get_account_code('sales'),
                'debit': Decimal('0.00'),
                'credit': sales_revenue,
                'description': f"Sales - Invoice {invoice.invoice_number}",
            })

        # CR VAT Payable (remaining VAT after crediting advances)
        if remaining_vat > 0:
            lines_data.append({
                'account_code': get_account_code('vat_payable'),
                'debit': Decimal('0.00'),
                'credit': remaining_vat,
                'description': f"VAT on Invoice {invoice.invoice_number}",
            })

        # Handle case where VAT was overpaid on advances (rare edge case)
        if remaining_vat < 0:
            lines_data.append({
                'account_code': get_account_code('vat_payable'),
                'debit': abs(remaining_vat),
                'credit': Decimal('0.00'),
                'description': f"VAT credit from advances - Invoice {invoice.invoice_number}",
            })

        return JournalEngine.create_or_get_journal(
            entry_date=invoice.invoice_date,
            source_type='sales_invoice',
            source_id=invoice.id,
            event_type='tax_invoice_created',
            description=f"Tax Invoice {invoice.invoice_number}" +
                       (f" - {invoice.customer.name}" if invoice.customer else ""),
            lines_data=lines_data,
            created_by=invoice.created_by,
        )
