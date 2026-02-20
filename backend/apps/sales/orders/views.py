import logging
import re
import traceback
from datetime import timedelta
from io import BytesIO

from django.conf import settings
from django.db import transaction
from django.db.models import Count, Q
from django.http import HttpResponse, FileResponse
from django.shortcuts import get_object_or_404
from django.template.loader import render_to_string
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from weasyprint import HTML

from apps.sales.quotations.models import SalesQuotation, SalesQuotationTimeline
from apps.core.services import CommunicationLogger
from .models import SalesOrder, SalesOrderItem, SalesOrderTimeline, OrderAttachment, OrderShare, OrderPayment
from .serializers import (
    SalesOrderCreateSerializer,
    SalesOrderDetailSerializer,
    SalesOrderItemSerializer,
    SalesOrderListSerializer,
    OrderAttachmentSerializer,
    OrderPaymentSerializer,
)
from .tasks import (
    create_order_print_job_task,
    send_order_email_task,
    send_order_whatsapp_task,
    send_receipt_email_task,
    send_receipt_whatsapp_task,
    create_receipt_print_job_task,
)
from .utils import generate_order_receipt_pdf, format_project_description

logger = logging.getLogger(__name__)


class OrderPagination(PageNumberPagination):
    """Custom pagination for orders"""
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 100


class SalesOrderListView(generics.ListAPIView):
    """
    API endpoint for listing orders with search and filtering
    """
    serializer_class = SalesOrderListSerializer
    pagination_class = OrderPagination
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]

    # Search fields
    search_fields = ['order_number', 'customer__name', 'notes', 'po_so_number']

    # Ordering fields
    ordering_fields = ['order_date', 'net_total', 'created_date', 'order_number', 'status']
    ordering = ['-created_date']  # Default ordering

    # Filter fields
    filterset_fields = {
        'status': ['exact'],
        'is_active': ['exact'],
        'order_date': ['gte', 'lte', 'exact'],
        'required_date': ['gte', 'lte', 'exact'],
        'net_total': ['gte', 'lte'],
        'customer': ['exact'],
        'created_by': ['exact'],
        'quotation': ['exact'],
    }

    def get_queryset(self):
        """
        Optimize queryset with select_related to avoid N+1 queries
        """
        queryset = SalesOrder.objects.select_related(
            'customer', 'created_by', 'quotation', 'costing', 'prepared_by'
        ).prefetch_related('items').annotate(
            item_count=Count('items')
        )
        return queryset


class SalesOrderDetailView(generics.RetrieveAPIView):
    """
    API endpoint for retrieving a single order with full details
    """
    serializer_class = SalesOrderDetailSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'pk'

    def get_queryset(self):
        """
        Optimize queryset with select_related and prefetch_related
        """
        return SalesOrder.objects.select_related(
            'customer', 'created_by', 'updated_by', 'prepared_by',
            'costing', 'quotation'
        ).prefetch_related(
            'items__finished_product',
            'items__costing_sheet',
            'payments',
            'credit_notes',
            'timeline_entries__created_by',
            'attachments__uploaded_by'
        )


class SalesOrderCreateView(generics.CreateAPIView):
    """
    API endpoint for creating new orders
    """
    serializer_class = SalesOrderCreateSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        # created_by is set in serializer
        serializer.save()


class SalesOrderUpdateView(generics.UpdateAPIView):
    """
    API endpoint for updating existing orders
    """
    serializer_class = SalesOrderCreateSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'pk'

    def get_queryset(self):
        """
        Optimize queryset with select_related and prefetch_related
        """
        return SalesOrder.objects.select_related(
            'customer', 'created_by', 'costing', 'quotation'
        ).prefetch_related('items__costing_sheet', 'items__finished_product')


