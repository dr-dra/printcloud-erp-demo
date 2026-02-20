"""
Celery tasks for POS receipt printing and cash drawer control.
"""

from celery import shared_task
import base64
import logging
from decimal import Decimal
from django.contrib.auth import get_user_model

from .models import POSTransaction
from printcloudclient.models import PrintJob

User = get_user_model()
logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def print_pos_receipt_task(self, transaction_id, user_id, printer_name=None, open_drawer=True):
    """
    Celery task to create receipt print job for POS transaction.

    Args:
        transaction_id: POSTransaction ID
        user_id: User performing the print
        printer_name: Optional specific printer (otherwise use user's POS printer preference)
        open_drawer: Whether to include cash drawer kick command

    Returns:
        dict: Success status, print job ID, and receipt number
    """
    try:
        # Get transaction with related data
        transaction = POSTransaction.objects.select_related(
            'customer', 'location', 'created_by', 'cash_drawer_session'
        ).prefetch_related('items', 'payments').get(pk=transaction_id)

        # Get user for printer preferences
        user = User.objects.get(pk=user_id)

        # Generate ESC/POS receipt data
        receipt_bytes = generate_escpos_receipt(transaction, open_drawer=open_drawer)

        # Log receipt preview for debugging (convert printable characters to text)
        try:
            preview = receipt_bytes.decode('utf-8', errors='ignore')
            logger.info(f'Receipt preview for {transaction.receipt_number}:\n{preview}')
        except:
            logger.info(f'Generated {len(receipt_bytes)} bytes of ESC/POS data for {transaction.receipt_number}')

        # Convert to base64
        base64_data = base64.b64encode(receipt_bytes).decode('utf-8')

        # Determine target printer - use custom printer if specified, otherwise user's default POS printer
        target_printer_name = printer_name or user.default_pos_printer

        # Create print job for PrintCloudClient
        # PrintCloudClient will send raw ESC/POS data to the thermal/POS printer
        print_job = PrintJob.objects.create(
            user=user,
            target_printer_name=target_printer_name or '',
            fallback_printer_names=[],  # Let PrintCloudClient handle fallbacks
            document_type='receipt',  # Important: This tells PrintCloudClient to use ProcessReceiptJob
            print_data=base64_data,
            copies=1,
            status='pending'
        )

        logger.info(
            f'Receipt print job {print_job.id} created for transaction {transaction.receipt_number} '
            f'(printer: {target_printer_name or "not specified"})'
        )

        return {
            'success': True,
            'message': 'Receipt print job created successfully',
            'print_job_id': str(print_job.id),
            'receipt_number': transaction.receipt_number,
            'printer_name': target_printer_name
        }

    except Exception as exc:
        logger.error(f'Error creating receipt print job: {str(exc)}')
        if self.request.retries < self.max_retries:
            raise self.retry(countdown=60 * (self.request.retries + 1), exc=exc)
        return {
            'success': False,
            'error': str(exc),
            'transaction_id': transaction_id
        }


