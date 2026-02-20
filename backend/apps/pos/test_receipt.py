#!/usr/bin/env python
"""
Test script to preview POS receipts without a physical printer.
Run this from the Django shell or as a management command.

Usage:
    python manage.py shell < apps/pos/test_receipt.py

Or in Django shell:
    from apps.pos.test_receipt import test_receipt_preview
    test_receipt_preview(transaction_id=1)
"""

import os
import sys
import django

# Setup Django environment if running standalone
if __name__ == '__main__':
    sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    django.setup()

from apps.pos.models import POSTransaction
from apps.pos.tasks import generate_escpos_receipt


def test_receipt_preview(transaction_id=None):
    """
    Generate and display a text preview of a receipt.

    Args:
        transaction_id: ID of POSTransaction to preview (uses latest if not provided)
    """
    try:
        # Get transaction
        if transaction_id:
            transaction = POSTransaction.objects.select_related(
                'customer', 'location', 'created_by', 'cash_drawer_session'
            ).prefetch_related('items', 'payments').get(pk=transaction_id)
        else:
            transaction = POSTransaction.objects.select_related(
                'customer', 'location', 'created_by', 'cash_drawer_session'
            ).prefetch_related('items', 'payments').filter(
                status='completed'
            ).order_by('-created_at').first()

        if not transaction:
            print("❌ No completed transactions found")
            return

        print(f"\n{'='*50}")
        print(f"🧾 RECEIPT PREVIEW for {transaction.receipt_number}")
        print(f"{'='*50}\n")

        # Generate ESC/POS data
        receipt_bytes = generate_escpos_receipt(transaction, open_drawer=True)

        # Decode and display (ESC/POS commands will show as special chars)
        receipt_text = receipt_bytes.decode('utf-8', errors='ignore')

        # Remove ESC/POS control codes for better readability
        import re
        # Remove common ESC/POS commands
        clean_text = re.sub(r'\x1b[@Epa]', '', receipt_text)  # ESC @, E, p, a
        clean_text = re.sub(r'\x1d[V!]', '', clean_text)  # GS V, !
        clean_text = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', clean_text)  # All control chars

        print(clean_text)

        print(f"\n{'='*50}")
        print(f"📊 Receipt Stats:")
        print(f"{'='*50}")
        print(f"Total bytes: {len(receipt_bytes)}")
        print(f"Items: {transaction.items.count()}")
        print(f"Payments: {transaction.payments.count()}")
        print(f"Total: Rs. {transaction.total:,.2f}")
        print(f"Cash drawer kick: ✅ Included")

        # Save to file for inspection
        filename = f'receipt_preview_{transaction.receipt_number}.txt'
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(clean_text)
        print(f"\n💾 Saved preview to: {filename}")

        # Also save raw bytes
        raw_filename = f'receipt_raw_{transaction.receipt_number}.bin'
        with open(raw_filename, 'wb') as f:
            f.write(receipt_bytes)
        print(f"💾 Saved raw ESC/POS data to: {raw_filename}")

        return receipt_bytes

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()


def list_recent_transactions(limit=10):
    """List recent completed transactions for testing."""
    transactions = POSTransaction.objects.filter(
        status='completed'
    ).select_related('customer', 'location').order_by('-created_at')[:limit]

    print(f"\n📋 Recent Completed Transactions:")
    print(f"{'='*80}")
    print(f"{'ID':<6} {'Receipt #':<20} {'Customer':<25} {'Total':>12} {'Date':<20}")
    print(f"{'-'*80}")

    for txn in transactions:
        customer_name = txn.customer.name if txn.customer else 'Walk-in'
        print(f"{txn.id:<6} {txn.receipt_number:<20} {customer_name[:24]:<25} Rs. {txn.total:>8,.2f} {txn.transaction_date.strftime('%Y-%m-%d %H:%M')}")

    print(f"{'-'*80}")
    print(f"Total: {transactions.count()} transactions\n")


if __name__ == '__main__':
    print("\n🧪 POS Receipt Testing Tool\n")

    # List recent transactions
    list_recent_transactions(5)

    # Preview latest receipt
    print("Generating preview of latest receipt...\n")
    test_receipt_preview()
