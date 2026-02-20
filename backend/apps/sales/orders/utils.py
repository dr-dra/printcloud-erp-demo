"""
Utility functions for order operations including receipt PDF generation.
"""

from decimal import Decimal
from weasyprint import HTML
from django.template.loader import render_to_string
from django.conf import settings
from io import BytesIO
import logging
import qrcode
from qrcode.image import svg

logger = logging.getLogger(__name__)


def format_project_description(items):
    """
    Format project description from first 3 item names.
    """
    if not items:
        return None

    item_names = []
    for item in list(items)[:3]:
        name = getattr(item, 'item_name', None)
        if name and str(name).strip():
            item_names.append(str(name).strip())

    if not item_names:
        return None

    unique_names = []
    for name in item_names:
        if name not in unique_names:
            unique_names.append(name)

    if len(unique_names) <= 2:
        return ' & '.join(unique_names)

    return ', '.join(unique_names[:2]) + ' & ' + unique_names[2]


def number_to_words(amount):
    """
    Convert number to words for receipt.
    Example: 3705.50 -> "three thousand, seven hundred five and fifty cents"
    """
    try:
        # Split into rupees and cents
        rupees = int(amount)
        cents = int((amount - rupees) * 100)

        # Number to words mapping
        ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]
        teens = ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
                 "sixteen", "seventeen", "eighteen", "nineteen"]
        tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]

        def convert_below_thousand(num):
            """Convert numbers below 1000 to words"""
            if num == 0:
                return ""
            elif num < 10:
                return ones[num]
            elif num < 20:
                return teens[num - 10]
            elif num < 100:
                return tens[num // 10] + (" " + ones[num % 10] if num % 10 != 0 else "")
            else:
                return ones[num // 100] + " hundred" + (" " + convert_below_thousand(num % 100) if num % 100 != 0 else "")

        def convert_to_words(num):
            """Convert full number to words"""
            if num == 0:
                return "zero"

            # Handle millions
            if num >= 1000000:
                millions = num // 1000000
                remainder = num % 1000000
                result = convert_below_thousand(millions) + " million"
                if remainder > 0:
                    result += " " + convert_to_words(remainder)
                return result

            # Handle thousands
            if num >= 1000:
                thousands = num // 1000
                remainder = num % 1000
                result = convert_below_thousand(thousands) + " thousand"
                if remainder > 0:
                    result += ", " + convert_below_thousand(remainder)
                return result

            return convert_below_thousand(num)

        # Convert rupees to words
        words = convert_to_words(rupees)

        # Add cents if present
        if cents > 0:
            words += f" and {convert_to_words(cents)} cents"

        return words.strip()

    except Exception as e:
        logger.error(f"Error converting number to words: {e}")
        return f"{amount:.2f}"


def generate_qr_code_svg(receipt_number):
    """
    Generate QR code as SVG string linking to receipt viewing page.
    QR code links to: printcloud.cc/r/[receipt_number]
    """
    try:
        # Create URL for the QR code
        qr_url = f"https://printcloud.cc/r/{receipt_number}"

        # Generate QR code with SVG format (vector-based, sharp printing)
        factory = svg.SvgPathImage
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=2,
            image_factory=factory,
        )
        qr.add_data(qr_url)
        qr.make(fit=True)

        # Generate SVG image
        img = qr.make_image(fill_color="black", back_color="white")

        # Convert to string
        svg_buffer = BytesIO()
        img.save(svg_buffer)
        qr_svg = svg_buffer.getvalue().decode('utf-8')

        logger.info(f"Generated QR code for receipt {receipt_number}")
        return qr_svg

    except Exception as e:
        logger.error(f"Error generating QR code for receipt {receipt_number}: {e}")
        return ""


def generate_order_receipt_pdf(payment_id, include_company_details=True):
    """
    Generate receipt PDF for an order payment (Advance Receipt).
    Returns: BytesIO object containing PDF
    """
    try:
        from .models import OrderPayment

        payment = OrderPayment.objects.select_related(
            'order__customer',
            'created_by',
            'deposit_account',
            'cheque_deposit_account'
        ).get(id=payment_id)

        # Ensure receipt number is generated
        if not payment.receipt_number:
            payment.generate_receipt_number()

        order = payment.order

        project_description = order.project_name or format_project_description(order.items.all())

        # Convert amount to words
        amount_in_words = number_to_words(float(payment.amount))

        # Generate QR code (vector SVG for sharp printing)
        qr_code_svg = generate_qr_code_svg(payment.receipt_number)

        # Company details (from settings or hardcoded)
        company = {
            'name': getattr(settings, 'COMPANY_NAME', 'Kandy Offset Printers (Pvt) Ltd'),
            'address': getattr(settings, 'COMPANY_ADDRESS', 'No 947 Peradeniya road Kandy'),
            'phone': getattr(settings, 'COMPANY_PHONE', '0814946426'),
            'email': getattr(settings, 'COMPANY_EMAIL', 'info@printsrilanka.com'),
        }
        frontend_url = getattr(settings, 'FRONTEND_URL', None)
        logo_url = f"{frontend_url}/images/Logo.svg" if frontend_url else None

        # Render HTML template
        template_name = (
            'orders/order_receipt_email.html'
            if include_company_details
            else 'orders/order_receipt_print.html'
        )
        html_string = render_to_string(template_name, {
            'payment': payment,
            'order': order,
            'company': company,
            'amount_in_words': amount_in_words,
            'qr_code_svg': qr_code_svg,
            'project_description': project_description,
            'include_company_details': include_company_details,
            'logo_url': logo_url,
        })

        # Generate PDF
        html = HTML(string=html_string)
        pdf_buffer = BytesIO()
        html.write_pdf(pdf_buffer)
        pdf_buffer.seek(0)

        logger.info(f"Generated order receipt PDF for payment {payment_id}")
        return pdf_buffer

    except Exception as e:
        logger.error(f"Error generating order receipt PDF: {e}", exc_info=True)
        raise
