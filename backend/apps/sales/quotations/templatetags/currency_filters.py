"""
Template filters for currency formatting in Indian numbering system
"""

from django import template
from decimal import Decimal, ROUND_HALF_UP

register = template.Library()


@register.filter
def indian_number_format(value):
    """
    Formats a number to Indian numbering system (lakhs and crores)
    Example: 1234567 becomes "12,34,567"
    """
    if value is None:
        return "0"
    
    try:
        # Convert to float first, then to string to handle decimals
        num = float(value)
        num_str = str(int(abs(num)))  # Get integer part only for formatting
        is_negative = num < 0
        
        if len(num_str) <= 3:
            return f"-{num_str}" if is_negative else num_str
        
        result = ""
        count = 0
        
        # Process from right to left
        for i in range(len(num_str) - 1, -1, -1):
            if count == 3 or (count > 3 and (count - 3) % 2 == 0):
                result = "," + result
            result = num_str[i] + result
            count += 1
        
        return f"-{result}" if is_negative else result
        
    except (ValueError, TypeError):
        return str(value)


@register.filter
def indian_currency_format(value):
    """
    Formats currency in Indian format with Rs. prefix
    """
    if value is None:
        return "Rs. 0.00"
    
    try:
        # Ensure we have a proper decimal with 2 places
        decimal_value = Decimal(str(value)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        # Split into integer and decimal parts
        integer_part = int(decimal_value)
        decimal_part = str(decimal_value).split('.')[1] if '.' in str(decimal_value) else "00"
        
        # Format the integer part using Indian numbering
        formatted_integer = indian_number_format(integer_part)
        
        return f"Rs. {formatted_integer}.{decimal_part.ljust(2, '0')}"
        
    except (ValueError, TypeError, Exception):
        return f"Rs. {value}"


@register.filter
def subtract(value, arg):
    """
    Subtracts arg from value
    """
    try:
        return float(value) - float(arg)
    except (ValueError, TypeError):
        return value


@register.filter
def primary_address(addresses):
    """
    Gets the primary address (billing preferred, or first available)
    """
    if not addresses:
        return None

    # Handle Django RelatedManager (convert to list)
    if hasattr(addresses, 'all'):
        addresses_list = addresses.all()
    else:
        addresses_list = addresses

    if not addresses_list:
        return None

    # Try to find billing address first
    for address in addresses_list:
        if hasattr(address, 'type') and address.type == 'billing':
            return address

    # Return first address if no billing found
    return addresses_list[0] if addresses_list else None


@register.filter
def items_subtotal(items):
    """
    Calculate the subtotal by summing all item prices
    """
    if not items:
        return Decimal('0.00')

    try:
        # Handle Django RelatedManager
        if hasattr(items, 'all'):
            items_list = items.all()
        else:
            items_list = items

        total = Decimal('0.00')
        for item in items_list:
            if hasattr(item, 'price') and item.price is not None:
                total += Decimal(str(item.price))

        return total
    except (ValueError, TypeError, Exception):
        return Decimal('0.00')