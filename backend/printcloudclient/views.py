from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.utils import timezone
from django.conf import settings
from datetime import timedelta
from django.db import transaction
from django.contrib.auth import get_user_model
from .models import PrintCloudClient, Printer, PrintJob
from .serializers import (
    PrintCloudClientRegistrationSerializer,
    PrintCloudClientSerializer,
    PrintJobSerializer,
    PrintJobCompletionSerializer,
    PrinterStatusUpdateSerializer,
    PrinterSerializer
)

User = get_user_model()

HEARTBEAT_TIMEOUT_SECONDS = getattr(settings, 'PRINTCLOUDCLIENT_HEARTBEAT_TIMEOUT_SECONDS', 120)
FORCE_REFRESH_TIMEOUT_SECONDS = getattr(
    settings,
    'PRINTCLOUDCLIENT_FORCE_REFRESH_TIMEOUT_SECONDS',
    45
)


def _parse_bool(value):
    if value is None:
        return False
    return str(value).strip().lower() in {'1', 'true', 'yes', 'y', 'on'}


def get_recent_online_clients(timeout_seconds=None):
    effective_timeout = timeout_seconds or HEARTBEAT_TIMEOUT_SECONDS
    cutoff = timezone.now() - timedelta(seconds=effective_timeout)
    stale_clients = PrintCloudClient.objects.filter(status='online', last_heartbeat__lt=cutoff)
    if stale_clients.exists():
        stale_clients.update(status='offline')
    return PrintCloudClient.objects.filter(status='online', last_heartbeat__gte=cutoff)

def map_printer_fields(printer_data):
    """
    Map PrintCloudClient C# field names to Django model field names
    """
    mapped = printer_data.copy()
    
    # Map C# boolean fields to Django field names
    if 'IsOnline' in mapped:
        mapped['status'] = 'online' if mapped.pop('IsOnline') else 'offline'
    
    # Map printer type from C# boolean flags to Django choice field
    if 'IsStandardPrinter' in mapped and 'IsPosPrinter' in mapped:
        is_standard = mapped.pop('IsStandardPrinter', False)
        is_pos = mapped.pop('IsPosPrinter', False)
        
        if is_pos:
            mapped['printer_type'] = 'pos'
        elif is_standard:
            mapped['printer_type'] = 'standard'
        else:
            mapped['printer_type'] = 'standard'  # Default fallback
    
    # Ensure required fields have defaults
    if 'status' not in mapped:
        mapped['status'] = 'online'
    if 'printer_type' not in mapped:
        mapped['printer_type'] = 'standard'
    
    # Clean up any remaining C# specific fields that might cause issues
    c_sharp_fields = ['IsOnline', 'IsStandardPrinter', 'IsPosPrinter']
    for field in c_sharp_fields:
        mapped.pop(field, None)
    
    return mapped

