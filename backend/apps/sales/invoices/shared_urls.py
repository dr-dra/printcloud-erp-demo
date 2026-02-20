from django.urls import path

from .shared_views import shared_invoice_detail, shared_invoice_pdf

app_name = 'shared_invoices'

urlpatterns = [
    path('<str:token>/', shared_invoice_detail, name='detail'),
    path('<str:token>/pdf/', shared_invoice_pdf, name='pdf'),
]