@shared_task(bind=True, max_retries=3)
def open_cash_drawer_task(self, user_id, printer_name=None):
    """
    Open cash drawer without printing receipt.
    Sends only the ESC/POS drawer kick command.

    Args:
        user_id: User performing the action
        printer_name: Optional specific printer (otherwise use user's POS printer preference)

    Returns:
        dict: Success status and print job ID
    """
    try:
        user = User.objects.get(pk=user_id)

        # Generate ONLY cash drawer kick command
        drawer_commands = bytearray()
        drawer_commands.extend(b'\x1B\x40')  # Initialize printer
        drawer_commands.extend(b'\x1B\x70\x00\x19\xFA')  # Kick drawer

        # Convert to base64
        base64_data = base64.b64encode(bytes(drawer_commands)).decode('utf-8')

        # Determine target printer - use custom printer if specified, otherwise user's default POS printer
        target_printer_name = printer_name or user.default_pos_printer

        # Create minimal print job for drawer kick
        # PrintCloudClient will send raw ESC/POS drawer command to the thermal/POS printer
        print_job = PrintJob.objects.create(
            user=user,
            target_printer_name=target_printer_name or '',
            fallback_printer_names=[],  # Let PrintCloudClient handle fallbacks
            document_type='receipt',  # Use receipt type for POS printer processing
            print_data=base64_data,
            copies=1,
            status='pending'
        )

        logger.info(
            f'Cash drawer kick job {print_job.id} created for user {user.email} '
            f'(printer: {target_printer_name or "not specified"})'
        )

        return {
            'success': True,
            'message': 'Cash drawer kick command sent to PrintCloudClient',
            'print_job_id': str(print_job.id),
            'printer_name': target_printer_name
        }

    except Exception as exc:
        logger.error(f'Error creating drawer kick job: {str(exc)}')
        if self.request.retries < self.max_retries:
            raise self.retry(countdown=60 * (self.request.retries + 1), exc=exc)
        return {
            'success': False,
            'error': str(exc)
        }


