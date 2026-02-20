#!/usr/bin/env python
"""
Send POS receipt to ESC/POS emulator for preview/testing.

Usage:
    python manage.py shell
    >>> from apps.pos.test_receipt_http import send_to_printer_emulator
    >>> send_to_printer_emulator(transaction_id=1)

Or from command line:
    python apps/pos/test_receipt_http.py
"""

import os
import sys
import django
import requests
import base64

# Setup Django environment if running standalone
if __name__ == '__main__':
    sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    django.setup()

from apps.pos.models import POSTransaction
from apps.pos.tasks import generate_escpos_receipt


def send_to_printer_emulator(transaction_id=None, printer_url="http://localhost:9100", open_drawer=True):
    """
    Send receipt to ESC/POS emulator for preview.

    Args:
        transaction_id: ID of POSTransaction (uses latest if not provided)
        printer_url: URL of ESC/POS emulator service
        open_drawer: Include cash drawer kick command

    Returns:
        bool: True if successful
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
            return False

        print(f"\n{'='*60}")
        print(f"🖨️  Sending Receipt to Printer Emulator")
        print(f"{'='*60}")
        print(f"Receipt: {transaction.receipt_number}")
        print(f"Total: Rs. {transaction.total:,.2f}")
        print(f"Items: {transaction.items.count()}")
        print(f"URL: {printer_url}")
        print(f"{'='*60}\n")

        # Generate ESC/POS receipt
        receipt_bytes = generate_escpos_receipt(transaction, open_drawer=open_drawer)

        print(f"✅ Generated {len(receipt_bytes)} bytes of ESC/POS data")

        # Check if drawer kick is included
        if b'\x1B\x70\x00\x19\xFA' in receipt_bytes:
            print(f"✅ Cash drawer kick command: INCLUDED")
        else:
            print(f"⚠️  Cash drawer kick command: NOT INCLUDED")

        # Send to ESC/POS emulator
        # Emulator expects raw ESC/POS data in the request body
        response = requests.post(
            printer_url,
            data=receipt_bytes,
            headers={
                'Content-Type': 'application/octet-stream'
            },
            timeout=10
        )

        if response.status_code == 200:
            print(f"\n✅ Receipt sent successfully!")
            print(f"📊 HTTP Status: {response.status_code}")
            print(f"\n🌐 Open browser to: {printer_url}")
            print(f"   You should see the receipt rendered!\n")
            return True
        else:
            print(f"\n❌ Failed to send receipt")
            print(f"📊 HTTP Status: {response.status_code}")
            print(f"📄 Response: {response.text[:200]}")
            return False

    except requests.exceptions.ConnectionError:
        print(f"\n❌ Connection Error!")
        print(f"   Is ESC/POS emulator running on {printer_url}?")
        print(f"\n💡 Make sure your ESC/POS emulator is running on port 9100")
        return False

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_with_latest_transaction(printer_url="http://localhost:9100"):
    """Quick test with latest completed transaction."""
    return send_to_printer_emulator(printer_url=printer_url)


def test_with_specific_transaction(transaction_id, printer_url="http://localhost:9100"):
    """Test with specific transaction ID."""
    return send_to_printer_emulator(transaction_id=transaction_id, printer_url=printer_url)


def list_available_transactions(limit=10):
    """List transactions available for testing."""
    from apps.pos.test_receipt import list_recent_transactions
    list_recent_transactions(limit)


if __name__ == '__main__':
    print("\n🧪 POS Receipt → ESC/POS Emulator Testing Tool\n")

    # Check if ESC/POS emulator is running
    try:
        response = requests.get("http://localhost:9100", timeout=2)
        print("✅ ESC/POS emulator is running on port 9100\n")
    except:
        print("⚠️  ESC/POS emulator not detected on port 9100")
        print("   Make sure it's running before testing\n")

    # List available transactions
    list_available_transactions(5)

    # Send latest receipt
    print("\n" + "="*60)
    print("Sending latest receipt to printer emulator...")
    print("="*60 + "\n")

    success = test_with_latest_transaction()

    if success:
        print("\n" + "="*60)
        print("✨ SUCCESS! Check your browser at http://localhost:9100")
        print("="*60 + "\n")
