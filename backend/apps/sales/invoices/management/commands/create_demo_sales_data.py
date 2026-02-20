from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP
import random

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.customers.models import Customer
from apps.sales.invoices.models import SalesInvoice, SalesInvoiceItem, SalesInvoiceTimeline
from apps.sales.orders.models import SalesOrder, SalesOrderItem, SalesOrderTimeline
from apps.sales.quotations.models import SalesQuotation, SalesQuotationItem, SalesQuotationTimeline


MONEY_QUANT = Decimal("0.01")
VAT_RATE = Decimal("0.18")


class Command(BaseCommand):
    help = "Create synthetic demo quotations, orders, and invoices for showcase environments."

    def add_arguments(self, parser):
        parser.add_argument("--quotations", type=int, default=24, help="Number of demo quotations to create")
        parser.add_argument("--orders", type=int, default=18, help="Number of demo orders to create")
        parser.add_argument("--invoices", type=int, default=14, help="Number of demo invoices to create")
        parser.add_argument("--seed", type=int, default=2026, help="Random seed for repeatable generation")
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Delete previously generated demo sales data (DQ-2026-/DO-2026-/DI-2026-) first",
        )

    def handle(self, *args, **options):
        random.seed(options["seed"])

        quotation_target = max(0, options["quotations"])
        order_target = max(0, options["orders"])
        invoice_target = max(0, options["invoices"])

        user = self._get_seed_user()
        customers = self._ensure_customers()

        if options["clear"]:
            self._clear_previous_demo_data()

        q_counter = self._next_counter(SalesQuotation, "quot_number", "DQ-2026-")
        o_counter = self._next_counter(SalesOrder, "order_number", "DO-2026-")
        i_counter = self._next_counter(SalesInvoice, "invoice_number", "DI-2026-")

        created_quotations = []
        created_orders = []
        created_invoices = []

        with transaction.atomic():
            for _ in range(quotation_target):
                quotation, q_counter = self._create_quotation(customers, user, q_counter)
                created_quotations.append(quotation)

            for _ in range(order_target):
                if not created_quotations:
                    break
                source_quote = random.choice(created_quotations)
                order, o_counter = self._create_order(source_quote, user, o_counter)
                created_orders.append(order)

            for _ in range(invoice_target):
                if not created_orders:
                    break
                source_order = random.choice(created_orders)
                invoice, i_counter = self._create_invoice(source_order, user, i_counter)
                created_invoices.append(invoice)

        self.stdout.write(self.style.SUCCESS("Demo sales data generation complete."))
        self.stdout.write(
            f"Created: {len(created_quotations)} quotations, {len(created_orders)} orders, "
            f"{len(created_invoices)} invoices"
        )
        self.stdout.write(
            f"Totals now: quotations={SalesQuotation.objects.count()}, "
            f"orders={SalesOrder.objects.count()}, invoices={SalesInvoice.objects.count()}"
        )

    def _get_seed_user(self):
        User = get_user_model()
        user = User.objects.filter(is_superuser=True).first() or User.objects.first()
        if not user:
            raise Exception("No users found. Create a superuser first.")
        return user

    def _ensure_customers(self):
        customers = list(Customer.objects.filter(is_active=True))
        if customers:
            return customers

        call_command("create_sample_customers")
        customers = list(Customer.objects.filter(is_active=True))
        if not customers:
            raise Exception("No customers available after create_sample_customers.")
        return customers

    def _clear_previous_demo_data(self):
        deleted_invoices = SalesInvoice.objects.filter(invoice_number__startswith="DI-2026-").delete()[0]
        deleted_orders = SalesOrder.objects.filter(order_number__startswith="DO-2026-").delete()[0]
        deleted_quotes = SalesQuotation.objects.filter(quot_number__startswith="DQ-2026-").delete()[0]
        self.stdout.write(
            f"Cleared prior demo data: invoices={deleted_invoices}, orders={deleted_orders}, quotations={deleted_quotes}"
        )

    def _next_counter(self, model, field_name, prefix):
        max_counter = 0
        for value in model.objects.filter(**{f"{field_name}__startswith": prefix}).values_list(field_name, flat=True):
            suffix = value.replace(prefix, "", 1)
            if suffix.isdigit():
                max_counter = max(max_counter, int(suffix))
        return max_counter + 1

    def _money(self, value):
        return Decimal(str(value)).quantize(MONEY_QUANT, rounding=ROUND_HALF_UP)

    def _create_quotation(self, customers, user, counter):
        customer = random.choice(customers)
        issue_date = timezone.now().date() - timedelta(days=random.randint(2, 80))
        required_date = issue_date + timedelta(days=random.randint(5, 25))

        quot_number = f"DQ-2026-{counter:04d}"
        quotation = SalesQuotation.objects.create(
            quot_number=quot_number,
            number_type=1,
            customer=customer,
            date=issue_date,
            required_date=required_date,
            terms="50% advance, balance on delivery",
            notes="Synthetic demo quotation data",
            private_notes="Created by create_demo_sales_data",
            delivery_charge=Decimal("0.00"),
            discount=Decimal("0.00"),
            total=Decimal("0.00"),
            vat_rate=VAT_RATE,
            vat_amount=Decimal("0.00"),
            total_applied=True,
            delivery_applied=True,
            finalized=random.choice([True, False]),
            is_active=True,
            created_by=user,
        )

        line_count = random.randint(1, 3)
        subtotal = Decimal("0.00")
        product_names = [
            "Business Cards",
            "Letterheads",
            "Flyers",
            "Brochures",
            "Stickers",
            "Invoice Books",
            "Packaging Labels",
        ]

        for _ in range(line_count):
            item_name = random.choice(product_names)
            quantity = random.choice([100, 250, 500, 1000, 2000])
            unit_price = self._money(random.uniform(8, 95))
            line_total = self._money(Decimal(quantity) * unit_price)
            subtotal += line_total

            SalesQuotationItem.objects.create(
                quotation=quotation,
                item=item_name,
                description=f"{item_name} - demo line item",
                quantity=quantity,
                unit_price=unit_price,
                price=line_total,
            )

        discount = self._money(subtotal * Decimal(random.choice(["0", "0.03", "0.05"])))
        delivery = self._money(random.choice([0, 0, 250, 500]))
        taxable_total = max(Decimal("0.00"), self._money(subtotal - discount + delivery))
        vat_amount = self._money(taxable_total * VAT_RATE)
        grand_total = self._money(taxable_total + vat_amount)

        quotation.discount = discount
        quotation.delivery_charge = delivery
        quotation.vat_amount = vat_amount
        quotation.total = grand_total
        quotation.save(update_fields=["discount", "delivery_charge", "vat_amount", "total", "updated_date"])

        SalesQuotationTimeline.objects.create(
            quotation=quotation,
            event_type="created",
            message="Demo quotation generated",
            created_by=user,
        )

        return quotation, counter + 1

    def _create_order(self, source_quote, user, counter):
        order_number = f"DO-2026-{counter:04d}"
        order_date = source_quote.date or timezone.now().date()
        required_date = source_quote.required_date or (order_date + timedelta(days=7))

        statuses = ["confirmed", "production", "ready", "delivered", "completed"]
        status = random.choice(statuses)

        quote_items = list(source_quote.items.all())
        subtotal = self._money(sum((item.price or Decimal("0.00")) for item in quote_items))
        discount = self._money(random.choice([0, 100, 150, 250]))
        delivery = self._money(random.choice([0, 200, 350]))
        taxable_total = max(Decimal("0.00"), self._money(subtotal - discount + delivery))
        vat_amount = self._money(taxable_total * VAT_RATE)
        net_total = self._money(taxable_total + vat_amount)

        if status == "completed":
            amount_paid = net_total
        elif status in ["delivered", "ready"]:
            amount_paid = self._money(net_total * Decimal("0.40"))
        else:
            amount_paid = Decimal("0.00")

        order = SalesOrder.objects.create(
            order_number=order_number,
            number_type=1,
            customer=source_quote.customer,
            quotation=source_quote,
            order_date=order_date,
            required_date=required_date,
            status=status,
            project_name=f"{source_quote.customer.name} Print Job",
            notes="Synthetic demo order",
            customer_notes="Demo customer-facing note",
            subtotal=subtotal,
            discount=discount,
            delivery_charge=delivery,
            net_total=net_total,
            vat_rate=VAT_RATE,
            vat_amount=vat_amount,
            amount_paid=amount_paid,
            balance_due=self._money(net_total - amount_paid),
            prepared_by=user,
            prepared_from="quotation",
            prepared_reff=source_quote.quot_number,
            is_active=True,
            created_by=user,
            updated_by=user,
        )

        for quote_item in quote_items:
            SalesOrderItem.objects.create(
                order=order,
                item_name=quote_item.item or "Demo Item",
                description=quote_item.description,
                quantity=int(quote_item.quantity or 1),
                unit_price=self._money(quote_item.unit_price or Decimal("0.00")),
                amount=self._money(quote_item.price or Decimal("0.00")),
            )

        SalesOrderTimeline.objects.create(
            order=order,
            event_type="created",
            message="Demo order generated from quotation",
            created_by=user,
        )

        if status != "draft":
            SalesOrderTimeline.objects.create(
                order=order,
                event_type="status_changed",
                message=f"Order moved to {status}",
                old_status="draft",
                new_status=status,
                created_by=user,
            )

        return order, counter + 1

    def _create_invoice(self, source_order, user, counter):
        invoice_number = f"DI-2026-{counter:04d}"

        invoice_statuses = ["draft", "sent", "partially_paid", "paid", "overdue"]
        status = random.choice(invoice_statuses)

        invoice_date = source_order.order_date or timezone.now().date()
        due_date = invoice_date + timedelta(days=14)
        if status == "overdue":
            due_date = timezone.now().date() - timedelta(days=random.randint(5, 40))

        subtotal = self._money(source_order.subtotal or Decimal("0.00"))
        discount = self._money(source_order.discount or Decimal("0.00"))
        tax_amount = self._money(source_order.vat_amount or Decimal("0.00"))
        net_total = self._money(source_order.net_total or Decimal("0.00"))

        if status == "paid":
            amount_paid = net_total
        elif status == "partially_paid":
            amount_paid = self._money(net_total * Decimal("0.50"))
        else:
            amount_paid = Decimal("0.00")

        invoice_type = "tax_invoice" if status in ["sent", "partially_paid", "paid", "overdue"] else "proforma"

        invoice = SalesInvoice.objects.create(
            invoice_number=invoice_number,
            invoice_type=invoice_type,
            customer=source_order.customer,
            order=source_order,
            invoice_date=invoice_date,
            due_date=due_date,
            status=status,
            po_so_number=source_order.po_so_number,
            notes="Synthetic demo invoice",
            customer_notes="Thank you for your business",
            subtotal=subtotal,
            discount=discount,
            tax_amount=tax_amount,
            net_total=net_total,
            amount_paid=amount_paid,
            vat_rate=VAT_RATE,
            advances_applied=amount_paid if invoice_type == "tax_invoice" else Decimal("0.00"),
            created_by=user,
            updated_by=user,
        )

        for order_item in source_order.items.all():
            qty = self._money(order_item.quantity or 1)
            unit_price = self._money(order_item.unit_price or Decimal("0.00"))
            line_amount = self._money(order_item.amount or (qty * unit_price))

            SalesInvoiceItem.objects.create(
                invoice=invoice,
                item_name=order_item.item_name,
                description=order_item.description,
                quantity=qty,
                unit_price=unit_price,
                amount=line_amount,
                tax_rate=VAT_RATE,
                tax_amount=self._money(line_amount * VAT_RATE),
            )

        SalesInvoiceTimeline.objects.create(
            invoice=invoice,
            event_type="created",
            message="Demo invoice generated from order",
            created_by=user,
        )

        if status != "draft":
            SalesInvoiceTimeline.objects.create(
                invoice=invoice,
                event_type="status_changed",
                message=f"Invoice moved to {status}",
                old_status="draft",
                new_status=status,
                created_by=user,
            )

        return invoice, counter + 1
