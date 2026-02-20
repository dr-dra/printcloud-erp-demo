import logging
import traceback

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import OrderShare

logger = logging.getLogger(__name__)


@api_view(['GET'])
def shared_order_detail(request, token):
    """
    Get shared order details by token (public endpoint).
    """
    try:
        share = get_object_or_404(OrderShare, token=token)
        order = share.order

        logger.info(f"Accessed shared order {order.order_number} via token {token}")

        share.view_count += 1
        share.last_viewed_at = timezone.now()
        share.save(update_fields=['view_count', 'last_viewed_at'])

        is_expired = share.is_expired

        customer_data = None
        if order.customer:
            customer_data = {
                'name': order.customer.name,
                'email': order.customer.email,
                'contact': order.customer.contact,
            }

        items_data = []
        for item in order.items.all():
            items_data.append({
                'id': item.id,
                'item': item.item_name,
                'description': item.description,
                'quantity': item.quantity,
                'unit_price': float(item.unit_price) if item.unit_price else 0,
                'amount': float(item.amount) if item.amount else 0,
            })

        response_data = {
            'order': {
                'id': order.id,
                'order_number': order.order_number,
                'order_date': order.order_date.isoformat() if order.order_date else None,
                'required_date': order.required_date.isoformat() if order.required_date else None,
                'status': order.status,
                'customer': customer_data,
                'project_name': order.project_name,
                'notes': order.customer_notes,
                'subtotal': float(order.subtotal or 0),
                'discount': float(order.discount or 0),
                'delivery_charge': float(order.delivery_charge or 0),
                'vat_amount': float(order.vat_amount or 0),
                'net_total': float(order.net_total or 0),
                'items': items_data,
            },
            'token': token,
            'created_at': share.created_at.isoformat(),
            'expires_at': share.expires_at.isoformat(),
            'is_expired': is_expired,
        }

        return Response(response_data, status=status.HTTP_200_OK)

    except OrderShare.DoesNotExist:
        logger.warning(f"Order share link not found for token: {token}")
        return Response({'error': 'Share link not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error accessing shared order {token}: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return Response({'error': f'Failed to load order: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
