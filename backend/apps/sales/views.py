from rest_framework.views import APIView
from rest_framework import generics, filters, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from django.db.models import Count, Sum
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q

from apps.costing.models import CostingEstimating
from apps.customers.models import Customer
from .models import FinishedProduct, FinishedProductCategory
from .serializers import (
    FinishedProductSerializer,
    FinishedProductListSerializer,
    FinishedProductCreateSerializer,
    FinishedProductCategorySerializer,
    FinishedProductCategoryListSerializer
)


class SalesDashboardView(APIView):
    """
    Sales dashboard combining costing and customer data
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Get sales statistics
        total_customers = Customer.objects.filter(is_active=True).count()
        total_costing_sheets = CostingEstimating.objects.filter(isActive=1).count()
        
        # Recent activity
        recent_costing_sheets = CostingEstimating.objects.filter(isActive=1).order_by('-createdDate')[:5]
        recent_customers = Customer.objects.filter(is_active=True).order_by('-created_at')[:5]
        
        return Response({
            'statistics': {
                'total_customers': total_customers,
                'total_costing_sheets': total_costing_sheets,
            },
            'recent_activity': {
                'costing_sheets': [
                    {
                    'id': sheet.pk,
                    'project_name': sheet.projectName,
                    'customer_name': sheet.customerName,
                    'created_at': sheet.createdDate
                    }
                    for sheet in recent_costing_sheets
                ],
                'customers': [
                    {
                        'id': customer.pk,
                        'name': customer.name,
                        'customer_type': customer.customer_type,
                        'created_at': customer.created_at
                    }
                    for customer in recent_customers
                ]
            }
        })


# Finished Product Category Views

class FinishedProductCategoryPagination(PageNumberPagination):
    """Custom pagination for finished product categories"""
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200


class FinishedProductCategoryListView(generics.ListAPIView):
    """API endpoint for listing finished product categories"""
    serializer_class = FinishedProductCategoryListSerializer
    pagination_class = FinishedProductCategoryPagination
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    
    search_fields = ['category_name', 'description']
    ordering_fields = ['category_name', 'created_at']
    ordering = ['category_name']
    
    filterset_fields = {
        'is_active': ['exact'],
        'parent_category': ['exact', 'isnull'],
        'created_at': ['gte', 'lte', 'exact'],
    }

    def get_queryset(self):
        return FinishedProductCategory.objects.filter(is_active=True)


class FinishedProductCategoryDetailView(generics.RetrieveAPIView):
    """API endpoint for retrieving a single finished product category"""
    serializer_class = FinishedProductCategorySerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'pk'

    def get_queryset(self):
        return FinishedProductCategory.objects.all()


class FinishedProductCategoryCreateView(generics.CreateAPIView):
    """API endpoint for creating new finished product categories"""
    serializer_class = FinishedProductCategorySerializer
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        category = serializer.save()
        
        response_serializer = FinishedProductCategorySerializer(category)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class FinishedProductCategoryUpdateView(generics.UpdateAPIView):
    """API endpoint for updating finished product categories"""
    serializer_class = FinishedProductCategorySerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'pk'

    def get_queryset(self):
        return FinishedProductCategory.objects.all()

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        category = serializer.save()
        
        response_serializer = FinishedProductCategorySerializer(category)
        return Response(response_serializer.data)


class FinishedProductCategoryDeleteView(generics.DestroyAPIView):
    """API endpoint for deleting (soft delete) finished product categories"""
    permission_classes = [IsAuthenticated]
    lookup_field = 'pk'

    def get_queryset(self):
        return FinishedProductCategory.objects.all()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_active = False
        instance.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


# Finished Product Views

class FinishedProductPagination(PageNumberPagination):
    """Custom pagination for finished products"""
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200


class FinishedProductListView(generics.ListAPIView):
    """API endpoint for listing finished products with search and filtering"""
    serializer_class = FinishedProductListSerializer
    pagination_class = FinishedProductPagination
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    
    search_fields = ['name', 'description', 'category__category_name']
    ordering_fields = ['name', 'created_at', 'category__category_name']
    ordering = ['name']
    
    filterset_fields = {
        'is_active': ['exact'],
        'category': ['exact'],
        'category__parent_category': ['exact', 'isnull'],
        'created_at': ['gte', 'lte', 'exact'],
    }

    def get_queryset(self):
        return FinishedProduct.objects.filter(is_active=True).select_related('category')


class FinishedProductDetailView(generics.RetrieveAPIView):
    """API endpoint for retrieving a single finished product"""
    serializer_class = FinishedProductSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'pk'

    def get_queryset(self):
        return FinishedProduct.objects.select_related('category')


class FinishedProductCreateView(generics.CreateAPIView):
    """API endpoint for creating new finished products"""
    serializer_class = FinishedProductCreateSerializer
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = serializer.save()
        
        response_serializer = FinishedProductSerializer(product)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class FinishedProductUpdateView(generics.UpdateAPIView):
    """API endpoint for updating finished products"""
    serializer_class = FinishedProductCreateSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'pk'

    def get_queryset(self):
        return FinishedProduct.objects.all()

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        product = serializer.save()
        
        response_serializer = FinishedProductSerializer(product)
        return Response(response_serializer.data)


class FinishedProductDeleteView(generics.DestroyAPIView):
    """API endpoint for deleting (soft delete) finished products"""
    permission_classes = [IsAuthenticated]
    lookup_field = 'pk'

    def get_queryset(self):
        return FinishedProduct.objects.all()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_active = False
        instance.save()
        return Response(status=status.HTTP_204_NO_CONTENT)
