from rest_framework import generics, status, views, filters, viewsets
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from rest_framework.decorators import api_view, permission_classes, action
from django_filters.rest_framework import DjangoFilterBackend
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from django.template.loader import render_to_string
from django.http import HttpResponse
from django.conf import settings
from weasyprint import HTML
from io import BytesIO
from decimal import Decimal
import logging
import re
import traceback
from .models import (
    SalesInvoice, SalesInvoiceItem, SalesInvoiceTimeline, InvoicePayment,
    PaymentAllocation, CustomerAdvance, SalesCreditNote
)
from apps.sales.orders.models import OrderPayment, SalesOrderTimeline
from apps.accounting.permissions import IsAccountingOrAdmin
from .tasks import send_invoice_email_task, send_invoice_whatsapp_task
from .serializers import (
    SalesInvoiceListSerializer, SalesInvoiceDetailSerializer,
    SalesInvoiceCreateSerializer, InvoicePaymentSerializer,
    SalesCreditNoteSerializer
)
from apps.sales.orders.models import SalesOrder
from apps.accounting.models import ChartOfAccounts, JournalEntry
import datetime

logger = logging.getLogger(__name__)

class InvoicePagination(PageNumberPagination):
    """Custom pagination for invoices"""
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 100

class SalesInvoiceListView(generics.ListAPIView):
    """
    API endpoint for listing invoices with search, filtering, and sorting
    """
    permission_classes = [IsAuthenticated, IsAccountingOrAdmin]
    serializer_class = SalesInvoiceListSerializer
    pagination_class = InvoicePagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]

    # Search fields
    search_fields = ['invoice_number', 'customer__name']

    # Ordering fields
    ordering_fields = ['invoice_date', 'net_total', 'created_date', 'invoice_number', 'status', 'balance_due']
    ordering = ['-created_date']  # Default ordering

    def get_queryset(self):
        queryset = SalesInvoice.objects.all().select_related('customer')
        # Add filtering logic here similar to orders
        customer = self.request.query_params.get('customer')
        status = self.request.query_params.get('status')

        if customer:
            queryset = queryset.filter(customer_id=customer)
        if status:
            queryset = queryset.filter(status=status)

        return queryset

class SalesInvoiceDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    queryset = SalesInvoice.objects.select_related(
        'customer', 'order', 'created_by'
    ).prefetch_related(
        'items', 'payments', 'credit_notes', 'timeline_entries'
    )
    serializer_class = SalesInvoiceDetailSerializer

