"""
Views for Accounting Module

Provides REST API views for:
- Chart of Accounts
- Journal Entries
- Fiscal Periods
- Bank Transactions
- Financial Reports
"""

from rest_framework import viewsets, status, views
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation
from django.utils import timezone
from django.db import transaction, IntegrityError

from .models import (
    AccountCategory,
    ChartOfAccounts,
    AccountingAccountMapping,
    FiscalPeriod,
    JournalEntry,
    BankTransaction,
    JournalFailure
)
from apps.sales.invoices.models import SalesInvoice
from .serializers import (
    AccountCategorySerializer,
    ChartOfAccountsSerializer,
    ChartOfAccountsListSerializer,
    AccountingAccountMappingSerializer,
    FiscalPeriodSerializer,
    JournalEntrySerializer,
    JournalEntryListSerializer,
    BankTransactionSerializer,
    JournalFailureSerializer
)
from apps.accounting.services.journal_engine import JournalEngine
from apps.core.permissions import IsAccountingOrAdmin


class AccountCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for AccountCategory.
    Read-only - categories are system-defined.
    """
    queryset = AccountCategory.objects.filter(is_active=True)
    serializer_class = AccountCategorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [OrderingFilter]
    ordering_fields = ['display_order', 'name']
    ordering = ['display_order']


class ChartOfAccountsViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Chart of Accounts.
    Supports CRUD operations for non-system accounts.
    """
    queryset = ChartOfAccounts.objects.select_related('category', 'parent_account')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['category', 'is_active', 'allow_transactions']
    search_fields = ['account_code', 'account_name']
    ordering_fields = ['account_code', 'account_name', 'created_at']
    ordering = ['account_code']

    def get_serializer_class(self):
        """Use list serializer for list action."""
        if self.action == 'list':
            return ChartOfAccountsListSerializer
        return ChartOfAccountsSerializer

    def get_permissions(self):
        """Restrict write actions to admins; read actions to authenticated users."""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [IsAuthenticated()]

    def get_queryset(self):
        """Filter queryset based on query parameters."""
        queryset = super().get_queryset()

        # Filter by active status (default: show all)
        active = self.request.query_params.get('active')
        if active is not None:
            queryset = queryset.filter(is_active=active.lower() == 'true')

        return queryset

    def perform_create(self, serializer):
        """Set created_by on new accounts."""
        serializer.save(created_by=self.request.user)

    def perform_destroy(self, instance):
        """
        Don't actually delete - just deactivate.
        System accounts cannot be deactivated.
        """
        instance.is_active = False
        instance.save(update_fields=['is_active'])

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.is_system_account:
            return Response(
                {'error': 'System accounts cannot be deleted'},
                status=status.HTTP_400_BAD_REQUEST
            )
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['get'])
    def balance(self, request, pk=None):
        """Get current balance for an account."""
        account = self.get_object()
        return Response({
            'account_code': account.account_code,
            'account_name': account.account_name,
            'current_balance': account.current_balance,
            'category': account.category.name,
        })

    @action(detail=True, methods=['get'])
    def transactions(self, request, pk=None):
        """Get transactions for an account."""
        account = self.get_object()

        # Get query parameters
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        # Get journal lines for this account
        lines = account.journal_lines.filter(
            journal_entry__is_posted=True
        ).select_related('journal_entry')

        if start_date:
            lines = lines.filter(journal_entry__entry_date__gte=start_date)
        if end_date:
            lines = lines.filter(journal_entry__entry_date__lte=end_date)

        lines = lines.order_by('journal_entry__entry_date', 'journal_entry__journal_number')

        transactions = []
        for line in lines:
            transactions.append({
                'journal_entry_id': line.journal_entry.id,
                'date': line.journal_entry.entry_date,
                'journal_number': line.journal_entry.journal_number,
                'description': line.description or line.journal_entry.description,
                'debit': line.debit,
                'credit': line.credit,
            })

        return Response(transactions)


class AccountingAccountMappingViewSet(viewsets.ModelViewSet):
    """ViewSet for accounting account mappings."""
    queryset = AccountingAccountMapping.objects.select_related('account')
    serializer_class = AccountingAccountMappingSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['key', 'is_active']
    search_fields = ['key', 'account__account_code', 'account__account_name']
    ordering_fields = ['key', 'updated_at']
    ordering = ['key']


class JournalEntryViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Journal Entries.
    Supports creation of manual entries and viewing all entries.
    """
    queryset = JournalEntry.objects.select_related(
        'created_by', 'fiscal_period'
    ).prefetch_related('lines__account')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['entry_type', 'source_type', 'source_id', 'event_type', 'is_posted', 'is_reversed']
    search_fields = ['journal_number', 'description', 'source_reference']
    ordering_fields = ['entry_date', 'journal_number', 'created_at']
    ordering = ['-entry_date', '-journal_number']

    def get_serializer_class(self):
        """Use list serializer for list action."""
        if self.action == 'list':
            return JournalEntryListSerializer
        return JournalEntrySerializer

    def get_queryset(self):
        """Filter queryset based on query parameters."""
        queryset = super().get_queryset()

        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')

        if start_date:
            queryset = queryset.filter(entry_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(entry_date__lte=end_date)

        return queryset

    def perform_create(self, serializer):
        """Set created_by on new journal entries."""
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        """Prevent updating posted entries."""
        serializer.save()

    def perform_destroy(self, instance):
        """Prevent deleting posted entries."""
        instance.delete()

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.is_posted:
            return Response(
                {'error': 'Cannot modify posted journal entries'},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.is_posted:
            return Response(
                {'error': 'Cannot modify posted journal entries'},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.is_posted:
            return Response(
                {'error': 'Cannot delete posted journal entries'},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def post(self, request, pk=None):
        """Post a journal entry (make it immutable)."""
        journal = self.get_object()

        try:
            journal.post()
            return Response({
                'status': 'success',
                'message': f'Journal entry {journal.journal_number} posted successfully'
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def reverse(self, request, pk=None):
        """Create a reversal entry for this journal entry."""
        journal = self.get_object()

        reversal_date = request.data.get('reversal_date')
        description = request.data.get('description')

        try:
            reversal = journal.reverse(
                user=request.user,
                reversal_date=reversal_date,
                description=description
            )

            serializer = self.get_serializer(reversal)
            return Response({
                'status': 'success',
                'message': f'Reversal entry {reversal.journal_number} created successfully',
                'reversal': serializer.data
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class FiscalPeriodViewSet(viewsets.ModelViewSet):
    """ViewSet for Fiscal Periods."""
    queryset = FiscalPeriod.objects.all()
    serializer_class = FiscalPeriodSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['status']
    ordering_fields = ['start_date', 'end_date']
    ordering = ['-start_date']

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        """Close a fiscal period."""
        period = self.get_object()

        try:
            period.close_period(request.user)
            return Response({
                'status': 'success',
                'message': f'Fiscal period {period.name} closed successfully'
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def lock(self, request, pk=None):
        """Lock a fiscal period."""
        period = self.get_object()

        try:
            period.lock_period()
            return Response({
                'status': 'success',
                'message': f'Fiscal period {period.name} locked successfully'
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class JournalFailureViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for journal failures with retry action."""
    queryset = JournalFailure.objects.all()
    serializer_class = JournalFailureSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['source_type', 'event_type', 'resolved_at']
    search_fields = ['source_type', 'event_type', 'last_error']
    ordering_fields = ['last_attempt_at', 'attempts', 'created_at']
    ordering = ['-last_attempt_at', '-created_at']

    @action(detail=True, methods=['post'])
    def retry(self, request, pk=None):
        from apps.accounting.services.journal_engine import JournalEngine
        from apps.accounting.services.journal_failure import resolve_journal_failure, record_journal_failure

        if not pk:
            return Response({'error': 'Missing journal failure id'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                failure = JournalFailure.objects.select_for_update().get(pk=pk)
                if failure.resolved_at:
                    return Response({'status': 'success', 'message': 'Already resolved'}, status=status.HTTP_200_OK)
                if not failure.source_id:
                    return Response({'error': 'Missing source_id for retry'}, status=status.HTTP_400_BAD_REQUEST)

                journal = None

                if failure.source_type == 'sales_invoice':
                    from apps.sales.invoices.models import SalesInvoice
                    invoice = SalesInvoice.objects.get(pk=failure.source_id)
                    if failure.event_type == 'invoice_sent':
                        if invoice.status != 'sent' or invoice.invoice_type == 'proforma':
                            return Response({'error': 'Invoice is not eligible for invoice_sent journaling'}, status=status.HTTP_400_BAD_REQUEST)
                        journal = JournalEngine.handle_invoice_created(invoice)
                    elif failure.event_type == 'tax_invoice_created':
                        if invoice.invoice_type != 'tax_invoice':
                            return Response({'error': 'Invoice is not a tax invoice'}, status=status.HTTP_400_BAD_REQUEST)
                        journal = JournalEngine.handle_tax_invoice_created(invoice)

                elif failure.source_type == 'invoice_payment':
                    from apps.sales.invoices.models import InvoicePayment
                    payment = InvoicePayment.objects.select_related('invoice').get(pk=failure.source_id)
                    if failure.event_type == 'payment_received':
                        if payment.journal_entry_id:
                            resolve_journal_failure('invoice_payment', payment.id, 'payment_received')
                            return Response({'status': 'success', 'journal_id': payment.journal_entry_id})
                        if payment.is_void or getattr(payment, 'is_reversed', False):
                            return Response({'error': 'Payment is void/reversed'}, status=status.HTTP_400_BAD_REQUEST)
                        journal = JournalEngine.handle_invoice_payment(payment)
                        InvoicePayment.objects.filter(pk=payment.pk, journal_entry__isnull=True).update(journal_entry=journal)
                    elif failure.event_type == 'proforma_advance_received':
                        if payment.journal_entry_id:
                            resolve_journal_failure('invoice_payment', payment.id, 'proforma_advance_received')
                            return Response({'status': 'success', 'journal_id': payment.journal_entry_id})
                        if payment.invoice.invoice_type != 'proforma':
                            return Response({'error': 'Invoice is not proforma'}, status=status.HTTP_400_BAD_REQUEST)
                        if payment.is_void or getattr(payment, 'is_reversed', False):
                            return Response({'error': 'Payment is void/reversed'}, status=status.HTTP_400_BAD_REQUEST)
                        journal = JournalEngine.handle_proforma_advance_payment(payment)
                        InvoicePayment.objects.filter(pk=payment.pk, journal_entry__isnull=True).update(journal_entry=journal)
                    elif failure.event_type == 'cheque_cleared':
                        if payment.cheque_clearance_journal_entry_id:
                            resolve_journal_failure('invoice_payment', payment.id, 'cheque_cleared')
                            return Response({'status': 'success', 'journal_id': payment.cheque_clearance_journal_entry_id})
                        if not payment.cheque_cleared:
                            return Response({'error': 'Cheque not cleared'}, status=status.HTTP_400_BAD_REQUEST)
                        journal = JournalEngine.handle_invoice_payment_cheque_cleared(payment)
                        InvoicePayment.objects.filter(pk=payment.pk, cheque_clearance_journal_entry__isnull=True).update(
                            cheque_clearance_journal_entry=journal
                        )
                    elif failure.event_type == 'payment_refunded':
                        if payment.refund_journal_entry_id:
                            resolve_journal_failure('invoice_payment', payment.id, 'payment_refunded')
                            return Response({'status': 'success', 'journal_id': payment.refund_journal_entry_id})
                        if payment.is_void or getattr(payment, 'is_reversed', False):
                            return Response({'error': 'Payment is void/reversed'}, status=status.HTTP_400_BAD_REQUEST)
                        from apps.sales.invoices.models import CustomerAdvance
                        from apps.sales.invoices.models import SalesCreditNote
                        advance = CustomerAdvance.objects.filter(source_payment=payment, source_type='overpayment').order_by('-id').first()
                        refund_amount = advance.amount if advance else payment.amount
                        credit_note = SalesCreditNote.objects.filter(
                            invoice_payment_id=payment.id,
                            credit_note_type='payment_refund',
                        ).order_by('-id').first()
                        payout_account_code = credit_note.payout_account.account_code if (credit_note and credit_note.payout_account) else None
                        journal = JournalEngine.handle_invoice_payment_refund(payment, refund_amount=refund_amount, payout_account_code=payout_account_code)
                        InvoicePayment.objects.filter(pk=payment.pk, refund_journal_entry__isnull=True).update(
                            refund_journal_entry=journal,
                            is_refunded=True,
                            refunded_at=timezone.now()
                        )
                    elif failure.event_type == 'proforma_advance_refunded':
                        if payment.refund_journal_entry_id:
                            resolve_journal_failure('invoice_payment', payment.id, 'proforma_advance_refunded')
                            return Response({'status': 'success', 'journal_id': payment.refund_journal_entry_id})
                        if payment.invoice.invoice_type != 'proforma':
                            return Response({'error': 'Invoice is not proforma'}, status=status.HTTP_400_BAD_REQUEST)
                        if payment.is_void or getattr(payment, 'is_reversed', False):
                            return Response({'error': 'Payment is void/reversed'}, status=status.HTTP_400_BAD_REQUEST)
                        from apps.sales.invoices.models import SalesCreditNote
                        credit_note = SalesCreditNote.objects.filter(
                            invoice_payment_id=payment.id,
                            credit_note_type='payment_refund',
                        ).order_by('-id').first()
                        payout_account_code = credit_note.payout_account.account_code if (credit_note and credit_note.payout_account) else None
                        journal = JournalEngine.handle_proforma_advance_refund(payment, payout_account_code=payout_account_code)
                        InvoicePayment.objects.filter(pk=payment.pk, refund_journal_entry__isnull=True).update(
                            refund_journal_entry=journal,
                            is_refunded=True,
                            refunded_at=timezone.now()
                        )

                elif failure.source_type == 'order_payment':
                    from apps.sales.orders.models import OrderPayment
                    payment = OrderPayment.objects.select_related('order').get(pk=failure.source_id)
                    if failure.event_type == 'advance_received':
                        if payment.journal_entry_id:
                            resolve_journal_failure('order_payment', payment.id, 'advance_received')
                            return Response({'status': 'success', 'journal_id': payment.journal_entry_id})
                        if payment.is_void or getattr(payment, 'is_reversed', False):
                            return Response({'error': 'Payment is void/reversed'}, status=status.HTTP_400_BAD_REQUEST)
                        journal = JournalEngine.handle_order_advance_payment(payment)
                        OrderPayment.objects.filter(pk=payment.pk, journal_entry__isnull=True).update(journal_entry=journal)
                    elif failure.event_type == 'cheque_cleared':
                        if payment.cheque_clearance_journal_entry_id:
                            resolve_journal_failure('order_payment', payment.id, 'cheque_cleared')
                            return Response({'status': 'success', 'journal_id': payment.cheque_clearance_journal_entry_id})
                        if not payment.cheque_cleared:
                            return Response({'error': 'Cheque not cleared'}, status=status.HTTP_400_BAD_REQUEST)
                        journal = JournalEngine.handle_order_payment_cheque_cleared(payment)
                        OrderPayment.objects.filter(pk=payment.pk, cheque_clearance_journal_entry__isnull=True).update(
                            cheque_clearance_journal_entry=journal
                        )
                    elif failure.event_type == 'advance_refunded':
                        if payment.refund_journal_entry_id:
                            resolve_journal_failure('order_payment', payment.id, 'advance_refunded')
                            return Response({'status': 'success', 'journal_id': payment.refund_journal_entry_id})
                        if payment.is_void or getattr(payment, 'is_reversed', False):
                            return Response({'error': 'Payment is void/reversed'}, status=status.HTTP_400_BAD_REQUEST)
                        from apps.sales.invoices.models import SalesCreditNote
                        credit_note = SalesCreditNote.objects.filter(
                            order_payment_id=payment.id,
                            credit_note_type='payment_refund',
                        ).order_by('-id').first()
                        payout_account_code = credit_note.payout_account.account_code if (credit_note and credit_note.payout_account) else None
                        journal = JournalEngine.handle_order_advance_refund(payment, payout_account_code=payout_account_code)
                        OrderPayment.objects.filter(pk=payment.pk, refund_journal_entry__isnull=True).update(
                            refund_journal_entry=journal,
                            is_refunded=True,
                            refunded_at=timezone.now()
                        )

                elif failure.source_type == 'supplier_bill':
                    from apps.purchases.models import SupplierBill
                    bill = SupplierBill.objects.get(pk=failure.source_id)
                    if failure.event_type == 'bill_approved':
                        if bill.status != 'approved':
                            return Response({'error': 'Supplier bill not approved'}, status=status.HTTP_400_BAD_REQUEST)
                        journal = JournalEngine.handle_supplier_bill_approved(bill)

                elif failure.source_type == 'bill_payment':
                    from apps.purchases.models import BillPayment
                    payment = BillPayment.objects.select_related('bill').get(pk=failure.source_id)
                    if failure.event_type == 'bill_payment_created':
                        journal = JournalEngine.handle_bill_payment(payment)
                    elif failure.event_type == 'cheque_cleared':
                        if not payment.cheque_cleared:
                            return Response({'error': 'Cheque not cleared'}, status=status.HTTP_400_BAD_REQUEST)
                        journal = JournalEngine.handle_bill_payment_cheque_cleared(payment)

                elif failure.source_type == 'supplier_credit_note':
                    from apps.purchases.models import SupplierCreditNote
                    note = SupplierCreditNote.objects.get(pk=failure.source_id)
                    if failure.event_type == 'supplier_credit_note_approved':
                        if note.status != 'approved':
                            return Response({'error': 'Supplier credit note not approved'}, status=status.HTTP_400_BAD_REQUEST)
                        journal = JournalEngine.handle_supplier_credit_note_approved(note)

                elif failure.source_type == 'sales_credit_note':
                    from apps.sales.invoices.models import SalesCreditNote
                    note = SalesCreditNote.objects.get(pk=failure.source_id)
                    if failure.event_type == 'sales_credit_note_approved':
                        if note.status != 'approved' or getattr(note, 'credit_note_type', 'ar_credit') != 'ar_credit':
                            return Response({'error': 'Sales credit note not eligible for journaling'}, status=status.HTTP_400_BAD_REQUEST)
                        journal = JournalEngine.handle_sales_credit_note_approved(note)

                elif failure.source_type == 'bank_transaction':
                    from apps.accounting.models import BankTransaction
                    txn = BankTransaction.objects.get(pk=failure.source_id)
                    if failure.event_type == 'bank_txn_approved':
                        if txn.journal_entry_id:
                            resolve_journal_failure('bank_transaction', txn.id, 'bank_txn_approved')
                            return Response({'status': 'success', 'journal_id': txn.journal_entry_id})
                        if txn.status not in ['approved', 'posted']:
                            return Response({'error': 'Bank transaction is not approved/posted'}, status=status.HTTP_400_BAD_REQUEST)
                        journal = JournalEngine.handle_bank_transaction(txn)
                        BankTransaction.objects.filter(pk=txn.pk, journal_entry__isnull=True).update(
                            journal_entry=journal,
                            status='posted',
                        )

                if not journal:
                    return Response({'error': 'No retry handler for this failure'}, status=status.HTTP_400_BAD_REQUEST)

                resolve_journal_failure(failure.source_type, failure.source_id, failure.event_type)
                return Response({'status': 'success', 'journal_id': journal.id})

        except JournalFailure.DoesNotExist:
            return Response({'error': 'Journal failure not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            # Best-effort: if we can still load the failure, record the error.
            try:
                failure = JournalFailure.objects.get(pk=pk)
                record_journal_failure(failure.source_type, failure.source_id, failure.event_type, e)
            except Exception:
                pass
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class BankTransactionViewSet(viewsets.ModelViewSet):
    """ViewSet for Bank Transactions."""
    queryset = BankTransaction.objects.select_related(
        'created_by', 'approved_by', 'journal_entry'
    )
    serializer_class = BankTransactionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['transaction_type', 'status']
    search_fields = ['description', 'reference_number']
    ordering_fields = ['transaction_date', 'created_at']
    ordering = ['-transaction_date']

    def get_queryset(self):
        """Filter queryset based on query parameters."""
        queryset = super().get_queryset()

        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')

        if start_date:
            queryset = queryset.filter(transaction_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(transaction_date__lte=end_date)

        return queryset

    def perform_create(self, serializer):
        """Set created_by on new transactions."""
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a bank transaction."""
        transaction = self.get_object()

        try:
            journal = transaction.approve(request.user)
            return Response({
                'status': 'success',
                'message': 'Bank transaction posted to ledger' if journal else 'Bank transaction approved; journal posting pending or failed',
                'journal_id': journal.id if journal else None,
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a bank transaction."""
        transaction = self.get_object()

        if transaction.status not in ['draft', 'pending']:
            return Response(
                {'error': f"Cannot reject transaction with status '{transaction.status}'"},
                status=status.HTTP_400_BAD_REQUEST
            )

        transaction.status = 'rejected'
        transaction.save()

        return Response({
            'status': 'success',
            'message': 'Bank transaction rejected'
        })


# ==============================================================================
# Financial Reports API Views
# ==============================================================================

class CashBookReportView(views.APIView):
    """
    Cash Book Report API.
    GET: Returns cash transactions for a date range.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get cash book report."""
        from .services.ledger_service import LedgerService

        # Get date range from query params
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        cash_account = request.query_params.get('cash_account', '1000')

        # Default to current month if not provided
        if not start_date or not end_date:
            today = timezone.now().date()
            start_date = today.replace(day=1)
            end_date = today
        else:
            start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
            end_date = datetime.strptime(end_date, '%Y-%m-%d').date()

        try:
            report = LedgerService.get_cash_book(start_date, end_date, cash_account)
            return Response(report)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class ARAgingReportView(views.APIView):
    """
    Accounts Receivable Aging Report API.
    GET: Returns AR aging analysis.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get AR aging report."""
        from .services.ledger_service import LedgerService

        # Get as_of_date from query params (default: today)
        as_of_date_str = request.query_params.get('as_of_date')
        if as_of_date_str:
            as_of_date = datetime.strptime(as_of_date_str, '%Y-%m-%d').date()
        else:
            as_of_date = None

        try:
            report = LedgerService.get_accounts_receivable_aging(as_of_date)
            return Response(report)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class APAgingReportView(views.APIView):
    """
    Accounts Payable Aging Report API.
    GET: Returns AP aging analysis.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get AP aging report."""
        from .services.ledger_service import LedgerService

        # Get as_of_date from query params (default: today)
        as_of_date_str = request.query_params.get('as_of_date')
        if as_of_date_str:
            as_of_date = datetime.strptime(as_of_date_str, '%Y-%m-%d').date()
        else:
            as_of_date = None

        try:
            report = LedgerService.get_accounts_payable_aging(as_of_date)
            return Response(report)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class ProfitAndLossReportView(views.APIView):
    """
    Profit & Loss Statement API.
    GET: Returns P&L for a date range.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get profit and loss statement."""
        from .services.ledger_service import LedgerService

        # Get date range from query params
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        # Default to current month if not provided
        if not start_date or not end_date:
            today = timezone.now().date()
            start_date = today.replace(day=1)
            end_date = today
        else:
            start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
            end_date = datetime.strptime(end_date, '%Y-%m-%d').date()

        try:
            report = LedgerService.get_profit_and_loss(start_date, end_date)
            return Response(report)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class TrialBalanceReportView(views.APIView):
    """
    Trial Balance Report API.
    GET: Returns trial balance as of a date.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get trial balance."""
        from .services.ledger_service import LedgerService

        # Get as_of_date from query params (default: today)
        as_of_date_str = request.query_params.get('as_of_date')
        if as_of_date_str:
            as_of_date = datetime.strptime(as_of_date_str, '%Y-%m-%d').date()
        else:
            as_of_date = None

        try:
            report = LedgerService.get_trial_balance(as_of_date)
            return Response(report)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class BalanceSheetReportView(views.APIView):
    """
    Balance Sheet Report API.
    GET: Returns balance sheet as of a date.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get balance sheet."""
        from .services.ledger_service import LedgerService

        # Get as_of_date from query params (default: today)
        as_of_date_str = request.query_params.get('as_of_date')
        if as_of_date_str:
            as_of_date = datetime.strptime(as_of_date_str, '%Y-%m-%d').date()
        else:
            as_of_date = None

        try:
            report = LedgerService.get_balance_sheet(as_of_date)
            return Response(report)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

class ARAgingReportView(views.APIView):
    """
    API view for AR aging report.
    GET /api/accounting/ar/aging/?as_of_date=2026-01-15&customer_id=1
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get AR aging report."""
        from decimal import Decimal
        from django.db.models import Q

        as_of_date = request.query_params.get('as_of_date')
        customer_id = request.query_params.get('customer_id')

        # Convert as_of_date if provided
        if as_of_date:
            try:
                as_of_date = datetime.strptime(as_of_date, '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {'error': 'Invalid as_of_date format. Use YYYY-MM-DD'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            as_of_date = datetime.now().date()

        # Convert customer_id to int if provided
        if customer_id:
            try:
                customer_id = int(customer_id)
            except ValueError:
                return Response(
                    {'error': 'Invalid customer_id. Must be an integer'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Get unpaid/partially paid invoices
        invoices_qs = SalesInvoice.objects.filter(
            Q(status='sent') | Q(status='partially_paid') | Q(status='overdue')
        ).filter(balance_due__gt=0).select_related('customer').order_by('customer__name', '-invoice_date')

        if customer_id:
            invoices_qs = invoices_qs.filter(customer_id=customer_id)

        # Build invoice-level report with aging buckets
        invoices_data = []
        totals = {
            'current': Decimal('0.00'),
            'days_1_30': Decimal('0.00'),
            'days_31_60': Decimal('0.00'),
            'days_61_90': Decimal('0.00'),
            'days_90_plus': Decimal('0.00'),
            'total': Decimal('0.00'),
        }

        for invoice in invoices_qs:
            days_outstanding = (as_of_date - invoice.due_date).days if invoice.due_date else 0

            # Determine age bucket
            if days_outstanding <= 0:
                age_bucket = 'Current'
                bucket_key = 'current'
            elif days_outstanding <= 30:
                age_bucket = '1-30 days'
                bucket_key = 'days_1_30'
            elif days_outstanding <= 60:
                age_bucket = '31-60 days'
                bucket_key = 'days_31_60'
            elif days_outstanding <= 90:
                age_bucket = '61-90 days'
                bucket_key = 'days_61_90'
            else:
                age_bucket = '90+ days'
                bucket_key = 'days_90_plus'

            invoices_data.append({
                'invoice_number': invoice.invoice_number,
                'customer': invoice.customer.name if invoice.customer else 'Unknown',
                'customer_id': invoice.customer_id,
                'invoice_date': invoice.invoice_date.isoformat(),
                'due_date': invoice.due_date.isoformat() if invoice.due_date else None,
                'days_outstanding': days_outstanding,
                'age_bucket': age_bucket,
                'amount': str(invoice.balance_due),
            })

            # Update totals
            balance = invoice.balance_due
            totals[bucket_key] += balance
            totals['total'] += balance

        # Convert totals to strings for JSON
        totals_response = {k: str(v) for k, v in totals.items()}

        return Response({
            'invoices': invoices_data,
            'summary': totals_response,
            'customers': []  # For backwards compatibility if needed
        })


class CustomerStatementView(views.APIView):
    """
    API view for customer statement.
    GET /api/accounting/customers/{customer_id}/statement/?start_date=2026-01-01&end_date=2026-01-31
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, customer_id):
        """Get customer statement with running balance."""
        from apps.accounting.services.ar_reports import ARReportService

        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        # Convert dates if provided
        if start_date:
            try:
                start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {'error': 'Invalid start_date format. Use YYYY-MM-DD'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        if end_date:
            try:
                end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {'error': 'Invalid end_date format. Use YYYY-MM-DD'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        try:
            statement = ARReportService.get_customer_statement(customer_id, start_date, end_date)
            return Response(statement)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class CustomerBalanceView(views.APIView):
    """
    API view for customer balance summary.
    GET /api/accounting/customers/{customer_id}/balance/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, customer_id):
        """Get customer balance summary."""
        from apps.accounting.services.ar_reports import ARReportService

        try:
            balance = ARReportService.get_customer_balance(customer_id)
            return Response(balance)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class BankAccountsOnlyView(views.APIView):
    """
    API view to get only bank accounts from Chart of Accounts.
    Used for payment deposit account selection (excludes AR, AP, advances, etc.)
    GET /api/accounting/bank-accounts/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Returns list of bank accounts (codes: 1010, 1020, 1030, etc.)
        These are accounts where payments can be deposited.
        """
        bank_accounts = ChartOfAccounts.objects.filter(
            account_code__startswith='10',
            is_active=True
        ).exclude(
            account_code__in=['1000', '1040']
        ).values('id', 'account_code', 'account_name').order_by('account_code')

        return Response({
            'count': bank_accounts.count(),
            'results': list(bank_accounts)
        })


class CashDepositView(views.APIView):
    """
    Create a cash deposit to bank journal entry.
    POST /api/accounting/cash/deposit/
    """
    permission_classes = [IsAuthenticated, IsAccountingOrAdmin]

    def _resolve_bank_account(self, account_param):
        if account_param is None or str(account_param).strip() == '':
            return None

        queryset = ChartOfAccounts.objects.filter(
            is_active=True,
            account_code__startswith='10'
        ).exclude(account_code__in=['1000', '1040'])

        if isinstance(account_param, int):
            account = queryset.filter(id=account_param).first()
            return account if account and account.allow_transactions else None

        account_param = str(account_param).strip()
        if account_param.isdigit():
            account = queryset.filter(id=int(account_param)).first()
            return account if account and account.allow_transactions else None

        account = queryset.filter(account_code=account_param).first()
        return account if account and account.allow_transactions else None

    def post(self, request):
        entry_date_str = request.data.get('date')
        amount_raw = request.data.get('amount')
        bank_account_param = (
            request.data.get('bank_account_id')
            or request.data.get('bank_account_code')
            or request.data.get('bank_account')
        )
        reference = request.data.get('reference') or ''
        notes = request.data.get('notes') or ''

        if entry_date_str:
            try:
                entry_date = datetime.strptime(entry_date_str, '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {'error': 'Invalid date format. Use YYYY-MM-DD.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            entry_date = timezone.now().date()

        if amount_raw in [None, '']:
            return Response(
                {'error': 'Amount is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            amount = Decimal(str(amount_raw))
        except (InvalidOperation, ValueError, TypeError):
            return Response(
                {'error': 'Invalid amount.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if amount <= 0:
            return Response(
                {'error': 'Amount must be greater than zero.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        bank_account = self._resolve_bank_account(bank_account_param)
        if not bank_account:
            return Response(
                {'error': 'Valid bank account is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        cash_account = ChartOfAccounts.objects.filter(account_code='1000', is_active=True).first()
        if not cash_account:
            return Response(
                {'error': 'Cash in Hand account (1000) not found.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        normalized_amount = amount.quantize(Decimal('0.01'))
        reference = reference.strip()
        notes = notes.strip()

        source_reference = reference or f"CASH-DEP-{entry_date.isoformat()}-{bank_account.id}-{normalized_amount}"

        with transaction.atomic():
            existing_entry = JournalEntry.objects.filter(
                source_type='manual',
                event_type='cash_deposit',
                source_reference=source_reference
            ).first()
            if existing_entry:
                serializer = JournalEntrySerializer(existing_entry)
                return Response(serializer.data, status=status.HTTP_200_OK)

            description = f"Cash deposit to {bank_account.account_code} - {bank_account.account_name}"
            if notes:
                description = f"{description} - {notes}"

            try:
                journal_entry = JournalEngine.create_journal_entry(
                    entry_date=entry_date,
                    source_type='manual',
                    source_id=None,
                    event_type='cash_deposit',
                    description=description,
                    lines_data=[
                        {
                            'account_code': bank_account.account_code,
                            'debit': normalized_amount,
                            'credit': 0,
                            'description': 'Cash deposit to bank',
                        },
                        {
                            'account_code': cash_account.account_code,
                            'debit': 0,
                            'credit': normalized_amount,
                            'description': 'Cash in hand',
                        },
                    ],
                    created_by=request.user,
                    auto_post=True,
                    source_reference=source_reference,
                )
            except IntegrityError:
                existing_entry = JournalEntry.objects.filter(
                    source_type='manual',
                    event_type='cash_deposit',
                    source_reference=source_reference
                ).first()
                if existing_entry:
                    serializer = JournalEntrySerializer(existing_entry)
                    return Response(serializer.data, status=status.HTTP_200_OK)
                raise

        serializer = JournalEntrySerializer(journal_entry)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
