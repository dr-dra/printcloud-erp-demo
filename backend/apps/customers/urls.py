from django.urls import path
from .views import CustomerListView, CustomerExportAllView, CustomerCreateView, CustomerDetailView, CustomerUpdateView, CustomerDeleteView, customer_archive_view, CustomerDocumentDeleteView, customer_emails_typeahead, save_customer_emails, CustomerAdvanceListView

urlpatterns = [
    path('', CustomerListView.as_view(), name='customer-list'),
    path('create/', CustomerCreateView.as_view(), name='customer-create'),
    path('<int:pk>/', CustomerDetailView.as_view(), name='customer-detail'),
    path('<int:pk>/advances/', CustomerAdvanceListView.as_view(), name='customer-advances'),
    path('<int:pk>/update/', CustomerUpdateView.as_view(), name='customer-update'),
    path('<int:pk>/archive/', customer_archive_view, name='customer-archive'),
    path('<int:pk>/delete/', CustomerDeleteView.as_view(), name='customer-delete'),
    path('<int:customer_id>/documents/<int:id>/delete/', CustomerDocumentDeleteView.as_view(), name='document-delete'),
    path('<int:customer_id>/emails/typeahead/', customer_emails_typeahead, name='customer-emails-typeahead'),
    path('<int:customer_id>/emails/save/', save_customer_emails, name='save-customer-emails'),
    path('export-all/', CustomerExportAllView.as_view(), name='customer-export-all'),
] 
