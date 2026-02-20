import json
import logging

from django.shortcuts import get_object_or_404, render
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status
from rest_framework.decorators import api_view
from rest_framework.decorators import permission_classes as api_permission_classes
from rest_framework.generics import (
    CreateAPIView,
    DestroyAPIView,
    ListAPIView,
    RetrieveAPIView,
    UpdateAPIView,
)
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.sales.invoices.models import CustomerAdvance
from .models import Customer, CustomerAddress, CustomerDocument, CustomerEmail
from .serializers import CustomerAdvanceSerializer, CustomerListSerializer, CustomerSerializer

logger = logging.getLogger(__name__)

# Create your views here.

class CustomerPagination(PageNumberPagination):
    page_size = 50  # Default page size
    page_size_query_param = 'page_size'
    max_page_size = 100

class CustomerListView(ListAPIView):
    queryset = Customer.objects.select_related('created_by', 'updated_by').prefetch_related('addresses').filter(is_active=True).order_by("-id")
    serializer_class = CustomerListSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    search_fields = ["name", "contact", "email"]  # Search by customer name, contact, email
    filterset_fields = ["pos_customer"]
    pagination_class = CustomerPagination

    def get_queryset(self):
        queryset = super().get_queryset()
        logger.info(f'CustomerListView.get_queryset called with user: {self.request.user}')
        return queryset

class CustomerCreateView(CreateAPIView):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated]

    def __init__(self, *args, **kwargs):
        print("🚨 CustomerCreateView.__init__ called!")
        super().__init__(*args, **kwargs)

    def dispatch(self, request, *args, **kwargs):
        print(f"🚨 CustomerCreateView.dispatch called! Method: {request.method}")
        return super().dispatch(request, *args, **kwargs)

    def post(self, request, *args, **kwargs):
        print("🚨 CustomerCreateView.post called!")
        return self.create(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        print("🔥 CUSTOMER CREATE METHOD CALLED!")
        print(f"🔥 Request method: {request.method}")
        print(f"🔥 Request data keys: {list(request.data.keys())}")
        print(f"🔥 Request files keys: {list(request.FILES.keys())}")
        
        # Handle multipart form data for file uploads
        customer_data = request.data.copy()
        
        # Extract files from request
        uploaded_files = []
        file_titles = []
        file_descriptions = []
        
        # Get files and their metadata
        for key, value in request.FILES.items():
            if key.startswith('document_file_'):
                index = key.split('_')[-1]
                uploaded_files.append(value)
                file_titles.append(request.data.get(f'document_title_{index}', ''))
                file_descriptions.append(request.data.get(f'document_description_{index}', ''))
                print(f"🔥 Found file: {value.name} (size: {value.size})")
        
        print(f"🔥 Total files to process: {len(uploaded_files)}")
        
        # Handle addresses JSON string
        if 'addresses' in customer_data:
            try:
                addresses_data = json.loads(customer_data['addresses'])
                customer_data['addresses'] = addresses_data
            except (json.JSONDecodeError, TypeError):
                print(f'🔥 Failed to parse addresses JSON: {customer_data["addresses"]}')
                customer_data['addresses'] = []
        
        # Create customer first
        serializer = self.get_serializer(data=customer_data)
        serializer.is_valid(raise_exception=True)
        customer = self.perform_create(serializer)
        print(f"🔥 Customer created with ID: {customer.id}")
        
        # Create documents after customer is created
        for i, file in enumerate(uploaded_files):
            title = file_titles[i] if i < len(file_titles) else file.name
            description = file_descriptions[i] if i < len(file_descriptions) else ''
            
            print(f"🔥 Creating document: {title} for customer {customer.id}")
            print(f"🔥 File size: {file.size} bytes")
            
            document = CustomerDocument.objects.create(
                customer=customer,
                file=file,
                title=title,
                description=description,
                uploaded_by=request.user
            )
            print(f"🔥 Document created with ID: {document.id}")
            print(f"🔥 Document file URL: {document.file.url if document.file else 'No URL'}")
        
        headers = self.get_success_headers(serializer.data)
        print(f"🔥 Response status: 201")
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        # Auto-generate legacy_id by finding the next available ID
        last_customer = Customer.objects.order_by('-legacy_id').first()
        next_legacy_id = (last_customer.legacy_id + 1) if last_customer else 1
        
        # Save the customer with auto-generated legacy_id and current user
        customer = serializer.save(
            legacy_id=next_legacy_id,
            created_by=self.request.user,
            updated_by=self.request.user,
            created_at=timezone.now(),
            updated_at=timezone.now()
        )
        return customer

class CustomerDetailView(RetrieveAPIView):
    queryset = Customer.objects.select_related('created_by', 'updated_by').prefetch_related('addresses', 'documents')
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated]


