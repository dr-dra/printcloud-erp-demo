import logging
import traceback

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import InvoiceShare
from .tasks import generate_invoice_pdf

logger = logging.getLogger(__name__)


@api_view(['GET'])
def shared_invoice_detail(request, token):
    """
    Get shared invoice details by token (public endpoint).
    """
    try:
        share = get_object_or_404(InvoiceShare, token=token)
        invoice = share.invoice

        logger.info(f"Accessed shared invoice {invoice.invoice_number} via token {token}")

        share.view_count += 1
        share.last_viewed_at = timezone.now()
        share.save(update_fields=['view_count', 'last_viewed_at'])

        is_expired = share.is_expired

        customer_data = None
        if invoice.customer:
            customer_data = {
                'name': invoice.customer.name,
                'email': invoice.customer.email,
                'contact': invoice.customer.contact,
            }

        items_data = []
        for item in invoice.items.all():
            items_data.append({
                'id': item.id,
                'item': item.item_name,
                'description': item.description,
                'quantity': float(item.quantity) if item.quantity else 0,
                'unit_price': float(item.unit_price) if item.unit_price else 0,
                'amount': float(item.amount) if item.amount else 0,
            })

        response_data = {
            'invoice': {
                'id': invoice.id,
                'invoice_number': invoice.invoice_number,
                'invoice_type': invoice.invoice_type,
                'invoice_date': invoice.invoice_date.isoformat() if invoice.invoice_date else None,
                'due_date': invoice.due_date.isoformat() if invoice.due_date else None,
                'status': invoice.status,
                'customer': customer_data,
                'po_so_number': invoice.po_so_number,
                'notes': invoice.customer_notes,
                'subtotal': float(invoice.subtotal or 0),
                'discount': float(invoice.discount or 0),
                'tax_amount': float(invoice.tax_amount or 0),
                'net_total': float(invoice.net_total or 0),
                'items': items_data,
            },
            'token': token,
            'created_at': share.created_at.isoformat(),
            'expires_at': share.expires_at.isoformat(),
            'is_expired': is_expired,
        }

        return Response(response_data, status=status.HTTP_200_OK)

    except InvoiceShare.DoesNotExist:
        logger.warning(f"Invoice share link not found for token: {token}")
        return Response({'error': 'Share link not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error accessing shared invoice {token}: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return Response({'error': f'Failed to load invoice: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def shared_invoice_pdf(request, token):
    """
    Generate and return PDF for shared invoice (public endpoint).
    """
    try:
        share = get_object_or_404(InvoiceShare, token=token)
        invoice = share.invoice

        logger.info(f"Generating PDF for shared invoice {invoice.invoice_number} via token {token}")

        if share.is_expired:
            return Response({'error': 'This share link has expired'}, status=status.HTTP_403_FORBIDDEN)

        share.view_count += 1
        share.last_viewed_at = timezone.now()
        share.save(update_fields=['view_count', 'last_viewed_at'])

        pdf_buffer = generate_invoice_pdf(invoice)

        response = HttpResponse(pdf_buffer.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="Invoice-{invoice.invoice_number}.pdf"'
        return response

    except InvoiceShare.DoesNotExist:
        logger.warning(f"Invoice share link not found for token: {token}")
        return Response({'error': 'Share link not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error generating PDF for shared invoice {token}: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return Response({'error': f'Failed to generate PDF: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
