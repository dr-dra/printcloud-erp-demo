from django.urls import path

from .shared_views import shared_purchase_order_detail, shared_purchase_order_pdf

app_name = 'shared_purchase_orders'

urlpatterns = [
    path('<str:token>/', shared_purchase_order_detail, name='detail'),
    path('<str:token>/pdf/', shared_purchase_order_pdf, name='pdf'),
]
