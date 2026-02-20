from django.urls import path
from . import views

app_name = 'printcloudclient'

urlpatterns = [
    # PrintCloudClient endpoints (no auth required)
    path('register/', views.register_client, name='register_client'),
    path('jobs/', views.get_client_jobs, name='get_client_jobs'),
    path('status/', views.update_printer_status, name='update_printer_status'),
    path('job/<uuid:job_id>/complete/', views.complete_print_job, name='complete_print_job'),
    path('heartbeat/', views.heartbeat, name='heartbeat'),
    
    # Web app endpoints (auth required)
    path('print/', views.CreatePrintJobView.as_view(), name='create_print_job'),
    path('printers/available/', views.get_available_printers, name='get_available_printers'),
    path('printers/check-availability/', views.check_printer_availability, name='check_printer_availability'),
    path('printjobs/<uuid:job_id>/status/', views.get_print_job_status, name='get_print_job_status'),
    path('clients/', views.get_online_clients, name='get_online_clients'),
    
    # Browser fallback endpoints
    path('check-availability/', views.check_client_availability, name='check_client_availability'),
    path('browser-print/<str:document_type>/<int:document_id>/', views.browser_print_fallback, name='browser_print_fallback'),
    path('browser-print/<str:document_type>/<int:document_id>', views.browser_print_fallback, name='browser_print_fallback_noslash'),
]