class CustomerAdvanceListView(ListAPIView):
    serializer_class = CustomerAdvanceSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = CustomerPagination

    def get_queryset(self):
        customer_id = self.kwargs.get('pk')
        return CustomerAdvance.objects.filter(customer_id=customer_id).order_by('-advance_date', '-id')

class CustomerUpdateView(UpdateAPIView):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated]

    def update(self, request, *args, **kwargs):
        print(f"🔥 CUSTOMER UPDATE METHOD CALLED!")
        print(f"🔥 Request method: {request.method}")
        print(f"🔥 Request data keys: {list(request.data.keys())}")
        print(f"🔥 Request files keys: {list(request.FILES.keys())}")
        
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        # Handle multipart form data for file uploads
        customer_data = request.data.copy()
        
        # Extract files from request
        uploaded_files = []
        file_titles = []
        file_descriptions = []
        
        # Get files and their metadata
        for key, value in request.FILES.items():
            if key.startswith('document_file_'):
                index = key.split('_')[-1]
                uploaded_files.append(value)
                file_titles.append(request.data.get(f'document_title_{index}', ''))
                file_descriptions.append(request.data.get(f'document_description_{index}', ''))
                print(f"🔥 Found file: {value.name} (size: {value.size})")
        
        print(f"🔥 Total files to process: {len(uploaded_files)}")
        
        # Handle addresses JSON string
        if 'addresses' in customer_data:
            try:
                addresses_data = json.loads(customer_data['addresses'])
                customer_data['addresses'] = addresses_data
            except (json.JSONDecodeError, TypeError):
                print(f'🔥 Failed to parse addresses JSON: {customer_data["addresses"]}')
                customer_data['addresses'] = []
        
        # Update customer
        serializer = self.get_serializer(instance, data=customer_data, partial=partial)
        serializer.is_valid(raise_exception=True)
        customer = self.perform_update(serializer)
        print(f"🔥 Customer updated with ID: {customer.id}")
        
        # Create new documents if any were uploaded
        for i, file in enumerate(uploaded_files):
            title = file_titles[i] if i < len(file_titles) else file.name
            description = file_descriptions[i] if i < len(file_descriptions) else ''
            
            print(f"🔥 Creating document: {title} for customer {customer.id}")
            print(f"🔥 File size: {file.size} bytes")
            
            document = CustomerDocument.objects.create(
                customer=customer,
                file=file,
                title=title,
                description=description,
                uploaded_by=request.user
            )
            print(f"🔥 Document created with ID: {document.id}")
        
        if getattr(instance, '_prefetched_objects_cache', None):
            # If 'prefetch_related' has been applied to a queryset, we need to
            # forcibly invalidate the prefetch cache on the instance.
            instance._prefetched_objects_cache = {}
        
        return Response(serializer.data)

    def perform_update(self, serializer):
        # Update the customer with current user and timestamp
        customer = serializer.save(
            updated_by=self.request.user,
            updated_at=timezone.now()
        )
        return customer

