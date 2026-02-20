import logging
import os
import re
import traceback
from datetime import timedelta
from io import BytesIO

import requests
from django.conf import settings
from django.db import transaction
from django.db.models import Count, Max, Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.template.loader import render_to_string
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from weasyprint import CSS, HTML

from .models import QuotationShare, SalesQuotation, SalesQuotationItem
from .serializers import (
    SalesQuotationCreateSerializer,
    SalesQuotationDetailSerializer,
    SalesQuotationItemSerializer,
    SalesQuotationListSerializer,
)
from .tasks import (
    create_quotation_print_job_task,
    send_quotation_email_task,
    send_quotation_whatsapp_task,
)

logger = logging.getLogger(__name__)


class QuotationPagination(PageNumberPagination):
    """Custom pagination for quotations"""
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 100


class SalesQuotationListView(generics.ListAPIView):
    """
    API endpoint for listing quotations with search and filtering
    """
    serializer_class = SalesQuotationListSerializer
    pagination_class = QuotationPagination
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    
    # Search fields
    search_fields = ['quot_number', 'customer__name', 'notes']
    
    # Ordering fields
    ordering_fields = ['date', 'total', 'created_date', 'quot_number']
    ordering = ['-created_date']  # Default ordering
    
    # Filter fields
    filterset_fields = {
        'finalized': ['exact'],
        'is_active': ['exact'],
        'date': ['gte', 'lte', 'exact'],
        'total': ['gte', 'lte'],
        'customer': ['exact'],
        'created_by': ['exact'],
    }

    def get_queryset(self):
        """
        Optimize queryset with select_related to avoid N+1 queries
        """
        queryset = SalesQuotation.objects.select_related(
            'customer', 'created_by'
        ).prefetch_related('items').annotate(
            item_count=Count('items')
        )
        # Additional filtering can be added here
        return queryset


class SalesQuotationDetailView(generics.RetrieveAPIView):
    """
    API endpoint for retrieving a single quotation with full details
    """
    serializer_class = SalesQuotationDetailSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'pk'

    def get_queryset(self):
        """
        Optimize queryset with select_related and prefetch_related
        """
        return SalesQuotation.objects.select_related(
            'customer', 'created_by', 'costing'
        ).prefetch_related(
            'items__costing_sheet'
        )


class SalesQuotationItemListView(generics.ListAPIView):
    """
    API endpoint for listing quotation items for a specific quotation
    """
    serializer_class = SalesQuotationItemSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    
    search_fields = ['item', 'description']
    
    def get_queryset(self):
        """
        Filter items by quotation ID from URL
        """
        quotation_id = self.kwargs.get('quotation_id')
        return SalesQuotationItem.objects.filter(
            quotation_id=quotation_id
        ).select_related('quotation', 'costing_sheet')


class SalesQuotationCreateView(generics.CreateAPIView):
    """
    API endpoint for creating new quotations
    """
    serializer_class = SalesQuotationCreateSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        # Set the created_by field to the current user
        serializer.save(created_by=self.request.user)


class SalesQuotationUpdateView(generics.UpdateAPIView):
    """
    API endpoint for updating existing quotations
    """
    serializer_class = SalesQuotationCreateSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'pk'

    def get_queryset(self):
        """
        Optimize queryset with select_related and prefetch_related
        """
        return SalesQuotation.objects.select_related(
            'customer', 'created_by', 'costing'
        ).prefetch_related('items__costing_sheet')


