"""
Views for Purchases Module

Provides REST API views for:
- Purchase Orders
- Goods Received Notes (GRN)
- Supplier Bills
- Bill Payments
- Credit Notes
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.utils import timezone
from django.db import transaction
from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.template.loader import render_to_string
from io import BytesIO
from weasyprint import HTML
import re

from .models import (
    PurchaseOrder,
    PurchaseOrderItem,
    PurchaseOrderTimeline,
    GoodsReceivedNote,
    GRNItem,
    SupplierBill,
    BillPayment,
    BillScan,
    SupplierCreditNote,
)
from .utils import generate_po_number, build_po_number
from .tasks import (
    send_purchase_order_email_task,
    send_purchase_order_whatsapp_task,
    create_purchase_order_print_job_task,
)
from .serializers import (
    PurchaseOrderSerializer,
    PurchaseOrderListSerializer,
    PurchaseOrderItemSerializer,
    PurchaseOrderTimelineSerializer,
    GoodsReceivedNoteSerializer,
    GoodsReceivedNoteListSerializer,
    GRNItemSerializer,
    SupplierBillSerializer,
    SupplierBillListSerializer,
    BillPaymentSerializer,
    BillScanSerializer,
    BillScanListSerializer,
    SupplierCreditNoteSerializer,
    SupplierCreditNoteListSerializer,
)


class PurchaseOrderViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Purchase Orders.
    Supports CRUD operations and status management.
    """
    queryset = PurchaseOrder.objects.select_related('supplier', 'created_by').prefetch_related(
        'items', 'timeline_entries'
    )
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'supplier']
    search_fields = ['po_number', 'supplier__name', 'notes']
    ordering_fields = ['order_date', 'po_number', 'created_at', 'total']
    ordering = ['-order_date']

    def get_serializer_class(self):
        """Use list serializer for list action."""
        if self.action == 'list':
            return PurchaseOrderListSerializer
        return PurchaseOrderSerializer

    def get_queryset(self):
        """Filter queryset based on query parameters."""
        queryset = super().get_queryset()

        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')

        if start_date:
            queryset = queryset.filter(order_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(order_date__lte=end_date)

        return queryset

    def perform_create(self, serializer):
        """Set created_by on new purchase orders."""
        po_number = serializer.validated_data.get('po_number')
        if not po_number:
            po_number = generate_po_number()
        serializer.save(created_by=self.request.user, po_number=po_number)

    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        """Send PO to supplier (change status to 'sent')."""
        po = self.get_object()

        if po.status != 'draft':
            return Response(
                {'error': f"Cannot send PO with status '{po.status}'"},
                status=status.HTTP_400_BAD_REQUEST
            )

        po.status = 'sent'
        po.save()

        # Create timeline entry
        PurchaseOrderTimeline.objects.create(
            purchase_order=po,
            event_type='status_change',
            message=f'Purchase order sent to supplier',
            old_status='draft',
            new_status='sent',
            created_by=request.user,
        )

        return Response({
            'status': 'success',
            'message': f'Purchase order {po.po_number} sent to supplier'
        })

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        """Confirm PO (supplier acknowledged)."""
        po = self.get_object()

        if po.status not in ['sent']:
            return Response(
                {'error': f"Cannot confirm PO with status '{po.status}'"},
                status=status.HTTP_400_BAD_REQUEST
            )

        po.status = 'confirmed'
        po.save()

        # Create timeline entry
        PurchaseOrderTimeline.objects.create(
            purchase_order=po,
            event_type='status_change',
            message=f'Purchase order confirmed by supplier',
            old_status='sent',
            new_status='confirmed',
            created_by=request.user,
        )

        return Response({
            'status': 'success',
            'message': f'Purchase order {po.po_number} confirmed'
        })

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel purchase order."""
        po = self.get_object()

        if po.status in ['completed', 'cancelled']:
            return Response(
                {'error': f"Cannot cancel PO with status '{po.status}'"},
                status=status.HTTP_400_BAD_REQUEST
            )

        old_status = po.status
        po.status = 'cancelled'
        po.save()

        # Create timeline entry
        PurchaseOrderTimeline.objects.create(
            purchase_order=po,
            event_type='status_change',
            message=f'Purchase order cancelled',
            old_status=old_status,
            new_status='cancelled',
            created_by=request.user,
        )

        return Response({
            'status': 'success',
            'message': f'Purchase order {po.po_number} cancelled'
        })

    @action(detail=True, methods=['post'], url_path='short-close')
    def short_close(self, request, pk=None):
        """Short close a PO by setting ordered qty to received qty and closing."""
        po = self.get_object()

        if po.status in ['cancelled', 'completed']:
            return Response(
                {'error': f"Cannot short close PO with status '{po.status}'"},
                status=status.HTTP_400_BAD_REQUEST
            )

        for item in po.items.all():
            if item.quantity_received < item.quantity:
                item.quantity = item.quantity_received
                item.save(update_fields=['quantity'])

        po.status = 'received'
        po.save(update_fields=['status', 'updated_at'])
        po.add_timeline_entry(
            event_type='short_close',
            message='PO short-closed; remaining quantities cancelled.',
            user=request.user,
        )

        return Response({
            'status': 'success',
            'message': f'Purchase order {po.po_number} short-closed'
        })

    @action(detail=True, methods=['post'])
    def recalculate(self, request, pk=None):
        """Recalculate totals based on current line items."""
        po = self.get_object()
        po.calculate_totals()
        return Response({
            'status': 'success',
            'message': f'Purchase order {po.po_number} totals recalculated',
            'subtotal': po.subtotal,
            'total': po.total,
        })

    @action(detail=False, methods=['get'], url_path='next-number')
    def next_number(self, request):
        """Generate the next available purchase order number."""
        try:
            po_number = generate_po_number()
            collision_count = 0
            year_suffix = po_number[2:4]
            sequence_match = re.search(r'(\d{4})$', po_number)
            sequence = int(sequence_match.group(1)) if sequence_match else 1

            while PurchaseOrder.objects.filter(po_number=po_number).exists():
                sequence += 1
                po_number = build_po_number(year_suffix, sequence)
                collision_count += 1
                if collision_count > 100:
                    break

            return Response({
                'po_number': po_number,
                'success': True,
            }, status=status.HTTP_200_OK)

        except Exception as exc:
            return Response({
                'error': f'Failed to generate purchase order number: {str(exc)}',
                'success': False,
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def pdf(self, request, pk=None):
        purchase_order = get_object_or_404(
            PurchaseOrder.objects.select_related('supplier', 'created_by').prefetch_related('items'),
            pk=pk
        )

        context = {
            'purchase_order': purchase_order,
            'items': purchase_order.items.all(),
            'now': timezone.now(),
        }

        html_string = render_to_string('purchases/purchase_order_pdf.html', context)
        pdf_buffer = BytesIO()
        html = HTML(string=html_string, base_url=request.build_absolute_uri('/'))
        html.write_pdf(pdf_buffer)
        pdf_buffer.seek(0)

        response = HttpResponse(pdf_buffer.read(), content_type='application/pdf')
        response['Content-Disposition'] = (
            f'attachment; filename="Purchase-Order-{purchase_order.po_number}.pdf"'
        )
        return response

    @action(detail=True, methods=['post'])
    def email(self, request, pk=None):
        try:
            purchase_order = get_object_or_404(
                PurchaseOrder.objects.select_related('supplier', 'created_by'),
                pk=pk
            )

            data = request.data or {}
            to_emails = data.get('to_emails', [])
            cc_emails = data.get('cc_emails', [])
            bcc_emails = data.get('bcc_emails', [])
            subject = data.get('subject', f'Purchase Order {purchase_order.po_number}').strip()
            message = data.get('message', '').strip()
            message_html = data.get('message_html', '').strip()
            send_copy_to_sender = data.get('send_copy_to_sender', False)

            if not to_emails and purchase_order.supplier and purchase_order.supplier.email:
                to_emails = [purchase_order.supplier.email]

            if not to_emails:
                return Response(
                    {
                        'error': (
                            'No recipient email found. Please provide email address or ensure '
                            'supplier has an email.'
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            email_regex = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
            for email in to_emails + cc_emails + bcc_emails:
                if not email_regex.match(email):
                    return Response(
                        {'error': f'Invalid email format: {email}'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            email_data = {
                'purchase_order_id': purchase_order.id,
                'from_email': request.user.email or settings.DEFAULT_FROM_EMAIL,
                'to_emails': to_emails,
                'cc_emails': cc_emails,
                'bcc_emails': bcc_emails,
                'subject': subject,
                'message': message_html if message_html else message,
                'send_copy_to_sender': send_copy_to_sender,
                'sender_name': request.user.username or request.user.email,
                'user_id': request.user.id,
            }

            task = send_purchase_order_email_task.delay(email_data)

            return Response({
                'success': True,
                'message': f'Email is being sent to {len(to_emails)} recipient(s)',
                'task_id': task.id,
                'po_number': purchase_order.po_number,
            }, status=status.HTTP_200_OK)

        except Exception as exc:
            return Response(
                {'error': f'Failed to send email: {str(exc)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=['post'])
    def whatsapp(self, request, pk=None):
        try:
            purchase_order = get_object_or_404(
                PurchaseOrder.objects.select_related('supplier', 'created_by'),
                pk=pk
            )

            data = request.data or {}
            phone_number = data.get('phone_number', '').strip()
            message = data.get('message', '').strip()

            if not phone_number:
                return Response(
                    {'error': 'Phone number is required'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if not message:
                return Response(
                    {'error': 'Message is required'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            whatsapp_data = {
                'purchase_order_id': purchase_order.id,
                'phone_number': phone_number,
                'message': message,
                'sender_name': request.user.username or request.user.email,
                'user_id': request.user.id,
            }

            task = send_purchase_order_whatsapp_task.delay(whatsapp_data)

            return Response({
                'success': True,
                'message': f'WhatsApp is being sent to {phone_number}',
                'task_id': task.id,
                'po_number': purchase_order.po_number,
                'phone_number': phone_number,
            }, status=status.HTTP_200_OK)

        except Exception as exc:
            return Response(
                {'error': f'Failed to send WhatsApp: {str(exc)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=['post'])
    def print(self, request, pk=None):
        try:
            purchase_order = get_object_or_404(PurchaseOrder, pk=pk)

            printer_name = request.data.get('printer_name')
            copies = request.data.get('copies', 1)

            try:
                copies = int(copies)
                if copies < 1 or copies > 99:
                    copies = 1
            except (ValueError, TypeError):
                copies = 1

            task = create_purchase_order_print_job_task.delay(
                purchase_order.id,
                request.user.id,
                printer_name=printer_name,
                copies=copies,
            )

            return Response({
                'success': True,
                'message': f'Print job queued for purchase order #{purchase_order.po_number}',
                'task_id': task.id,
                'po_number': purchase_order.po_number,
                'printer_name': printer_name,
                'copies': copies,
            }, status=status.HTTP_200_OK)

        except Exception as exc:
            return Response(
                {'error': f'Failed to create print job: {str(exc)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class PurchaseOrderItemViewSet(viewsets.ModelViewSet):
    """ViewSet for PurchaseOrderItem management."""
    queryset = PurchaseOrderItem.objects.select_related('purchase_order')
    serializer_class = PurchaseOrderItemSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['purchase_order']


class GoodsReceivedNoteViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Goods Received Notes (GRN).
    Handles receiving and inspection of goods.
    """
    queryset = GoodsReceivedNote.objects.select_related(
        'purchase_order', 'supplier', 'received_by', 'inspected_by'
    ).prefetch_related('items')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'supplier', 'purchase_order', 'quality_passed']
    search_fields = ['grn_number', 'delivery_note_number']
    ordering_fields = ['received_date', 'grn_number']
    ordering = ['-received_date']

    def get_serializer_class(self):
        """Use list serializer for list action."""
        if self.action == 'list':
            return GoodsReceivedNoteListSerializer
        return GoodsReceivedNoteSerializer

    @action(detail=True, methods=['post'])
    def inspect(self, request, pk=None):
        """Mark GRN as inspected."""
        grn = self.get_object()

        if grn.status != 'received':
            return Response(
                {'error': f"Cannot inspect GRN with status '{grn.status}'"},
                status=status.HTTP_400_BAD_REQUEST
            )

        quality_passed = request.data.get('quality_passed', True)
        inspection_notes = request.data.get('inspection_notes', '')

        grn.status = 'inspected'
        grn.inspection_date = timezone.now()
        grn.inspected_by = request.user
        grn.quality_passed = quality_passed
        grn.inspection_notes = inspection_notes
        grn.save()

        return Response({
            'status': 'success',
            'message': f'GRN {grn.grn_number} marked as inspected',
            'quality_passed': quality_passed,
        })