class SalesInvoiceCreateView(generics.CreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = SalesInvoiceCreateSerializer

    def create(self, request, *args, **kwargs):
        items_data = request.data.pop('items', [])
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        with transaction.atomic():
            invoice = serializer.save(created_by=request.user)
            for item_data in items_data:
                SalesInvoiceItem.objects.create(invoice=invoice, **item_data)
            
            SalesInvoiceTimeline.objects.create(
                invoice=invoice,
                event_type='created',
                message=f"Invoice created by {request.user.get_full_name()}",
                new_status=invoice.status,
                created_by=request.user
            )
            
        return Response(SalesInvoiceDetailSerializer(invoice).data, status=status.HTTP_201_CREATED)

class SalesInvoiceUpdateView(generics.UpdateAPIView):
    """
    Update an invoice.

    IMPORTANT: Tax Invoices are LOCKED after issuance.
    Only certain fields can be updated on a Tax Invoice:
    - notes, customer_notes, status (for workflow)

    Line items, amounts, VAT flags, and prices cannot be changed.
    To "correct" a Tax Invoice, it must be voided and reissued.
    """
    permission_classes = [IsAuthenticated]
    queryset = SalesInvoice.objects.all()
    serializer_class = SalesInvoiceCreateSerializer

    # Fields that can be updated on a Tax Invoice (locked document)
    TAX_INVOICE_ALLOWED_FIELDS = {
        'notes', 'customer_notes', 'status', 'due_date'
    }

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()

        # ============================================================
        # TAX INVOICE LOCKING: Prevent changes to locked Tax Invoices
        # ============================================================
        if instance.invoice_type == 'tax_invoice':
            # Check if trying to modify restricted fields
            items_data = request.data.get('items', None)

            # Block item changes completely
            if items_data is not None:
                return Response(
                    {
                        'error': 'Tax Invoice is locked. Line items cannot be modified.',
                        'detail': 'Tax Invoices are legal documents and cannot be edited after issuance. '
                                  'To make corrections, void this invoice and create a new one.'
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Check for restricted field changes
            restricted_fields_in_request = set(request.data.keys()) - self.TAX_INVOICE_ALLOWED_FIELDS - {'id'}

            # These fields are absolutely locked on Tax Invoices
            locked_fields = {
                'invoice_number', 'invoice_type', 'customer', 'order',
                'subtotal', 'discount', 'tax_amount', 'net_total',
                'vat_rate', 'advances_applied', 'amount_paid', 'balance_due',
                'invoice_date', 'po_so_number'
            }

            attempted_locked_changes = restricted_fields_in_request & locked_fields
            if attempted_locked_changes:
                return Response(
                    {
                        'error': f'Tax Invoice is locked. Cannot modify: {", ".join(attempted_locked_changes)}',
                        'detail': 'Tax Invoices are legal documents. Only notes and status can be updated. '
                                  'To make corrections, void this invoice and create a new one.',
                        'locked_fields': list(attempted_locked_changes)
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            # For Tax Invoices, only allow updating allowed fields
            allowed_data = {k: v for k, v in request.data.items() if k in self.TAX_INVOICE_ALLOWED_FIELDS}

            serializer = self.get_serializer(instance, data=allowed_data, partial=True)
            serializer.is_valid(raise_exception=True)

            with transaction.atomic():
                invoice = serializer.save(updated_by=request.user)

                SalesInvoiceTimeline.objects.create(
                    invoice=invoice,
                    event_type='modified',
                    message=f"Invoice notes/status updated by {request.user.get_full_name()} (Tax Invoice - restricted edit)",
                    created_by=request.user
                )

            return Response(SalesInvoiceDetailSerializer(invoice).data)

        # ============================================================
        # PROFORMA / DRAFT: Full editing allowed
        # ============================================================
        items_data = request.data.pop('items', None)

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            invoice = serializer.save(updated_by=request.user)

            if items_data is not None:
                instance.items.all().delete()
                for item_data in items_data:
                    SalesInvoiceItem.objects.create(invoice=invoice, **item_data)

            SalesInvoiceTimeline.objects.create(
                invoice=invoice,
                event_type='modified',
                message=f"Invoice updated by {request.user.get_full_name()}",
                created_by=request.user
            )

        return Response(SalesInvoiceDetailSerializer(invoice).data)

class ConvertOrderToInvoiceView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, order_id):
        order = get_object_or_404(SalesOrder, id=order_id)
        
        if order.status == 'cancelled':
            return Response({"error": "Cannot invoice a cancelled order"}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # Generate invoice number
            year = timezone.now().year
            last_invoice = SalesInvoice.objects.filter(invoice_number__contains=f'INV-{year}').order_by('-id').first()
            if last_invoice:
                last_num = int(last_invoice.invoice_number.split('-')[-1])
                new_num = last_num + 1
            else:
                new_num = 1
            invoice_number = f"INV-{year}-{new_num:04d}"

            # Create invoice
            invoice = SalesInvoice.objects.create(
                invoice_number=invoice_number,
                customer=order.customer,
                order=order,
                invoice_date=timezone.now().date(),
                due_date=timezone.now().date() + datetime.timedelta(days=7),
                invoice_type='tax_invoice',
                status='draft',
                po_so_number=order.po_so_number,
                subtotal=order.subtotal,
                discount=order.discount,
                net_total=order.net_total,
                created_by=request.user
            )

            # Create items
            for item in order.items.all():
                is_vat_exempt = bool(item.finished_product and item.finished_product.is_vat_exempt)
                SalesInvoiceItem.objects.create(
                    invoice=invoice,
                    finished_product=item.finished_product,
                    item_name=item.item_name,
                    description=item.description,
                    quantity=item.quantity,
                    unit_price=item.unit_price,
                    amount=item.amount,
                    is_vat_exempt=is_vat_exempt,
                    tax_rate=invoice.vat_rate,
                )

            # Update order status
            order.status = 'invoiced'
            order.save()

            SalesInvoiceTimeline.objects.create(
                invoice=invoice,
                event_type='converted',
                message=f"Invoice generated from Order {order.order_number}",
                new_status='draft',
                created_by=request.user
            )

        return Response(SalesInvoiceDetailSerializer(invoice).data, status=status.HTTP_201_CREATED)

class RecordPaymentView(generics.CreateAPIView):
    """
    Record a payment against an invoice.

    AUTO-MAPPING OF DEPOSIT ACCOUNTS:
    - cash → 1000 (Cash in Hand)
    - cheque → 1040 (Cheques Received) [cheque_deposit_account for later clearance]
    - bank_transfer/card → specified bank account (1010/1020/1030) or default 1010

    Uses atomic operations and Decimal for all calculations.
    Locks invoice during payment to prevent concurrent modifications.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = InvoicePaymentSerializer

    def _get_account_by_id_or_code(self, account_param):
        """
        Helper: Get ChartOfAccounts by ID or account code.
        """
        if not account_param:
            return None

        try:
            # Try as integer ID first
            if isinstance(account_param, int):
                return ChartOfAccounts.objects.get(id=account_param)
            else:
                # Try as account code (string like "1000")
                try:
                    account_id = int(account_param)
                    return ChartOfAccounts.objects.get(id=account_id)
                except (ValueError, ChartOfAccounts.DoesNotExist):
                    # Try as account code
                    return ChartOfAccounts.objects.get(account_code=str(account_param))
        except ChartOfAccounts.DoesNotExist:
            return None

    def create(self, request, *args, **kwargs):
        invoice_id = self.kwargs.get('pk')

        with transaction.atomic():
            # Lock invoice for update to prevent race conditions
            invoice = SalesInvoice.objects.select_for_update().get(id=invoice_id)

            # Prepare data for serializer
            payment_data = dict(request.data)

            # Get payment method
            payment_method = payment_data.get('payment_method', 'cash')

            # Remove frontend-only fields and clean up empty strings
            payment_data.pop('bank_account_id', None)

            # Remove empty string values for optional fields
            optional_fields = ['reference_number', 'notes', 'cheque_number', 'cheque_date']
            for field in optional_fields:
                if payment_data.get(field) == '' or not payment_data.get(field):
                    payment_data.pop(field, None)

            # AUTO-MAP DEPOSIT ACCOUNT based on payment method
            deposit_account = None

            if payment_method == 'cash':
                # Cash → 1000 (Cash in Hand)
                deposit_account = ChartOfAccounts.objects.get(account_code='1000')

            elif payment_method == 'cheque':
                # Cheque → 1040 (Cheques Received / Undeposited Funds)
                deposit_account = ChartOfAccounts.objects.get(account_code='1040')
                # For cheques, client should provide cheque_deposit_account (where it will be deposited later)
                # This is validated in the serializer

            elif payment_method in ['bank_transfer', 'card']:
                # Bank Transfer/Card → specified bank account or default 1010
                bank_account_param = payment_data.get('bank_account_id')
                if bank_account_param and str(bank_account_param).strip():  # Check non-empty
                    deposit_account = self._get_account_by_id_or_code(bank_account_param)
                    if not deposit_account:
                        return Response(
                            {'error': f'Bank account not found: {bank_account_param}'},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                else:
                    # Default to 1010 (Bank)
                    deposit_account = ChartOfAccounts.objects.get(account_code='1010')

            elif payment_method == 'other':
                # Other → default to 1010
                deposit_account = ChartOfAccounts.objects.get(account_code='1010')

            # Set the auto-mapped deposit account
            if deposit_account:
                payment_data['deposit_account'] = deposit_account.id

            # Process cheque_deposit_account if cheque payment
            cheque_deposit_account_param = payment_data.get('cheque_deposit_account')
            if payment_method == 'cheque':
                if cheque_deposit_account_param and str(cheque_deposit_account_param).strip():  # Check non-empty
                    # Validate cheque_deposit_account exists
                    cheque_deposit_account = self._get_account_by_id_or_code(cheque_deposit_account_param)
                    if not cheque_deposit_account:
                        return Response(
                            {'error': f'Cheque deposit account not found: {cheque_deposit_account_param}'},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                    # Set the account ID
                    payment_data['cheque_deposit_account'] = cheque_deposit_account.id
                else:
                    # For cheque, cheque_deposit_account is optional - will default to None and be handled by signal
                    payment_data.pop('cheque_deposit_account', None)
            else:
                # For non-cheque payments, remove cheque_deposit_account
                payment_data.pop('cheque_deposit_account', None)

            serializer = self.get_serializer(data=payment_data)
            serializer.is_valid(raise_exception=True)

            # Ensure amount is Decimal
            payment_amount = Decimal(str(serializer.validated_data['amount']))

            # Check for overpayment
            invoice_balance_before = Decimal(str(invoice.balance_due))
            invoice_type_at_payment = invoice.invoice_type

            if payment_amount > invoice_balance_before:
                logger.warning(
                    f"Overpayment detected on invoice {invoice.id}: "
                    f"payment={payment_amount}, balance_due={invoice_balance_before}"
                )

            # Create payment record with auto-mapped deposit accounts
            save_kwargs = {
                'invoice': invoice,
                'created_by': request.user,
                'deposit_account': deposit_account
            }

            # Add cheque_deposit_account if it was set (for cheque payments)
            if payment_method == 'cheque' and 'cheque_deposit_account' in payment_data:
                cheque_account_id = payment_data.get('cheque_deposit_account')
                if cheque_account_id:
                    save_kwargs['cheque_deposit_account_id'] = cheque_account_id

            from apps.accounting.services.journal_context import skip_accounting_journal_signals
            from apps.accounting.services.journal_events import schedule_invoice_payment_journal

            # Authoritative flow: views schedule journals explicitly; signals stay as a backstop.
            with skip_accounting_journal_signals():
                payment = serializer.save(**save_kwargs)
            schedule_invoice_payment_journal(
                payment.id,
                invoice_type_at_payment=invoice_type_at_payment,
                invoice_balance_before=str(invoice_balance_before),
            )

            # Update invoice amount_paid and let the model recalculate balance_due
            # Refresh invoice to get latest state
            invoice.refresh_from_db()

            # Calculate new amount_paid (using actual Decimal, not F() expression)
            # so the model's save() method can properly calculate balance_due
            invoice.amount_paid = invoice.amount_paid + payment_amount

            # DON'T use update_fields - we need the model's save() to recalculate balance_due
            invoice.save()

            # Refresh to get final state with recalculated balance_due
            invoice.refresh_from_db()

            # Update status based on payment
            old_status = invoice.status
            if invoice.balance_due <= 0:
                invoice.status = 'paid'
            elif invoice.amount_paid > 0:
                invoice.status = 'partially_paid'

            if invoice.status != old_status:
                invoice.save(update_fields=['status', 'updated_date'])

            # Create timeline entry
            SalesInvoiceTimeline.objects.create(
                invoice=invoice,
                event_type='payment_received',
                message=f"Payment of {payment_amount} recorded via {payment.payment_method}",
                old_status=old_status,
                new_status=invoice.status,
                created_by=request.user
            )

            # Generate receipt number for the payment
            payment.generate_receipt_number()

            # Check for auto-conversion of proforma to tax invoice
            if invoice.invoice_type == 'proforma' and invoice.balance_due <= 0:
                _check_auto_convert_proforma(invoice)

        # Refresh to get final state
        invoice.refresh_from_db()
        payment.refresh_from_db()

        # Return payment data with receipt number
        return Response(InvoicePaymentSerializer(payment).data, status=status.HTTP_201_CREATED)


class ClearChequeView(views.APIView):
    """
    Mark a cheque payment as cleared/deposited.

    POST /sales/invoices/payments/{pk}/clear-cheque/

    Checks:
    - Payment must be a cheque
    - Cheque must not already be cleared

    Updates:
    - cheque_cleared = True
    - cheque_cleared_date = today
    - Triggers signal via update_fields
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        return Response(
            {
                'error': 'Void payment is disabled. Use Reverse Payment (if money never moved) '
                         'or Credit Memo/Refund (if money moved).'
            },
            status=status.HTTP_400_BAD_REQUEST
        )

        # Legacy flow retained for reference; should not be used.
        try:
            payment = InvoicePayment.objects.get(id=pk)
        except InvoicePayment.DoesNotExist:
            return Response(
                {'error': 'Payment not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Validate payment is a cheque
        if payment.payment_method != 'cheque':
            return Response(
                {'error': 'Payment is not a cheque'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate cheque not already cleared
        if payment.cheque_cleared:
            return Response(
                {'error': 'Cheque already cleared'},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            # Update cheque status
            payment.cheque_cleared = True
            payment.cheque_cleared_date = timezone.now().date()
            # Use update_fields to trigger any signal handlers
            payment.save(update_fields=['cheque_cleared', 'cheque_cleared_date', 'updated_at'])

            # Create timeline entry
            SalesInvoiceTimeline.objects.create(
                invoice=payment.invoice,
                event_type='cheque_cleared',
                message=f"Cheque {payment.cheque_number} cleared on {payment.cheque_cleared_date}",
                new_status=payment.invoice.status,
                created_by=request.user
            )

        return Response({
            'success': True,
            'message': f'Cheque {payment.cheque_number} marked as cleared',
            'cheque_cleared_date': payment.cheque_cleared_date
        }, status=status.HTTP_200_OK)


class VoidPaymentView(views.APIView):
    """
    Void a payment and reverse its accounting entries.

    POST /sales/invoices/payments/{pk}/void/

    Checks:
    - Payment must not already be void

    Operations:
    - Lock invoice for update
    - Reverse journal entries if posted
    - Void associated customer advances
    - Update invoice balance atomically
    - Mark payment as void with reason
    - Create timeline entry

    Note: Voiding a payment restores the invoice balance_due.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        return Response(
            {
                'error': 'Void payment is disabled. Use Reverse Payment (if money never moved) '
                         'or Credit Memo/Refund (if money moved).'
            },
            status=status.HTTP_400_BAD_REQUEST
        )

        # Legacy flow retained for reference; should not be used.
        try:
            payment = InvoicePayment.objects.get(id=pk)
        except InvoicePayment.DoesNotExist:
            return Response(
                {'error': 'Payment not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Validate payment not already void
        if payment.is_void:
            return Response(
                {'error': 'Payment already voided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get void reason from request
        void_reason = request.data.get('reason', 'No reason provided')
        if not void_reason:
            void_reason = 'No reason provided'

        with transaction.atomic():
            # Lock invoice for update
            invoice = SalesInvoice.objects.select_for_update().get(id=payment.invoice_id)

            payment_amount = Decimal(str(payment.amount))

            # Reverse journal entries if they exist and are posted
            if payment.journal_entry and payment.journal_entry.is_posted:
                # Create reversal entry
                reversal_entry = JournalEntry.objects.create(
                    journal_number=f"VOID-{payment.journal_entry.journal_number}",
                    entry_date=timezone.now().date(),
                    entry_type='system',
                    source_type='invoice_payment',
                    event_type=f'payment_void_{payment.id}',
                    source_id=payment.id,
                    source_reference=f'Void Payment {payment.id}',
                    description=f'Reversal of payment {payment.id} for invoice {invoice.invoice_number}',
                    is_posted=True,
                    posted_at=timezone.now(),
                    reverses=payment.journal_entry,
                    created_by=request.user
                )

                # Create lines (reverse the original lines)
                from apps.accounting.models import JournalLine

                original_lines = payment.journal_entry.lines.all()
                for line in original_lines:
                    JournalLine.objects.create(
                        journal_entry=reversal_entry,
                        account=line.account,
                        debit=line.credit,  # Reverse debit/credit
                        credit=line.debit,
                        description=f'Reversal: {line.description}'
                    )

                    # Update account balances
                    line.account.update_balance(line.credit, line.debit)

                # Mark original entry as reversed
                payment.journal_entry.is_reversed = True
                payment.journal_entry.reversed_by = request.user
                payment.journal_entry.reversed_at = timezone.now()
                payment.journal_entry.save(
                    update_fields=['is_reversed', 'reversed_by', 'reversed_at']
                )

            # Void any associated customer advances
            advances = CustomerAdvance.objects.filter(
                source_payment=payment,
                status__in=['available', 'applied']
            )
            for advance in advances:
                advance.status = 'voided'
                advance.balance = Decimal('0')
                advance.save(update_fields=['status', 'balance', 'updated_at'])

            # Update invoice balance (using actual Decimal, not F() expression)
            # so the model's save() method can properly calculate balance_due
            invoice.amount_paid = invoice.amount_paid - payment_amount

            # DON'T use update_fields - we need the model's save() to recalculate balance_due
            invoice.save()

            # Refresh to get final state with recalculated balance_due
            invoice.refresh_from_db()

            # Update invoice status
            old_status = invoice.status
            if invoice.balance_due > 0 and invoice.amount_paid > 0:
                invoice.status = 'partially_paid'
            elif invoice.amount_paid <= 0:
                invoice.status = 'draft'
            invoice.save(update_fields=['status', 'updated_date'])

            # Mark payment as void
            payment.is_void = True
            payment.void_reason = void_reason
            payment.voided_by = request.user
            payment.voided_at = timezone.now()
            payment.save(
                update_fields=['is_void', 'void_reason', 'voided_by', 'voided_at']
            )

            # Create timeline entry
            SalesInvoiceTimeline.objects.create(
                invoice=invoice,
                event_type='payment_voided',
                message=f"Payment of {payment_amount} voided. Reason: {void_reason}",
                old_status=old_status,
                new_status=invoice.status,
                created_by=request.user
            )

        # Refresh for response
        invoice.refresh_from_db()

        return Response({
            'success': True,
            'message': f'Payment voided successfully',
            'invoice': SalesInvoiceDetailSerializer(invoice).data
        }, status=status.HTTP_200_OK)


class ReversePaymentView(views.APIView):
    """
    Reverse a payment via accounting reversal (preferred over voiding).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if request.user.role not in ['admin', 'accounting']:
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            with transaction.atomic():
                payment = InvoicePayment.objects.select_for_update().get(id=pk)

                if payment.is_reversed:
                    return Response(
                        {'error': 'Payment already reversed'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                if getattr(payment, 'is_refunded', False):
                    return Response(
                        {'error': 'Payment already refunded'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                if not payment.journal_entry:
                    return Response(
                        {'error': 'Payment has no journal entry to reverse'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                if not payment.journal_entry.is_posted:
                    return Response(
                        {'error': 'Payment journal is not posted'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                reversal_entry = payment.journal_entry.reverse(user=request.user)

                payment.is_reversed = True
                payment.reversed_by = request.user
                payment.reversed_at = timezone.now()
                payment.reversal_journal_entry = reversal_entry
                payment.save(update_fields=[
                    'is_reversed', 'reversed_by', 'reversed_at', 'reversal_journal_entry'
                ])

                invoice = SalesInvoice.objects.select_for_update().get(id=payment.invoice_id)
                payment_amount = Decimal(str(payment.amount))
                invoice.amount_paid = invoice.amount_paid - payment_amount
                invoice.save()
                invoice.refresh_from_db()

                old_status = invoice.status
                if invoice.balance_due <= 0:
                    invoice.status = 'paid'
                elif invoice.amount_paid > 0:
                    invoice.status = 'partially_paid'
                else:
                    invoice.status = 'sent'
                invoice.save(update_fields=['status', 'updated_date'])

                SalesInvoiceTimeline.objects.create(
                    invoice=invoice,
                    event_type='payment_reversed',
                    message=f"Payment of {payment_amount} reversed.",
                    old_status=old_status,
                    new_status=invoice.status,
                    created_by=request.user
                )

            return Response({
                'success': True,
                'message': 'Payment reversed successfully',
                'invoice': SalesInvoiceDetailSerializer(invoice).data
            }, status=status.HTTP_200_OK)
        except InvoicePayment.DoesNotExist:
            return Response({'error': 'Payment not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class RefundPaymentView(views.APIView):
    """
    Refund a payment when money has already moved.

    - Proforma payments: refund full advance (incl VAT) via refund journal
    - Tax invoice payments: only refundable if tied to an overpayment (CustomerAdvance)
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if request.user.role not in ['admin', 'accounting']:
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        from apps.accounting.services.journal_engine import JournalEngine
        from apps.accounting.services.journal_failure import record_journal_failure

        try:
            with transaction.atomic():
                payment = InvoicePayment.objects.select_for_update().select_related('invoice').get(id=pk)

                if payment.is_refunded:
                    return Response({'error': 'Payment already refunded'}, status=status.HTTP_400_BAD_REQUEST)

                if payment.is_reversed or payment.is_void:
                    return Response({'error': 'Payment cannot be refunded after reversal/void'}, status=status.HTTP_400_BAD_REQUEST)

                if payment.payment_method == 'cheque' and not payment.cheque_cleared:
                    return Response(
                        {'error': 'Cheque not cleared. Use Reverse Payment instead.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                if not payment.journal_entry or not payment.journal_entry.is_posted:
                    return Response({'error': 'Payment journal is not posted'}, status=status.HTTP_400_BAD_REQUEST)

                refund_amount = None

                if payment.invoice and payment.invoice.invoice_type == 'proforma':
                    try:
                        journal = JournalEngine.handle_proforma_advance_refund(payment)
                    except Exception as je_error:
                        record_journal_failure('invoice_payment', payment.id, 'proforma_advance_refunded', je_error)
                        raise
                    refund_amount = Decimal(str(payment.amount))
                else:
                    advance = CustomerAdvance.objects.select_for_update().filter(
                        source_payment=payment,
                        status='available',
                        balance__gt=0
                    ).first()
                    if not advance:
                        return Response(
                            {'error': 'Refund is only available for overpayments (customer advance balance).'},
                            status=status.HTTP_400_BAD_REQUEST
                        )

                    refund_amount = Decimal(str(advance.balance))
                    if refund_amount <= 0:
                        return Response({'error': 'No refundable advance balance'}, status=status.HTTP_400_BAD_REQUEST)

                    try:
                        journal = JournalEngine.handle_invoice_payment_refund(payment, refund_amount=refund_amount)
                    except Exception as je_error:
                        record_journal_failure('invoice_payment', payment.id, 'payment_refunded', je_error)
                        raise

                    advance.status = 'refunded'
                    advance.balance = Decimal('0')
                    advance.save(update_fields=['status', 'balance', 'updated_at'])

                payment.is_refunded = True
                payment.refunded_by = request.user
                payment.refunded_at = timezone.now()
                payment.refund_journal_entry = journal
                payment.save(update_fields=[
                    'is_refunded', 'refunded_by', 'refunded_at', 'refund_journal_entry'
                ])

                invoice = SalesInvoice.objects.select_for_update().get(id=payment.invoice_id)
                invoice.amount_paid = invoice.amount_paid - refund_amount
                invoice.save()
                invoice.refresh_from_db()

                old_status = invoice.status
                if invoice.balance_due <= 0:
                    invoice.status = 'paid'
                elif invoice.amount_paid > 0:
                    invoice.status = 'partially_paid'
                else:
                    invoice.status = 'sent'
                invoice.save(update_fields=['status', 'updated_date'])

                SalesInvoiceTimeline.objects.create(
                    invoice=invoice,
                    event_type='payment_refunded',
                    message=f"Payment of {refund_amount} refunded.",
                    old_status=old_status,
                    new_status=invoice.status,
                    created_by=request.user
                )

            return Response({
                'success': True,
                'message': 'Payment refunded successfully',
                'invoice': SalesInvoiceDetailSerializer(invoice).data
            }, status=status.HTTP_200_OK)

        except InvoicePayment.DoesNotExist:
            return Response({'error': 'Payment not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class AllocatePaymentView(views.APIView):
    """
    Allocate a single payment across multiple invoices.

    POST /sales/invoices/allocate-payment/

    Request body:
    {
        "customer_id": 1,
        "amount": 1000.00,
        "payment_method": "bank_transfer",
        "deposit_account": "1010",
        "reference_number": "TXN-12345",
        "allocations": [
            {"invoice_id": 1, "amount": 600.00},
            {"invoice_id": 2, "amount": 400.00}
        ]
    }

    Validations:
    - All allocations must be for the same customer
    - Allocations must sum to total payment amount
    - No allocation can exceed invoice balance
    - All invoices must exist

    Operations:
    - Lock all invoices atomically
    - Create single InvoicePayment record
    - Create PaymentAllocation records for each invoice
    - Update each invoice's amount_paid atomically
    - Create timeline entries for each invoice

    Returns:
    - success: bool
    - message: str
    - payment_id: int
    - allocations: list of allocations created
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Extract request data
        customer_id = request.data.get('customer_id')
        payment_amount = request.data.get('amount')
        payment_method = request.data.get('payment_method', 'bank_transfer')
        reference_number = request.data.get('reference_number')
        deposit_account_param = request.data.get('deposit_account')
        allocations_data = request.data.get('allocations', [])

        # Validate required fields
        if not customer_id or not payment_amount or not allocations_data:
            return Response(
                {'error': 'customer_id, amount, and allocations are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Convert amount to Decimal
        try:
            payment_amount = Decimal(str(payment_amount))
        except:
            return Response(
                {'error': 'Invalid payment amount'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if payment_amount <= 0:
            return Response(
                {'error': 'Payment amount must be positive'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate allocations
        if not isinstance(allocations_data, list) or len(allocations_data) == 0:
            return Response(
                {'error': 'allocations must be a non-empty list'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check allocation amounts sum to payment amount
        allocation_total = Decimal('0')
        allocation_ids = []

        for alloc in allocations_data:
            try:
                alloc_amount = Decimal(str(alloc.get('amount', 0)))
                allocation_total += alloc_amount
                allocation_ids.append(alloc.get('invoice_id'))
            except:
                return Response(
                    {'error': 'Invalid allocation amount'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        if allocation_total != payment_amount:
            return Response(
                {'error': f'Allocations sum ({allocation_total}) must equal payment amount ({payment_amount})'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Handle deposit_account
        deposit_account = None
        if deposit_account_param:
            try:
                if isinstance(deposit_account_param, int):
                    deposit_account = ChartOfAccounts.objects.get(id=deposit_account_param)
                else:
                    try:
                        deposit_account_id = int(deposit_account_param)
                        deposit_account = ChartOfAccounts.objects.get(id=deposit_account_id)
                    except (ValueError, ChartOfAccounts.DoesNotExist):
                        deposit_account = ChartOfAccounts.objects.get(
                            account_code=str(deposit_account_param)
                        )
            except ChartOfAccounts.DoesNotExist:
                return Response(
                    {'error': f'Deposit account not found: {deposit_account_param}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        with transaction.atomic():
            # Lock all invoices for update
            invoices = SalesInvoice.objects.select_for_update().filter(
                id__in=allocation_ids,
                customer_id=customer_id
            )

            # Validate all invoices exist and belong to customer
            if invoices.count() != len(allocation_ids):
                return Response(
                    {'error': 'One or more invoices not found or do not belong to customer'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Create invoice dict for easy lookup
            invoice_dict = {inv.id: inv for inv in invoices}

            # Validate each allocation
            for alloc in allocations_data:
                invoice_id = alloc.get('invoice_id')
                alloc_amount = Decimal(str(alloc.get('amount')))
                invoice = invoice_dict.get(invoice_id)

                if not invoice:
                    return Response(
                        {'error': f'Invoice {invoice_id} not found'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                if alloc_amount > invoice.balance_due:
                    return Response(
                        {'error': f'Allocation ({alloc_amount}) exceeds balance_due ({invoice.balance_due}) for invoice {invoice.invoice_number}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

            # Create the payment record
            payment = InvoicePayment.objects.create(
                invoice=invoices.first(),  # Anchor to first invoice
                payment_date=timezone.now(),
                amount=payment_amount,
                payment_method=payment_method,
                reference_number=reference_number,
                deposit_account=deposit_account,
                created_by=request.user
            )

            # Create allocations and update invoice balances
            created_allocations = []

            for alloc in allocations_data:
                invoice_id = alloc.get('invoice_id')
                alloc_amount = Decimal(str(alloc.get('amount')))
                invoice = invoice_dict[invoice_id]

                # Create allocation record
                allocation = PaymentAllocation.objects.create(
                    payment=payment,
                    invoice=invoice,
                    amount=alloc_amount
                )
                created_allocations.append(allocation)

                # Update invoice balance using atomic F() expression
                invoice.amount_paid = F('amount_paid') + alloc_amount
                invoice.save(update_fields=['amount_paid', 'updated_date'])

            # Update invoice statuses and create timeline entries
            for invoice_id, invoice in invoice_dict.items():
                # Refresh to get calculated balance_due
                invoice.refresh_from_db()

                old_status = invoice.status
                if invoice.balance_due <= 0:
                    invoice.status = 'paid'
                elif invoice.amount_paid > 0:
                    invoice.status = 'partially_paid'

                if invoice.status != old_status:
                    invoice.save(update_fields=['status', 'updated_date'])

                # Get allocation amount for this invoice
                alloc_amount = next(
                    (Decimal(str(a['amount'])) for a in allocations_data if a['invoice_id'] == invoice_id),
                    Decimal('0')
                )

                # Create timeline entry
                SalesInvoiceTimeline.objects.create(
                    invoice=invoice,
                    event_type='payment_allocated',
                    message=f"Payment allocation of {alloc_amount} created",
                    old_status=old_status,
                    new_status=invoice.status,
                    created_by=request.user
                )

        return Response({
            'success': True,
            'message': f'Payment allocated across {len(created_allocations)} invoices',
            'payment_id': payment.id,
            'allocations': [
                {
                    'invoice_id': a.invoice_id,
                    'invoice_number': a.invoice.invoice_number,
                    'amount': a.amount
                }
                for a in created_allocations
            ]
        }, status=status.HTTP_201_CREATED)


class GetNextInvoiceNumberView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        year = timezone.now().year
        last_invoice = SalesInvoice.objects.filter(invoice_number__contains=f'INV-{year}').order_by('-id').first()
        if last_invoice:
            try:
                last_num = int(last_invoice.invoice_number.split('-')[-1])
                new_num = last_num + 1
            except:
                new_num = 1
        else:
            new_num = 1

        invoice_number = f"INV-{year}-{new_num:04d}"
        return Response({"success": True, "invoice_number": invoice_number})


class InvoicePDFView(views.APIView):
    """Generate and return PDF for a specific invoice"""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        invoice = get_object_or_404(
            SalesInvoice.objects.select_related('customer', 'created_by').prefetch_related('items'),
            pk=pk
        )

        # Prepare context for template
        context = {
            'invoice': invoice,
            'items': invoice.items.all(),
            'now': timezone.now(),
        }

        # Render HTML template
        html_string = render_to_string('invoices/invoice_pdf.html', context)

        # Generate PDF
        pdf_buffer = BytesIO()
        html = HTML(string=html_string, base_url=request.build_absolute_uri('/'))
        html.write_pdf(pdf_buffer)
        pdf_buffer.seek(0)

        # Create HTTP response
        response = HttpResponse(pdf_buffer.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="Invoice-{invoice.invoice_number}.pdf"'

        return response


class SendInvoiceEmailView(views.APIView):
    """Send invoice via email"""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        logger.info(f"Email endpoint called for invoice {pk}")

        try:
            invoice = get_object_or_404(
                SalesInvoice.objects.select_related('customer', 'created_by'),
                pk=pk
            )
            logger.info(f"Found invoice: {invoice.invoice_number}")

            # Get request data
            data = request.data or {}
            to_emails = data.get('to_emails', [])
            cc_emails = data.get('cc_emails', [])
            bcc_emails = data.get('bcc_emails', [])
            subject = data.get('subject', f'Invoice {invoice.invoice_number}').strip()
            message = data.get('message', '').strip()
            message_html = data.get('message_html', '').strip()
            send_copy_to_sender = data.get('send_copy_to_sender', False)

            # If no emails provided, use customer email
            if not to_emails and invoice.customer and invoice.customer.email:
                to_emails = [invoice.customer.email]

            if not to_emails:
                return Response(
                    {'error': 'No recipient email found. Please provide email address or ensure customer has an email.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Validate email format
            email_regex = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
            for email in to_emails + cc_emails + bcc_emails:
                if not email_regex.match(email):
                    return Response(
                        {'error': f'Invalid email format: {email}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

            # Prepare email data for Celery task
            email_data = {
                'invoice_id': invoice.id,
                'from_email': request.user.email or 'noreply@example.com',
                'to_emails': to_emails,
                'cc_emails': cc_emails,
                'bcc_emails': bcc_emails,
                'subject': subject,
                'message': message_html if message_html else message,
                'send_copy_to_sender': send_copy_to_sender,
                'sender_name': request.user.username or request.user.email,
                'user_id': request.user.id,
            }

            # Queue the email task
            logger.info(f"Starting email task for invoice {invoice.invoice_number}")
            task = send_invoice_email_task.delay(email_data)
            logger.info(f"Email task queued with ID: {task.id}")

            return Response({
                'success': True,
                'message': f'Email is being sent to {len(to_emails)} recipient(s)',
                'task_id': task.id,
                'invoice_number': invoice.invoice_number,
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error in send_invoice_email: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            return Response(
                {'error': f'Failed to send email: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SendInvoiceWhatsAppView(views.APIView):
    """Send invoice via WhatsApp"""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        logger.info(f"WhatsApp endpoint called for invoice {pk}")

        try:
            invoice = get_object_or_404(
                SalesInvoice.objects.select_related('customer', 'created_by'),
                pk=pk
            )
            logger.info(f"Found invoice: {invoice.invoice_number}")

            # Get request data
            data = request.data or {}
            phone_number = data.get('phone_number', '').strip()
            message = data.get('message', '').strip()

            if not phone_number:
                return Response(
                    {'error': 'Phone number is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if not message:
                return Response(
                    {'error': 'Message is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Prepare WhatsApp data for Celery task
            whatsapp_data = {
                'invoice_id': invoice.id,
                'phone_number': phone_number,
                'message': message,
                'sender_name': request.user.username or request.user.email,
                'user_id': request.user.id,
            }

            # Queue the WhatsApp task
            logger.info(f"Starting WhatsApp task for invoice {invoice.invoice_number} to {phone_number}")
            task = send_invoice_whatsapp_task.delay(whatsapp_data)
            logger.info(f"WhatsApp task queued with ID: {task.id}")

            return Response({
                'success': True,
                'message': f'WhatsApp is being sent to {phone_number}',
                'task_id': task.id,
                'invoice_number': invoice.invoice_number,
                'phone_number': phone_number,
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error in send_invoice_whatsapp: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            return Response(
                {'error': f'Failed to send WhatsApp: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class PrintInvoiceView(views.APIView):
    """Create a print job for an invoice"""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            invoice = get_object_or_404(SalesInvoice, pk=pk)

            # Get optional parameters
            printer_name = request.data.get('printer_name')
            copies = request.data.get('copies', 1)

            # Validate copies
            try:
                copies = int(copies)
                if copies < 1 or copies > 99:
                    copies = 1
            except (ValueError, TypeError):
                copies = 1

            logger.info(f"Creating print job for invoice {invoice.invoice_number} by user {request.user.email}")

            with transaction.atomic():
                # Update invoice status to 'sent' if currently 'draft'
                old_status = invoice.status
                if invoice.status == 'draft':
                    invoice.status = 'sent'
                    invoice.save(update_fields=['status', 'updated_date'])

                # Create timeline entry
                SalesInvoiceTimeline.objects.create(
                    invoice=invoice,
                    event_type='sent',
                    message=f"Invoice printed ({copies} copies) by {request.user.get_full_name()}",
                    old_status=old_status,
                    new_status=invoice.status,
                    created_by=request.user
                )

            return Response({
                'success': True,
                'message': f'Print job created for invoice #{invoice.invoice_number}',
                'invoice_number': invoice.invoice_number,
                'copies': copies,
                'printer_name': printer_name,
                'invoice_status': invoice.status,
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Failed to create print job: {str(e)}")
            return Response(
                {'error': f'Failed to create print job: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# ===================== RECEIPT ENDPOINTS =====================

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def email_receipt(request, payment_id):
    """
    Send payment receipt via email with PDF attachment.

    POST body:
    {
        "to_emails": ["customer@example.com"],
        "cc_emails": [],
        "bcc_emails": [],
        "subject": "Payment Receipt #RCP-2026-00001",
        "message": "Thank you for your payment...",
        "message_html": "<p>Thank you...</p>",
        "send_copy_to_sender": false
    }
    """
    try:
        from .tasks import send_receipt_email_task

        payment = InvoicePayment.objects.select_related('invoice__customer').get(id=payment_id)

        # Ensure receipt number exists
        if not payment.receipt_number:
            payment.generate_receipt_number()

        # Queue email task
        send_receipt_email_task.delay(
            payment_id=payment_id,
            to_emails=request.data.get('to_emails', []),
            cc_emails=request.data.get('cc_emails', []),
            bcc_emails=request.data.get('bcc_emails', []),
            subject=request.data.get('subject', ''),
            message=request.data.get('message', ''),
            message_html=request.data.get('message_html', ''),
            send_copy_to_sender=request.data.get('send_copy_to_sender', False),
            sender_id=request.user.id
        )

        return Response({
            'message': 'Receipt email queued for sending',
            'receipt_number': payment.receipt_number
        }, status=status.HTTP_200_OK)

    except InvoicePayment.DoesNotExist:
        return Response({'error': 'Payment not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error queuing receipt email: {e}", exc_info=True)
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def whatsapp_receipt(request, payment_id):
    """
    Send payment receipt via WhatsApp with secure link.

    POST body:
    {
        "phone_number": "+94771234567",
        "message": "Optional custom message"
    }
    """
    try:
        from .tasks import send_receipt_whatsapp_task

        payment = InvoicePayment.objects.select_related('invoice__customer').get(id=payment_id)

        # Ensure receipt number exists
        if not payment.receipt_number:
            payment.generate_receipt_number()

        # Queue WhatsApp task
        send_receipt_whatsapp_task.delay(
            payment_id=payment_id,
            phone_number=request.data.get('phone_number'),
            custom_message=request.data.get('message', ''),
            sender_id=request.user.id
        )

        return Response({
            'message': 'Receipt WhatsApp message queued',
            'receipt_number': payment.receipt_number
        }, status=status.HTTP_200_OK)

    except InvoicePayment.DoesNotExist:
        return Response({'error': 'Payment not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error queuing receipt WhatsApp: {e}", exc_info=True)
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def print_receipt(request, payment_id):
    """
    Print payment receipt to A5 printer.

    POST body:
    {
        "printer_name": "optional - uses default A5 printer if not provided",
        "copies": 1
    }
    """
    try:
        from .tasks import create_receipt_print_job_task

        payment = InvoicePayment.objects.select_related('invoice__customer').get(id=payment_id)

        # Ensure receipt number exists
        if not payment.receipt_number:
            payment.generate_receipt_number()

        # Queue print task
        create_receipt_print_job_task.delay(
            payment_id=payment_id,
            printer_name=request.data.get('printer_name'),
            copies=request.data.get('copies', 1),
            user_id=request.user.id
        )

        return Response({
            'message': 'Receipt print job queued',
            'receipt_number': payment.receipt_number
        }, status=status.HTTP_200_OK)

    except InvoicePayment.DoesNotExist:
        return Response({'error': 'Payment not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error queuing receipt print: {e}", exc_info=True)
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_receipt_share_link(request, payment_id):
    """
    Generate a secure share link for viewing receipt online.

    Returns:
    {
        "share_url": "https://printcloud.example.com/receipts/view/[signed-token]",
        "receipt_number": "RCP-2026-00001"
    }
    """
    try:
        from django.core.signing import Signer

        payment = InvoicePayment.objects.get(id=payment_id)

        # Ensure receipt number exists
        if not payment.receipt_number:
            payment.generate_receipt_number()

        # Generate signed token
        signer = Signer()
        token = signer.sign(f"receipt_{payment.id}")

        # Build share URL
        frontend_url = getattr(settings, 'FRONTEND_URL', None)
        if not frontend_url:
            frontend_url = request.build_absolute_uri('/')[:-1]

        share_url = f"{frontend_url}/receipts/view/{token}"

        return Response({
            'share_url': share_url,
            'receipt_number': payment.receipt_number
        }, status=status.HTTP_200_OK)

    except InvoicePayment.DoesNotExist:
        return Response({'error': 'Payment not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error generating receipt share link: {e}", exc_info=True)
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def view_receipt_public(request, token):
    """
    Public endpoint to view receipt via secure share link.
    No authentication required.

    Returns receipt data for frontend display.
    """
    try:
        from django.core.signing import Signer, BadSignature

        signer = Signer()
        unsigned_value = signer.unsign(token)

        # Extract payment ID from token
        if not unsigned_value.startswith('receipt_'):
            return Response({'error': 'Invalid token'}, status=status.HTTP_400_BAD_REQUEST)

        payment_id = int(unsigned_value.replace('receipt_', ''))

        payment = InvoicePayment.objects.select_related(
            'invoice__customer',
            'created_by',
            'deposit_account',
            'cheque_deposit_account'
        ).get(id=payment_id)

        # Ensure receipt number exists
        if not payment.receipt_number:
            payment.generate_receipt_number()

        # Return receipt data
        return Response({
            'receipt_number': payment.receipt_number,
            'payment_date': payment.payment_date,
            'amount': payment.amount,
            'payment_method': payment.get_payment_method_display(),
            'customer_name': payment.invoice.customer.name if payment.invoice.customer else 'N/A',
            'invoice_number': payment.invoice.invoice_number,
            'cashier': payment.created_by.get_full_name() if payment.created_by else 'N/A',
            'cheque_number': payment.cheque_number,
            'cheque_date': payment.cheque_date,
            'reference_number': payment.reference_number,
            'notes': payment.notes,
            'bank_name': payment.deposit_account.account_name if payment.deposit_account else None,
            'cheque_bank_name': payment.cheque_deposit_account.account_name if payment.cheque_deposit_account else None,
        }, status=status.HTTP_200_OK)

    except BadSignature:
        return Response({'error': 'Invalid or expired token'}, status=status.HTTP_400_BAD_REQUEST)
    except InvoicePayment.DoesNotExist:
        return Response({'error': 'Receipt not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error viewing receipt: {e}", exc_info=True)
        return Response({'error': 'Unable to load receipt'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def download_receipt_pdf(request, token):
    """
    Download receipt PDF via secure share link.
    No authentication required.
    """
    try:
        from django.core.signing import Signer, BadSignature
        from django.http import FileResponse
        from .utils import generate_receipt_pdf

        signer = Signer()
        unsigned_value = signer.unsign(token)

        if not unsigned_value.startswith('receipt_'):
            return Response({'error': 'Invalid token'}, status=status.HTTP_400_BAD_REQUEST)

        payment_id = int(unsigned_value.replace('receipt_', ''))
        payment = InvoicePayment.objects.get(id=payment_id)

        # Ensure receipt number exists
        if not payment.receipt_number:
            payment.generate_receipt_number()

        # Generate PDF
        pdf_buffer = generate_receipt_pdf(payment_id)

        # Return as file download
        response = FileResponse(
            pdf_buffer,
            as_attachment=True,
            filename=f'Receipt-{payment.receipt_number}.pdf',
            content_type='application/pdf'
        )

        return response

    except BadSignature:
        return Response({'error': 'Invalid or expired token'}, status=status.HTTP_400_BAD_REQUEST)
    except InvoicePayment.DoesNotExist:
        return Response({'error': 'Receipt not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error downloading receipt PDF: {e}", exc_info=True)
        return Response({'error': 'Unable to generate receipt'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def view_receipt_by_number(request, receipt_number):
    """
    Public endpoint to view receipt by receipt number.
    No authentication required.

    Returns receipt data for frontend display.
    """
    try:
        payment = InvoicePayment.objects.select_related(
            'invoice__customer',
            'created_by',
            'deposit_account',
            'cheque_deposit_account'
        ).get(receipt_number=receipt_number)

        # Return receipt data
        return Response({
            'payment': {
                'id': payment.id,
                'receipt_number': payment.receipt_number,
                'payment_date': payment.payment_date,
                'amount': str(payment.amount),
                'payment_method': payment.payment_method,
                'reference_number': payment.reference_number,
                'cheque_number': payment.cheque_number,
                'cheque_date': payment.cheque_date,
                'receipt_generated_at': payment.receipt_generated_at,
            },
            'invoice': {
                'id': payment.invoice.id,
                'invoice_number': payment.invoice.invoice_number,
                'customer_name': payment.invoice.customer.name if payment.invoice.customer else 'N/A',
                'customer_email': payment.invoice.customer.email if payment.invoice.customer else None,
                'customer_phone': payment.invoice.customer.phone if payment.invoice.customer else None,
            },
            'cashier_name': payment.created_by.get_full_name() if payment.created_by else 'N/A',
        }, status=status.HTTP_200_OK)

    except InvoicePayment.DoesNotExist:
        return Response({'error': 'Receipt not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error viewing receipt by number: {e}", exc_info=True)
        return Response({'error': 'Unable to load receipt'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def download_receipt_pdf_by_number(request, receipt_number):
    """
    Public endpoint to download receipt PDF by receipt number.
    No authentication required.

    Returns PDF binary data.
    """
    try:
        from .utils import generate_receipt_pdf

        # Get payment by receipt number
        payment = InvoicePayment.objects.get(receipt_number=receipt_number)

        # Generate PDF
        pdf_buffer = generate_receipt_pdf(payment.id)

        # Return PDF as response
        response = HttpResponse(pdf_buffer.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="Receipt-{receipt_number}.pdf"'
        return response

    except InvoicePayment.DoesNotExist:
        return Response({'error': 'Receipt not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error downloading receipt PDF by number: {e}", exc_info=True)
        return Response({'error': 'Unable to generate receipt'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ===================== PROFORMA TO TAX INVOICE CONVERSION =====================

class ConvertProformaToTaxInvoiceView(views.APIView):
    """
    Convert a Proforma Invoice to a Tax Invoice.

    This is the VAT trigger point. When converted:
    1. Invoice type changes from 'proforma' to 'tax_invoice'
    2. Journal entry is created:
       - DR: Customer Advances (2100) for advances applied
       - DR: AR (1100) for balance due
       - CR: Sales Revenue (4000)
       - CR: VAT Payable (2400) for remaining VAT

    Conversion can happen:
    - Automatically: When proforma is paid in full
    - Manually: User clicks "Convert to Tax Invoice" button

    POST /sales/invoices/{pk}/convert-to-tax-invoice/
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            with transaction.atomic():
                invoice = SalesInvoice.objects.select_for_update().get(id=pk)

                already_converted = invoice.invoice_type == 'tax_invoice'
                invoice = invoice.convert_proforma_to_tax_invoice(user=request.user)

                if not already_converted:
                    SalesInvoiceTimeline.objects.create(
                        invoice=invoice,
                        event_type='modified',
                        message=f"Converted from Proforma to Tax Invoice by {request.user.get_full_name()}. Advances applied: Rs. {invoice.advances_applied:,.2f}",
                        created_by=request.user
                    )

            from apps.accounting.models import JournalEntry
            tax_journal = JournalEntry.objects.filter(
                source_type='sales_invoice',
                source_id=invoice.id,
                event_type='tax_invoice_created',
            ).order_by('-id').first()

            return Response({
                'success': True,
                'message': 'Invoice converted to Tax Invoice successfully' if not already_converted else 'Invoice is already a Tax Invoice',
                'invoice_number': invoice.invoice_number,
                'invoice_type': invoice.invoice_type,
                'advances_applied': float(invoice.advances_applied),
                'balance_due': float(invoice.balance_due),
                'journal_id': tax_journal.id if tax_journal else None,
            }, status=status.HTTP_200_OK)

        except SalesInvoice.DoesNotExist:
            return Response(
                {'error': 'Invoice not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            from django.core.exceptions import ValidationError

            if isinstance(e, ValidationError):
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

            logger.error(f"Error converting proforma to tax invoice: {e}")
            logger.error(traceback.format_exc())
            return Response(
                {'error': f'Failed to convert invoice: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


def _check_auto_convert_proforma(invoice):
    """
    Check if a proforma invoice should be auto-converted to tax invoice.

    Auto-conversion happens when:
    - Invoice type is 'proforma'
    - Invoice is fully paid (balance_due <= 0)

    This function should be called after recording a payment.
    """
    if invoice.invoice_type != 'proforma':
        return False

    if invoice.balance_due > 0:
        return False

    try:
        with transaction.atomic():
            locked = SalesInvoice.objects.select_for_update().get(pk=invoice.pk)
            if locked.invoice_type == 'tax_invoice':
                return True

            locked = locked.convert_proforma_to_tax_invoice(user=None)

            SalesInvoiceTimeline.objects.create(
                invoice=locked,
                event_type='modified',
                message=f"Auto-converted to Tax Invoice (fully paid). Advances applied: Rs. {locked.advances_applied:,.2f}",
                created_by=None
            )

        logger.info(f"Invoice {invoice.invoice_number} auto-converted to Tax Invoice")
        return True

    except Exception as e:
        logger.error(f"Error in auto-convert proforma: {e}")
        return False


class SalesCreditNoteViewSet(viewsets.ModelViewSet):
    """ViewSet for Sales Credit Notes (credit memo module)."""
    queryset = SalesCreditNote.objects.select_related(
        'customer', 'invoice', 'order', 'invoice_payment', 'order_payment',
        'applied_to_invoice', 'approved_by', 'created_by', 'payout_account'
    )
    serializer_class = SalesCreditNoteSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['credit_note_number', 'reason', 'customer__name']
    ordering_fields = ['credit_note_date', 'credit_note_number', 'created_at']
    ordering = ['-credit_note_date', '-credit_note_number']
    filterset_fields = {
        'credit_note_date': ['gte', 'lte', 'exact'],
        'status': ['exact'],
        'credit_note_type': ['exact'],
        'customer': ['exact'],
    }

    def create(self, request, *args, **kwargs):
        from apps.accounting.permissions import IsAccountingOrAdmin
        from apps.accounting.services.journal_engine import JournalEngine
        from apps.accounting.services.journal_failure import record_journal_failure
        from django.core.exceptions import ValidationError

        if not IsAccountingOrAdmin().has_permission(request, self):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        credit_note_type = data.get('credit_note_type', 'ar_credit')

        try:
            with transaction.atomic():
                if credit_note_type in ['payment_reverse', 'payment_refund']:
                    invoice_payment = data.get('invoice_payment')
                    order_payment = data.get('order_payment')

                    if invoice_payment and order_payment:
                        raise ValidationError('Select either an invoice payment or an order payment, not both.')
                    if not invoice_payment and not order_payment:
                        raise ValidationError('Payment is required for this credit note.')

                    if invoice_payment:
                        try:
                            payment = InvoicePayment.objects.select_for_update().select_related('invoice').get(
                                pk=invoice_payment.id
                            )
                        except InvoicePayment.DoesNotExist:
                            raise ValidationError('Invoice payment not found')
                        customer = payment.invoice.customer if payment.invoice else None
                        invoice = payment.invoice
                        order = None
                    else:
                        try:
                            payment = OrderPayment.objects.select_for_update().select_related('order').get(
                                pk=order_payment.id
                            )
                        except OrderPayment.DoesNotExist:
                            raise ValidationError('Order payment not found')
                        customer = payment.order.customer if payment.order else None
                        invoice = None
                        order = payment.order

                    if payment.is_void or payment.is_reversed or payment.is_refunded:
                        raise ValidationError('Payment already reversed/refunded/voided.')

                    if payment.payment_method == 'cheque' and not payment.cheque_cleared:
                        if credit_note_type == 'payment_refund':
                            raise ValidationError('Cheque not cleared. Use Reverse Payment instead.')

                    if not payment.journal_entry or not payment.journal_entry.is_posted:
                        raise ValidationError('Payment journal is not posted.')

                    payout_method = data.get('payout_method')
                    payout_account = data.get('payout_account')
                    payout_account_code = payout_account.account_code if payout_account else None

                    bank_account_name = data.get('customer_bank_account_name') or (customer.bank_account_name if customer else None)
                    bank_name = data.get('customer_bank_name') or (customer.bank_name if customer else None)
                    bank_account_number = data.get('customer_bank_account_number') or (customer.bank_account_number if customer else None)

                    refund_amount = Decimal(str(payment.amount))

                    if credit_note_type == 'payment_refund':
                        if payout_method == 'bank_transfer' and not all([bank_account_name, bank_name, bank_account_number]):
                            raise ValidationError('Customer bank details are required for bank transfer refunds.')

                        if invoice_payment:
                            if invoice and invoice.invoice_type == 'proforma':
                                try:
                                    journal = JournalEngine.handle_proforma_advance_refund(
                                        payment, payout_account_code=payout_account_code
                                    )
                                except Exception as je_error:
                                    record_journal_failure('invoice_payment', payment.id, 'proforma_advance_refunded', je_error)
                                    raise
                            else:
                                advance = CustomerAdvance.objects.select_for_update().filter(
                                    source_payment=payment,
                                    status='available',
                                    balance__gt=0
                                ).first()
                                if not advance:
                                    raise ValidationError('Refund is only available for overpayments (customer advance balance).')
                                refund_amount = Decimal(str(advance.balance))
                                if refund_amount <= 0:
                                    raise ValidationError('No refundable advance balance')
                                try:
                                    journal = JournalEngine.handle_invoice_payment_refund(
                                        payment,
                                        refund_amount=refund_amount,
                                        payout_account_code=payout_account_code
                                    )
                                except Exception as je_error:
                                    record_journal_failure('invoice_payment', payment.id, 'payment_refunded', je_error)
                                    raise
                                advance.status = 'refunded'
                                advance.balance = Decimal('0')
                                advance.save(update_fields=['status', 'balance', 'updated_at'])
                        else:
                            try:
                                journal = JournalEngine.handle_order_advance_refund(
                                    payment, payout_account_code=payout_account_code
                                )
                            except Exception as je_error:
                                record_journal_failure('order_payment', payment.id, 'advance_refunded', je_error)
                                raise

                        payment.is_refunded = True
                        payment.refunded_by = request.user
                        payment.refunded_at = timezone.now()
                        payment.refund_journal_entry = journal
                        payment.save(update_fields=[
                            'is_refunded', 'refunded_by', 'refunded_at', 'refund_journal_entry'
                        ])
                    else:
                        journal = payment.journal_entry.reverse(user=request.user)
                        payment.is_reversed = True
                        payment.reversed_by = request.user
                        payment.reversed_at = timezone.now()
                        payment.reversal_journal_entry = journal
                        payment.save(update_fields=[
                            'is_reversed', 'reversed_by', 'reversed_at', 'reversal_journal_entry'
                        ])

                    credit_note = SalesCreditNote.objects.create(
                        credit_note_type=credit_note_type,
                        customer=customer or data.get('customer'),
                        invoice=invoice or data.get('invoice'),
                        order=order or data.get('order'),
                        invoice_payment=invoice_payment,
                        order_payment=order_payment,
                        credit_note_date=data.get('credit_note_date') or timezone.now().date(),
                        amount=refund_amount,
                        reason=data.get('reason'),
                        detail_note=data.get('detail_note'),
                        description=data.get('description'),
                        payout_method=payout_method,
                        payout_account=payout_account,
                        payout_voucher_number=data.get('payout_voucher_number'),
                        payout_cheque_number=data.get('payout_cheque_number'),
                        customer_bank_account_name=bank_account_name,
                        customer_bank_name=bank_name,
                        customer_bank_account_number=bank_account_number,
                        journal_entry=journal,
                        status='approved',
                        approved_by=request.user,
                        approved_at=timezone.now(),
                        created_by=request.user,
                    )

                    if invoice_payment:
                        invoice = SalesInvoice.objects.select_for_update().get(id=payment.invoice_id)
                        invoice.amount_paid = invoice.amount_paid - refund_amount
                        invoice.save()
                        invoice.refresh_from_db()
                        old_status = invoice.status
                        if invoice.balance_due <= 0:
                            invoice.status = 'paid'
                        elif invoice.amount_paid > 0:
                            invoice.status = 'partially_paid'
                        else:
                            invoice.status = 'sent'
                        invoice.save(update_fields=['status', 'updated_date'])

                        SalesInvoiceTimeline.objects.create(
                            invoice=invoice,
                            event_type='payment_refunded' if credit_note_type == 'payment_refund' else 'payment_reversed',
                            message=f"Credit note {credit_note.credit_note_number} created.",
                            old_status=old_status,
                            new_status=invoice.status,
                            created_by=request.user
                        )
                    else:
                        from django.db.models import Sum
                        order = payment.order
                        total_paid = OrderPayment.objects.filter(
                            order=order,
                            is_void=False,
                            is_reversed=False,
                            is_refunded=False
                        ).aggregate(total=Sum('amount'))['total'] or 0
                        order.amount_paid = total_paid
                        order.balance_due = order.net_total - total_paid
                        order.save(update_fields=['amount_paid', 'balance_due'])
                        SalesOrderTimeline.objects.create(
                            order=order,
                            event_type='modified',
                            message=f"Credit note {credit_note.credit_note_number} created.",
                            created_by=request.user
                        )
                else:
                    credit_note = SalesCreditNote.objects.create(
                        credit_note_type=credit_note_type,
                        customer=data.get('customer'),
                        invoice=data.get('invoice'),
                        order=data.get('order'),
                        credit_note_date=data.get('credit_note_date') or timezone.now().date(),
                        amount=data.get('amount') or Decimal('0.00'),
                        reason=data.get('reason'),
                        detail_note=data.get('detail_note'),
                        description=data.get('description'),
                        status='draft',
                        created_by=request.user,
                    )

                return Response(self.get_serializer(credit_note).data, status=status.HTTP_201_CREATED)
        except ValidationError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        note = self.get_object()
        try:
            note.approve(request.user)
            return Response({'status': 'success', 'message': 'Credit note approved'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def apply(self, request, pk=None):
        note = self.get_object()
        invoice_id = request.data.get('invoice_id')
        if not invoice_id:
            return Response({'error': 'invoice_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            invoice = SalesInvoice.objects.get(pk=invoice_id)
            note.apply_to_invoice(invoice, request.user)
            return Response({'status': 'success', 'message': 'Credit note applied'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def pdf(self, request, pk=None):
        note = self.get_object()
        try:
            from .utils import generate_credit_note_pdf
            pdf_buffer = generate_credit_note_pdf(note.id)
            response = HttpResponse(pdf_buffer, content_type='application/pdf')
            response['Content-Disposition'] = f'inline; filename="CreditNote-{note.credit_note_number}.pdf"'
            return response
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def print(self, request, pk=None):
        note = self.get_object()
        try:
            from .tasks import create_credit_note_print_job_task

            printer_name = request.data.get('printer_name')
            copies = request.data.get('copies', 1)

            try:
                copies = int(copies)
                if copies < 1 or copies > 99:
                    copies = 1
            except (ValueError, TypeError):
                copies = 1

            task = create_credit_note_print_job_task.delay(
                note.id,
                printer_name=printer_name,
                copies=copies,
                user_id=request.user.id
            )

            return Response({
                'success': True,
                'message': f'Print job queued for credit note #{note.credit_note_number}',
                'task_id': task.id,
                'credit_note_number': note.credit_note_number,
                'printer_name': printer_name,
                'copies': copies
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
