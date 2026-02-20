from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SalesInvoiceListView, SalesInvoiceDetailView, SalesInvoiceCreateView,
    SalesInvoiceUpdateView, ConvertOrderToInvoiceView, RecordPaymentView,
    GetNextInvoiceNumberView, InvoicePDFView, SendInvoiceEmailView, SendInvoiceWhatsAppView,
    PrintInvoiceView, ClearChequeView, VoidPaymentView, AllocatePaymentView,
    ConvertProformaToTaxInvoiceView,
    email_receipt, whatsapp_receipt, print_receipt, generate_receipt_share_link,
    view_receipt_public, download_receipt_pdf, view_receipt_by_number, download_receipt_pdf_by_number,
    SalesCreditNoteViewSet
)

app_name = 'invoices'

router = DefaultRouter()
router.register(r'credit-notes', SalesCreditNoteViewSet, basename='sales-credit-note')

urlpatterns = [
    path('', SalesInvoiceListView.as_view(), name='list'),
    path('<int:pk>/', SalesInvoiceDetailView.as_view(), name='detail'),
    path('create/', SalesInvoiceCreateView.as_view(), name='create'),
    path('<int:pk>/edit/', SalesInvoiceUpdateView.as_view(), name='update'),
    path('next-number/', GetNextInvoiceNumberView.as_view(), name='next-number'),
    path('convert-order/<int:order_id>/', ConvertOrderToInvoiceView.as_view(), name='convert-order'),
    path('<int:pk>/record-payment/', RecordPaymentView.as_view(), name='record-payment'),
    path('payments/<int:pk>/clear-cheque/', ClearChequeView.as_view(), name='clear-cheque'),
    path('payments/<int:pk>/void/', VoidPaymentView.as_view(), name='void-payment'),
    path('allocate-payment/', AllocatePaymentView.as_view(), name='allocate-payment'),
    path('<int:pk>/pdf/', InvoicePDFView.as_view(), name='pdf'),
    path('<int:pk>/email/', SendInvoiceEmailView.as_view(), name='email'),
    path('<int:pk>/whatsapp/', SendInvoiceWhatsAppView.as_view(), name='whatsapp'),
    path('<int:pk>/print/', PrintInvoiceView.as_view(), name='print'),

    # Proforma to Tax Invoice conversion
    path('<int:pk>/convert-to-tax-invoice/', ConvertProformaToTaxInvoiceView.as_view(), name='convert-to-tax-invoice'),

    # Receipt endpoints
    path('payments/<int:payment_id>/receipt/email/', email_receipt, name='email-receipt'),
    path('payments/<int:payment_id>/receipt/whatsapp/', whatsapp_receipt, name='whatsapp-receipt'),
    path('payments/<int:payment_id>/receipt/print/', print_receipt, name='print-receipt'),
    path('payments/<int:payment_id>/receipt/generate-share-link/', generate_receipt_share_link, name='generate-receipt-share-link'),

    # Public receipt viewing (no auth required)
    path('receipts/view/<str:token>/', view_receipt_public, name='view-receipt-public'),
    path('receipts/download/<str:token>/', download_receipt_pdf, name='download-receipt-pdf'),
    path('receipts/<str:receipt_number>/', view_receipt_by_number, name='view-receipt-by-number'),
    path('receipts/<str:receipt_number>/download/', download_receipt_pdf_by_number, name='download-receipt-by-number'),

    path('', include(router.urls)),
]
