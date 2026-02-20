import calendar
import logging
from datetime import datetime, timedelta

from django.db.models import Count, Q
from django.db.models.functions import TruncMonth
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status
from rest_framework.generics import (
    CreateAPIView,
    ListAPIView,
    RetrieveUpdateDestroyAPIView,
)
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.employees.models import Employee

from .models import CostingEstimating, CostingSheet
from .serializers import (
    CostingActivitySerializer,
    CostingEstimatingDetailSerializer,
    CostingListSerializer,
    CostingSheetCreateSerializer,
)

logger = logging.getLogger(__name__)

class CostingPagination(PageNumberPagination):
    page_size = 50  # Default page size
    page_size_query_param = 'page_size'
    max_page_size = 100

class CostingListView(ListAPIView):
    queryset = CostingEstimating.objects.all()
    serializer_class = CostingListSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, DjangoFilterBackend, filters.OrderingFilter]
    search_fields = ["projectName", "customerName", "notes"]
    ordering_fields = ['id', 'createdDate', 'customerName', 'projectName', 'createdBy']
    ordering = ['-createdDate']  # Default ordering (newest first)
    pagination_class = CostingPagination

    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Get date filter parameters
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        logger.info(f'CostingListView.get_queryset called with params: start_date={start_date}, end_date={end_date}')
        
        # Apply date filtering
        if start_date:
            try:
                # Parse the date and filter by createdDate field
                start_datetime = datetime.strptime(start_date, '%Y-%m-%d')
                queryset = queryset.filter(createdDate__date__gte=start_datetime.date())
                logger.info(f'Applied start_date filter: {start_date}')
            except ValueError as e:
                logger.warning(f'Invalid start_date format: {start_date}, error: {e}')
        
        if end_date:
            try:
                # Parse the date and filter by createdDate field
                # Add one day to include the full end date
                end_datetime = datetime.strptime(end_date, '%Y-%m-%d')
                end_datetime = end_datetime + timedelta(days=1)
                queryset = queryset.filter(createdDate__lt=end_datetime)
                logger.info(f'Applied end_date filter: {end_date} (inclusive)')
            except ValueError as e:
                logger.warning(f'Invalid end_date format: {end_date}, error: {e}')
        
        return queryset

class CostingExportAllView(ListAPIView):
    queryset = CostingEstimating.objects.all()
    serializer_class = CostingListSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None  # Disable pagination

