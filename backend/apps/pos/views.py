from django.db.models import F, Q, Sum, Count
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.permissions import IsAccounting, IsDesigner, IsOrderOwner, IsPOSStaff
from apps.customers.models import Customer

from .models import (
    CashDrawerSession,
    POSOrder,
    POSOrderItem,
    POSPayment,
    POSTransaction,
    POSTransactionItem,
    POSProduct,
    POSCategory,
    POSLocation,
)
from .serializers import (
    CashDrawerSessionSerializer,
    POSOrderCompletePaymentSerializer,
    POSOrderCreateSerializer,
    POSOrderDetailSerializer,
    POSOrderListSerializer,
    POSOrderUpdateSerializer,
    POSOrderVoidSerializer,
    POSTransactionSerializer,
    POSProductQuickAccessSerializer,
    POSProductSerializer,
    POSProductListSerializer,
    POSCategorySerializer,
    POSLocationSerializer,
)
from .services import (
    complete_pos_order,
    create_pos_order,
    get_or_create_open_session,
    update_pos_order,
    void_pos_order,
)


class CashDrawerSessionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing cash drawer sessions.
    """
    queryset = CashDrawerSession.objects.all()
    serializer_class = CashDrawerSessionSerializer
    permission_classes = [IsAuthenticated, IsAccounting]

    def get_queryset(self):
        """Filter sessions by user if not admin"""
        user = self.request.user
        if user.role == 'admin':
            return CashDrawerSession.objects.all()
        return CashDrawerSession.objects.filter(user=user)

    @action(detail=False, methods=['get'])
    def open(self, request):
        """Get the current open session for the user"""
        session = CashDrawerSession.objects.filter(
            user=request.user,
            status='open'
        ).first()

        if not session:
            return Response(status=status.HTTP_204_NO_CONTENT)

        serializer = self.get_serializer(session)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def report(self, request, pk=None):
        """Get detailed session report"""
        session = self.get_object()
        
        # Payment Breakdown
        payments = POSPayment.objects.filter(
            transaction__cash_drawer_session=session,
            transaction__status='completed'
        ).values('payment_method').annotate(total=Sum('amount'))
        
        payment_breakdown = {
            'cash': 0,
            'card': 0,
            'lanka_qr': 0,
            'account': 0,
            'other': 0
        }
        
        for p in payments:
            method = p['payment_method']
            amount = float(p['total'])
            if method == 'cash':
                payment_breakdown['cash'] += amount
            elif method == 'card':
                payment_breakdown['card'] += amount
            elif method == 'mobile_payment':
                payment_breakdown['lanka_qr'] += amount
            elif method == 'account':
                payment_breakdown['account'] += amount
            else:
                payment_breakdown['other'] += amount

        # Transaction Stats
        completed_count = session.transactions.filter(status='completed').count()
        pending_count = POSOrder.objects.filter(
            location=session.location, 
            status='pending_payment'
        ).count()

        # Category Performance
        category_performance = POSTransactionItem.objects.filter(
            transaction__cash_drawer_session=session,
            transaction__status='completed'
        ).values(
            category_name=F('product__category__name')
        ).annotate(
            total_revenue=Sum('line_total')
        ).order_by('-total_revenue')

        # Typesetter Leaderboard
        # Link via POSOrder.related_transaction -> POSTransaction
        leaderboard = POSOrder.objects.filter(
            related_transaction__cash_drawer_session=session,
            related_transaction__status='completed'
        ).values(
            designer_name=F('created_by__username'),
            designer_email=F('created_by__email')
        ).annotate(
            total_sales=Sum('total')
        ).order_by('-total_sales')

        data = {
            'id': session.id,
            'session_number': session.session_number,
            'user': session.user_id,
            'location': session.location_id,
            'opened_at': session.opened_at,
            'status': session.status,
            'opening_balance': session.opening_balance,
            'expected_balance': session.expected_balance,
            'payment_breakdown': payment_breakdown,
            'stats': {
                'completed_orders': completed_count,
                'pending_orders': pending_count
            },
            'category_performance': [
                {
                    'name': item['category_name'] or 'Uncategorized',
                    'value': float(item['total_revenue'] or 0)
                } for item in category_performance
            ],
            'leaderboard': [
                {
                    'name': item['designer_name'] or item['designer_email'],
                    'value': float(item['total_sales'] or 0)
                } for item in leaderboard
            ]
        }

        return Response(data)

    @action(detail=False, methods=['get'])
    def last_closed(self, request):
        """Get the most recent closed session for a location"""
        location_id = request.query_params.get('location_id')

        if not location_id:
            return Response(
                {'error': 'location_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        session = CashDrawerSession.objects.filter(
            location_id=location_id,
            status='closed'
        ).order_by('-closed_at').first()

        if not session:
            return Response(status=status.HTTP_204_NO_CONTENT)

        # Get lightweight session summary
        transactions = session.transactions.filter(status='completed')
        total_sales = transactions.aggregate(total=Sum('total'))['total'] or 0

        # Payment breakdown
        payments = POSPayment.objects.filter(
            transaction__cash_drawer_session=session,
            transaction__status='completed'
        ).values('payment_method').annotate(total=Sum('amount'))

        payment_breakdown = {
            'cash': 0, 'card': 0, 'lanka_qr': 0, 'account': 0, 'other': 0
        }

        for p in payments:
            method = p['payment_method']
            amount = float(p['total'])
            if method == 'cash':
                payment_breakdown['cash'] += amount
            elif method == 'card':
                payment_breakdown['card'] += amount
            elif method == 'mobile_payment':
                payment_breakdown['lanka_qr'] += amount
            elif method == 'account':
                payment_breakdown['account'] += amount
            else:
                payment_breakdown['other'] += amount

        data = {
            'id': session.id,
            'session_number': session.session_number,
            'user_email': session.user.email,
            'opened_at': session.opened_at,
            'closed_at': session.closed_at,
            'duration_hours': (session.closed_at - session.opened_at).total_seconds() / 3600,
            'opening_balance': str(session.opening_balance),
            'actual_balance': str(session.actual_balance),
            'expected_balance': str(session.expected_balance),
            'variance': str(session.variance),
            'transaction_count': transactions.count(),
            'total_sales': str(total_sales),
            'payment_breakdown': payment_breakdown
        }

        return Response(data)

    @action(detail=True, methods=['post'])
    def force_close(self, request, pk=None):
        """Force close an old session (requires actual_balance and closing_notes)"""
        session = self.get_object()

        if session.status != 'open':
            return Response(
                {'error': 'Session is not open'},
                status=status.HTTP_400_BAD_REQUEST
            )

        actual_balance = request.data.get('actual_balance')
        closing_notes = request.data.get('closing_notes')

        if actual_balance is None:
            return Response(
                {'error': 'actual_balance is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not closing_notes:
            return Response(
                {'error': 'closing_notes are required when force-closing old sessions'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Close session
        from django.db import transaction
        from apps.pos.zreport_service import generate_zreport, post_zreport_journal

        with transaction.atomic():
            session.close_session(
                actual_balance=actual_balance,
                closing_notes=closing_notes
            )
            zreport = generate_zreport(session)
            post_zreport_journal(zreport, created_by=request.user)

        serializer = self.get_serializer(session)
        return Response(serializer.data)

    def partial_update(self, request, *args, **kwargs):
        """Update session - validate pending orders before closing"""
        try:
            session = self.get_object()

            # If attempting to close session, validate
            if request.data.get('status') == 'closed':
                # Check if session is already closed
                if session.status == 'closed':
                    return Response({
                        'error': 'Session is already closed',
                        'detail': 'This session has already been closed. Please refresh to see current status.'
                    }, status=status.HTTP_400_BAD_REQUEST)

                # Check for pending orders
                if session.status == 'open':
                    # Check for pending orders at this location
                    pending_orders = POSOrder.objects.filter(
                        location=session.location,
                        status='pending_payment'
                    )

                    pending_count = pending_orders.count()
                    if pending_count > 0:
                        # Get display codes for the pending orders (last 3 digits of order_number)
                        order_codes = [order.order_number[-3:] if order.order_number else str(order.id) for order in pending_orders[:5]]  # Show first 5

                        return Response({
                            'error': 'Cannot close session with pending orders',
                            'detail': f'There are {pending_count} pending order(s) that must be completed or voided before closing the session.',
                            'pending_orders': order_codes,
                            'pending_count': pending_count
                        }, status=status.HTTP_400_BAD_REQUEST)

            # Continue with normal update
            return super().partial_update(request, *args, **kwargs)

        except Exception as e:
            import traceback
            print(f"[ERROR] partial_update failed: {str(e)}")
            print(traceback.format_exc())
            return Response({
                'error': 'Failed to update session',
                'detail': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def create(self, request, *args, **kwargs):
        """Create or get open session"""
        location_id = request.data.get('location_id')
        opening_balance = request.data.get('opening_balance')

        if not location_id:
            return Response(
                {'error': 'location_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if opening_balance is None:
            return Response(
                {'error': 'opening_balance is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        location = get_object_or_404(POSLocation, id=location_id)

        try:
            session = get_or_create_open_session(
                user=request.user,
                location=location,
                opening_balance=opening_balance
            )
            serializer = self.get_serializer(session)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class POSOrderViewSet(viewsets.ModelViewSet):
    """
    ViewSet for POS orders (designer/accounting workflow).

    list: Get all orders (filter by status, created_by)
    create: Create new order (designers only)
    retrieve: Get order detail
    update/partial_update: Update order items (designers, own orders only)
    void_order: Void an order (designers, own orders only)
    complete_payment: Accept payment and complete order (accounting only)
    pending_orders: Get pending payment orders (accounting)
    by_order_number: Get order by 6-digit number (accounting)
    """

    queryset = POSOrder.objects.all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list':
            return POSOrderListSerializer
        elif self.action in ['create']:
            return POSOrderCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return POSOrderUpdateSerializer
        elif self.action == 'void_order':
            return POSOrderVoidSerializer
        elif self.action == 'complete_payment':
            return POSOrderCompletePaymentSerializer
        return POSOrderDetailSerializer

    def get_permissions(self):
        """Set permissions based on action"""
        if self.action == 'create':
            permission_classes = [IsAuthenticated, IsPOSStaff]
        elif self.action in ['void_order']:
            permission_classes = [IsAuthenticated, IsAccounting]
        elif self.action in ['complete_payment', 'pending_orders', 'by_order_number']:
            permission_classes = [IsAuthenticated, IsAccounting]
        else:
            permission_classes = [IsAuthenticated]

        return [permission() for permission in permission_classes]

    def get_queryset(self):
        """Filter queryset based on query parameters"""
        queryset = super().get_queryset()

        # Filter by status
        status_param = self.request.query_params.get('status', None)
        if status_param:
            queryset = queryset.filter(status=status_param)

        # Filter by created_by (for designers to see their own orders)
        created_by_me = self.request.query_params.get('created_by_me', None)
        if created_by_me == 'true':
            queryset = queryset.filter(created_by=self.request.user)

        return queryset.select_related('customer', 'location', 'created_by', 'completed_by')

    def create(self, request, *args, **kwargs):
        """Create new POS order"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Get location and customer
        location = get_object_or_404(POSLocation, id=serializer.validated_data['location_id'])
        customer = None
        if serializer.validated_data.get('customer_id'):
            customer = get_object_or_404(Customer, id=serializer.validated_data['customer_id'])

        # Create order using service function
        order = create_pos_order(
            user=request.user,
            location=location,
            items_data=serializer.validated_data['items'],
            customer=customer,
            notes=serializer.validated_data.get('notes')
        )

        # Return detailed order
        output_serializer = POSOrderDetailSerializer(order)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        """Update existing POS order"""
        order = self.get_object()

        # Check ownership - Allow creators, superusers, admins, accounting, and cashiers to update
        if request.user != order.created_by and not request.user.is_superuser and request.user.role not in ['admin', 'accounting', 'cashier']:
            return Response(
                {'error': 'You can only edit your own orders'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Update order using service function
        try:
            updated_order = update_pos_order(
                order=order,
                items_data=serializer.validated_data['items'],
                user=request.user
            )

            output_serializer = POSOrderDetailSerializer(updated_order)
            return Response(output_serializer.data)

        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def void_order(self, request, pk=None):
        """Void a POS order"""
        order = self.get_object()

        # Accounting/cashier can void any pending order
        # Permission already verified by IsAccounting class
        if request.user.role not in ['accounting', 'cashier', 'admin']:
            return Response(
                {'error': 'Only accounting/cashier can void orders'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = POSOrderVoidSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            voided_order = void_pos_order(
                order=order,
                void_reason=serializer.validated_data['void_reason'],
                user=request.user
            )

            output_serializer = POSOrderDetailSerializer(voided_order)
            return Response(output_serializer.data)

        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsAccounting])
    def complete_payment(self, request, pk=None):
        """Complete payment for a POS order"""
        order = self.get_object()

        serializer = POSOrderCompletePaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Get print receipt preference (default to False)
        print_receipt = request.data.get('print_receipt', False)

        # Get cash drawer session
        cash_drawer_session = get_object_or_404(
            CashDrawerSession,
            id=serializer.validated_data['cash_drawer_session_id']
        )

        try:
            transaction = complete_pos_order(
                order=order,
                payment_data=serializer.validated_data['payments'],
                cash_drawer_session=cash_drawer_session,
                user=request.user
            )

            # Handle receipt printing based on user selection
            if print_receipt:
                # "Save & Print" - Print receipt AND open drawer
                from .tasks import print_pos_receipt_task
                print_pos_receipt_task.delay(
                    transaction_id=transaction.id,
                    user_id=request.user.id,
                    open_drawer=True
                )
            else:
                # "Save" only - Just open drawer (no receipt)
                from .tasks import open_cash_drawer_task
                open_cash_drawer_task.delay(user_id=request.user.id)

            output_serializer = POSTransactionSerializer(transaction)
            return Response(output_serializer.data)

        except (ValueError, Exception) as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated, IsAccounting])
    def pending_orders(self, request):
        """Get all pending payment orders"""
        orders = POSOrder.objects.filter(status='pending_payment').select_related(
            'customer', 'location', 'created_by'
        ).prefetch_related('items').order_by('-created_at')

        serializer = POSOrderListSerializer(orders, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated, IsAccounting])
    def by_order_number(self, request):
        """Get order by order number or 3-digit display code"""
        order_number = request.query_params.get('order_number', None)

        if not order_number:
            return Response(
                {'error': 'order_number query parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Handle 3-digit display code by prepending today's prefix
        if len(order_number) == 3:
            today_prefix = timezone.now().strftime('%y%m%d')
            full_order_number = f"{today_prefix}{order_number}"
        else:
            full_order_number = order_number

        order = get_object_or_404(POSOrder, order_number=full_order_number)
        serializer = POSOrderDetailSerializer(order)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated, IsAccounting])
    def monthly_sales_report(self, request):
        """
        Get monthly sales report for chart visualization.
        Accepts start_date, end_date, and compare parameters.
        """
        from datetime import datetime
        try:
            # Get query parameters
            start_date = request.query_params.get('start_date')
            end_date = request.query_params.get('end_date')
            compare = request.query_params.get('compare', 'false').lower() == 'true'

            # Validate required parameters
            if not start_date or not end_date:
                return Response(
                    {'error': 'start_date and end_date are required parameters'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Parse dates
            try:
                start_datetime = datetime.strptime(start_date, '%Y-%m-%d')
                end_datetime = datetime.strptime(end_date, '%Y-%m-%d')
            except ValueError as e:
                return Response(
                    {'error': f'Invalid date format. Use YYYY-MM-DD. Error: {str(e)}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Get current year data
            current_data = self._get_monthly_sales(start_datetime, end_datetime)

            response_data = {
                'labels': current_data['labels'],
                'current': current_data['counts']
            }

            # Add previous year data if compare is True
            if compare:
                # Calculate previous year date range
                prev_start = start_datetime.replace(year=start_datetime.year - 1)
                prev_end = end_datetime.replace(year=end_datetime.year - 1)

                previous_data = self._get_monthly_sales(prev_start, prev_end)
                response_data['previous'] = previous_data['counts']

            return Response(response_data)

        except Exception as e:
            import traceback
            print(f"[ERROR] monthly_sales_report failed: {str(e)}")
            print(traceback.format_exc())
            return Response(
                {'error': 'Internal server error occurred'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def _get_monthly_sales(self, start_date, end_date):
        """
        Helper method to get monthly sales totals for a given date range.
        Returns labels (month names) and total sales amounts.
        """
        from django.db.models.functions import TruncMonth
        from django.db.models import Sum

        # Query POSTransaction records grouped by month
        # Using POSTransaction for completed sales
        monthly_sales = (
            POSTransaction.objects
            .filter(
                transaction_date__date__gte=start_date.date(),
                transaction_date__date__lte=end_date.date(),
                status='completed'
            )
            .annotate(month=TruncMonth('transaction_date'))
            .values('month')
            .annotate(total_sales=Sum('total'))
            .order_by('month')
        )

        # Create a complete list of months in the range
        labels = []
        sales = []

        current_date = start_date.replace(day=1)  # Start from first day of month
        end_month = end_date.replace(day=1)

        while current_date <= end_month:
            month_key = current_date.strftime('%Y-%m-01')
            month_name = current_date.strftime('%b')  # Jan, Feb, etc.

            labels.append(month_name)

            # Find total for this month
            month_total = next(
                (item['total_sales'] for item in monthly_sales if item['month'].strftime('%Y-%m-01') == month_key),
                0
            )
            sales.append(float(month_total))

            # Move to next month
            if current_date.month == 12:
                current_date = current_date.replace(year=current_date.year + 1, month=1)
            else:
                current_date = current_date.replace(month=current_date.month + 1)

        return {
            'labels': labels,
            'counts': sales
        }


class POSQuickServiceItemViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for quick access items.
    Returns POS products marked as quick access.
    """

    serializer_class = POSProductQuickAccessSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Get quick access items (POS products with is_quick_access=True)"""
        return POSProduct.objects.filter(
            is_quick_access=True,
            is_active=True
        ).select_related('category').order_by('-sales_count', 'name')

    def list(self, request, *args, **kwargs):
        """Return quick access items with optional search filter and limit"""
        queryset = self.get_queryset()

        # Apply search filter if provided
        search = request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(sku__icontains=search) |
                Q(name__icontains=search)
            )

        # Apply limit if provided
        limit = request.query_params.get('limit', None)
        if limit:
            try:
                queryset = queryset[:int(limit)]
            except (ValueError, TypeError):
                pass  # Ignore invalid limit values

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class POSProductViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing POS products.
    Provides CRUD operations for products.
    """

    queryset = POSProduct.objects.all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        """Use list serializer for list view, full serializer otherwise"""
        if self.action == 'list':
            return POSProductListSerializer
        return POSProductSerializer

    def get_queryset(self):
        """Filter queryset based on query parameters"""
        queryset = super().get_queryset()

        # Filter by category
        category_id = self.request.query_params.get('category_id', None)
        if category_id:
            queryset = queryset.filter(category_id=category_id)

        # Filter active only (default: true)
        active_only = self.request.query_params.get('active_only', 'true')
        if active_only == 'true':
            queryset = queryset.filter(is_active=True)

        # Filter quick access only
        quick_access_only = self.request.query_params.get('quick_access_only', None)
        if quick_access_only == 'true':
            queryset = queryset.filter(is_quick_access=True)

        # Search by name or SKU
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) |
                Q(sku__icontains=search)
            )

        # Sort by parameter
        sort_by = self.request.query_params.get('sort_by', 'name')
        if sort_by == 'sales_count':
            queryset = queryset.order_by('-sales_count', 'name')
        else:
            queryset = queryset.order_by('name')

        # Apply limit if provided
        limit = self.request.query_params.get('limit', None)
        if limit:
            try:
                queryset = queryset[:int(limit)]
            except (ValueError, TypeError):
                pass  # Ignore invalid limit values

        return queryset.select_related('category', 'created_by')

    def perform_create(self, serializer):
        """Set created_by on product creation"""
        serializer.save(created_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        """
        Soft delete a POS product, but only if it has no sales history.
        Blocks deletion if product appears in any orders or transactions.
        """
        from apps.pos.models import POSOrderItem, POSTransactionItem

        product = self.get_object()

        # Check if product has been sold (appears in any orders)
        # Use explicit queries instead of reverse relations to ensure they work
        order_count = POSOrderItem.objects.filter(product=product).count()

        # Check if product has transaction history
        transaction_count = POSTransactionItem.objects.filter(product=product).count()

        # Calculate total sales instances
        total_sales = order_count + transaction_count

        if total_sales > 0:
            return Response(
                {
                    'error': f'Cannot delete product "{product.name}" because it has been sold {total_sales} time(s). Products with sales history cannot be deleted to preserve transaction integrity.',
                    'details': {
                        'orders': order_count,
                        'transactions': transaction_count,
                        'total_sales': total_sales
                    }
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Perform soft delete - DO NOT call super().destroy() or product.delete()
        product.is_active = False
        product.save(update_fields=['is_active', 'updated_at'])

        return Response(
            {
                'message': f'Product "{product.name}" has been deactivated successfully.'
            },
            status=status.HTTP_200_OK
        )


class POSCategoryViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing POS categories.
    Provides CRUD operations for categories.
    """

    queryset = POSCategory.objects.all()
    serializer_class = POSCategorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter queryset based on query parameters"""
        queryset = super().get_queryset()

        # Filter active only (default: true)
        active_only = self.request.query_params.get('active_only', 'true')
        if active_only == 'true':
            queryset = queryset.filter(is_active=True)

        return queryset.order_by('display_order', 'name')

    def destroy(self, request, *args, **kwargs):
        """
        Soft delete a POS category, but only if it has no products.
        Blocks deletion if products are assigned to this category.
        """
        category = self.get_object()

        # Check if category has any products
        product_count = category.products.filter(is_active=True).count()

        if product_count > 0:
            return Response(
                {
                    'error': f'Cannot delete category "{category.name}" because it has {product_count} product(s) assigned to it. Please reassign or remove the products first.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Perform soft delete
        category.is_active = False
        category.save()

        return Response(
            {'message': f'Category "{category.name}" deleted successfully.'},
            status=status.HTTP_200_OK
        )


class POSLocationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing POS locations.
    Provides CRUD operations for locations.
    """

    queryset = POSLocation.objects.all()
    serializer_class = POSLocationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter queryset based on query parameters"""
        queryset = super().get_queryset()

        # Filter active only (default: true)
        active_only = self.request.query_params.get('active_only', 'true')
        if active_only == 'true':
            queryset = queryset.filter(is_active=True)

        return queryset.order_by('name')
