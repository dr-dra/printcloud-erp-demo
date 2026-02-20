from django.urls import path
from .views import (
    SalesQuotationListView,
    SalesQuotationDetailView,
    SalesQuotationCreateView,
    SalesQuotationUpdateView,
    SalesQuotationItemListView,
    SalesQuotationNextNumberView,
    quotation_pdf,
    quotation_letterhead,
    send_quotation_email,
    send_quotation_whatsapp,
    test_whatsapp_api,
    print_quotation,
    generate_share_link,
)

app_name = 'quotations'

urlpatterns = [
    # Quotation endpoints
    path('', SalesQuotationListView.as_view(), name='quotation-list'),
    path('create/', SalesQuotationCreateView.as_view(), name='quotation-create'),
    path('next-number/', SalesQuotationNextNumberView.as_view(), name='quotation-next-number'),
    path('<int:pk>/', SalesQuotationDetailView.as_view(), name='quotation-detail'),
    path('<int:pk>/edit/', SalesQuotationUpdateView.as_view(), name='quotation-update'),
    path('<int:pk>/pdf/', quotation_pdf, name='quotation-pdf'),
    path('<int:pk>/letterhead/', quotation_letterhead, name='quotation-letterhead'),
    path('<int:pk>/email/', send_quotation_email, name='quotation-email'),
    path('<int:pk>/whatsapp/', send_quotation_whatsapp, name='quotation-whatsapp'),
    path('test-whatsapp/', test_whatsapp_api, name='test-whatsapp-api'),
    path('<int:quotation_id>/print/', print_quotation, name='quotation-print'),
    
    # Quotation items endpoints
    path('<int:quotation_id>/items/', SalesQuotationItemListView.as_view(), name='quotation-items'),
    
    # Share link endpoints
    path('<int:pk>/generate-share-link/', generate_share_link, name='generate-share-link'),
    
]