class SalesQuotationNextNumberView(APIView):
    """
    API endpoint for generating the next quotation number
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Generate and return the next available quotation number
        """
        try:
            with transaction.atomic():
                # Get the highest existing quot_number (business number continuation)
                quotations = SalesQuotation.objects.exclude(quot_number__isnull=True).exclude(quot_number='')
                
                max_number = 0
                for quotation in quotations:
                    try:
                        # Skip timestamp-based quotation numbers (they start with Q or contain dates)
                        if (quotation.quot_number.startswith('Q') or 
                            quotation.quot_number.startswith('TEST-') or
                            len(quotation.quot_number.replace('-', '').replace('Q', '')) > 8):
                            continue
                            
                        # Extract numeric part from quot_number (handle various formats)
                        number_str = re.sub(r'[^\d]', '', quotation.quot_number)
                        if number_str:
                            number = int(number_str)
                            if number > max_number:
                                max_number = number
                    except (ValueError, TypeError):
                        continue
                
                if max_number == 0:
                    # First quotation or no valid numbers found - start from 241545 as per example
                    next_number = "241545"
                else:
                    # Continue from the highest number
                    next_number = str(max_number + 1)
                
                # Ensure the number doesn't already exist
                collision_count = 0
                while SalesQuotation.objects.filter(quot_number=next_number).exists():
                    max_number += 1
                    next_number = str(max_number)
                    collision_count += 1
                    if collision_count > 100:  # Safety break
                        break
                
                return Response({
                    'quot_number': next_number,
                    'success': True
                }, status=status.HTTP_200_OK)
                
        except Exception as e:
            return Response({
                'error': f'Failed to generate quotation number: {str(e)}',
                'success': False
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def quotation_pdf(request, pk):
    """
    Generate and return PDF for a specific quotation
    """
    # Get the quotation with related data
    quotation = get_object_or_404(
        SalesQuotation.objects.select_related(
            'customer', 'created_by'
        ).prefetch_related('items'),
        pk=pk
    )
    
    # Format project description from first 3 item names
    def format_project_description():
        if not quotation.items.exists():
            return 'No items'
        
        items = list(quotation.items.all()[:3])
        item_names = [item.item for item in items if item.item and item.item.strip()]
        
        if not item_names:
            return 'No item names available'
        
        # Remove duplicates while preserving order
        unique_names = []
        for name in item_names:
            if name not in unique_names:
                unique_names.append(name)
        
        if len(unique_names) <= 2:
            return ' & '.join(unique_names)
        else:
            return ', '.join(unique_names[:2]) + ' & ' + unique_names[2]
    
    # Prepare context for template
    context = {
        'quotation': quotation,
        'project_description': format_project_description(),
    }
    
    # Render HTML template
    html_string = render_to_string('quotations/quotation_pdf.html', context)
    
    # Generate PDF with static files support
    pdf_buffer = BytesIO()
    
    # Get the base directory for static files
    base_url = request.build_absolute_uri('/')[:-1]  # Remove trailing slash
    static_url = base_url + '/static/'
    
    # Create HTML object with base URL for static files
    html = HTML(string=html_string, base_url=request.build_absolute_uri('/'))
    
    # Write PDF
    html.write_pdf(pdf_buffer)
    pdf_buffer.seek(0)
    
    # Create HTTP response
    response = HttpResponse(pdf_buffer.read(), content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="Quotation-{quotation.quot_number}.pdf"'
    
    return response


def quotation_letterhead(request, pk):
    """
    Generate and return HTML for letterhead printing (no logo, 4cm top margin)
    """
    # Get the quotation with related data
    quotation = get_object_or_404(
        SalesQuotation.objects.select_related(
            'customer', 'created_by'
        ).prefetch_related('items'),
        pk=pk
    )
    
    # Format project description from first 3 item names
    def format_project_description():
        if not quotation.items.exists():
            return 'No items'
        
        items = list(quotation.items.all()[:3])
        item_names = [item.item for item in items if item.item and item.item.strip()]
        
        if not item_names:
            return 'No item names available'
        
        # Remove duplicates while preserving order
        unique_names = []
        for name in item_names:
            if name not in unique_names:
                unique_names.append(name)
        
        if len(unique_names) <= 2:
            return ' & '.join(unique_names)
        else:
            return ', '.join(unique_names[:2]) + ' & ' + unique_names[2]
    
    # Prepare context for template
    context = {
        'quotation': quotation,
        'project_description': format_project_description(),
    }
    
    # Render HTML template for letterhead printing
    html_string = render_to_string('quotations/quotation_letterhead.html', context)
    
    # Return HTML response for Electron printing
    response = HttpResponse(html_string, content_type='text/html')
    return response


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_quotation_email(request, pk):
    """
    Send quotation via email with PDF attachment
    """
    logger.info(f"Email endpoint called for quotation {pk}")
    
    try:
        # Get the quotation
        quotation = get_object_or_404(
            SalesQuotation.objects.select_related('customer', 'created_by'),
            pk=pk
        )
        logger.info(f"Found quotation: {quotation.quot_number}")
        
        # Validate request data
        data = request.data
        logger.info(f"Request data: {data}")
        to_emails = data.get('to_emails', [])
        cc_emails = data.get('cc_emails', [])
        bcc_emails = data.get('bcc_emails', [])
        subject = data.get('subject', '').strip()
        message = data.get('message', '').strip()
        message_html = data.get('message_html', '').strip()
        send_copy_to_sender = data.get('send_copy_to_sender', False)
        logger.info(f"Parsed emails: to={to_emails}, cc={cc_emails}, bcc={bcc_emails}")
        
        # Validation
        if not to_emails:
            return Response(
                {'error': 'At least one recipient email is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not subject:
            return Response(
                {'error': 'Subject is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Validate email addresses
        email_regex = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
        
        all_emails = to_emails + cc_emails + bcc_emails
        invalid_emails = [email for email in all_emails if not email_regex.match(email)]
        
        if invalid_emails:
            return Response(
                {'error': f'Invalid email addresses: {", ".join(invalid_emails)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Trigger Celery task
        
        # Prepare task data
        email_data = {
            'quotation_id': quotation.id,
            'from_email': request.user.email,
            'to_emails': to_emails,
            'cc_emails': cc_emails,
            'bcc_emails': bcc_emails,
            'subject': subject,
            'message': message_html if message_html else message,  # Use HTML version if available
            'send_copy_to_sender': send_copy_to_sender,
            'sender_name': request.user.username or request.user.email,
        }
        
        # Start the email task
        logger.info(f"Starting email task with data: {email_data}")
        task = send_quotation_email_task.delay(email_data)
        logger.info(f"Email task started with ID: {task.id}")
        
        return Response({
            'success': True,
            'message': f'Email is being sent to {len(to_emails)} recipient(s)',
            'task_id': task.id,
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error in send_quotation_email: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return Response(
            {'error': f'Failed to send email: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def print_quotation(request, quotation_id):
    """
    Enhanced API endpoint to create a print job for a quotation via Celery
    Supports custom printer selection and copy count
    """
    try:
        # Get the quotation to ensure it exists and user has access
        quotation = get_object_or_404(SalesQuotation, pk=quotation_id)
        
        # Get optional parameters from request body
        printer_name = request.data.get('printer_name')  # Override printer selection
        copies = request.data.get('copies', 1)  # Number of copies
        
        # Validate copies
        try:
            copies = int(copies)
            if copies < 1 or copies > 99:
                copies = 1
        except (ValueError, TypeError):
            copies = 1
        
        logger.info(f"Creating print job for quotation {quotation.quot_number} by user {request.user.email}")
        if printer_name:
            logger.info(f"Using custom printer: {printer_name}")
        logger.info(f"Print copies: {copies}")
        
        # Queue the enhanced Celery task with printer and copies parameters  
        task = create_quotation_print_job_task.delay(
            quotation.id, 
            request.user.id, 
            printer_name=printer_name, 
            copies=copies
        )
        
        logger.info(f"Print job task queued with ID: {task.id}")
        
        # Don't wait for task completion - let it run asynchronously
        # The frontend will use the task_id to check status if needed
        print_job_id = None  # Will be created by the async task
        
        return Response({
            'success': True,
            'message': f'Print job queued for quotation #{quotation.quot_number}',
            'task_id': task.id,
            'print_job_id': print_job_id,  # Now includes the actual print job ID
            'quotation_number': quotation.quot_number,
            'printer_name': printer_name,
            'copies': copies
        }, status=status.HTTP_200_OK)
        
    except SalesQuotation.DoesNotExist:
        return Response(
            {'error': 'Quotation not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Error creating print job for quotation {quotation_id}: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return Response(
            {'error': f'Failed to create print job: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_share_link(request, pk):
    """
    Generate a secure share link for a quotation
    """
    try:
        # Get the quotation
        quotation = get_object_or_404(SalesQuotation, pk=pk)
        logger.info(f"Generating share link for quotation {quotation.quot_number}")
        
        # Set expiration (default 7 days)
        expires_days = request.data.get('expires_days', 7)
        expires_at = timezone.now() + timedelta(days=expires_days)
        
        # Generate unique token
        token = QuotationShare.generate_token()
        while QuotationShare.objects.filter(token=token).exists():
            token = QuotationShare.generate_token()
        
        # Create share record
        share = QuotationShare.objects.create(
            quotation=quotation,
            token=token,
            expires_at=expires_at,
            created_by=request.user
        )
        
        # Generate the share URL using environment-specific frontend URL
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        share_url = f"{frontend_url}/shared/quotation/{token}"
        
        logger.info(f"Created share link: {share_url}")
        
        return Response({
            'success': True,
            'share_url': share_url,
            'token': token,
            'expires_at': expires_at.isoformat(),
            'expires_days': expires_days
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error generating share link for quotation {pk}: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return Response(
            {'error': f'Failed to generate share link: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_quotation_whatsapp(request, pk):
    """
    Send quotation via WhatsApp with secure share link
    """
    logger.info(f"🔥 WhatsApp endpoint called for quotation {pk}")
    logger.info(f"🔥 Request method: {request.method}")
    logger.info(f"🔥 Request user: {request.user}")
    logger.info(f"🔥 Request data: {request.data}")
    logger.info(f"🔥 Request headers: {dict(request.headers)}")
    
    try:
        # Get the quotation
        logger.info(f"🔥 Getting quotation with pk={pk}")
        quotation = get_object_or_404(
            SalesQuotation.objects.select_related('customer', 'created_by'),
            pk=pk
        )
        logger.info(f"🔥 Found quotation: {quotation.quot_number}")
        
        # Validate request data
        data = request.data
        logger.info(f"🔥 Request data: {data}")
        phone_number = data.get('phone_number', '').strip()
        message = data.get('message', '').strip()
        logger.info(f"🔥 Phone: {phone_number}, Message length: {len(message)}")
        
        # Validation
        if not phone_number:
            return Response(
                {'error': 'Phone number is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate phone number format (basic international format)
        phone_regex = re.compile(r'^\+[1-9]\d{1,14}$')
        if not phone_regex.match(phone_number):
            return Response(
                {'error': 'Invalid phone number format. Please include country code (e.g., +94771234567)'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not message:
            return Response(
                {'error': 'Message is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Check WhatsApp message length limit
        if len(message) > 4096:
            return Response(
                {'error': 'Message too long. WhatsApp limit is 4096 characters.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Prepare task data
        logger.info(f"🔥 Preparing task data...")
        logger.info(f"🔥 Request user: {request.user}, has employee: {hasattr(request.user, 'employee')}")
        
        sender_name = 'PrintCloud Team'  # Default fallback
        try:
            if hasattr(request.user, 'employee') and request.user.employee:
                sender_name = getattr(request.user.employee, 'full_name', None) or request.user.username or 'PrintCloud Team'
            else:
                sender_name = request.user.username or 'PrintCloud Team'
            logger.info(f"🔥 Sender name resolved to: {sender_name}")
        except Exception as e:
            logger.error(f"🔥 Error getting sender name: {e}")
        
        whatsapp_data = {
            'quotation_id': quotation.id,
            'phone_number': phone_number,
            'message': message,
            'sender_name': sender_name,
            'user_id': request.user.id,
        }
        
        # Start the WhatsApp task
        logger.info(f"🔥 Starting WhatsApp task with data: {whatsapp_data}")
        task = send_quotation_whatsapp_task.delay(whatsapp_data)
        logger.info(f"🔥 WhatsApp task started with ID: {task.id}")
        
        logger.info(f"🔥 WhatsApp endpoint completing successfully")
        return Response({
            'success': True,
            'message': f'WhatsApp message is being sent to {phone_number}',
            'task_id': task.id,
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"🔥 CRITICAL ERROR in send_quotation_whatsapp: {str(e)}")
        logger.error(f"🔥 Exception type: {type(e).__name__}")
        logger.error(f"🔥 Full traceback: {traceback.format_exc()}")
        return Response(
            {'error': f'Failed to send WhatsApp message: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def test_whatsapp_api(request):
    """
    Test WhatsApp API connectivity using the same format as Meta's working test command
    """
    logger.info("🔥 WhatsApp API test endpoint called")
    
    try:
        # Get WhatsApp configuration from settings
        whatsapp_config = getattr(settings, 'WHATSAPP_CONFIG', {})
        access_token = whatsapp_config.get('ACCESS_TOKEN')
        phone_number_id = whatsapp_config.get('PHONE_NUMBER_ID')
        api_version = whatsapp_config.get('API_VERSION', 'v22.0')
        
        # Enhanced logging for token validation
        logger.info(f"🔥 Test - API Version: {api_version}")
        logger.info(f"🔥 Test - Phone Number ID: {phone_number_id}")
        logger.info(f"🔥 Test - Access Token (first 20 chars): {access_token[:20] if access_token else 'None'}...")
        
        if not access_token or not phone_number_id:
            return Response({
                'success': False,
                'error': 'WhatsApp configuration incomplete - missing ACCESS_TOKEN or PHONE_NUMBER_ID'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Use the exact same format as Meta's working test command
        api_url = f"https://graph.facebook.com/{api_version}/{phone_number_id}/messages"
        
        # Template message format (exactly like Meta's test)
        payload = {
            "messaging_product": "whatsapp",
            "to": "61429808152",  # Test phone number from requirements
            "type": "template",
            "template": {
                "name": "hello_world",
                "language": {
                    "code": "en_US"
                }
            }
        }
        
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        logger.info(f"🔥 Test API URL: {api_url}")
        logger.info(f"🔥 Test payload: {payload}")
        
        # Send test message
        response = requests.post(
            api_url,
            headers=headers,
            json=payload,
            timeout=30
        )
        
        # Log response details
        logger.info(f"🔥 Test response status: {response.status_code}")
        logger.info(f"🔥 Test response: {response.text}")
        
        if response.status_code == 200:
            response_data = response.json()
            return Response({
                'success': True,
                'message': 'WhatsApp API test successful',
                'api_version': api_version,
                'response': response_data
            }, status=status.HTTP_200_OK)
        else:
            error_response = response.json() if response.headers.get('content-type', '').startswith('application/json') else {'error': response.text}
            return Response({
                'success': False,
                'error': f'WhatsApp API test failed (HTTP {response.status_code})',
                'api_version': api_version,
                'response': error_response
            }, status=status.HTTP_400_BAD_REQUEST)
            
    except Exception as e:
        logger.error(f"🔥 WhatsApp API test error: {str(e)}")
        return Response({
            'success': False,
            'error': f'Test failed: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