class SalesOrderNextNumberView(APIView):
    """
    API endpoint for generating the next order number
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Generate and return the next available order number
        Format: P###### (legacy format, continuing from existing sequence)
        Example: P221878 -> P221879
        """
        try:
            with transaction.atomic():
                # Get the highest order number from legacy format (P + 6 digits only)
                # Use regex to match exactly P followed by 6 digits
                orders = SalesOrder.objects.filter(
                    order_number__regex=r'^P\d{6}$'
                ).exclude(order_number__isnull=True).exclude(order_number='')

                max_number = 0
                for order in orders:
                    try:
                        # Extract the numeric part after 'P'
                        number_str = order.order_number[1:]  # Remove 'P' prefix
                        number = int(number_str)
                        if number > max_number:
                            max_number = number
                    except (ValueError, TypeError):
                        continue

                # Generate next number (P followed by 6 digits)
                next_number = f"P{max_number + 1}"

                # Ensure the number doesn't already exist
                collision_count = 0
                while SalesOrder.objects.filter(order_number=next_number).exists():
                    max_number += 1
                    next_number = f"P{max_number + 1}"
                    collision_count += 1
                    if collision_count > 100:  # Safety break
                        break

                return Response({
                    'order_number': next_number,
                    'success': True
                }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error generating order number: {str(e)}")
            return Response({
                'error': f'Failed to generate order number: {str(e)}',
                'success': False
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ConvertQuotationToOrderView(APIView):
    """
    API endpoint to convert a quotation to an order
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, quotation_id):
        """
        Convert a quotation to an order
        """
        try:
            # Get the quotation with related data
            quotation = get_object_or_404(
                SalesQuotation.objects.select_related('customer').prefetch_related('items'),
                pk=quotation_id
            )

            with transaction.atomic():
                # Generate next order number
                current_year = timezone.now().year
                year_prefix = f"ORD-{current_year}-"
                orders = SalesOrder.objects.filter(order_number__startswith=year_prefix)
                max_number = 0
                for order in orders:
                    try:
                        number_str = order.order_number.replace(year_prefix, '')
                        number = int(number_str)
                        if number > max_number:
                            max_number = number
                    except (ValueError, TypeError):
                        continue
                next_order_number = f"{year_prefix}{str(max_number + 1).zfill(4)}"

                # Create the order
                order = SalesOrder.objects.create(
                    order_number=next_order_number,
                    number_type=1,  # Order
                    customer=quotation.customer,
                    quotation=quotation,
                    order_date=timezone.now().date(),
                    required_date=quotation.required_date,
                    status='confirmed',  # Start as confirmed since it's from a quotation
                    notes=quotation.notes or '',
                    customer_notes=quotation.private_notes or '',
                    subtotal=quotation.total - (quotation.delivery_charge + quotation.discount + quotation.vat_amount),
                    discount=quotation.discount,
                    delivery_charge=quotation.delivery_charge,
                    vat_rate=quotation.vat_rate,
                    vat_amount=quotation.vat_amount,
                    net_total=quotation.total,
                    costing=quotation.costing,
                    prepared_by=request.user,
                    prepared_from='quotation',
                    prepared_reff=quotation.quot_number,
                    created_by=request.user,
                )

                # Copy items from quotation to order
                for quot_item in quotation.items.all():
                    SalesOrderItem.objects.create(
                        order=order,
                        finished_product=quot_item.finished_product,
                        item_name=quot_item.item or quot_item.finished_product.name if quot_item.finished_product else 'Item',
                        description=quot_item.description,
                        quantity=quot_item.quantity or 1,
                        unit_price=quot_item.unit_price or 0,
                        amount=quot_item.price or 0,
                        costing_sheet=quot_item.costing_sheet,
                        cs_profit_margin=quot_item.cs_profit_margin,
                        cs_profit=quot_item.cs_profit,
                        cs_total=quot_item.cs_total,
                    )

                # Create timeline entry in order
                SalesOrderTimeline.objects.create(
                    order=order,
                    event_type='converted',
                    message=f'Order created from quotation {quotation.quot_number}',
                    created_by=request.user
                )

                # Create timeline entry in quotation
                SalesQuotationTimeline.objects.create(
                    quotation=quotation,
                    event_type='converted',
                    message=f'Converted to order {order.order_number}',
                    created_by=request.user
                )

                # Serialize and return the new order
                serializer = SalesOrderDetailSerializer(order, context={'request': request})
                return Response({
                    'success': True,
                    'message': f'Order {order.order_number} created from quotation {quotation.quot_number}',
                    'order': serializer.data
                }, status=status.HTTP_201_CREATED)

        except SalesQuotation.DoesNotExist:
            return Response(
                {'error': 'Quotation not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error converting quotation {quotation_id} to order: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            return Response(
                {'error': f'Failed to convert quotation to order: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class CloneOrderView(APIView):
    """
    API endpoint to clone an existing order
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        """
        Clone an order with a new order number
        """
        try:
            # Get the original order
            original_order = get_object_or_404(
                SalesOrder.objects.prefetch_related('items'),
                pk=pk
            )

            with transaction.atomic():
                # Generate next order number
                current_year = timezone.now().year
                year_prefix = f"ORD-{current_year}-"
                orders = SalesOrder.objects.filter(order_number__startswith=year_prefix)
                max_number = 0
                for order in orders:
                    try:
                        number_str = order.order_number.replace(year_prefix, '')
                        number = int(number_str)
                        if number > max_number:
                            max_number = number
                    except (ValueError, TypeError):
                        continue
                next_order_number = f"{year_prefix}{str(max_number + 1).zfill(4)}"

                # Clone the order
                cloned_order = SalesOrder.objects.create(
                    order_number=next_order_number,
                    number_type=original_order.number_type,
                    customer=original_order.customer,
                    quotation=None,  # Don't copy quotation link
                    order_date=timezone.now().date(),
                    required_date=original_order.required_date,
                    status='draft',  # Reset to draft
                    po_so_number=None,  # Clear PO/SO number
                    notes=original_order.notes,
                    customer_notes=original_order.customer_notes,
                    delivery_instructions=original_order.delivery_instructions,
                    subtotal=original_order.subtotal,
                    discount=original_order.discount,
                    delivery_charge=original_order.delivery_charge,
                    vat_rate=original_order.vat_rate,
                    vat_amount=original_order.vat_amount,
                    net_total=original_order.net_total,
                    costing=original_order.costing,
                    prepared_by=request.user,
                    prepared_from='clone',
                    prepared_reff=original_order.order_number,
                    created_by=request.user,
                )

                # Clone items
                for item in original_order.items.all():
                    SalesOrderItem.objects.create(
                        order=cloned_order,
                        finished_product=item.finished_product,
                        item_name=item.item_name,
                        description=item.description,
                        quantity=item.quantity,
                        unit_price=item.unit_price,
                        amount=item.amount,
                        costing_sheet=item.costing_sheet,
                        cs_profit_margin=item.cs_profit_margin,
                        cs_profit=item.cs_profit,
                        cs_total=item.cs_total,
                    )

                # Create timeline entry
                SalesOrderTimeline.objects.create(
                    order=cloned_order,
                    event_type='created',
                    message=f'Order cloned from {original_order.order_number}',
                    created_by=request.user
                )

                # Serialize and return
                serializer = SalesOrderDetailSerializer(cloned_order, context={'request': request})
                return Response({
                    'success': True,
                    'message': f'Order {cloned_order.order_number} cloned from {original_order.order_number}',
                    'order': serializer.data
                }, status=status.HTTP_201_CREATED)

        except SalesOrder.DoesNotExist:
            return Response(
                {'error': 'Order not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error cloning order {pk}: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            return Response(
                {'error': f'Failed to clone order: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class TransitionOrderStatusView(APIView):
    """
    API endpoint to transition order status
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        """
        Transition order to a new status with validation
        """
        try:
            order = get_object_or_404(SalesOrder, pk=pk)
            new_status = request.data.get('status')
            message = request.data.get('message', '')
            production_stage = request.data.get('production_stage')

            if not new_status:
                return Response(
                    {'error': 'Status is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Validate status value
            valid_statuses = [choice[0] for choice in SalesOrder.STATUS_CHOICES]
            if new_status not in valid_statuses:
                return Response(
                    {'error': f'Invalid status. Must be one of: {", ".join(valid_statuses)}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if production_stage:
                valid_stages = [choice[0] for choice in SalesOrder.PRODUCTION_STAGE_CHOICES]
                if production_stage not in valid_stages:
                    return Response(
                        {'error': f'Invalid production stage. Must be one of: {", ".join(valid_stages)}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

            old_status = order.status

            with transaction.atomic():
                # Update status
                order.status = new_status

                if new_status == 'production':
                    order.production_stage = production_stage or order.production_stage or 'pre_press'

                # Update date fields based on status
                if new_status == 'production' and not order.production_start_date:
                    order.production_start_date = timezone.now().date()
                elif new_status == 'delivered' and not order.delivered_date:
                    order.delivered_date = timezone.now().date()
                elif new_status == 'completed' and not order.completion_date:
                    order.completion_date = timezone.now().date()

                order.save()

                # Create timeline entry
                event_type = 'status_changed'
                if new_status == 'confirmed':
                    event_type = 'confirmed'
                elif new_status == 'production':
                    event_type = 'production_started'
                elif new_status == 'ready':
                    event_type = 'ready'
                elif new_status == 'delivered':
                    event_type = 'delivered'
                elif new_status == 'completed':
                    event_type = 'completed'
                elif new_status == 'cancelled':
                    event_type = 'cancelled'

                timeline_message = message if message else f'Status changed from {old_status} to {new_status}'

                SalesOrderTimeline.objects.create(
                    order=order,
                    event_type=event_type,
                    message=timeline_message,
                    old_status=old_status,
                    new_status=new_status,
                    created_by=request.user
                )

                return Response({
                    'success': True,
                    'message': f'Order status updated to {new_status}',
                    'old_status': old_status,
                    'new_status': new_status,
                    'production_stage': order.production_stage
                }, status=status.HTTP_200_OK)

        except SalesOrder.DoesNotExist:
            return Response(
                {'error': 'Order not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error transitioning order {pk} status: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            return Response(
                {'error': f'Failed to update status: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_order_job_card(request, pk):
    """
    Placeholder hook: when a job card is created, move order to production.
    """
    try:
        order = get_object_or_404(SalesOrder, pk=pk)
        job_ticket_number = request.data.get('job_ticket_number')

        with transaction.atomic():
            if not order.job_ticket_generated:
                order.job_ticket_generated = True
            if job_ticket_number:
                order.job_ticket_number = job_ticket_number

            old_status = order.status
            if order.status != 'production':
                order.status = 'production'
                order.production_start_date = order.production_start_date or timezone.now().date()
                order.production_stage = order.production_stage or 'pre_press'

                SalesOrderTimeline.objects.create(
                    order=order,
                    event_type='production_started',
                    message='Production started from job card creation',
                    old_status=old_status,
                    new_status='production',
                    created_by=request.user
                )

            SalesOrderTimeline.objects.create(
                order=order,
                event_type='job_ticket_generated',
                message='Job card created',
                created_by=request.user
            )

            order.save()

        return Response({
            'success': True,
            'status': order.status,
            'production_stage': order.production_stage,
            'job_ticket_generated': order.job_ticket_generated,
        }, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"Error creating job card for order {pk}: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return Response(
            {'error': f'Failed to create job card: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def set_order_production_stage(request, pk):
    """
    Placeholder hook: update the production stage for an order in production.
    """
    try:
        order = get_object_or_404(SalesOrder, pk=pk)
        production_stage = request.data.get('production_stage')

        if order.status != 'production':
            return Response(
                {'error': 'Order must be in production to set a stage'},
                status=status.HTTP_400_BAD_REQUEST
            )

        valid_stages = [choice[0] for choice in SalesOrder.PRODUCTION_STAGE_CHOICES]
        if production_stage not in valid_stages:
            return Response(
                {'error': f'Invalid production stage. Must be one of: {", ".join(valid_stages)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        order.production_stage = production_stage
        order.save(update_fields=['production_stage'])

        SalesOrderTimeline.objects.create(
            order=order,
            event_type='status_changed',
            message=f'Production stage updated to {production_stage}',
            created_by=request.user
        )

        return Response({
            'success': True,
            'production_stage': order.production_stage,
        }, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"Error setting production stage for order {pk}: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return Response(
            {'error': f'Failed to set production stage: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_order_ready(request, pk):
    """
    Placeholder hook: when a dispatch note is created, mark order as ready.
    """
    try:
        order = get_object_or_404(SalesOrder, pk=pk)
        old_status = order.status
        order.status = 'ready'
        order.save(update_fields=['status'])

        SalesOrderTimeline.objects.create(
            order=order,
            event_type='ready',
            message='Order marked ready from dispatch note',
            old_status=old_status,
            new_status='ready',
            created_by=request.user
        )

        return Response({'success': True, 'status': 'ready'}, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"Error marking order ready {pk}: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return Response(
            {'error': f'Failed to mark ready: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_order_delivered(request, pk):
    """
    Placeholder hook: when an order is delivered or picked up.
    """
    try:
        order = get_object_or_404(SalesOrder, pk=pk)
        old_status = order.status
        order.status = 'delivered'
        order.delivered_date = order.delivered_date or timezone.now().date()
        order.save(update_fields=['status', 'delivered_date'])

        SalesOrderTimeline.objects.create(
            order=order,
            event_type='delivered',
            message='Order delivered to customer',
            old_status=old_status,
            new_status='delivered',
            created_by=request.user
        )

        return Response({'success': True, 'status': 'delivered'}, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"Error marking order delivered {pk}: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return Response(
            {'error': f'Failed to mark delivered: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_order_completed(request, pk):
    """
    Placeholder hook: when invoice is created and order is done.
    """
    try:
        order = get_object_or_404(SalesOrder, pk=pk)
        old_status = order.status
        order.status = 'completed'
        order.completion_date = order.completion_date or timezone.now().date()
        order.save(update_fields=['status', 'completion_date'])

        SalesOrderTimeline.objects.create(
            order=order,
            event_type='completed',
            message='Order completed after invoice',
            old_status=old_status,
            new_status='completed',
            created_by=request.user
        )

        return Response({'success': True, 'status': 'completed'}, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"Error marking order completed {pk}: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return Response(
            {'error': f'Failed to mark completed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def order_pdf(request, pk):
    """
    Generate and return PDF for a specific order
    """
    try:
        # Get the order with related data
        order = get_object_or_404(
            SalesOrder.objects.select_related(
                'customer', 'created_by'
            ).prefetch_related('items'),
            pk=pk
        )

        project_description = order.project_name or format_project_description(order.items.all())

        # Prepare context for template
        context = {
            'order': order,
            'project_description': project_description,
        }

        # Render HTML template
        html_string = render_to_string('orders/order_pdf.html', context)

        # Generate PDF
        pdf_buffer = BytesIO()
        html = HTML(string=html_string, base_url=request.build_absolute_uri('/'))
        html.write_pdf(pdf_buffer)
        pdf_buffer.seek(0)

        # Create HTTP response
        response = HttpResponse(pdf_buffer.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="Order-{order.order_number}.pdf"'

        return response

    except SalesOrder.DoesNotExist:
        return HttpResponse('Order not found', status=404)
    except Exception as e:
        logger.error(f"Error generating PDF for order {pk}: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return HttpResponse(f'Error generating PDF: {str(e)}', status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def order_payment_receipt_pdf(request, payment_id):
    """
    Download receipt PDF for an order advance payment.
    """
    try:
        pdf_buffer = generate_order_receipt_pdf(payment_id)
        response = HttpResponse(pdf_buffer.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="Order-Receipt-{payment_id}.pdf"'
        return response
    except OrderPayment.DoesNotExist:
        return HttpResponse('Payment not found', status=404)
    except Exception as e:
        logger.error(f"Error generating order receipt PDF: {e}", exc_info=True)
        return HttpResponse('Error generating receipt PDF', status=500)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_order_email(request, pk):
    """
    Send order confirmation via email
    """
    try:
        order = get_object_or_404(SalesOrder, pk=pk)

        # Extract email data from request
        to_emails = request.data.get('to', [])
        cc_emails = request.data.get('cc', [])
        subject = request.data.get('subject', f'Order Confirmation - {order.order_number}')
        message = request.data.get('message', '')

        # Validate emails
        if not to_emails:
            return Response(
                {'error': 'At least one recipient email is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Queue the email task
        task = send_order_email_task.delay({
            'order_id': order.id,
            'to_emails': to_emails,
            'cc_emails': cc_emails,
            'subject': subject,
            'message': message,
            'user_id': request.user.id
        })

        logger.info(f"Order email task queued with ID: {task.id}")

        return Response({
            'success': True,
            'message': f'Email is being sent to {len(to_emails)} recipient(s)',
            'task_id': task.id,
        }, status=status.HTTP_200_OK)

    except SalesOrder.DoesNotExist:
        return Response(
            {'error': 'Order not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Error in send_order_email: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return Response(
            {'error': f'Failed to send email: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def print_order(request, order_id):
    """
    Create a print job for an order
    """
    try:
        order = get_object_or_404(SalesOrder, pk=order_id)

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

        logger.info(f"Creating print job for order {order.order_number}")

        # Queue the print task
        task = create_order_print_job_task.delay(
            order.id,
            request.user.id,
            printer_name=printer_name,
            copies=copies
        )

        logger.info(f"Print job task queued with ID: {task.id}")

        return Response({
            'success': True,
            'message': f'Print job queued for order #{order.order_number}',
            'task_id': task.id,
            'order_number': order.order_number,
            'printer_name': printer_name,
            'copies': copies
        }, status=status.HTTP_200_OK)

    except SalesOrder.DoesNotExist:
        return Response(
            {'error': 'Order not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Error creating print job for order {order_id}: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return Response(
            {'error': f'Failed to create print job: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_order_whatsapp(request, pk):
    """
    Send order confirmation via WhatsApp
    """
    try:
        order = get_object_or_404(
            SalesOrder.objects.select_related('customer'),
            pk=pk
        )

        # Extract WhatsApp data
        phone_number = request.data.get('phone_number')
        message = request.data.get('message', '')

        if not phone_number:
            # Try to get from customer
            if order.customer and order.customer.contact:
                phone_number = order.customer.contact
            else:
                return Response(
                    {'error': 'Phone number is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Queue the WhatsApp task
        task = send_order_whatsapp_task.delay({
            'order_id': order.id,
            'phone_number': phone_number,
            'message': message,
            'user_id': request.user.id
        })

        logger.info(f"Order WhatsApp task queued with ID: {task.id}")

        return Response({
            'success': True,
            'message': f'WhatsApp message is being sent to {phone_number}',
            'task_id': task.id,
        }, status=status.HTTP_200_OK)

    except SalesOrder.DoesNotExist:
        return Response(
            {'error': 'Order not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Error in send_order_whatsapp: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return Response(
            {'error': f'Failed to send WhatsApp message: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_order_share_link(request, pk):
    """
    Generate a secure share link for an order
    """
    try:
        order = get_object_or_404(SalesOrder, pk=pk)
        logger.info(f"Generating share link for order {order.order_number}")

        # Set expiration (default 7 days)
        expires_days = request.data.get('expires_days', 7)
        expires_at = timezone.now() + timedelta(days=expires_days)

        # Generate unique token
        token = OrderShare.generate_token()
        while OrderShare.objects.filter(token=token).exists():
            token = OrderShare.generate_token()

        # Create share record
        share = OrderShare.objects.create(
            order=order,
            token=token,
            expires_at=expires_at,
            created_by=request.user
        )

        # Generate the share URL
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        share_url = f"{frontend_url}/shared/order/{token}"

        logger.info(f"Created share link: {share_url}")

        return Response({
            'success': True,
            'share_url': share_url,
            'token': token,
            'expires_at': expires_at.isoformat(),
            'expires_days': expires_days
        }, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"Error generating share link for order {pk}: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return Response(
            {'error': f'Failed to generate share link: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


class OrderAttachmentUploadView(generics.CreateAPIView):
    """
    API endpoint to upload file attachments for an order
    """
    serializer_class = OrderAttachmentSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        order_id = self.kwargs.get('order_id')
        order = get_object_or_404(SalesOrder, pk=order_id)
        serializer.save(order=order, uploaded_by=self.request.user)


class OrderAttachmentDownloadView(generics.RetrieveAPIView):
    """
    API endpoint to download an order attachment
    """
    queryset = OrderAttachment.objects.all()
    permission_classes = [IsAuthenticated]

    def retrieve(self, request, *args, **kwargs):
        attachment = self.get_object()
        # Return file URL for download
        return Response({
            'success': True,
            'file_url': request.build_absolute_uri(attachment.file.url),
            'file_name': attachment.title,
        }, status=status.HTTP_200_OK)


# ============================================================================
# Order Payment Views (Advances)
# ============================================================================

class OrderPaymentListView(generics.ListAPIView):
    """
    List all payments for a specific order
    """
    serializer_class = OrderPaymentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        order_id = self.kwargs.get('order_id')
        return OrderPayment.objects.filter(
            order_id=order_id,
            is_void=False
        ).select_related('created_by', 'deposit_account', 'cheque_deposit_account').order_by('-payment_date')


class OrderPaymentCreateView(APIView):
    """
    Create a new payment for an order (Advance Payment)

    Order payments go to Customer Advances, not AR/Sales.
    Journal Entry:
        DR: Cash/Bank
        CR: Customer Advances (net of VAT)
        CR: VAT Payable (VAT portion)
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, order_id):
        try:
            order = get_object_or_404(SalesOrder, pk=order_id)

            payment_data = dict(request.data)
            payment_method = payment_data.get('payment_method', 'cash')
            bank_account_param = payment_data.pop('bank_account_id', None)

            # Clean optional fields to avoid invalid empty values
            optional_fields = [
                'reference_number',
                'notes',
                'cheque_number',
                'cheque_date',
                'cheque_deposit_account',
            ]
            for field in optional_fields:
                if payment_data.get(field) == '' or not payment_data.get(field):
                    payment_data.pop(field, None)

            # Validate payment data
            serializer = OrderPaymentSerializer(data=payment_data)
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

            with transaction.atomic():
                from apps.accounting.services.journal_context import skip_accounting_journal_signals

                # Authoritative flow: views schedule journals explicitly; signals stay as a backstop.
                with skip_accounting_journal_signals():
                    payment = OrderPayment.objects.create(
                        order=order,
                        payment_date=serializer.validated_data.get('payment_date', timezone.now()),
                        amount=serializer.validated_data['amount'],
                        payment_method=serializer.validated_data['payment_method'],
                        reference_number=serializer.validated_data.get('reference_number'),
                        notes=serializer.validated_data.get('notes'),
                        cheque_number=serializer.validated_data.get('cheque_number'),
                        cheque_date=serializer.validated_data.get('cheque_date'),
                        cheque_deposit_account=serializer.validated_data.get('cheque_deposit_account'),
                        created_by=request.user,
                    )

                # Generate receipt number
                payment.generate_receipt_number()

                # Map deposit account based on payment method
                from apps.accounting.models import ChartOfAccounts

                def get_account_by_id_or_code(account_param):
                    if not account_param:
                        return None
                    try:
                        return ChartOfAccounts.objects.get(id=int(account_param))
                    except (ValueError, ChartOfAccounts.DoesNotExist):
                        try:
                            return ChartOfAccounts.objects.get(account_code=str(account_param))
                        except ChartOfAccounts.DoesNotExist:
                            return None

                deposit_account = None
                if payment_method == 'cash':
                    deposit_account = ChartOfAccounts.objects.get(account_code='1000')
                elif payment_method == 'cheque':
                    deposit_account = ChartOfAccounts.objects.get(account_code='1040')
                elif payment_method in ['bank_transfer', 'card']:
                    deposit_account = get_account_by_id_or_code(bank_account_param)
                    if not deposit_account:
                        deposit_account = ChartOfAccounts.objects.get(account_code='1010')
                else:
                    deposit_account = ChartOfAccounts.objects.get(account_code='1010')

                if deposit_account:
                    payment.deposit_account = deposit_account
                    payment.save(update_fields=['deposit_account'])

                from apps.accounting.services.journal_events import schedule_order_advance_received
                schedule_order_advance_received(payment.id)

                # Update order totals
                self._update_order_totals(order)

                # Create timeline entry
                SalesOrderTimeline.objects.create(
                    order=order,
                    event_type='modified',
                    message=f"Payment of Rs. {payment.amount:,.2f} received ({payment.get_payment_method_display()}). Receipt: {payment.receipt_number}",
                    created_by=request.user
                )

                # Return serialized payment
                return Response({
                    'success': True,
                    'payment': OrderPaymentSerializer(payment).data,
                    'order_amount_paid': float(order.amount_paid),
                    'order_balance_due': float(order.balance_due),
                }, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"Error creating order payment: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            return Response(
                {'error': f'Failed to create payment: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def _update_order_totals(self, order):
        """Update order amount_paid and balance_due from payments"""
        from django.db.models import Sum
        total_paid = OrderPayment.objects.filter(
            order=order,
            is_void=False,
            is_reversed=False,
            is_refunded=False
        ).aggregate(total=Sum('amount'))['total'] or 0

        order.amount_paid = total_paid
        order.balance_due = order.net_total - total_paid
        order.save(update_fields=['amount_paid', 'balance_due'])


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def void_order_payment(request, payment_id):
    """
    Void an order payment

    This reverses the journal entry and updates order totals.
    """
    return Response(
        {
            'error': 'Void payment is disabled. Use Reverse Payment (if money never moved) '
                     'or Credit Memo/Refund (if money moved).'
        },
        status=status.HTTP_400_BAD_REQUEST
    )

    # Legacy flow retained for reference; should not be used.
    try:
        payment = get_object_or_404(OrderPayment, pk=payment_id)

        if payment.is_void:
            return Response(
                {'error': 'Payment is already voided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        void_reason = request.data.get('void_reason', 'Payment voided')

        with transaction.atomic():
            # Mark payment as void
            payment.is_void = True
            payment.void_reason = void_reason
            payment.voided_by = request.user
            payment.voided_at = timezone.now()
            payment.save(update_fields=['is_void', 'void_reason', 'voided_by', 'voided_at'])

            # Create reversal journal entry if original exists
            if payment.journal_entry:
                from apps.accounting.services.journal_engine import JournalEngine
                try:
                    # Create reversal journal (swap debits and credits)
                    original_journal = payment.journal_entry
                    reversal_lines = []
                    for line in original_journal.lines.all():
                        reversal_lines.append({
                            'account_code': line.account.account_code,
                            'debit': line.credit,  # Swap
                            'credit': line.debit,  # Swap
                            'description': f"Reversal: {line.description}",
                        })

                    JournalEngine.create_journal_entry(
                        entry_date=timezone.now().date(),
                        source_type='order_payment_void',
                        source_id=payment.id,
                        event_type='payment_voided',
                        description=f"Void payment for Order {payment.order.order_number}",
                        lines_data=reversal_lines,
                        created_by=request.user,
                    )
                except Exception as je_error:
                    logger.error(f"Failed to create reversal journal: {je_error}")

            # Update order totals
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

            # Create timeline entry
            SalesOrderTimeline.objects.create(
                order=order,
                event_type='modified',
                message=f"Payment voided: Rs. {payment.amount:,.2f} ({payment.get_payment_method_display()}). Reason: {void_reason}",
                created_by=request.user
            )

        return Response({
            'success': True,
            'message': 'Payment voided successfully',
            'order_amount_paid': float(order.amount_paid),
            'order_balance_due': float(order.balance_due),
        }, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"Error voiding order payment: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return Response(
            {'error': f'Failed to void payment: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reverse_order_payment(request, payment_id):
    """
    Reverse an order payment via accounting reversal (preferred over voiding).
    """
    if request.user.role not in ['admin', 'accounting']:
        return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
    try:
        with transaction.atomic():
            payment = OrderPayment.objects.select_for_update().get(pk=payment_id)

            if payment.is_reversed:
                return Response({'error': 'Payment already reversed'}, status=status.HTTP_400_BAD_REQUEST)
            if getattr(payment, 'is_refunded', False):
                return Response({'error': 'Payment already refunded'}, status=status.HTTP_400_BAD_REQUEST)

            if not payment.journal_entry:
                return Response({'error': 'Payment has no journal entry to reverse'}, status=status.HTTP_400_BAD_REQUEST)

            if not payment.journal_entry.is_posted:
                return Response({'error': 'Payment journal is not posted'}, status=status.HTTP_400_BAD_REQUEST)

            reversal_entry = payment.journal_entry.reverse(user=request.user)

            payment.is_reversed = True
            payment.reversed_by = request.user
            payment.reversed_at = timezone.now()
            payment.reversal_journal_entry = reversal_entry
            payment.save(update_fields=[
                'is_reversed', 'reversed_by', 'reversed_at', 'reversal_journal_entry'
            ])

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
                message=f"Payment reversed: Rs. {payment.amount:,.2f} ({payment.get_payment_method_display()}).",
                created_by=request.user
            )

        return Response({
            'success': True,
            'message': 'Payment reversed successfully',
            'order_amount_paid': float(order.amount_paid),
            'order_balance_due': float(order.balance_due),
        }, status=status.HTTP_200_OK)

    except OrderPayment.DoesNotExist:
        return Response({'error': 'Payment not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error reversing order payment: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return Response(
            {'error': f'Failed to reverse payment: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def refund_order_payment(request, payment_id):
    """
    Refund an order payment when money has already moved.
    """
    if request.user.role not in ['admin', 'accounting']:
        return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
    from apps.accounting.services.journal_engine import JournalEngine
    from apps.accounting.services.journal_failure import record_journal_failure

    try:
        with transaction.atomic():
            payment = OrderPayment.objects.select_for_update().get(pk=payment_id)

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

            try:
                journal = JournalEngine.handle_order_advance_refund(payment)
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
                message=f"Payment refunded: Rs. {payment.amount:,.2f} ({payment.get_payment_method_display()}).",
                created_by=request.user
            )

        return Response({
            'success': True,
            'message': 'Payment refunded successfully',
            'order_amount_paid': float(order.amount_paid),
            'order_balance_due': float(order.balance_due),
        }, status=status.HTTP_200_OK)

    except OrderPayment.DoesNotExist:
        return Response({'error': 'Payment not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error refunding order payment: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return Response(
            {'error': f'Failed to refund payment: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def clear_order_payment_cheque(request, payment_id):
    """
    Mark an order cheque payment as cleared/deposited.

    POST /sales/orders/payments/{payment_id}/clear-cheque/
    """
    try:
        with transaction.atomic():
            from apps.accounting.services.journal_context import skip_accounting_journal_signals
            from apps.accounting.services.journal_events import schedule_order_payment_cheque_cleared

            payment = OrderPayment.objects.select_for_update().get(pk=payment_id)

            if payment.payment_method != 'cheque':
                return Response({'error': 'Payment is not a cheque'}, status=status.HTTP_400_BAD_REQUEST)

            if payment.cheque_cleared:
                schedule_order_payment_cheque_cleared(payment.id)
                return Response({
                    'success': True,
                    'message': f'Cheque {payment.cheque_number} is already cleared',
                    'cheque_cleared_date': payment.cheque_cleared_date,
                    'journal_id': payment.cheque_clearance_journal_entry_id,
                }, status=status.HTTP_200_OK)

            cleared_date = request.data.get('cleared_date')
            if cleared_date:
                payment.cheque_cleared_date = cleared_date
            else:
                payment.cheque_cleared_date = timezone.now().date()

            payment.cheque_cleared = True
            with skip_accounting_journal_signals():
                payment.save(update_fields=['cheque_cleared', 'cheque_cleared_date'])

            schedule_order_payment_cheque_cleared(payment.id)

            SalesOrderTimeline.objects.create(
                order=payment.order,
                event_type='modified',
                message=f"Cheque {payment.cheque_number} cleared on {payment.cheque_cleared_date}",
                created_by=request.user
            )

        return Response({
            'success': True,
            'message': f'Cheque {payment.cheque_number} marked as cleared',
            'cheque_cleared_date': payment.cheque_cleared_date
        }, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"Error clearing order cheque: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return Response(
            {'error': f'Failed to clear cheque: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# ===================== ORDER RECEIPT ENDPOINTS =====================

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def email_order_receipt(request, payment_id):
    """
    Send order payment receipt via email with PDF attachment.
    """
    try:
        payment = OrderPayment.objects.select_related('order__customer').get(id=payment_id)

        if not payment.receipt_number:
            payment.generate_receipt_number()

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

    except OrderPayment.DoesNotExist:
        return Response({'error': 'Payment not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error queuing order receipt email: {e}", exc_info=True)
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def whatsapp_order_receipt(request, payment_id):
    """
    Send order payment receipt via WhatsApp with secure link.
    """
    try:
        payment = OrderPayment.objects.select_related('order__customer').get(id=payment_id)

        if not payment.receipt_number:
            payment.generate_receipt_number()

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

    except OrderPayment.DoesNotExist:
        return Response({'error': 'Payment not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error queuing order receipt WhatsApp: {e}", exc_info=True)
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def print_order_receipt(request, payment_id):
    """
    Print order payment receipt to A5 printer.
    """
    try:
        payment = OrderPayment.objects.select_related('order__customer').get(id=payment_id)

        if not payment.receipt_number:
            payment.generate_receipt_number()

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

    except OrderPayment.DoesNotExist:
        return Response({'error': 'Payment not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error queuing order receipt print: {e}", exc_info=True)
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_order_receipt_share_link(request, payment_id):
    """
    Generate a secure share link for viewing an order receipt online.
    """
    try:
        from django.core.signing import Signer

        payment = OrderPayment.objects.get(id=payment_id)

        if not payment.receipt_number:
            payment.generate_receipt_number()

        signer = Signer()
        token = signer.sign(f"order_receipt_{payment.id}")

        frontend_url = getattr(settings, 'FRONTEND_URL', None)
        if not frontend_url:
            frontend_url = request.build_absolute_uri('/')[:-1]

        share_url = f"{frontend_url}/receipts/view/{token}"

        return Response({
            'share_url': share_url,
            'receipt_number': payment.receipt_number
        }, status=status.HTTP_200_OK)

    except OrderPayment.DoesNotExist:
        return Response({'error': 'Payment not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error generating order receipt share link: {e}", exc_info=True)
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def view_order_receipt_public(request, token):
    """
    Public endpoint to view order receipt via secure share link.
    No authentication required.
    """
    try:
        from django.core.signing import Signer, BadSignature

        signer = Signer()
        unsigned_value = signer.unsign(token)

        if not unsigned_value.startswith('order_receipt_'):
            return Response({'error': 'Invalid token'}, status=status.HTTP_400_BAD_REQUEST)

        payment_id = int(unsigned_value.replace('order_receipt_', ''))

        payment = OrderPayment.objects.select_related(
            'order__customer',
            'created_by',
            'deposit_account',
            'cheque_deposit_account'
        ).get(id=payment_id)

        if not payment.receipt_number:
            payment.generate_receipt_number()

        return Response({
            'document_type': 'order',
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
            'order': {
                'id': payment.order.id,
                'order_number': payment.order.order_number,
                'customer_name': payment.order.customer.name if payment.order.customer else 'N/A',
                'customer_email': payment.order.customer.email if payment.order.customer else None,
                'customer_phone': payment.order.customer.contact if payment.order.customer else None,
            },
            'cashier_name': payment.created_by.get_full_name() if payment.created_by else 'N/A',
        }, status=status.HTTP_200_OK)

    except BadSignature:
        return Response({'error': 'Invalid or expired token'}, status=status.HTTP_400_BAD_REQUEST)
    except OrderPayment.DoesNotExist:
        return Response({'error': 'Receipt not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error viewing order receipt: {e}", exc_info=True)
        return Response({'error': 'Unable to load receipt'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def download_order_receipt_pdf(request, token):
    """
    Download order receipt PDF via secure share link.
    No authentication required.
    """
    try:
        from django.core.signing import Signer, BadSignature

        signer = Signer()
        unsigned_value = signer.unsign(token)

        if not unsigned_value.startswith('order_receipt_'):
            return Response({'error': 'Invalid token'}, status=status.HTTP_400_BAD_REQUEST)

        payment_id = int(unsigned_value.replace('order_receipt_', ''))
        payment = OrderPayment.objects.get(id=payment_id)

        if not payment.receipt_number:
            payment.generate_receipt_number()

        pdf_buffer = generate_order_receipt_pdf(payment_id)

        response = FileResponse(
            pdf_buffer,
            as_attachment=True,
            filename=f'Receipt-{payment.receipt_number}.pdf',
            content_type='application/pdf'
        )

        return response

    except BadSignature:
        return Response({'error': 'Invalid or expired token'}, status=status.HTTP_400_BAD_REQUEST)
    except OrderPayment.DoesNotExist:
        return Response({'error': 'Receipt not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error downloading order receipt PDF: {e}", exc_info=True)
        return Response({'error': 'Unable to generate receipt'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def view_order_receipt_by_number(request, receipt_number):
    """
    Public endpoint to view order receipt by receipt number.
    No authentication required.
    """
    try:
        payment = OrderPayment.objects.select_related(
            'order__customer',
            'created_by',
            'deposit_account',
            'cheque_deposit_account'
        ).get(receipt_number=receipt_number)

        return Response({
            'document_type': 'order',
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
            'order': {
                'id': payment.order.id,
                'order_number': payment.order.order_number,
                'customer_name': payment.order.customer.name if payment.order.customer else 'N/A',
                'customer_email': payment.order.customer.email if payment.order.customer else None,
                'customer_phone': payment.order.customer.contact if payment.order.customer else None,
            },
            'cashier_name': payment.created_by.get_full_name() if payment.created_by else 'N/A',
        }, status=status.HTTP_200_OK)

    except OrderPayment.DoesNotExist:
        return Response({'error': 'Receipt not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error viewing order receipt by number: {e}", exc_info=True)
        return Response({'error': 'Unable to load receipt'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def download_order_receipt_pdf_by_number(request, receipt_number):
    """
    Public endpoint to download order receipt PDF by receipt number.
    No authentication required.
    """
    try:
        payment = OrderPayment.objects.get(receipt_number=receipt_number)
        pdf_buffer = generate_order_receipt_pdf(payment.id)

        response = HttpResponse(pdf_buffer.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename=\"Receipt-{receipt_number}.pdf\"'
        return response

    except OrderPayment.DoesNotExist:
        return Response({'error': 'Receipt not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error downloading order receipt PDF by number: {e}", exc_info=True)
        return Response({'error': 'Unable to generate receipt'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
