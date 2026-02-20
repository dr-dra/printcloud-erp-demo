from decimal import Decimal

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q, OuterRef, Subquery
from django.db.models import Sum, F, Value, DecimalField, Max, ExpressionWrapper
from django.db.models.functions import Coalesce
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

from apps.purchases.models import PurchaseOrderItem, PurchaseOrder

from .models import (
    InvCategory,
    InvUnitMeasure,
    InvItem,
    PriceHistory,
    InvGoodsReceivedNote,
    InvGRNItem,
    InvMRN,
    InvMRNItem,
    InvStockAllocation,
    InvPRN,
    InvPRNItem,
    InvPRNItemPOLink,
    InvGoodsIssueNote,
    InvGINItem,
    InvUsageReport,
    InvUsageItem,
    InvStockAdjustment,
    InvStockAdjustmentItem,
    InvStockMovement,
    InvDispatchNote,
    InvDispatchItem,
    InvWastageCategory,
    InvStockBatch,
)
from .serializers import (
    InvCategorySerializer,
    InvUnitMeasureSerializer,
    InvItemSerializer,
    PriceHistorySerializer,
    PriceHistoryCreateSerializer,
    InvGoodsReceivedNoteSerializer,
    InvGRNItemSerializer,
    InvMRNSerializer,
    InvMRNItemSerializer,
    InvStockAllocationSerializer,
    InvPRNSerializer,
    InvPRNItemSerializer,
    InvPRNItemPOLinkSerializer,
    InvStockPositionSerializer,
    InvGoodsIssueNoteSerializer,
    InvGINItemSerializer,
    InvUsageReportSerializer,
    InvUsageItemSerializer,
    InvStockAdjustmentSerializer,
    InvStockAdjustmentItemSerializer,
    InvStockMovementSerializer,
    InvDispatchNoteSerializer,
    InvDispatchItemSerializer,
    InvWastageCategorySerializer,
)
from .services import accept_grn, allocate_mrn, issue_gin, apply_stock_adjustment, apply_usage_returns
from .utils import (
    generate_grn_number,
    generate_mrn_number,
    generate_prn_number,
    generate_gin_number,
    generate_adjustment_number,
    generate_usage_number,
    generate_dispatch_number,
)


class InvCategoryViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = InvCategorySerializer
    queryset = InvCategory.objects.all().order_by('name')

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(Q(name__icontains=search) | Q(code__icontains=search))
        return queryset


class InvUnitMeasureViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = InvUnitMeasureSerializer
    queryset = InvUnitMeasure.objects.all().order_by('name')

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(Q(name__icontains=search) | Q(code__icontains=search))
        return queryset


class InvItemViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = InvItemSerializer
    queryset = InvItem.objects.select_related('category', 'stock_uom', 'purchase_uom', 'preferred_supplier')

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) |
                Q(sku__icontains=search)
            )
        category_id = self.request.query_params.get('category')
        if category_id:
            queryset = queryset.filter(category_id=category_id)
        active = self.request.query_params.get('is_active')
        if active == 'true':
            queryset = queryset.filter(is_active=True)
        elif active == 'false':
            queryset = queryset.filter(is_active=False)
        return queryset


class PriceHistoryViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = PriceHistorySerializer
    queryset = PriceHistory.objects.select_related('item', 'supplier', 'created_by')

    def get_serializer_class(self):
        if self.action == 'create':
            return PriceHistoryCreateSerializer
        return PriceHistorySerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        item_id = self.request.query_params.get('item_id')
        supplier_id = self.request.query_params.get('supplier_id')
        source_type = self.request.query_params.get('source_type')
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')

        if item_id:
            queryset = queryset.filter(item_id=item_id)
        if supplier_id:
            queryset = queryset.filter(supplier_id=supplier_id)
        if source_type:
            queryset = queryset.filter(source_type=source_type)
        if date_from:
            queryset = queryset.filter(effective_date__gte=date_from)
        if date_to:
            queryset = queryset.filter(effective_date__lte=date_to)

        return queryset.order_by('-effective_date', '-created_at')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'], url_path='current')
    def current_prices(self, request):
        item_id = request.query_params.get('item_id')
        supplier_id = request.query_params.get('supplier_id')

        if item_id and supplier_id:
            latest = PriceHistory.objects.get_current_price(item_id, supplier_id)
            if not latest:
                return Response(
                    {'item_id': int(item_id), 'supplier_id': int(supplier_id), 'unit_price': None},
                    status=status.HTTP_200_OK,
                )
            serializer = PriceHistorySerializer(latest)
            return Response(serializer.data)

        if item_id:
            queryset = PriceHistory.objects.get_current_prices_for_item(item_id)
        elif supplier_id:
            latest = (
                PriceHistory.objects.filter(supplier_id=supplier_id, item_id=OuterRef('item_id'))
                .order_by('-effective_date', '-created_at')
            )
            queryset = (
                PriceHistory.objects.filter(supplier_id=supplier_id, id__in=Subquery(latest.values('id')[:1]))
                .select_related('item', 'supplier')
                .order_by('unit_price')
            )
        else:
            latest = (
                PriceHistory.objects.filter(
                    item_id=OuterRef('item_id'),
                    supplier_id=OuterRef('supplier_id')
                ).order_by('-effective_date', '-created_at')
            )
            queryset = (
                PriceHistory.objects.filter(id__in=Subquery(latest.values('id')[:1]))
                .select_related('item', 'supplier')
                .order_by('item_id', 'supplier_id')
            )

        serializer = PriceHistorySerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path=r'item/(?P<item_id>\d+)')
    def item_history(self, request, item_id=None):
        supplier_id = request.query_params.get('supplier_id')
        queryset = PriceHistory.objects.filter(item_id=item_id).select_related('supplier', 'item')
        if supplier_id:
            queryset = queryset.filter(supplier_id=supplier_id)
        serializer = PriceHistorySerializer(queryset.order_by('-effective_date', '-created_at'), many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path=r'item/(?P<item_id>\d+)/compare')
    def item_compare(self, request, item_id=None):
        item = InvItem.objects.select_related('stock_uom').filter(id=item_id).first()
        if not item:
            return Response({'error': 'Item not found'}, status=status.HTTP_404_NOT_FOUND)

        prices = PriceHistory.objects.get_supplier_comparison(item_id)
        if prices:
            all_prices = [entry['unit_price'] for entry in prices]
            lowest = min(all_prices)
            highest = max(all_prices)
            avg_price = sum(all_prices) / len(all_prices)
            range_percent = (
                ((highest - lowest) / avg_price) * Decimal('100')
                if avg_price
                else Decimal('0')
            )
        else:
            lowest = highest = avg_price = range_percent = None

        response = {
            'item_id': item.id,
            'item_sku': item.sku,
            'item_name': item.name,
            'stock_uom': item.stock_uom.code if item.stock_uom else None,
            'prices': [
                {
                    'supplier_id': entry['supplier_id'],
                    'supplier_name': entry['supplier__name'],
                    'unit_price': entry['unit_price'],
                    'effective_date': entry['effective_date'],
                    'source_type': entry['source_type'],
                    'price_rank': entry['price_rank'],
                    'is_lowest': entry['is_lowest'],
                    'diff_from_avg': entry['diff_from_avg'],
                }
                for entry in prices
            ],
            'summary': {
                'lowest_price': lowest,
                'highest_price': highest,
                'average_price': avg_price,
                'price_range_percent': range_percent,
            },
        }
        return Response(response)

    @action(detail=False, methods=['get'], url_path=r'item/(?P<item_id>\d+)/trend')
    def item_trend(self, request, item_id=None):
        supplier_id = request.query_params.get('supplier_id')
        period = request.query_params.get('period', 'monthly')
        try:
            months = int(request.query_params.get('months', 12))
        except (TypeError, ValueError):
            months = 12

        trend_qs = PriceHistory.objects.get_price_trend(
            item_id=item_id,
            supplier_id=supplier_id,
            months=months,
            period=period,
        )

        trend = []
        for entry in trend_qs:
            period_value = entry['period']
            if period_value is not None:
                period_label = period_value.strftime('%Y-%m-%d')
                if period == 'monthly':
                    period_label = period_value.strftime('%Y-%m')
                elif period == 'weekly':
                    period_label = period_value.strftime('%Y-%m-%d')
            else:
                period_label = None
            trend.append({
                'period': period_label,
                'avg_price': entry['avg_price'],
                'min_price': entry['min_price'],
                'max_price': entry['max_price'],
                'count': entry['count'],
            })

        avg_prices = [entry['avg_price'] for entry in trend if entry['avg_price'] is not None]
        overall_avg = sum(avg_prices) / len(avg_prices) if avg_prices else None

        trend_direction = 'flat'
        percent_change = None
        if len(avg_prices) >= 2:
            first = avg_prices[0]
            last = avg_prices[-1]
            if first:
                percent_change = ((last - first) / first) * Decimal('100')
                if percent_change > 0:
                    trend_direction = 'increasing'
                elif percent_change < 0:
                    trend_direction = 'decreasing'

        return Response({
            'item_id': int(item_id),
            'supplier_id': int(supplier_id) if supplier_id else None,
            'period': period,
            'trend': trend,
            'summary': {
                'overall_avg': overall_avg,
                'trend_direction': trend_direction,
                'percent_change': percent_change,
            },
        })

    @action(detail=False, methods=['get'], url_path=r'supplier/(?P<supplier_id>\d+)')
    def supplier_history(self, request, supplier_id=None):
        item_id = request.query_params.get('item_id')
        queryset = PriceHistory.objects.filter(supplier_id=supplier_id).select_related('supplier', 'item')
        if item_id:
            queryset = queryset.filter(item_id=item_id)
        serializer = PriceHistorySerializer(queryset.order_by('-effective_date', '-created_at'), many=True)
        return Response(serializer.data)


