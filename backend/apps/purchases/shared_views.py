import logging
import traceback

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import PurchaseOrderShare
from .tasks import generate_purchase_order_pdf

logger = logging.getLogger(__name__)


@api_view(['GET'])
def shared_purchase_order_detail(request, token):
    """
    Get shared purchase order details by token (public endpoint).
    """
    try:
        share = get_object_or_404(PurchaseOrderShare, token=token)
        purchase_order = share.purchase_order

        logger.info(f"Accessed shared purchase order {purchase_order.po_number} via token {token}")

        share.view_count += 1
        share.last_viewed_at = timezone.now()
        share.save(update_fields=['view_count', 'last_viewed_at'])

        is_expired = share.is_expired

        supplier_data = {
            'name': purchase_order.supplier.name,
            'email': purchase_order.supplier.email,
            'contact': purchase_order.supplier.contact,
        } if purchase_order.supplier else None

        items_data = []
        for item in purchase_order.items.all():
            items_data.append({
                'id': item.id,
                'item': item.item_name,
                'description': item.description,
                'quantity': float(item.quantity) if item.quantity else 0,
                'unit_price': float(item.unit_price) if item.unit_price else 0,
                'amount': float(item.amount) if item.amount else 0,
                'unit_of_measure': item.unit_of_measure,
            })

        response_data = {
            'purchase_order': {
                'id': purchase_order.id,
                'po_number': purchase_order.po_number,
                'order_date': purchase_order.order_date.isoformat() if purchase_order.order_date else None,
                'expected_delivery_date': purchase_order.expected_delivery_date.isoformat() if purchase_order.expected_delivery_date else None,
                'status': purchase_order.status,
                'supplier': supplier_data,
                'delivery_address': purchase_order.delivery_address,
                'supplier_notes': purchase_order.supplier_notes,
                'subtotal': float(purchase_order.subtotal or 0),
                'tax_amount': float(purchase_order.tax_amount or 0),
                'discount_amount': float(purchase_order.discount_amount or 0),
                'total': float(purchase_order.total or 0),
                'items': items_data,
            },
            'token': token,
            'created_at': share.created_at.isoformat(),
            'expires_at': share.expires_at.isoformat(),
            'is_expired': is_expired,
        }

        return Response(response_data, status=status.HTTP_200_OK)

    except PurchaseOrderShare.DoesNotExist:
        logger.warning(f"Purchase order share link not found for token: {token}")
        return Response({'error': 'Share link not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error accessing shared purchase order {token}: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return Response({'error': f'Failed to load purchase order: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def shared_purchase_order_pdf(request, token):
    """
    Generate and return PDF for shared purchase order (public endpoint).
    """
    try:
        share = get_object_or_404(PurchaseOrderShare, token=token)
        purchase_order = share.purchase_order

        logger.info(f"Generating PDF for shared purchase order {purchase_order.po_number} via token {token}")

        if share.is_expired:
            return Response({'error': 'This share link has expired'}, status=status.HTTP_403_FORBIDDEN)

        share.view_count += 1
        share.last_viewed_at = timezone.now()
        share.save(update_fields=['view_count', 'last_viewed_at'])

        pdf_buffer = generate_purchase_order_pdf(purchase_order)

        response = HttpResponse(pdf_buffer.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename=\"Purchase-Order-{purchase_order.po_number}.pdf\"'
        return response

    except PurchaseOrderShare.DoesNotExist:
        logger.warning(f"Purchase order share link not found for token: {token}")
        return Response({'error': 'Share link not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error generating PDF for shared purchase order {token}: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return Response({'error': f'Failed to generate PDF: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
