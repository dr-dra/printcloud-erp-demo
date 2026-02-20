from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DocumentCommunicationLogViewSet, BugReportCreateView

router = DefaultRouter()
router.register(r'communication-logs', DocumentCommunicationLogViewSet, basename='communication-log')

urlpatterns = [
    path('', include(router.urls)),
    path('bug-reports/', BugReportCreateView.as_view(), name='bug-report-create'),
]
