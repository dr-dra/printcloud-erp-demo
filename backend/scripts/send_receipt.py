#!/usr/bin/env python3
"""Send an order receipt PDF by receipt number."""

import argparse
import os
import sys
from pathlib import Path


def setup_django() -> None:
    base_dir = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(base_dir))
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

    import django  # noqa: WPS433

    django.setup()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Send order receipt PDF by receipt number.')
    parser.add_argument('receipt_number', help='Receipt number (e.g., R00003)')
    parser.add_argument(
        '--email',
        default='dharshanae@yahoo.com',
        help='Recipient email address (default: dharshanae@yahoo.com)',
    )
    parser.add_argument(
        '--save',
        help='Optional path to save the PDF instead of emailing (or in addition). '
        'If a directory is provided, saves the order print (logo-less) receipt.',
    )
    parser.add_argument(
        '--no-email',
        action='store_true',
        help='Do not send email; only generate/save the PDF.',
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    setup_django()

    from django.core.mail import EmailMessage  # noqa: WPS433
    from apps.sales.orders.models import OrderPayment  # noqa: WPS433
    from apps.sales.orders.utils import generate_order_receipt_pdf  # noqa: WPS433

    receipt_number = args.receipt_number.strip()
    order_payment = OrderPayment.objects.select_related('order').filter(
        receipt_number=receipt_number,
    ).first()

    if not order_payment:
        print(f"Order receipt not found: {receipt_number}")
        return 1

    filename = f"order-{receipt_number}-print.pdf"
    pdf_bytes = generate_order_receipt_pdf(
        order_payment.id,
        include_company_details=False,
    ).getvalue()

    if args.save:
        save_path = Path(args.save).expanduser()
        if save_path.is_dir() or str(save_path).endswith('/'):
            save_path.mkdir(parents=True, exist_ok=True)
            out_path = save_path / filename
            out_path.write_bytes(pdf_bytes)
            print(f"Saved PDF to {out_path}")
        else:
            save_path.write_bytes(pdf_bytes)
            print(f"Saved PDF to {save_path}")

    if not args.no_email:
        subject = f"Payment Receipt {receipt_number}"
        body = (
            f"Attached is your payment receipt {receipt_number} for order "
            f"{order_payment.order.order_number}."
        )
        email = EmailMessage(
            subject=subject,
            body=body,
            to=[args.email],
        )
        email.attach(filename, pdf_bytes, 'application/pdf')
        email.send(fail_silently=False)
        print(f"Sent receipt {receipt_number} to {args.email}")

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
