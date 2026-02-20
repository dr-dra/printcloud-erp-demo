from rest_framework import viewsets, permissions
from rest_framework.pagination import PageNumberPagination
from django.db.models import Q
from .models import Costing
from .serializers import CostingSerializer
import logging

logger = logging.getLogger(__name__)

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 14  # Default to 14 rows per page
    page_size_query_param = 'page_size'
    max_page_size = 50  # Maximum 50 rows per page
    min_page_size = 5   # Minimum 5 rows per page

    def get_page_size(self, request):
        try:
            page_size = int(request.query_params.get(self.page_size_query_param, self.page_size))
            logger.info(f'Requested page size: {page_size}')
            
            if page_size > self.max_page_size:
                logger.info(f'Page size {page_size} exceeds max, using {self.max_page_size}')
                return self.max_page_size
            if page_size < self.min_page_size:
                logger.info(f'Page size {page_size} below min, using {self.min_page_size}')
                return self.min_page_size
                
            logger.info(f'Using page size: {page_size}')
            return page_size
        except (TypeError, ValueError):
            logger.info(f'Invalid page size, using default: {self.page_size}')
            return self.page_size

    def paginate_queryset(self, queryset, request, view=None):
        page_size = self.get_page_size(request)
        logger.info(f'Paginating queryset with page_size={page_size}')
        self.page_size = page_size
        return super().paginate_queryset(queryset, request, view)

class CostingViewSet(viewsets.ModelViewSet):
    queryset = Costing.objects.all()
    serializer_class = CostingSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get('search', '')
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        page_size = self.request.query_params.get('page_size')

        logger.info(f'CostingViewSet.get_queryset called with params: search={search}, start_date={start_date}, end_date={end_date}, page_size={page_size}')

        if search:
            queryset = queryset.filter(
                Q(project_name__icontains=search) |
                Q(customer_name__icontains=search) |
                Q(notes__icontains=search)
            )

        if start_date:
            queryset = queryset.filter(date__gte=start_date)
        if end_date:
            queryset = queryset.filter(date__lte=end_date)

        return queryset.order_by('-date') 