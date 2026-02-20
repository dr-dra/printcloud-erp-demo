from django.urls import path

from .views import (
    SalesOrderListView,
    SalesOrderDetailView,
    SalesOrderCreateView,
    SalesOrderUpdateView,
    SalesOrderNextNumberView,
    ConvertQuotationToOrderView,
    CloneOrderView,
    TransitionOrderStatusView,
    create_order_job_card,
    set_order_production_stage,
    mark_order_ready,
    mark_order_delivered,
    mark_order_completed,
    OrderAttachmentUploadView,
    OrderAttachmentDownloadView,
    order_pdf,
    send_order_email,
    send_order_whatsapp,
    print_order,
    generate_order_share_link,
    # Payment views
    OrderPaymentListView,
    OrderPaymentCreateView,
    void_order_payment,
    clear_order_payment_cheque,
    order_payment_receipt_pdf,
    email_order_receipt,
    whatsapp_order_receipt,
    print_order_receipt,
    generate_order_receipt_share_link,
    view_order_receipt_public,
    download_order_receipt_pdf,
    view_order_receipt_by_number,
    download_order_receipt_pdf_by_number,
)

app_name = 'orders'

urlpatterns = [
    # Order CRUD endpoints
    path('', SalesOrderListView.as_view(), name='order-list'),
    path('create/', SalesOrderCreateView.as_view(), name='order-create'),
    path('next-number/', SalesOrderNextNumberView.as_view(), name='order-next-number'),
    path('<int:pk>/', SalesOrderDetailView.as_view(), name='order-detail'),
    path('<int:pk>/edit/', SalesOrderUpdateView.as_view(), name='order-update'),

    # Conversion and cloning
    path('convert-quotation/<int:quotation_id>/', ConvertQuotationToOrderView.as_view(), name='convert-quotation'),
    path('<int:pk>/clone/', CloneOrderView.as_view(), name='order-clone'),

    # Status transitions
    path('<int:pk>/transition/', TransitionOrderStatusView.as_view(), name='order-transition'),
    path('<int:pk>/job-card/', create_order_job_card, name='order-job-card'),
    path('<int:pk>/production-stage/', set_order_production_stage, name='order-production-stage'),
    path('<int:pk>/dispatch-note/', mark_order_ready, name='order-dispatch-ready'),
    path('<int:pk>/delivered/', mark_order_delivered, name='order-delivered'),
    path('<int:pk>/completed/', mark_order_completed, name='order-completed'),

    # Document generation
    path('<int:pk>/pdf/', order_pdf, name='order-pdf'),

    # Communication
    path('<int:pk>/email/', send_order_email, name='order-email'),
    path('<int:pk>/whatsapp/', send_order_whatsapp, name='order-whatsapp'),
    path('<int:order_id>/print/', print_order, name='order-print'),

    # Sharing
    path('<int:pk>/generate-share-link/', generate_order_share_link, name='generate-share-link'),

    # Attachments
    path('<int:order_id>/attachments/upload/', OrderAttachmentUploadView.as_view(), name='attachment-upload'),
    path('attachments/<int:pk>/download/', OrderAttachmentDownloadView.as_view(), name='attachment-download'),

    # Payments (Advances)
    path('<int:order_id>/payments/', OrderPaymentListView.as_view(), name='payment-list'),
    path('<int:order_id>/payments/create/', OrderPaymentCreateView.as_view(), name='payment-create'),
    path('payments/<int:payment_id>/clear-cheque/', clear_order_payment_cheque, name='payment-clear-cheque'),
    path('payments/<int:payment_id>/void/', void_order_payment, name='payment-void'),
    path('payments/<int:payment_id>/receipt-pdf/', order_payment_receipt_pdf, name='payment-receipt-pdf'),
    path('payments/<int:payment_id>/receipt/email/', email_order_receipt, name='payment-receipt-email'),
    path('payments/<int:payment_id>/receipt/whatsapp/', whatsapp_order_receipt, name='payment-receipt-whatsapp'),
    path('payments/<int:payment_id>/receipt/print/', print_order_receipt, name='payment-receipt-print'),
    path('payments/<int:payment_id>/receipt/generate-share-link/', generate_order_receipt_share_link, name='payment-receipt-share'),

    # Public order receipt viewing (no auth required)
    path('receipts/view/<str:token>/', view_order_receipt_public, name='receipt-view-public'),
    path('receipts/download/<str:token>/', download_order_receipt_pdf, name='receipt-download'),
    path('receipts/<str:receipt_number>/', view_order_receipt_by_number, name='receipt-view-by-number'),
    path('receipts/<str:receipt_number>/download/', download_order_receipt_pdf_by_number, name='receipt-download-by-number'),
]