@method_decorator(csrf_exempt, name='dispatch')
class InvGoodsReceivedNoteViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = InvGoodsReceivedNoteSerializer
    queryset = InvGoodsReceivedNote.objects.select_related('purchase_order', 'supplier')

    def get_queryset(self):
        queryset = super().get_queryset()
        status = self.request.query_params.get('status')
        if status:
            queryset = queryset.filter(status=status)
        purchase_order_id = self.request.query_params.get('purchase_order')
        if purchase_order_id:
            queryset = queryset.filter(purchase_order_id=purchase_order_id)
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(grn_number__icontains=search) |
                Q(purchase_order__po_number__icontains=search) |
                Q(supplier__name__icontains=search)
            )
        return queryset

    def perform_create(self, serializer):
        purchase_order = serializer.validated_data.get('purchase_order')
        supplier = serializer.validated_data.get('supplier') or purchase_order.supplier
        grn_number = serializer.validated_data.get('grn_number') or generate_grn_number()
        serializer.save(received_by=self.request.user, supplier=supplier, grn_number=grn_number)

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        grn = self.get_object()
        try:
            accept_grn(grn, request.user)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'message': f'GRN {grn.grn_number} accepted'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def inspect(self, request, pk=None):
        grn = self.get_object()
        if grn.status not in ['received', 'draft']:
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
        grn.save(update_fields=['status', 'inspection_date', 'inspected_by', 'quality_passed', 'inspection_notes'])
        return Response({'message': f'GRN {grn.grn_number} inspected'}, status=status.HTTP_200_OK)


class InvGRNItemViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = InvGRNItemSerializer
    queryset = InvGRNItem.objects.select_related('grn', 'item', 'purchase_order_item')

    def get_queryset(self):
        queryset = super().get_queryset()
        grn_id = self.request.query_params.get('grn')
        if grn_id:
            queryset = queryset.filter(grn_id=grn_id)
        return queryset


class InvMRNViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = InvMRNSerializer
    queryset = InvMRN.objects.all().order_by('-request_date', '-mrn_number')

    def perform_create(self, serializer):
        mrn_number = serializer.validated_data.get('mrn_number') or generate_mrn_number()
        serializer.save(created_by=self.request.user, mrn_number=mrn_number)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        mrn = self.get_object()
        allocate_mrn(mrn, request.user)
        return Response({'message': f'MRN {mrn.mrn_number} approved'}, status=status.HTTP_200_OK)


class InvMRNItemViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = InvMRNItemSerializer
    queryset = InvMRNItem.objects.select_related('mrn', 'item')

    def get_queryset(self):
        queryset = super().get_queryset()
        mrn_id = self.request.query_params.get('mrn')
        if mrn_id:
            queryset = queryset.filter(mrn_id=mrn_id)
        return queryset


class InvStockAllocationViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = InvStockAllocationSerializer
    queryset = InvStockAllocation.objects.select_related('mrn_item', 'item')

    def get_queryset(self):
        queryset = super().get_queryset()
        mrn_id = self.request.query_params.get('mrn')
        if mrn_id:
            queryset = queryset.filter(mrn_item__mrn_id=mrn_id)
        return queryset


class InvPRNViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = InvPRNSerializer
    queryset = InvPRN.objects.all().order_by('-request_date', '-prn_number')

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get('search')
        status_param = self.request.query_params.get('status')
        if search:
            queryset = queryset.filter(
                Q(prn_number__icontains=search) |
                Q(notes__icontains=search)
            )
        if status_param:
            queryset = queryset.filter(status=status_param)
        return queryset

    def perform_create(self, serializer):
        prn_number = serializer.validated_data.get('prn_number') or generate_prn_number()
        serializer.save(prn_number=prn_number, requested_by=self.request.user)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        prn = self.get_object()
        if prn.status != 'draft':
            return Response(
                {'error': f"Cannot approve PRN with status '{prn.status}'"},
                status=status.HTTP_400_BAD_REQUEST
            )

        prn.status = 'approved'
        prn.approved_by = request.user
        prn.approved_at = timezone.now()
        prn.save(update_fields=['status', 'approved_by', 'approved_at', 'updated_at'])

        prn.items.filter(status='draft').update(status='approved')

        return Response({'message': f'PRN {prn.prn_number} approved'}, status=status.HTTP_200_OK)


class InvPRNItemViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = InvPRNItemSerializer
    queryset = InvPRNItem.objects.select_related('prn', 'item')

    def get_queryset(self):
        queryset = super().get_queryset()
        prn_id = self.request.query_params.get('prn')
        if prn_id:
            queryset = queryset.filter(prn_id=prn_id)
        return queryset

    @action(detail=False, methods=['get'], url_path='available')
    def available(self, request):
        queryset = self.get_queryset().filter(
            prn__status__in=['approved', 'partially_ordered'],
            status__in=['approved', 'partially_ordered']
        )
        queryset = queryset.annotate(
            remaining_to_order=Coalesce(F('required_qty') - F('ordered_qty'), Value(0))
        ).filter(remaining_to_order__gt=0)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='add-to-po')
    def add_to_po(self, request, pk=None):
        prn_item = self.get_object()
        purchase_order_id = request.data.get('purchase_order')
        quantity = request.data.get('quantity')

        if not purchase_order_id or not quantity:
            return Response({'error': 'purchase_order and quantity are required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            quantity = Decimal(str(quantity))
        except Exception:
            return Response({'error': 'Invalid quantity'}, status=status.HTTP_400_BAD_REQUEST)

        if quantity <= 0:
            return Response({'error': 'Quantity must be greater than zero'}, status=status.HTTP_400_BAD_REQUEST)

        remaining = prn_item.required_qty - prn_item.ordered_qty
        if quantity > remaining:
            return Response({'error': 'Quantity exceeds remaining to order'}, status=status.HTTP_400_BAD_REQUEST)

        purchase_order = PurchaseOrder.objects.filter(id=purchase_order_id).first()
        if not purchase_order:
            return Response({'error': 'Purchase order not found'}, status=status.HTTP_404_NOT_FOUND)

        if purchase_order.status not in ['draft', 'sent']:
            return Response({'error': 'Only draft or sent POs can be updated'}, status=status.HTTP_400_BAD_REQUEST)

        max_line = purchase_order.items.aggregate(max_line=Coalesce(Max('line_number'), Value(0)))
        next_line = int(max_line['max_line'] or 0) + 1

        item = prn_item.item
        unit_of_measure = item.purchase_uom.code if item.purchase_uom else item.stock_uom.code if item.stock_uom else 'units'

        po_item = PurchaseOrderItem.objects.create(
            purchase_order=purchase_order,
            line_number=next_line,
            item=item,
            item_name=item.name,
            description='',
            quantity=quantity,
            unit_of_measure=unit_of_measure,
            unit_price=0,
            tax_rate=0,
            amount=0,
        )

        InvPRNItemPOLink.objects.create(
            prn_item=prn_item,
            purchase_order_item=po_item,
            ordered_qty=quantity
        )

        prn_item.ordered_qty = prn_item.ordered_qty + quantity
        if prn_item.ordered_qty >= prn_item.required_qty:
            prn_item.status = 'ordered'
        elif prn_item.ordered_qty > 0:
            prn_item.status = 'partially_ordered'
        prn_item.save(update_fields=['ordered_qty', 'status'])

        prn = prn_item.prn
        if prn.items.filter(status__in=['draft', 'approved', 'partially_ordered']).exists():
            prn.status = 'partially_ordered'
        else:
            prn.status = 'ordered'
        prn.save(update_fields=['status', 'updated_at'])

        purchase_order.calculate_totals()

        link_serializer = InvPRNItemPOLinkSerializer(InvPRNItemPOLink.objects.get(purchase_order_item=po_item))
        return Response(link_serializer.data, status=status.HTTP_201_CREATED)


class InvStockPositionViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        search = request.query_params.get('search')
        category_id = request.query_params.get('category')
        low_stock = request.query_params.get('low_stock')

        items = InvItem.objects.select_related('category', 'stock_uom')

        if search:
            items = items.filter(Q(sku__icontains=search) | Q(name__icontains=search))
        if category_id:
            items = items.filter(category_id=category_id)

        decimal_zero = Value(0, output_field=DecimalField(max_digits=14, decimal_places=2))

        on_hand_subquery = (
            InvStockBatch.objects.filter(item=OuterRef('pk'), is_active=True)
            .values('item')
            .annotate(total=Coalesce(Sum('quantity_remaining'), decimal_zero))
            .values('total')[:1]
        )

        open_po_statuses = ['draft', 'sent', 'confirmed', 'partially_received']
        on_order_subquery = (
            PurchaseOrderItem.objects.filter(
                item=OuterRef('pk'),
                purchase_order__status__in=open_po_statuses
            )
            .values('item')
            .annotate(
                outstanding=Coalesce(
                    Sum(
                        ExpressionWrapper(
                            F('quantity') - F('quantity_received'),
                            output_field=DecimalField(max_digits=14, decimal_places=2)
                        )
                    ),
                    decimal_zero
                )
            )
            .values('outstanding')[:1]
        )

        items = items.annotate(
            on_hand=Coalesce(
                Subquery(on_hand_subquery, output_field=DecimalField(max_digits=14, decimal_places=2)),
                decimal_zero
            ),
            on_order=Coalesce(
                Subquery(on_order_subquery, output_field=DecimalField(max_digits=14, decimal_places=2)),
                decimal_zero
            ),
        ).annotate(
            allocated=decimal_zero,
            available=ExpressionWrapper(
                F('on_hand') - decimal_zero,
                output_field=DecimalField(max_digits=14, decimal_places=2)
            ),
        )

        if low_stock == 'true':
            items = items.filter(available__lte=F('reorder_level'))

        data = [
            {
                'item_id': item.id,
                'item_sku': item.sku,
                'item_name': item.name,
                'category_name': item.category.name if item.category else '',
                'stock_uom_code': item.stock_uom.code if item.stock_uom else None,
                'location': 'Main',
                'on_hand': item.on_hand,
                'allocated': item.allocated,
                'available': item.available,
                'on_order': item.on_order,
                'reorder_level': item.reorder_level,
                'status': 'LOW' if item.available <= item.reorder_level else 'OK',
            }
            for item in items
        ]

        serializer = InvStockPositionSerializer(data, many=True)
        return Response(serializer.data)


class InvGoodsIssueNoteViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = InvGoodsIssueNoteSerializer
    queryset = InvGoodsIssueNote.objects.all().order_by('-issue_date', '-gin_number')

    def perform_create(self, serializer):
        gin_number = serializer.validated_data.get('gin_number') or generate_gin_number()
        serializer.save(gin_number=gin_number)

    @action(detail=True, methods=['post'])
    def issue(self, request, pk=None):
        gin = self.get_object()
        try:
            issue_gin(gin, request.user)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'message': f'GIN {gin.gin_number} issued'}, status=status.HTTP_200_OK)


class InvGINItemViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = InvGINItemSerializer
    queryset = InvGINItem.objects.select_related('gin', 'item')

    def get_queryset(self):
        queryset = super().get_queryset()
        gin_id = self.request.query_params.get('gin')
        if gin_id:
            queryset = queryset.filter(gin_id=gin_id)
        return queryset


class InvUsageReportViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = InvUsageReportSerializer
    queryset = InvUsageReport.objects.all().order_by('-report_date', '-report_number')

    def perform_create(self, serializer):
        report_number = serializer.validated_data.get('report_number') or generate_usage_number()
        serializer.save(created_by=self.request.user, report_number=report_number)

    @action(detail=True, methods=['post'])
    def apply_returns(self, request, pk=None):
        report = self.get_object()
        apply_usage_returns(report, request.user)
        return Response({'message': f'Usage report {report.report_number} returns applied'}, status=status.HTTP_200_OK)


class InvUsageItemViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = InvUsageItemSerializer
    queryset = InvUsageItem.objects.select_related('usage_report', 'item', 'wastage_category')

    def get_queryset(self):
        queryset = super().get_queryset()
        report_id = self.request.query_params.get('usage_report')
        if report_id:
            queryset = queryset.filter(usage_report_id=report_id)
        return queryset


class InvStockAdjustmentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = InvStockAdjustmentSerializer
    queryset = InvStockAdjustment.objects.all().order_by('-adjustment_date', '-adjustment_number')

    def perform_create(self, serializer):
        adjustment_number = serializer.validated_data.get('adjustment_number') or generate_adjustment_number()
        serializer.save(requested_by=self.request.user, adjustment_number=adjustment_number)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        adjustment = self.get_object()
        try:
            apply_stock_adjustment(adjustment, request.user)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'message': f'Adjustment {adjustment.adjustment_number} approved'}, status=status.HTTP_200_OK)


class InvStockAdjustmentItemViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = InvStockAdjustmentItemSerializer
    queryset = InvStockAdjustmentItem.objects.select_related('adjustment', 'item')

    def get_queryset(self):
        queryset = super().get_queryset()
        adjustment_id = self.request.query_params.get('adjustment')
        if adjustment_id:
            queryset = queryset.filter(adjustment_id=adjustment_id)
        return queryset


class InvStockMovementViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = InvStockMovementSerializer
    queryset = InvStockMovement.objects.select_related('item', 'created_by').order_by('-created_at')

    def get_queryset(self):
        queryset = super().get_queryset()
        item_id = self.request.query_params.get('item')
        if item_id:
            queryset = queryset.filter(item_id=item_id)
        movement_type = self.request.query_params.get('movement_type')
        if movement_type:
            queryset = queryset.filter(movement_type=movement_type)
        date_from = self.request.query_params.get('date_from')
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)
        date_to = self.request.query_params.get('date_to')
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(item__sku__icontains=search) |
                Q(item__name__icontains=search) |
                Q(reference_type__icontains=search)
            )
        return queryset


class InvDispatchNoteViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = InvDispatchNoteSerializer
    queryset = InvDispatchNote.objects.all().order_by('-dispatch_date', '-dispatch_number')

    def perform_create(self, serializer):
        dispatch_number = serializer.validated_data.get('dispatch_number') or generate_dispatch_number()
        serializer.save(created_by=self.request.user, dispatch_number=dispatch_number)


class InvDispatchItemViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = InvDispatchItemSerializer
    queryset = InvDispatchItem.objects.select_related('dispatch_note')

    def get_queryset(self):
        queryset = super().get_queryset()
        dispatch_id = self.request.query_params.get('dispatch_note')
        if dispatch_id:
            queryset = queryset.filter(dispatch_note_id=dispatch_id)
        return queryset


class InvWastageCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = InvWastageCategorySerializer
    queryset = InvWastageCategory.objects.filter(is_active=True).order_by('name')
