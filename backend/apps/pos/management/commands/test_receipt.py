"""
Django management command to test POS receipt printing.
Sends receipts to ESC/POS emulator at http://localhost:9100

Usage:
    python manage.py test_receipt                    # Test with latest transaction
    python manage.py test_receipt --id 1             # Test with specific transaction
    python manage.py test_receipt --list             # List available transactions
    python manage.py test_receipt --url http://localhost:8080  # Custom URL
"""

from django.core.management.base import BaseCommand, CommandError
from apps.pos.test_receipt_http import (
    send_to_printer_emulator,
    list_available_transactions
)


class Command(BaseCommand):
    help = 'Test POS receipt printing with ESC/POS emulator'

    def add_arguments(self, parser):
        parser.add_argument(
            '--id',
            type=int,
            help='Transaction ID to test (uses latest if not specified)',
        )
        parser.add_argument(
            '--url',
            type=str,
            default='http://localhost:9100',
            help='ESC/POS emulator URL (default: http://localhost:9100)',
        )
        parser.add_argument(
            '--list',
            action='store_true',
            help='List available transactions',
        )
        parser.add_argument(
            '--no-drawer',
            action='store_true',
            help='Exclude cash drawer kick command',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('\n🧪 POS Receipt Testing Tool\n'))

        # List transactions
        if options['list']:
            self.stdout.write('Available transactions:')
            list_available_transactions(10)
            return

        # Send receipt
        transaction_id = options.get('id')
        printer_url = options['url']
        open_drawer = not options['no_drawer']

        self.stdout.write(f"Printer URL: {printer_url}")
        if transaction_id:
            self.stdout.write(f"Transaction ID: {transaction_id}")
        else:
            self.stdout.write("Using latest completed transaction")

        self.stdout.write('')

        # Send to emulator
        success = send_to_printer_emulator(
            transaction_id=transaction_id,
            printer_url=printer_url,
            open_drawer=open_drawer
        )

        if success:
            self.stdout.write(self.style.SUCCESS(
                f'\n✨ Receipt sent! Open browser: {printer_url}\n'
            ))
        else:
            raise CommandError('Failed to send receipt to emulator')
