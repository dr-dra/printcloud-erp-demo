from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from apps.users.auth_views import LoginAlertTokenObtainPairView

urlpatterns = [
    path('admin/', admin.site.urls),

    # API Routes
    path('api/auth/jwt/create/', LoginAlertTokenObtainPairView.as_view(), name='jwt-create'),
    path('api/auth/', include('djoser.urls')),                         # Registration, Activation, etc.
    path('api/auth/', include('djoser.urls.jwt')),                     # JWT login/logout
    path('api/users/', include('apps.users.urls')),                    # Custom user views (optional, if you create)
    path('api/employees/', include('apps.employees.urls')),            # Custom employee views (optional, if you create)

    # Core shared resources
    path('api/core/', include('apps.core.urls')),                      # Core shared models (communication logs)

    # Accounting and purchasing modules
    path('api/accounting/', include('apps.accounting.urls')),          # Accounting module (chart of accounts, journals)
    path('api/suppliers/', include('apps.suppliers.urls')),            # Supplier management
    path('api/purchases/', include('apps.purchases.urls')),            # Purchase orders and supplier bills

    # Original app routes restored
    path('api/costings/', include('apps.costing.urls')),               # Costing views
    path('api/customers/', include('apps.customers.urls')),            # Customer views
    path('api/pos/', include('apps.pos.urls')),                        # POS system (orders, quick services)
    path('api/inventory/', include('apps.inventory.urls')),            # Inventory (stock items, locations, movements)
    path('api/sales/', include('apps.sales.urls')),                    # Sales views (includes quotations)
    path('api/reminders/', include('apps.reminders.urls')),            # Reminders system
    path('api/mailadmin/', include('apps.mailadmin.urls')),              # Mail admin interface
    path('api/printcloudclient/', include('printcloudclient.urls')),    # PrintCloudClient API
    
    # Public shared endpoints (no authentication required)
    path('api/shared/quotations/', include('apps.sales.quotations.shared_urls')),
    path('api/shared/invoices/', include('apps.sales.invoices.shared_urls')),
    path('api/shared/orders/', include('apps.sales.orders.shared_urls')),
    path('api/shared/purchase-orders/', include('apps.purchases.shared_urls')),
]

# Serve media files during development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += staticfiles_urlpatterns()
    # Serve local profile pictures
    urlpatterns += static('/media/profile_pictures/', document_root=settings.PROFILE_PICTURES_ROOT)