@api_view(['POST'])
@permission_classes([permissions.AllowAny])  # No auth required for client registration
def register_client(request):
    """Auto-register PrintCloudClient on startup"""
    serializer = PrintCloudClientRegistrationSerializer(data=request.data)
    if serializer.is_valid():
        # Check if client already exists by name and IP
        existing_client = PrintCloudClient.objects.filter(
            name=serializer.validated_data['name'],
            ip_address=serializer.validated_data['ip_address']
        ).first()
        
        if existing_client:
            # Update existing client
            existing_client.status = 'online'
            existing_client.last_heartbeat = timezone.now()
            existing_client.version = serializer.validated_data.get('version')
            existing_client.save()
            
            # Update printers
            existing_client.printers.all().delete()
            printers_data = request.data.get('printers', [])
            for printer_data in printers_data:
                # Map C# client fields to Django model fields
                mapped_data = map_printer_fields(printer_data)
                Printer.objects.create(client=existing_client, **mapped_data)
            
            response_serializer = PrintCloudClientSerializer(existing_client)
            return Response(response_serializer.data, status=status.HTTP_200_OK)
        else:
            # Create new client
            client = serializer.save()
            response_serializer = PrintCloudClientSerializer(client)
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def get_client_jobs(request):
    """Get assigned print jobs for this PrintCloudClient"""
    client_id = request.GET.get('client_id')
    if not client_id:
        return Response({'error': 'client_id parameter required'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        client = PrintCloudClient.objects.get(id=client_id)
        
        # Get pending jobs assigned to this client or unassigned jobs
        pending_jobs = PrintJob.objects.filter(
            status__in=['pending', 'assigned'],
            assigned_client__isnull=True
        )[:5]  # Limit to 5 jobs per request
        
        # Get client's available printers for validation
        available_printers = list(client.printers.filter(status='online').values_list('name', flat=True))
        
        # Assign jobs to this client only if printer is available
        with transaction.atomic():
            for job in pending_jobs:
                # Check if target printer or any fallback printer is available
                can_print = (
                    job.target_printer_name in available_printers or
                    any(printer in available_printers for printer in job.fallback_printer_names)
                )
                
                if can_print:
                    job.assigned_client = client
                    job.status = 'assigned'
                    job.assigned_at = timezone.now()
                    job.save()
                else:
                    # Log why job wasn't assigned for debugging
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.info(f"Job {job.id} not assigned to client {client.name}: target printer '{job.target_printer_name}' not available. Available: {available_printers}")
        
        # Return assigned jobs
        assigned_jobs = PrintJob.objects.filter(
            assigned_client=client,
            status__in=['assigned', 'printing']
        )
        
        serializer = PrintJobSerializer(assigned_jobs, many=True)
        return Response(serializer.data)
        
    except PrintCloudClient.DoesNotExist:
        return Response({'error': 'Client not found'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def update_printer_status(request):
    """Update printer and connection status"""
    client_id = request.data.get('client_id')
    if not client_id:
        return Response({'error': 'client_id required'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        client = PrintCloudClient.objects.get(id=client_id)
        serializer = PrinterStatusUpdateSerializer(data=request.data)
        
        if serializer.is_valid():
            # Update client heartbeat
            client.last_heartbeat = timezone.now()
            client.status = 'online'
            client.save()
            
            # Update printer statuses
            printers_data = serializer.validated_data['printers']
            for printer_data in printers_data:
                printer, created = Printer.objects.update_or_create(
                    client=client,
                    name=printer_data['name'],
                    defaults=printer_data
                )
            
            return Response({'status': 'updated'})
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
    except PrintCloudClient.DoesNotExist:
        return Response({'error': 'Client not found'}, status=status.HTTP_404_NOT_FOUND)

def create_print_job_notification(job, status, error_message=''):
    """Create a notification for print job completion"""
    try:
        from apps.reminders.models import Notification, Reminder
        from django.utils import timezone
        
        # Create a temporary reminder for the notification
        # This uses the existing notification system but for print job updates
        if status == 'completed':
            note = f"Print job completed successfully"
            if job.used_printer_name:
                note += f" on printer '{job.used_printer_name}'"
        elif status == 'failed':
            note = f"Print job failed"
            if error_message:
                note += f": {error_message}"
        else:
            return  # Only notify on completion or failure
        
        # Create a reminder entry for the notification (required by the system)
        reminder = Reminder.objects.create(
            entity_type='quotation',  # Assuming this is for quotations
            entity_id=0,  # Dummy ID since this is just for notifications
            entity_ref=f"Print Job {str(job.id)[:8]}",
            assignee_user=job.user,
            due_at=timezone.now(),
            note=note,
            status='done',  # Mark as done since it's just informational
            origin_module='print_jobs',
            created_by=job.user,
            link_path=''  # Could link to print job status page
        )
        
        # Create the notification
        notification = Notification.objects.create(
            user=job.user,
            reminder=reminder,
            channel='in_app',
            delivered_at=timezone.now()
        )
        
        return notification
        
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Failed to create print job notification: {str(e)}")
        return None

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def complete_print_job(request, job_id):
    """Mark job as completed or failed and create user notification"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        job = PrintJob.objects.get(id=job_id)
        serializer = PrintJobCompletionSerializer(job, data=request.data, partial=True)
        
        if serializer.is_valid():
            old_status = job.status
            new_status = serializer.validated_data['status']
            error_message = serializer.validated_data.get('error_message', '')
            used_printer = serializer.validated_data.get('used_printer_name', '')
            
            # Update job
            job.status = new_status
            job.error_message = error_message
            job.used_printer_name = used_printer
            
            if new_status == 'completed':
                job.completed_at = timezone.now()
                logger.info(f"Print job {job_id} completed successfully on printer '{used_printer}' for user {job.user.email}")
            elif new_status == 'failed':
                logger.warning(f"Print job {job_id} failed for user {job.user.email}: {error_message}")
            
            job.save()
            
            # Create notification for user
            create_print_job_notification(job, new_status, error_message)
            
            return Response({
                'status': 'updated',
                'job_status': new_status,
                'message': f'Print job {job_id} marked as {new_status}'
            })
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
    except PrintJob.DoesNotExist:
        return Response({'error': 'Job not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error completing print job {job_id}: {str(e)}")
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def heartbeat(request):
    """Maintain connection with API"""
    client_id = request.GET.get('client_id')
    if not client_id:
        return Response({'error': 'client_id parameter required'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        client = PrintCloudClient.objects.get(id=client_id)
        client.last_heartbeat = timezone.now()
        client.status = 'online'
        client.save()
        
        return Response({
            'status': 'ok',
            'timestamp': timezone.now(),
            'pending_jobs_count': PrintJob.objects.filter(
                assigned_client=client,
                status__in=['assigned', 'printing']
            ).count()
        })
        
    except PrintCloudClient.DoesNotExist:
        return Response({'error': 'Client not found'}, status=status.HTTP_404_NOT_FOUND)

class CreatePrintJobView(generics.CreateAPIView):
    """API endpoint for web app to create print jobs"""
    serializer_class = PrintJobSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def perform_create(self, serializer):
        user = self.request.user
        
        # Get user's preferred printer based on document type
        document_type = serializer.validated_data['document_type']
        target_printer = None
        fallback_printers = []
        
        if document_type in ['invoice', 'quotation', 'job_ticket']:
            target_printer = user.default_a4_printer
        elif document_type in ['receipt']:
            target_printer = user.default_pos_printer
        elif document_type in ['dispatch_note', 'credit_note']:
            target_printer = user.default_a5_printer
        
        # Get available printers as fallbacks
        if target_printer:
            if document_type == 'receipt':
                # For receipts, only POS printers as fallbacks
                available_printers = Printer.objects.filter(
                    printer_type='pos', 
                    status='online'
                ).exclude(name=target_printer).values_list('name', flat=True)
            else:
                # For documents, standard printers as fallbacks
                available_printers = Printer.objects.filter(
                    printer_type='standard', 
                    status='online'
                ).exclude(name=target_printer).values_list('name', flat=True)
            
            fallback_printers = list(available_printers)[:3]  # Limit to 3 fallbacks
        
        serializer.save(
            user=user,
            target_printer_name=target_printer or '',
            fallback_printer_names=fallback_printers
        )

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_available_printers(request):
    """Get all available printers from online PrintCloudClient instances"""
    # Get all printers from online clients
    force_refresh = _parse_bool(request.GET.get('force_refresh'))
    timeout_seconds = FORCE_REFRESH_TIMEOUT_SECONDS if force_refresh else None
    online_clients = get_recent_online_clients(timeout_seconds=timeout_seconds)
    online_printers = Printer.objects.filter(
        client__in=online_clients,
        status='online'
    ).select_related('client')
    
    # Group printers by type for frontend convenience
    printers_by_type = {
        'standard': [],
        'pos': []
    }
    
    for printer in online_printers:
        printer_data = PrinterSerializer(printer).data
        printer_data['client_name'] = printer.client.name
        printer_data['client_id'] = str(printer.client.id)
        printers_by_type[printer.printer_type].append(printer_data)
    
    return Response({
        'printers_by_type': printers_by_type,
        'total_count': online_printers.count(),
        'clients_online': online_clients.count()
    })

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_online_clients(request):
    """Get list of online PrintCloudClient instances"""
    force_refresh = _parse_bool(request.GET.get('force_refresh'))
    timeout_seconds = FORCE_REFRESH_TIMEOUT_SECONDS if force_refresh else None
    online_clients = get_recent_online_clients(timeout_seconds=timeout_seconds)
    
    # Add printer counts for each client
    clients_data = []
    for client in online_clients:
        client_data = PrintCloudClientSerializer(client).data
        client_data['printer_counts'] = {
            'total': client.printers.count(),
            'online': client.printers.filter(status='online').count(),
            'standard': client.printers.filter(printer_type='standard', status='online').count(),
            'pos': client.printers.filter(printer_type='pos', status='online').count()
        }
        clients_data.append(client_data)
    
    return Response({
        'clients': clients_data,
        'total_clients': len(clients_data)
    })

def calculate_printer_similarity(target_printer_name, target_printer_type, candidate_printer):
    """
    Calculate similarity score between target printer preferences and candidate printer
    Returns score from 0-100 (higher is better match)
    """
    if not target_printer_name or not candidate_printer:
        return 0
    
    score = 0
    target_name_lower = target_printer_name.lower()
    candidate_name_lower = candidate_printer.name.lower()
    
    # Printer type match (highest priority) - 40 points
    if candidate_printer.printer_type == target_printer_type:
        score += 40
    
    # Exact name match - 30 points
    if target_name_lower == candidate_name_lower:
        score += 30
    # Partial name match - 20 points
    elif target_name_lower in candidate_name_lower or candidate_name_lower in target_name_lower:
        score += 20
    # Brand match (first word) - 15 points
    elif target_name_lower.split()[0] == candidate_name_lower.split()[0]:
        score += 15
    
    # Driver similarity - 15 points
    if candidate_printer.driver and target_printer_name:
        candidate_driver_lower = candidate_printer.driver.lower()
        if any(word in candidate_driver_lower for word in target_name_lower.split()):
            score += 15
        elif any(word in target_name_lower for word in candidate_driver_lower.split()):
            score += 10
    
    # Status bonus - 15 points for online printers
    if candidate_printer.status == 'online':
        score += 15
    
    return min(score, 100)  # Cap at 100

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def check_printer_availability(request):
    """
    Check if user's default printer is available and provide alternatives with similarity scores
    """
    document_type = request.GET.get('document_type', 'quotation')
    force_refresh = _parse_bool(request.GET.get('force_refresh'))
    timeout_seconds = FORCE_REFRESH_TIMEOUT_SECONDS if force_refresh else None
    user = request.user
    
    # Determine required printer type and get user's default printer
    if document_type == 'receipt':
        required_printer_type = 'pos'
        default_printer_name = user.default_pos_printer
    elif document_type in ['dispatch_note', 'credit_note']:
        required_printer_type = 'standard'
        default_printer_name = user.default_a5_printer
    else:  # quotation, invoice, job_ticket
        required_printer_type = 'standard'  
        default_printer_name = user.default_a4_printer
    
    # Check if default printer is available
    online_clients = get_recent_online_clients(timeout_seconds=timeout_seconds)
    default_printer_available = False
    if default_printer_name:
        default_printer_available = Printer.objects.filter(
            name=default_printer_name,
            printer_type=required_printer_type,
            status='online',
            client__in=online_clients
        ).exists()
    
    # Get all available printers of the required type
    available_printers = Printer.objects.filter(
        printer_type=required_printer_type,
        status='online',
        client__in=online_clients
    ).select_related('client')
    
    # Calculate similarity scores and prepare printer data
    printer_alternatives = []
    for printer in available_printers:
        # Skip if this is the default printer and it's available
        if default_printer_available and printer.name == default_printer_name:
            continue
            
        similarity_score = calculate_printer_similarity(
            default_printer_name, 
            required_printer_type, 
            printer
        )
        
        printer_data = {
            'id': str(printer.id),
            'name': printer.name,
            'printer_type': printer.printer_type,
            'status': printer.status,
            'driver': printer.driver,
            'client_name': printer.client.name,
            'client_id': str(printer.client.id),
            'similarity_score': similarity_score
        }
        printer_alternatives.append(printer_data)
    
    # Sort alternatives by similarity score (descending) then by name
    printer_alternatives.sort(key=lambda x: (-x['similarity_score'], x['name']))
    
    return Response({
        'defaultPrinterAvailable': default_printer_available,
        'defaultPrinterName': default_printer_name,
        'requiredPrinterType': required_printer_type,
        'availablePrinters': printer_alternatives,
        'totalAlternatives': len(printer_alternatives),
        'recommendedPrinter': printer_alternatives[0] if printer_alternatives else None
    })

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_print_job_status(request, job_id):
    """
    Get real-time status of a print job for polling
    """
    try:
        job = PrintJob.objects.select_related('user', 'assigned_client').get(
            id=job_id,
            user=request.user  # Only allow users to check their own jobs
        )
        
        response_data = {
            'id': str(job.id),
            'status': job.status,
            'document_type': job.document_type,
            'target_printer_name': job.target_printer_name,
            'used_printer_name': job.used_printer_name,
            'error_message': job.error_message,
            'copies': job.copies,
            'created_at': job.created_at.isoformat(),
            'assigned_at': job.assigned_at.isoformat() if job.assigned_at else None,
            'completed_at': job.completed_at.isoformat() if job.completed_at else None,
        }
        
        # Add client information if assigned
        if job.assigned_client:
            response_data['assigned_client'] = {
                'id': str(job.assigned_client.id),
                'name': job.assigned_client.name,
                'ip_address': job.assigned_client.ip_address
            }
        
        return Response(response_data)
        
    except PrintJob.DoesNotExist:
        return Response({'error': 'Print job not found'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def browser_print_fallback(request, document_type, document_id):
    """
    Generate PDF for browser printing as fallback
    """
    from django.http import HttpResponse
    import logging
    from rest_framework_simplejwt.authentication import JWTAuthentication
    from rest_framework.response import Response
    
    logger = logging.getLogger(__name__)
    
    try:
        user = request.user
        if not getattr(user, 'is_authenticated', False):
            token = request.GET.get('access_token')
            if token:
                jwt_auth = JWTAuthentication()
                try:
                    validated = jwt_auth.get_validated_token(token)
                    user = jwt_auth.get_user(validated)
                    request.user = user
                except Exception:
                    return Response(
                        {'detail': 'Authentication credentials were not provided.'},
                        status=status.HTTP_401_UNAUTHORIZED
                    )
            else:
                return Response(
                    {'detail': 'Authentication credentials were not provided.'},
                    status=status.HTTP_401_UNAUTHORIZED
                )

        pdf_buffer, filename = build_browser_print_pdf(
            document_type,
            document_id,
            user
        )

        if not pdf_buffer:
            return HttpResponse('Document not found or access denied', status=404)

        logger.info(f"Generating browser fallback PDF for {document_type} {document_id} by user {request.user.email}")

        response = HttpResponse(pdf_buffer.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response['Pragma'] = 'no-cache'
        response['Expires'] = '0'

        return response
        
    except Exception as e:
        logger.error(f"Error generating browser fallback for {document_type} {document_id}: {str(e)}")
        return HttpResponse(f'Error generating print version: {str(e)}', status=500)

def build_browser_print_pdf(document_type, document_id, user):
    """
    Build PDF buffer for browser print fallback.
    Returns (BytesIO, filename) or (None, None).
    """
    try:
        if document_type == 'quotation':
            from apps.sales.quotations.models import SalesQuotation
            from apps.sales.quotations.tasks import generate_quotation_pdf

            quotation = SalesQuotation.objects.select_related('customer').prefetch_related('items').get(
                id=document_id
            )
            pdf_buffer = generate_quotation_pdf(quotation)
            filename = f'Quotation-{quotation.quot_number}.pdf'
            return pdf_buffer, filename

        if document_type == 'order':
            from apps.sales.orders.models import SalesOrder
            from apps.sales.orders.tasks import generate_order_pdf

            order = SalesOrder.objects.select_related('customer', 'prepared_by', 'created_by').prefetch_related(
                'items', 'customer__addresses'
            ).get(id=document_id)
            pdf_buffer = generate_order_pdf(order)
            filename = f'Order-{order.order_number}.pdf'
            return pdf_buffer, filename

        if document_type == 'invoice':
            from apps.sales.invoices.models import SalesInvoice
            from apps.sales.invoices.tasks import generate_invoice_pdf

            invoice = SalesInvoice.objects.select_related('customer').prefetch_related('items').get(
                id=document_id
            )
            pdf_buffer = generate_invoice_pdf(invoice)
            filename = f'Invoice-{invoice.invoice_number}.pdf'
            return pdf_buffer, filename

        if document_type == 'order_receipt':
            from apps.sales.orders.utils import generate_order_receipt_pdf

            pdf_buffer = generate_order_receipt_pdf(document_id, include_company_details=False)
            filename = f'Order-Receipt-{document_id}.pdf'
            return pdf_buffer, filename

        if document_type == 'receipt':
            from apps.sales.invoices.utils import generate_receipt_pdf

            pdf_buffer = generate_receipt_pdf(document_id, include_company_details=True)
            filename = f'Receipt-{document_id}.pdf'
            return pdf_buffer, filename

        if document_type == 'credit_note':
            from apps.sales.invoices.utils import generate_credit_note_pdf

            pdf_buffer = generate_credit_note_pdf(document_id, include_company_details=True)
            filename = f'CreditNote-{document_id}.pdf'
            return pdf_buffer, filename

        return (None, None)
    except Exception:
        return (None, None)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def check_client_availability(request):
    """
    Check if any PrintCloud clients are available for printing
    """
    force_refresh = _parse_bool(request.data.get('force_refresh'))
    timeout_seconds = FORCE_REFRESH_TIMEOUT_SECONDS if force_refresh else None
    online_clients = get_recent_online_clients(timeout_seconds=timeout_seconds)
    online_clients_count = online_clients.count()
    
    # Get compatible printers for the requested document type
    document_type = request.data.get('document_type', 'quotation')
    required_printer_type = 'pos' if document_type == 'receipt' else 'standard'
    
    compatible_printers_count = Printer.objects.filter(
        client__in=online_clients,
        status='online',
        printer_type=required_printer_type
    ).count()
    
    return Response({
        'clients_online': online_clients_count,
        'compatible_printers_available': compatible_printers_count,
        'should_use_fallback': compatible_printers_count == 0,
        'fallback_reason': 'No compatible printers online' if compatible_printers_count == 0 else None,
        'heartbeat_timeout_seconds': timeout_seconds or HEARTBEAT_TIMEOUT_SECONDS,
        'force_refresh': force_refresh
    })