class GRNItemViewSet(viewsets.ModelViewSet):
    """ViewSet for GRNItem management."""
    queryset = GRNItem.objects.select_related('grn', 'purchase_order_item')
    serializer_class = GRNItemSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['grn']


class SupplierBillViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Supplier Bills.
    Handles bill creation, approval, and payment tracking.
    """
    queryset = SupplierBill.objects.select_related(
        'supplier', 'purchase_order', 'created_by', 'approved_by', 'scan_source'
    ).prefetch_related('payments')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'supplier', 'purchase_order']
    search_fields = ['bill_number', 'internal_reference', 'supplier__name']
    ordering_fields = ['bill_date', 'due_date', 'total', 'balance_due']
    ordering = ['-bill_date']

    def get_serializer_class(self):
        """Use list serializer for list action."""
        if self.action == 'list':
            return SupplierBillListSerializer
        return SupplierBillSerializer

    def get_queryset(self):
        """Filter queryset based on query parameters."""
        queryset = super().get_queryset()

        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')

        if start_date:
            queryset = queryset.filter(bill_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(bill_date__lte=end_date)

        # Filter overdue bills
        overdue = self.request.query_params.get('overdue')
        if overdue and overdue.lower() == 'true':
            queryset = queryset.filter(
                due_date__lt=timezone.now().date(),
                status__in=['approved', 'partially_paid']
            )

        return queryset

    def perform_create(self, serializer):
        """Set created_by on new bills and link to scan if provided."""
        bill = serializer.save(created_by=self.request.user)

        # Link bill to scan if scan_id was provided
        scan_id = self.request.data.get('scan_id')
        if scan_id:
            try:
                scan = BillScan.objects.get(pk=scan_id)
                scan.created_bill = bill
                scan.save()
            except BillScan.DoesNotExist:
                pass  # Ignore if scan not found

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a supplier bill (triggers accounting entry)."""
        bill = self.get_object()

        try:
            bill.approve(request.user)
            return Response({
                'status': 'success',
                'message': f'Bill {bill.bill_number} approved successfully'
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def void(self, request, pk=None):
        """Void a supplier bill."""
        bill = self.get_object()

        if bill.status == 'void':
            return Response(
                {'error': 'Bill is already void'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if bill.amount_paid > 0:
            return Response(
                {'error': 'Cannot void a bill with payments'},
                status=status.HTTP_400_BAD_REQUEST
            )

        bill.status = 'void'
        bill.save()

        return Response({
            'status': 'success',
            'message': f'Bill {bill.bill_number} voided'
        })

    @action(detail=True, methods=['post', 'get'])
    def payments(self, request, pk=None):
        """
        GET: List all payments for this bill
        POST: Record a new payment for this bill
        """
        bill = self.get_object()

        if request.method == 'GET':
            serializer = BillPaymentSerializer(bill.payments.all(), many=True)
            return Response(serializer.data)

        # POST - create new payment
        payment_data = {**request.data, 'bill': bill.id}
        serializer = BillPaymentSerializer(data=payment_data, context={'request': request})
        if serializer.is_valid():
            try:
                payment = bill.record_payment(
                    amount=serializer.validated_data['amount'],
                    payment_method=serializer.validated_data['payment_method'],
                    user=request.user,
                    payment_date=serializer.validated_data.get('payment_date'),
                    reference_number=serializer.validated_data.get('reference_number'),
                    notes=serializer.validated_data.get('notes'),
                    cheque_number=serializer.validated_data.get('cheque_number'),
                    cheque_date=serializer.validated_data.get('cheque_date'),
                    cheque_cleared=serializer.validated_data.get('cheque_cleared', False),
                    cheque_cleared_date=serializer.validated_data.get('cheque_cleared_date'),
                )

                return Response(
                    BillPaymentSerializer(payment).data,
                    status=status.HTTP_201_CREATED
                )
            except Exception as e:
                return Response(
                    {'error': str(e)},
                    status=status.HTTP_400_BAD_REQUEST
                )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class BillPaymentViewSet(viewsets.ModelViewSet):
    """ViewSet for BillPayment management."""
    queryset = BillPayment.objects.select_related('bill', 'created_by')
    serializer_class = BillPaymentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['bill', 'payment_method', 'cheque_cleared']
    search_fields = ['reference_number', 'cheque_number']
    ordering_fields = ['payment_date', 'amount']
    ordering = ['-payment_date']

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        bill = serializer.validated_data['bill']
        payment = bill.record_payment(
            amount=serializer.validated_data['amount'],
            payment_method=serializer.validated_data['payment_method'],
            user=request.user,
            payment_date=serializer.validated_data.get('payment_date'),
            reference_number=serializer.validated_data.get('reference_number'),
            notes=serializer.validated_data.get('notes'),
            cheque_number=serializer.validated_data.get('cheque_number'),
            cheque_date=serializer.validated_data.get('cheque_date'),
            cheque_cleared=serializer.validated_data.get('cheque_cleared', False),
            cheque_cleared_date=serializer.validated_data.get('cheque_cleared_date'),
        )

        output = BillPaymentSerializer(payment)
        headers = self.get_success_headers(output.data)
        return Response(output.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=True, methods=['post'])
    def mark_cheque_cleared(self, request, pk=None):
        """Mark a cheque payment as cleared."""
        payment = self.get_object()

        if payment.payment_method != 'cheque':
            return Response(
                {'error': 'This is not a cheque payment'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if payment.cheque_cleared:
            return Response(
                {'error': 'Cheque is already marked as cleared'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            with transaction.atomic():
                payment = BillPayment.objects.select_for_update().get(pk=payment.pk)
                payment.cheque_cleared = True
                payment.cheque_cleared_date = timezone.now().date()
                payment.save(update_fields=['cheque_cleared', 'cheque_cleared_date'])

                from apps.accounting.services.journal_engine import JournalEngine
                JournalEngine.handle_bill_payment_cheque_cleared(payment)
        except Exception as e:
            from apps.accounting.services.journal_failure import record_journal_failure
            record_journal_failure('bill_payment', payment.id, 'cheque_cleared', e)
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'status': 'success',
            'message': f'Cheque {payment.cheque_number} marked as cleared'
        })


class SupplierCreditNoteViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Supplier Credit Notes.
    Handles credit notes from suppliers for returns or adjustments.
    """
    queryset = SupplierCreditNote.objects.select_related(
        'supplier', 'supplier_bill', 'applied_to_bill', 'created_by', 'approved_by'
    )
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'supplier', 'supplier_bill', 'reason']
    search_fields = ['credit_note_number', 'description']
    ordering_fields = ['credit_note_date', 'amount']
    ordering = ['-credit_note_date']

    def get_serializer_class(self):
        """Use list serializer for list action."""
        if self.action == 'list':
            return SupplierCreditNoteListSerializer
        return SupplierCreditNoteSerializer

    def perform_create(self, serializer):
        """Set created_by on new credit notes."""
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a supplier credit note (triggers accounting entry)."""
        credit_note = self.get_object()

        try:
            credit_note.approve(request.user)
            return Response({
                'status': 'success',
                'message': f'Credit note {credit_note.credit_note_number} approved'
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def apply_to_bill(self, request, pk=None):
        """Apply credit note to a bill."""
        credit_note = self.get_object()
        bill_id = request.data.get('bill_id')

        if not bill_id:
            return Response(
                {'error': 'bill_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            from .models import SupplierBill
            bill = SupplierBill.objects.get(pk=bill_id)
            credit_note.apply_to_bill(bill, request.user)

            return Response({
                'status': 'success',
                'message': f'Credit note applied to bill {bill.bill_number}'
            })
        except SupplierBill.DoesNotExist:
            return Response(
                {'error': 'Bill not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def void(self, request, pk=None):
        """Void a credit note."""
        credit_note = self.get_object()

        try:
            credit_note.void()
            return Response({
                'status': 'success',
                'message': f'Credit note {credit_note.credit_note_number} voided'
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class BillScanViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Bill Scans with AI extraction.

    Endpoints:
    - POST /api/purchases/bill-scans/ - Upload bill scan and trigger AI processing
    - GET /api/purchases/bill-scans/{id}/ - Get scan details with extraction results
    - PATCH /api/purchases/bill-scans/{id}/ - Update extracted data (user edits)
    - POST /api/purchases/bill-scans/{id}/create-bill/ - Create SupplierBill from validated scan
    """
    queryset = BillScan.objects.select_related(
        'uploaded_by', 'matched_supplier', 'created_bill'
    )
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['processing_status', 'matched_supplier']
    search_fields = ['file_name']
    ordering_fields = ['uploaded_at', 'processing_completed_at']
    ordering = ['-uploaded_at']

    def get_serializer_class(self):
        if self.action == 'list':
            return BillScanListSerializer
        return BillScanSerializer

    def create(self, request, *args, **kwargs):
        """
        Upload bill scan file and trigger AI processing.

        Expects a multipart/form-data request with 'file' field.
        """
        file = request.FILES.get('file')

        if not file:
            return Response(
                {'error': 'No file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate file size
        if file.size > settings.BILL_SCAN_MAX_FILE_SIZE:
            return Response(
                {
                    'error': f'File too large. Max size: {settings.BILL_SCAN_MAX_FILE_SIZE / (1024*1024)}MB'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate file type
        if file.content_type not in settings.BILL_SCAN_ALLOWED_TYPES:
            return Response(
                {
                    'error': 'Invalid file type. Allowed: PDF, JPG, PNG'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create BillScan record
        bill_scan = BillScan.objects.create(
            file=file,
            file_name=file.name,
            file_size=file.size,
            file_type=file.content_type,
            uploaded_by=request.user
        )

        # Trigger async AI processing
        from .tasks import process_bill_scan_task
        process_bill_scan_task.delay(bill_scan.id)

        serializer = self.get_serializer(bill_scan)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        """
        Allow updating extracted_data and user_edited_fields.

        Users can edit AI-extracted values and the system tracks which fields were edited.
        """
        instance = self.get_object()

        # Track which fields user edited
        if 'extracted_data' in request.data:
            edited_fields = request.data.get('user_edited_fields', {})
            instance.user_edited_fields = edited_fields

        return super().partial_update(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def create_bill(self, request, pk=None):
        """
        Create SupplierBill from validated scan data.

        Expects validated bill data from frontend after user review.
        """
        bill_scan = self.get_object()

        if bill_scan.processing_status != 'completed':
            return Response(
                {'error': 'Bill scan processing not completed'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if bill_scan.created_bill:
            return Response(
                {'error': 'Bill already created from this scan'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get validated data from request (user may have edited)
        bill_data = request.data

        # Validate required fields
        required_fields = ['internal_reference', 'bill_number', 'supplier', 'bill_date', 'subtotal', 'total']
        missing_fields = [field for field in required_fields if field not in bill_data]
        if missing_fields:
            return Response(
                {'error': f'Missing required fields: {", ".join(missing_fields)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Create SupplierBill
            bill = SupplierBill.objects.create(
                bill_number=bill_data['bill_number'],
                internal_reference=bill_data['internal_reference'],
                supplier_id=bill_data['supplier'],
                bill_date=bill_data['bill_date'],
                due_date=bill_data.get('due_date', bill_data['bill_date']),
                subtotal=bill_data['subtotal'],
                tax_amount=bill_data.get('tax_amount', 0),
                discount_amount=bill_data.get('discount_amount', 0),
                total=bill_data['total'],
                balance_due=bill_data['total'],  # Initially, balance equals total
                notes=bill_data.get('notes', ''),
                created_by=request.user
            )

            # Link scan to bill
            bill_scan.created_bill = bill
            bill_scan.save()

            return Response(
                SupplierBillSerializer(bill).data,
                status=status.HTTP_201_CREATED
            )

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