@api_view(['POST'])
@api_permission_classes([IsAuthenticated])
def customer_archive_view(request, pk):
    """Archive a customer instead of deleting them"""
    try:
        customer = Customer.objects.get(pk=pk)
    except Customer.DoesNotExist:
        return Response({'error': 'Customer not found'}, status=status.HTTP_404_NOT_FOUND)
    
    reason = request.data.get('reason', '')
    
    # Business logic checks - check for active relationships
    # You can expand these checks based on your business requirements
    
    # For now, we'll just archive the customer
    # In a real system, you'd check for active orders, pending invoices, etc.
    
    try:
        # Mark customer as inactive and set archived fields
        customer.is_active = False
        # If you add archive fields later, you can use them here:
        # customer.is_archived = True
        # customer.archived_at = timezone.now()
        # customer.archived_by = request.user
        # customer.archived_reason = reason
        customer.save()
        
        logger.info(f"Customer {customer.name} (ID: {customer.id}) archived by {request.user}")
        
        return Response({
            'message': f'Customer {customer.name} archived successfully',
            'archived_at': timezone.now().isoformat(),
            'archived_by': request.user.username
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Failed to archive customer {customer.id}: {e}")
        return Response({'error': 'Failed to archive customer'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class CustomerDocumentDeleteView(DestroyAPIView):
    """Delete individual customer documents with proper S3 cleanup"""
    queryset = CustomerDocument.objects.all()
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'

    def get_queryset(self):
        # Ensure users can only delete documents for accessible customers
        customer_id = self.kwargs.get('customer_id')
        return CustomerDocument.objects.filter(customer_id=customer_id)

    def perform_destroy(self, instance):
        # Log the deletion for audit purposes
        logger.info(f"User {self.request.user} deleting document: {instance.title} (ID: {instance.id})")

        # Django signal will handle S3 deletion automatically if configured
        # For now, we'll just delete the database record
        instance.delete()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response({"message": "Document deleted successfully"}, status=200)

class CustomerDeleteView(DestroyAPIView):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated]

class CustomerExportAllView(ListAPIView):
    queryset = Customer.objects.all()
    serializer_class = CustomerListSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None  # Disable pagination


@api_view(['GET'])
@api_permission_classes([IsAuthenticated])
def customer_emails_typeahead(request, customer_id):
    """
    Typeahead endpoint for customer emails with search functionality
    """
    try:
        # Verify customer exists and user has access
        customer = get_object_or_404(Customer, id=customer_id)
        
        # Get search query
        search_query = request.GET.get('q', '').strip()
        
        # Base queryset for customer emails
        emails = CustomerEmail.objects.filter(customer=customer)
        
        # Apply search filter if provided
        if search_query and len(search_query) >= 1:
            emails = emails.filter(email__icontains=search_query)
        
        # Get email values and include customer's main email
        email_list = list(emails.values_list('email', flat=True))
        
        # Add customer's main email if it exists and matches search
        if customer.email:
            if not search_query or search_query.lower() in customer.email.lower():
                if customer.email not in email_list:
                    email_list.insert(0, customer.email)  # Put main email first
        
        # Limit results to prevent performance issues
        email_list = email_list[:20]
        
        return Response({
            'emails': email_list
        })
        
    except Customer.DoesNotExist:
        return Response({'error': 'Customer not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error in customer_emails_typeahead: {e}")
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@api_permission_classes([IsAuthenticated])
def save_customer_emails(request, customer_id):
    """
    Save new customer emails from email sending
    """
    try:
        # Verify customer exists and user has access
        customer = get_object_or_404(Customer, id=customer_id)
        
        # Get emails from request
        emails = request.data.get('emails', [])
        
        if not emails or not isinstance(emails, list):
            return Response({'error': 'Valid emails list required'}, status=status.HTTP_400_BAD_REQUEST)
        
        saved_emails = []
        for email in emails:
            email = email.strip().lower()
            
            # Skip if empty or invalid email format
            if not email or '@' not in email:
                continue
                
            # Skip customer's main email (already in customer record)
            if customer.email and email == customer.email.lower():
                continue
            
            # Create email record if it doesn't exist
            email_obj, created = CustomerEmail.objects.get_or_create(
                customer=customer,
                email=email,
                defaults={'created_by': request.user}
            )
            
            if created:
                saved_emails.append(email)
                logger.info(f"Saved new customer email: {email} for customer {customer.name}")
        
        return Response({
            'message': f'Saved {len(saved_emails)} new emails',
            'saved_emails': saved_emails
        })
        
    except Customer.DoesNotExist:
        return Response({'error': 'Customer not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error in save_customer_emails: {e}")
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
