from django.urls import path

from .shared_views import shared_order_detail

app_name = 'shared_orders'

urlpatterns = [
    path('<str:token>/', shared_order_detail, name='detail'),
]