class CostingActivityView(APIView):
    """
    API endpoint to return monthly costing sheet counts for chart visualization.
    Accepts start_date, end_date, and compare parameters.
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        try:
            # Get query parameters
            start_date = request.query_params.get('start_date')
            end_date = request.query_params.get('end_date')
            compare = request.query_params.get('compare', 'false').lower() == 'true'
            
            logger.info(f'CostingActivityView called with params: start_date={start_date}, end_date={end_date}, compare={compare}')
            
            # Validate required parameters
            if not start_date or not end_date:
                return Response(
                    {'error': 'start_date and end_date are required parameters'}, 
                    status=400
                )
            
            # Parse dates
            try:
                start_datetime = datetime.strptime(start_date, '%Y-%m-%d')
                end_datetime = datetime.strptime(end_date, '%Y-%m-%d')
            except ValueError as e:
                return Response(
                    {'error': f'Invalid date format. Use YYYY-MM-DD. Error: {str(e)}'}, 
                    status=400
                )
            
            # Get current year data
            current_data = self._get_monthly_counts(start_datetime, end_datetime)
            
            response_data = {
                'labels': current_data['labels'],
                'current': current_data['counts']
            }
            
            # Add previous year data if compare is True
            if compare:
                # Calculate previous year date range
                prev_start = start_datetime.replace(year=start_datetime.year - 1)
                prev_end = end_datetime.replace(year=end_datetime.year - 1)
                
                previous_data = self._get_monthly_counts(prev_start, prev_end)
                response_data['previous'] = previous_data['counts']
            
            logger.info(f'CostingActivityView returning data: {response_data}')
            return Response(response_data)
            
        except Exception as e:
            logger.error(f'Error in CostingActivityView: {str(e)}')
            return Response(
                {'error': 'Internal server error occurred'}, 
                status=500
            )
    
    def _get_monthly_counts(self, start_date, end_date):
        """
        Helper method to get monthly counts for a given date range.
        Returns labels (month names) and counts.
        """
        # Query costing estimating records grouped by month
        monthly_counts = (
            CostingEstimating.objects
            .filter(createdDate__date__gte=start_date.date(), createdDate__date__lte=end_date.date())
            .annotate(month=TruncMonth('createdDate'))
            .values('month')
            .annotate(count=Count('id'))
            .order_by('month')
        )
        
        # Create a complete list of months in the range
        labels = []
        counts = []
        
        current_date = start_date.replace(day=1)  # Start from first day of month
        end_month = end_date.replace(day=1)
        
        while current_date <= end_month:
            month_key = current_date.strftime('%Y-%m-01')
            month_name = current_date.strftime('%b')  # Jan, Feb, etc.
            
            labels.append(month_name)
            
            # Find count for this month
            month_count = next(
                (item['count'] for item in monthly_counts if item['month'].strftime('%Y-%m-01') == month_key),
                0
            )
            counts.append(month_count)
            
            # Move to next month
            if current_date.month == 12:
                current_date = current_date.replace(year=current_date.year + 1, month=1)
            else:
                current_date = current_date.replace(month=current_date.month + 1)
        
        return {
            'labels': labels,
            'counts': counts
        }


class CostingSheetCreateView(CreateAPIView):
    """
    API endpoint to create a new costing estimating record
    """
    queryset = CostingEstimating.objects.all()
    serializer_class = CostingSheetCreateSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        """Set the created_by field to the current user if not provided"""
        # If sales_person is not provided, use current user as fallback
        request_user_id = getattr(self.request.user, 'id', None)
        validated_data = serializer.validated_data

        if not validated_data.get('sales_person') and request_user_id:
            # Try to find employee record for current user
            try:
                employee = Employee.objects.filter(user_id=request_user_id).first()
                if employee:
                    validated_data['sales_person'] = employee.id
            except Exception:
                pass

        serializer.save()

    def create(self, request, *args, **kwargs):
        """
        Override create to use CostingEstimatingDetailSerializer for response
        """
        try:
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            instance = serializer.save()

            # Serialize the response using CostingEstimatingDetailSerializer
            response_serializer = CostingEstimatingDetailSerializer(instance)

            logger.info(f'Successfully created costing {instance.id} with response data')
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f'Error creating costing: {str(e)}', exc_info=True)
            raise


class CostingSheetDetailView(RetrieveUpdateDestroyAPIView):
    """
    API endpoint to retrieve, update, or delete a specific costing estimating record
    """
    queryset = CostingEstimating.objects.all()
    serializer_class = CostingEstimatingDetailSerializer
    permission_classes = [IsAuthenticated]
    
    def update(self, request, *args, **kwargs):
        """
        Custom update method to handle both CostingEstimating and CostingSheet records
        """
        try:
            instance = self.get_object()
            data = request.data
            logger.info(f'Update request received for costing {instance.id}')
            logger.info(f'Request data keys: {list(data.keys())}')
        
            # Update the main CostingEstimating record
            estimating_data = {
                'projectName': data.get('project_name', instance.projectName),
                'customerId': data.get('customer', instance.customerId),
                'notes': data.get('notes', instance.notes),
                'isOutbound': data.get('is_outbound', instance.isOutbound),
                'isActive': data.get('is_active', instance.isActive),
            }
            
            for key, value in estimating_data.items():
                setattr(instance, key, value)
            instance.save()
            
            # Handle CostingSheet records (variants)
            if 'variants' in data:
                # Get existing sheets
                existing_sheets = CostingSheet.objects.filter(costingId=instance.costingId)
                existing_sheet_ids = set(existing_sheets.values_list('id', flat=True))
                processed_sheet_ids = set()
                
                for variant_data in data['variants']:
                    sheet_id = variant_data.get('id')

                    # Process components data to create formulas JSON (same as CREATE method)
                    components = variant_data.get('components', [])
                    logger.info(f'Processing variant {sheet_id} with {len(components)} components')
                    formulas_json = {}

                    for component in components:
                        component_type = component.get('component_type', '')
                        if component_type:
                            formulas_json[component_type] = {
                                'name': component.get('name', ''),
                                'formula': component.get('formula', ''),
                                'calculated_cost': component.get('calculated_cost', 0),
                                'sort_order': component.get('sort_order', 0),
                                'is_active': component.get('is_active', True)
                            }
                            logger.info(f'Component {component_type}: formula={component.get("formula")}, cost={component.get("calculated_cost")}')

                    logger.info(f'Final formulas_json: {formulas_json}')

                    sheet_data = {
                        'costingId': instance.costingId,
                        'name': variant_data.get('name', ''),
                        'finished_product_id': variant_data.get('finished_product_id'),
                        'quantity': variant_data.get('quantity', 0),
                        'subTotal': variant_data.get('sub_total', 0),
                        'profitMargin': variant_data.get('profit_margin', 0),
                        'profitAmount': variant_data.get('profit_amount', 0),
                        'taxPercentage': variant_data.get('tax_percentage', 0),
                        'taxProfitAmount': variant_data.get('tax_profit_amount', 0),
                        'total': variant_data.get('total', 0),
                        'unitPrice': variant_data.get('unit_price', 0),
                        'formulas': formulas_json,
                        'activeSheet': 1 if variant_data.get('is_included', True) else 0,
                        'is_locked': 1 if variant_data.get('is_locked', False) else 0,
                    }
                    
                    if sheet_id and sheet_id in existing_sheet_ids:
                        # Update existing sheet
                        sheet = CostingSheet.objects.get(id=sheet_id)
                        for key, value in sheet_data.items():
                            setattr(sheet, key, value)
                        sheet.save()
                        processed_sheet_ids.add(sheet_id)
                    else:
                        # Create new sheet
                        new_sheet = CostingSheet.objects.create(**sheet_data)
                        processed_sheet_ids.add(new_sheet.id)
                
                # Delete sheets that were removed
                sheets_to_delete = existing_sheet_ids - processed_sheet_ids
                if sheets_to_delete:
                    CostingSheet.objects.filter(id__in=sheets_to_delete).delete()
        
            # Return updated data
            serializer = self.get_serializer(instance)
            return Response(serializer.data)
        
        except Exception as e:
            logger.error(f'Error updating costing sheet: {e}')
            logger.error(f'Request data: {request.data}')
            return Response(
                {'error': f'Error updating costing sheet: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )