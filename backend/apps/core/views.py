from rest_framework import viewsets, filters, generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
import logging
from django_filters.rest_framework import DjangoFilterBackend
from .models import DocumentCommunicationLog, BugReport
from .serializers import DocumentCommunicationLogSerializer, BugReportSerializer
from .tasks import send_bug_report_email

logger = logging.getLogger(__name__)


class DocumentCommunicationLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ReadOnly ViewSet for fetching document communication logs

    Query Parameters:
    - doc_type: Filter by document type (quotation, invoice, order)
    - doc_id: Filter by document ID
    - method: Filter by communication method (email, whatsapp, print)
    - success: Filter by success status (true/false)
    """
    queryset = DocumentCommunicationLog.objects.all()
    serializer_class = DocumentCommunicationLogSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['doc_type', 'doc_id', 'method', 'success']
    ordering_fields = ['sent_at']
    ordering = ['-sent_at']


class BugReportCreateView(generics.CreateAPIView):
    serializer_class = BugReportSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def perform_create(self, serializer):
        report = serializer.save(created_by=self.request.user)

        try:
            send_bug_report_email.delay(report.id)
        except Exception:
            logger.exception('Failed to enqueue bug report email')
