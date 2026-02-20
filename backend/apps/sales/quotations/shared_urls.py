from django.urls import path
from .shared_views import (
    shared_quotation_detail,
    shared_quotation_pdf,
)

app_name = 'shared_quotations'

urlpatterns = [
    # Public shared endpoints (no authentication required)
    path('<str:token>/', shared_quotation_detail, name='detail'),
    path('<str:token>/pdf/', shared_quotation_pdf, name='pdf'),
]