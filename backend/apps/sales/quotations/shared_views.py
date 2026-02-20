import logging
import traceback
from io import BytesIO

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.template.loader import render_to_string
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from weasyprint import HTML

from .models import QuotationShare

logger = logging.getLogger(__name__)


@api_view(['GET'])
def shared_quotation_detail(request, token):
    """
    Get shared quotation details by token (public endpoint)
    """
    try:
        # Get the share link
        share = get_object_or_404(QuotationShare, token=token)
        quotation = share.quotation
        
        logger.info(f"Accessed shared quotation {quotation.quot_number} via token {token}")
        
        # Update access tracking
        share.view_count += 1
        share.last_viewed_at = timezone.now()
        share.save()
        
        # Check if expired
        is_expired = share.is_expired
        
        # Prepare customer data
        customer_data = None
        if quotation.customer:
            # Format address from customer addresses
            address_text = None
            if quotation.customer.addresses.exists():
                primary_address = quotation.customer.addresses.first()
                address_parts = [primary_address.line1]
                if primary_address.line2:
                    address_parts.append(primary_address.line2)
                address_parts.append(primary_address.city)
                if primary_address.province:
                    address_parts.append(primary_address.province)
                if primary_address.country and primary_address.country != 'Sri Lanka':
                    address_parts.append(primary_address.country)
                address_text = ', '.join(address_parts)
            
            customer_data = {
                'name': quotation.customer.name,
                'email': quotation.customer.email,
                'contact': quotation.customer.contact,
                'address': address_text,
            }
        
        # Prepare items data
        items_data = []
        if quotation.items.exists():
            for item in quotation.items.all():
                items_data.append({
                    'id': item.id,
                    'item': item.item,
                    'description': item.description,
                    'quantity': item.quantity,
                    'unit_price': float(item.unit_price) if item.unit_price else 0,
                    'price': float(item.price) if item.price else 0,
                })
        
        # Response data
        response_data = {
            'quotation': {
                'id': quotation.id,
                'quot_number': quotation.quot_number,
                'costing_name': quotation.costing.project_name if quotation.costing else None,
                'customer': customer_data,
                'date': quotation.date.isoformat() if quotation.date else None,
                'required_date': quotation.required_date.isoformat() if quotation.required_date else None,
                'terms': quotation.terms,
                'notes': quotation.notes,
                'delivery_charge': float(quotation.delivery_charge),
                'discount': float(quotation.discount),
                'total': float(quotation.total),
                'items': items_data,
                'show_subtotal': quotation.show_subtotal,
                'show_delivery_charges': quotation.show_delivery_charges,
            },
            'token': token,
            'created_at': share.created_at.isoformat(),
            'expires_at': share.expires_at.isoformat(),
            'is_expired': is_expired,
        }
        
        return Response(response_data, status=status.HTTP_200_OK)
        
    except QuotationShare.DoesNotExist:
        logger.warning(f"Share link not found for token: {token}")
        return Response(
            {'error': 'Share link not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Error accessing shared quotation {token}: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return Response(
            {'error': f'Failed to load quotation: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def shared_quotation_pdf(request, token):
    """
    Generate and return PDF for shared quotation (public endpoint)
    """
    try:
        # Get the share link
        share = get_object_or_404(QuotationShare, token=token)
        quotation = share.quotation
        
        logger.info(f"Generating PDF for shared quotation {quotation.quot_number} via token {token}")
        
        # Check if expired
        if share.is_expired:
            return Response(
                {'error': 'This share link has expired'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Update access tracking
        share.view_count += 1
        share.last_viewed_at = timezone.now()
        share.save()
        
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
        
        # Create HTML object with base URL for static files
        html = HTML(string=html_string, base_url=request.build_absolute_uri('/'))
        
        # Write PDF
        html.write_pdf(pdf_buffer)
        pdf_buffer.seek(0)
        
        # Create HTTP response
        response = HttpResponse(pdf_buffer.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="Quotation-{quotation.quot_number}.pdf"'
        
        return response
        
    except QuotationShare.DoesNotExist:
        logger.warning(f"Share link not found for token: {token}")
        return Response(
            {'error': 'Share link not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Error generating PDF for shared quotation {token}: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return Response(
            {'error': f'Failed to generate PDF: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