def generate_escpos_receipt(transaction, open_drawer=True):
    """
    Generate ESC/POS commands for 80mm thermal receipt.

    Args:
        transaction: POSTransaction object with items, payments, customer
        open_drawer: Include cash drawer kick command

    Returns:
        bytes: Complete ESC/POS command sequence
    """
    commands = bytearray()

    # Initialize printer
    commands.extend(b'\x1B\x40')  # ESC @ - Initialize

    # === HEADER ===
    commands.extend(b'\x1B\x61\x01')  # Center align
    commands.extend(b'\x1B\x45\x01')  # Bold ON
    commands.extend(b'KANDY OFFSET PRINTERS LTD.\n')
    commands.extend(b'\x1B\x45\x00')  # Bold OFF

    # Address and phone (centered)
    commands.extend(b'947, Peradeniya Road Kandy\n')
    commands.extend(b'Tel: 0812389880\n')
    commands.extend(b'\n')

    # === SEPARATOR ===
    commands.extend(b'\x1B\x61\x00')  # Left align
    commands.extend(b'-' * 42 + b'\n\n')

    # === TRANSACTION INFO ===
    receipt_line = f'Receipt #: {transaction.receipt_number}\n'
    commands.extend(receipt_line.encode('utf-8'))

    date_line = f'Date: {transaction.transaction_date.strftime("%Y-%m-%d %H:%M:%S")}\n'
    commands.extend(date_line.encode('utf-8'))

    cashier_line = f'Cashier: {transaction.created_by.email}\n'
    commands.extend(cashier_line.encode('utf-8'))

    if transaction.customer:
        customer_line = f'Customer: {transaction.customer.name}\n'
        commands.extend(customer_line.encode('utf-8'))

    commands.extend(b'\n' + b'-' * 42 + b'\n\n')

    # === LINE ITEMS ===
    for item in transaction.items.all():
        # Item name with quantity (max 38 chars to leave space for "x##")
        item_name = item.item_name[:36] if len(item.item_name) > 36 else item.item_name
        item_line = f'{item_name} x{item.quantity}\n'
        commands.extend(item_line.encode('utf-8'))

        # Price line: "  @ Rs. ###.## Rs. ###.##" (right-aligned)
        unit_price_str = f'@ Rs. {item.unit_price:,.2f}'
        line_total_str = f'Rs. {item.line_total:,.2f}'

        # Calculate spacing (42 chars total, 2 spaces at start)
        available_space = 42 - 2
        price_section_length = len(unit_price_str) + len(line_total_str)
        spacing = available_space - price_section_length

        price_line = f'  {unit_price_str}{" " * spacing}{line_total_str}\n'
        commands.extend(price_line.encode('utf-8'))
        commands.extend(b'\n')

    # === TOTALS ===
    commands.extend(b'-' * 42 + b'\n\n')

    # Subtotal
    subtotal_str = f'Rs. {transaction.subtotal:,.2f}'
    subtotal_spacing = 42 - len('Subtotal:') - len(subtotal_str)
    subtotal_line = f'Subtotal:{" " * subtotal_spacing}{subtotal_str}\n'
    commands.extend(subtotal_line.encode('utf-8'))

    # Tax
    tax_str = f'Rs. {transaction.tax_amount:,.2f}'
    tax_spacing = 42 - len('Tax:') - len(tax_str)
    tax_line = f'Tax:{" " * tax_spacing}{tax_str}\n'
    commands.extend(tax_line.encode('utf-8'))

    commands.extend(b'-' * 42 + b'\n')

    # TOTAL (bold)
    commands.extend(b'\x1B\x45\x01')  # Bold ON
    total_str = f'Rs. {transaction.total:,.2f}'
    total_spacing = 42 - len('TOTAL:') - len(total_str)
    total_line = f'TOTAL:{" " * total_spacing}{total_str}\n'
    commands.extend(total_line.encode('utf-8'))
    commands.extend(b'\x1B\x45\x00')  # Bold OFF
    commands.extend(b'\n')

    # === PAYMENT INFO ===
    for payment in transaction.payments.all():
        # Payment method display
        payment_method = payment.get_payment_method_display()
        method_line = f'Payment Method: {payment_method}\n'
        commands.extend(method_line.encode('utf-8'))

        # For cash payments, show tendered and change
        if payment.payment_method == 'cash':
            # Calculate change from transaction
            total_paid = transaction.total_paid
            change = transaction.change_given

            # Tendered amount
            tendered_str = f'Rs. {total_paid:,.2f}'
            tendered_spacing = 42 - len('Tendered:') - len(tendered_str)
            tendered_line = f'Tendered:{" " * tendered_spacing}{tendered_str}\n'
            commands.extend(tendered_line.encode('utf-8'))

            # Change
            change_str = f'Rs. {change:,.2f}'
            change_spacing = 42 - len('Change:') - len(change_str)
            change_line = f'Change:{" " * change_spacing}{change_str}\n'
            commands.extend(change_line.encode('utf-8'))
        else:
            # For other payment methods, just show amount
            amount_str = f'Rs. {payment.amount:,.2f}'
            amount_spacing = 42 - len('Amount:') - len(amount_str)
            amount_line = f'Amount:{" " * amount_spacing}{amount_str}\n'
            commands.extend(amount_line.encode('utf-8'))

            # Show reference number if available
            if payment.reference_number:
                ref_line = f'Ref: {payment.reference_number}\n'
                commands.extend(ref_line.encode('utf-8'))

    commands.extend(b'\n')
    commands.extend(b'-' * 42 + b'\n\n')

    # === FOOTER ===
    commands.extend(b'\x1B\x61\x01')  # Center align
    commands.extend(b'Thank you for your business!\n')
    commands.extend(b'www.printcloud.io\n\n')

    # Session info (left aligned)
    commands.extend(b'\x1B\x61\x00')  # Left align
    item_count = transaction.items.count()
    total_qty = sum(item.quantity for item in transaction.items.all())
    session_code = transaction.cash_drawer_session.session_number.split('-')[-1] if transaction.cash_drawer_session else '???'

    footer_info = f'Items: {item_count}  |  Qty: {total_qty}  |  Session: {session_code}\n'
    commands.extend(footer_info.encode('utf-8'))

    # Feed lines before cut
    commands.extend(b'\n\n\n')

    # Cut paper
    commands.extend(b'\x1D\x56\x00')  # GS V 0 - Full cut

    # === CASH DRAWER KICK (if requested) ===
    if open_drawer:
        commands.extend(b'\x1B\x70\x00\x19\xFA')  # ESC p - Kick drawer

    return bytes(commands)
