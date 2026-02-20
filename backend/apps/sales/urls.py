from django.urls import path, include
from .views import (
    SalesDashboardView,
    # SalesItemListView,  # Legacy - commented out
    # SalesItemDetailView,  # Legacy - commented out
    # SalesItemCreateView,  # Legacy - commented out
    # SalesItemUpdateView,  # Legacy - commented out
    # SalesItemDeleteView,  # Legacy - commented out
    # Finished Product Category Views
    FinishedProductCategoryListView,
    FinishedProductCategoryDetailView,
    FinishedProductCategoryCreateView,
    FinishedProductCategoryUpdateView,
    FinishedProductCategoryDeleteView,
    # Finished Product Views
    FinishedProductListView,
    FinishedProductDetailView,
    FinishedProductCreateView,
    FinishedProductUpdateView,
    FinishedProductDeleteView
)

urlpatterns = [
    # Sales dashboard
    path('dashboard/', SalesDashboardView.as_view(), name='sales-dashboard'),
    
    # Legacy Sales items API - commented out
    # path('items/', SalesItemListView.as_view(), name='sales-item-list'),
    # path('items/create/', SalesItemCreateView.as_view(), name='sales-item-create'),
    # path('items/<int:pk>/', SalesItemDetailView.as_view(), name='sales-item-detail'),
    # path('items/<int:pk>/update/', SalesItemUpdateView.as_view(), name='sales-item-update'),
    # path('items/<int:pk>/delete/', SalesItemDeleteView.as_view(), name='sales-item-delete'),
    
    # Route to costing app
    path('costing/', include('apps.costing.urls')),
    
    # Route to customers app  
    path('customers/', include('apps.customers.urls')),
    
    # Route to quotations app
    path('quotations/', include('apps.sales.quotations.urls')),

    # Route to orders app
    path('orders/', include('apps.sales.orders.urls')),
    # Route to invoices app
    path('invoices/', include('apps.sales.invoices.urls')),

    # Finished Product Categories API
    path('categories/', FinishedProductCategoryListView.as_view(), name='finished-product-category-list'),
    path('categories/create/', FinishedProductCategoryCreateView.as_view(), name='finished-product-category-create'),
    path('categories/<int:pk>/', FinishedProductCategoryDetailView.as_view(), name='finished-product-category-detail'),
    path('categories/<int:pk>/update/', FinishedProductCategoryUpdateView.as_view(), name='finished-product-category-update'),
    path('categories/<int:pk>/delete/', FinishedProductCategoryDeleteView.as_view(), name='finished-product-category-delete'),
    
    # Finished Products API
    path('finished-products/', FinishedProductListView.as_view(), name='finished-product-list'),
    path('finished-products/create/', FinishedProductCreateView.as_view(), name='finished-product-create'),
    path('finished-products/<int:pk>/', FinishedProductDetailView.as_view(), name='finished-product-detail'),
    path('finished-products/<int:pk>/update/', FinishedProductUpdateView.as_view(), name='finished-product-update'),
    path('finished-products/<int:pk>/delete/', FinishedProductDeleteView.as_view(), name='finished-product-delete'),
] 