"""
Business logic for POS operations.
Handles transaction completion, stock deduction, void/refund operations, etc.
"""

from datetime import timedelta
from decimal import Decimal

from django.db import transaction as db_transaction
from django.utils import timezone

from .models import (
    CashDrawerSession,
    CustomerAccount,
    CustomerAccountTransaction,
    POSOrder,
    POSOrderItem,
    POSPayment,
    POSProduct,
    POSStockMovement,
    POSTransaction,
    POSTransactionItem,
)


class POSServiceError(Exception):
    """Base exception for POS service errors"""
    pass


class InsufficientStockError(POSServiceError):
    """Raised when stock is insufficient for a sale"""
    pass


class InsufficientPaymentError(POSServiceError):
    """Raised when payment amount is less than transaction total"""
    pass


class NoOpenSessionError(POSServiceError):
    """Raised when no open cash drawer session exists"""
    pass


class CreditLimitExceededError(POSServiceError):
    """Raised when customer account credit limit is exceeded"""
    pass


def complete_pos_transaction(transaction):
    """
    Complete POS transaction:
    1. Validate payment total matches transaction total
    2. Deduct inventory
    3. Update cash drawer expected balance
    4. Create stock movements
    5. Update customer account if applicable

    Args:
        transaction: POSTransaction instance

    Raises:
        InsufficientPaymentError: If total paid < transaction total
        InsufficientStockError: If stock unavailable for any item

    Returns:
        POSTransaction: The completed transaction
    """
    with db_transaction.atomic():
        # Validate payment
        total_paid = transaction.total_paid
        if total_paid < transaction.total:
            raise InsufficientPaymentError(
                f"Insufficient payment: Rs. {total_paid} paid, Rs. {transaction.total} required"
            )

        # Deduct inventory for each item (POS-managed)
        for item in transaction.items.all():
            product = item.product

            if product.track_inventory:
                # Validate stock availability (optional based on allow_backorder)
                if not product.allow_backorder and product.quantity_on_hand < item.quantity:
                    raise InsufficientStockError(
                        f"Insufficient stock for {product.name}. "
                        f"Available: {product.quantity_on_hand}, "
                        f"Requested: {item.quantity}"
                    )

                # Deduct quantity from POS product
                product.quantity_on_hand -= item.quantity
                product.sales_count += 1
                product.save(update_fields=['quantity_on_hand', 'sales_count'])

                # Create POS stock movement record
                POSStockMovement.objects.create(
                    product=product,
                    location=transaction.location,
                    movement_type='sale',
                    quantity=-item.quantity,
                    reference_type='pos_transaction',
                    reference_id=transaction.id,
                    notes=f"POS Sale: {transaction.receipt_number}",
                    created_by=transaction.created_by
                )
            else:
                # Still increment sales count even if not tracking inventory
                product.sales_count += 1
                product.save(update_fields=['sales_count'])

        # Update cash drawer expected balance (only for cash payments)
        cash_payments = transaction.payments.filter(payment_method='cash')
        if cash_payments.exists():
            cash_total = sum(p.amount for p in cash_payments)
            session = transaction.cash_drawer_session

            # Initialize expected_balance if null
            if session.expected_balance is None:
                session.expected_balance = session.opening_balance

            session.expected_balance += Decimal(str(cash_total))
            session.save()

        # Update customer account if account payment used
        account_payment = transaction.payments.filter(payment_method='account').first()
        if account_payment and transaction.customer:
            customer_account, created = CustomerAccount.objects.get_or_create(
                customer=transaction.customer,
                defaults={
                    'created_by': transaction.created_by,
                    'payment_term_days': transaction.customer.payment_term or 30
                }
            )

            # Check credit limit
            new_balance = customer_account.current_balance + transaction.total
            if new_balance > customer_account.credit_limit:
                raise CreditLimitExceededError(
                    f"Credit limit exceeded: Current balance Rs. {customer_account.current_balance}, "
                    f"Credit limit Rs. {customer_account.credit_limit}, "
                    f"Transaction amount Rs. {transaction.total}"
                )

            balance_before = customer_account.current_balance
            customer_account.current_balance = new_balance
            customer_account.last_transaction_date = transaction.transaction_date
            balance_after = customer_account.current_balance
            customer_account.save()

            # Update payment record with balance tracking
            account_payment.customer_account_balance_before = balance_before
            account_payment.customer_account_balance_after = balance_after
            account_payment.save()

            # Create account ledger entry
            CustomerAccountTransaction.objects.create(
                account=customer_account,
                transaction_type='charge',
                amount=transaction.total,
                balance_before=balance_before,
                balance_after=balance_after,
                pos_transaction=transaction,
                reference_number=transaction.receipt_number,
                due_date=(transaction.transaction_date.date() +
                         timedelta(days=customer_account.payment_term_days)),
                notes=f"POS Sale: {transaction.receipt_number}",
                created_by=transaction.created_by
            )

        # Mark transaction as completed
        transaction.status = 'completed'
        transaction.save()

        return transaction


def void_transaction(transaction, void_reason, user):
    """
    Void a transaction (reverses all effects).
    Should only be used for same-day errors before stock/payment settled.

    Args:
        transaction: POSTransaction instance
        void_reason: Reason for voiding
        user: User performing the void

    Returns:
        POSTransaction: The voided transaction
    """
    with db_transaction.atomic():
        # Reverse stock movements (POS-managed)
        for item in transaction.items.all():
            product = item.product

            if product.track_inventory:
                # Return quantity to POS product
                product.quantity_on_hand += item.quantity
                product.sales_count -= 1
                product.save(update_fields=['quantity_on_hand', 'sales_count'])

                # Create reversal movement
                POSStockMovement.objects.create(
                    product=product,
                    location=transaction.location,
                    movement_type='void',
                    quantity=item.quantity,
                    reference_type='pos_transaction_void',
                    reference_id=transaction.id,
                    notes=f"Void of {transaction.receipt_number}: {void_reason}",
                    created_by=user
                )
            else:
                # Still decrement sales count even if not tracking inventory
                product.sales_count -= 1
                product.save(update_fields=['sales_count'])

        # Reverse cash drawer balance
        cash_total = sum(
            p.amount for p in transaction.payments.filter(payment_method='cash')
        )
        if cash_total > 0:
            session = transaction.cash_drawer_session
            if session.expected_balance is not None:
                session.expected_balance -= Decimal(str(cash_total))
                session.save()

        # Reverse customer account
        account_payment = transaction.payments.filter(payment_method='account').first()
        if account_payment and transaction.customer:
            try:
                customer_account = transaction.customer.account
                balance_before = customer_account.current_balance
                customer_account.current_balance -= transaction.total
                balance_after = customer_account.current_balance
                customer_account.save()

                CustomerAccountTransaction.objects.create(
                    account=customer_account,
                    transaction_type='adjustment',
                    amount=-transaction.total,
                    balance_before=balance_before,
                    balance_after=balance_after,
                    pos_transaction=transaction,
                    reference_number=f"{transaction.receipt_number}-VOID",
                    notes=f"Void: {void_reason}",
                    created_by=user
                )
            except CustomerAccount.DoesNotExist:
                pass  # Account may not exist if transaction wasn't completed

        # Mark transaction as voided
        transaction.status = 'voided'
        transaction.voided_at = timezone.now()
        transaction.voided_by = user
        transaction.void_reason = void_reason
        transaction.save()

        return transaction


def create_pos_transaction(user, location, cash_drawer_session, customer=None):
    """
    Create a new POS transaction with validations.

    Args:
        user: User creating the transaction
        location: InventoryLocation where sale occurs
        cash_drawer_session: CashDrawerSession for this transaction
        customer: Optional Customer instance

    Raises:
        NoOpenSessionError: If cash drawer session is not open

    Returns:
        POSTransaction: New transaction instance
    """
    # Ensure cash drawer session is open
    if cash_drawer_session.status != 'open':
        raise NoOpenSessionError(
            f"Cash drawer session {cash_drawer_session.session_number} is not open"
        )

    # Generate receipt number
    receipt_number = POSTransaction.generate_receipt_number(location)

    # Create transaction
    transaction = POSTransaction.objects.create(
        receipt_number=receipt_number,
        cash_drawer_session=cash_drawer_session,
        location=location,
        customer=customer,
        created_by=user,
        status='completed'  # Will be set to completed after payment
    )

    return transaction


def get_or_create_open_session(user, location, opening_balance):
    """
    Get user's open cash drawer session or create a new one.

    Args:
        user: User
        location: InventoryLocation
        opening_balance: Opening balance if creating new session

    Returns:
        CashDrawerSession: Open session
    """
    # Try to get existing open session
    open_session = CashDrawerSession.objects.filter(
        user=user,
        location=location,
        status='open'
    ).first()

    if open_session:
        return open_session

    # Generate session number
    today = timezone.now().date()
    prefix = f"CD-{location.code}-{today.strftime('%Y%m%d')}"

    # Get last session for today
    last_session = CashDrawerSession.objects.filter(
        session_number__startswith=prefix
    ).order_by('-session_number').first()

    if last_session:
        last_num = int(last_session.session_number.split('-')[-1])
        new_num = last_num + 1
    else:
        new_num = 1

    session_number = f"{prefix}-{new_num:03d}"

    # Create new session
    session = CashDrawerSession.objects.create(
        session_number=session_number,
        user=user,
        location=location,
        opening_balance=opening_balance,
        expected_balance=opening_balance,
        status='open'
    )

    return session


def close_cash_drawer_session(session, actual_balance, commercial_printing_income=None,
                              payouts=None, closing_notes=None, user=None):
    """
    Close a cash drawer session with variance tracking.

    Args:
        session: CashDrawerSession instance
        actual_balance: Actual counted cash
        commercial_printing_income: Income from commercial printing (optional)
        payouts: Cash paid out via vouchers (optional)
        closing_notes: Optional notes (e.g., denomination breakdown)
        user: User closing the session (optional)

    Returns:
        CashDrawerSession: Closed session
    """
    session.close_session(
        actual_balance=actual_balance,
        commercial_printing_income=commercial_printing_income,
        payouts=payouts,
        closing_notes=closing_notes
    )
    return session


def process_customer_account_payment(customer_account, amount, payment_method, reference_number=None, user=None):
    """
    Process a payment towards a customer account (reduces balance).

    Args:
        customer_account: CustomerAccount instance
        amount: Payment amount
        payment_method: Payment method used
        reference_number: Optional reference number
        user: User processing payment

    Returns:
        CustomerAccountTransaction: Payment transaction record
    """
    with db_transaction.atomic():
        balance_before = customer_account.current_balance
        customer_account.current_balance -= amount
        customer_account.last_payment_date = timezone.now()
        balance_after = customer_account.current_balance
        customer_account.save()

        # Create ledger entry
        account_txn = CustomerAccountTransaction.objects.create(
            account=customer_account,
            transaction_type='payment',
            amount=-amount,  # Negative for payments
            balance_before=balance_before,
            balance_after=balance_after,
            reference_number=reference_number or f"PMT-{timezone.now().strftime('%Y%m%d%H%M%S')}",
            notes=f"Payment via {payment_method}",
            created_by=user
        )

        return account_txn


# =============================================================================
# POS Order Workflow Functions (Designer/Accounting separation)
# =============================================================================

def create_pos_order(user, location, items_data, customer=None, notes=None):
    """
    Create POS order (by designer/typesetter).
    Does NOT process payment or deduct inventory.

    Args:
        user: User creating the order (designer)
        location: InventoryLocation where order is created
        items_data: List of dicts with: stock_item_id, quantity, unit_price, tax_rate, discount_amount
        customer: Optional Customer instance
        notes: Optional order notes

    Returns:
        POSOrder: The created order with order_number

    Raises:
        ValueError: If user doesn't have designer or admin role
    """
    # Validate user role
    if user.role not in ['designer', 'accounting', 'cashier', 'admin']:
        raise ValueError("Only designers, accounting staff, cashiers, and admins can create POS orders")

    with db_transaction.atomic():
        # Generate order number
        order_number = POSOrder.generate_order_number()

        # Create order
        order = POSOrder.objects.create(
            order_number=order_number,
            location=location,
            customer=customer,
            status='pending_payment',
            notes=notes,
            created_by=user
        )

        # Create order items and calculate totals
        subtotal = Decimal('0.00')
        total_discount = Decimal('0.00')
        total_tax = Decimal('0.00')

        for item_data in items_data:
            product = POSProduct.objects.get(id=item_data['product_id'])

            quantity = item_data['quantity']
            unit_price = Decimal(str(item_data['unit_price']))
            tax_rate = Decimal(str(item_data.get('tax_rate', 0)))
            discount_amount = Decimal(str(item_data.get('discount_amount', 0)))

            # Calculate line total
            line_subtotal = unit_price * quantity
            line_tax = line_subtotal * (tax_rate / 100)
            line_total = line_subtotal - discount_amount + line_tax

            # Create order item
            POSOrderItem.objects.create(
                order=order,
                product=product,
                item_name=product.name,
                sku=product.sku or '',
                quantity=quantity,
                unit_price=unit_price,
                tax_rate=tax_rate,
                tax_amount=line_tax,
                discount_amount=discount_amount,
                line_total=line_total,
                notes=item_data.get('notes')
            )

            # Update totals
            subtotal += line_subtotal
            total_discount += discount_amount
            total_tax += line_tax

        # Update order totals
        order.subtotal = subtotal
        order.discount_amount = total_discount
        order.tax_amount = total_tax
        order.total = subtotal - total_discount + total_tax
        order.save()

        # Broadcast the new order to the 'orders' group
        try:
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync
            from .serializers import POSOrderListSerializer

            channel_layer = get_channel_layer()
            if channel_layer:
                serializer = POSOrderListSerializer(order)
                async_to_sync(channel_layer.group_send)(
                    'orders', 
                    {
                        'type': 'order_message',
                        'message': {
                            'action': 'new_order',
                            'order': serializer.data
                        }
                    }
                )
        except Exception as e:
            # Log the error but don't fail the transaction
            print(f"Error broadcasting new order: {e}")

        return order


def update_pos_order(order, items_data, user):
    """
    Update POS order items (only if pending_payment).

    Args:
        order: POSOrder instance
        items_data: List of dicts with: stock_item_id, quantity, unit_price, tax_rate, discount_amount
        user: User updating the order

    Returns:
        POSOrder: Updated order

    Raises:
        ValueError: If order is not editable or user is not owner
    """
    # Validate order is editable
    if not order.is_editable:
        raise ValueError(f"Order {order.order_number} cannot be edited (status: {order.status})")

    # Validate user is owner or admin or accounting or cashier
    if user != order.created_by and not user.is_superuser and user.role not in ['admin', 'accounting', 'cashier']:
        raise ValueError("You can only edit your own orders")

    with db_transaction.atomic():
        # Delete existing items
        order.items.all().delete()

        # Create new items and recalculate totals
        subtotal = Decimal('0.00')
        total_discount = Decimal('0.00')
        total_tax = Decimal('0.00')

        for item_data in items_data:
            product = POSProduct.objects.get(id=item_data['product_id'])

            quantity = item_data['quantity']
            unit_price = Decimal(str(item_data['unit_price']))
            tax_rate = Decimal(str(item_data.get('tax_rate', 0)))
            discount_amount = Decimal(str(item_data.get('discount_amount', 0)))

            # Calculate line total
            line_subtotal = unit_price * quantity
            line_tax = line_subtotal * (tax_rate / 100)
            line_total = line_subtotal - discount_amount + line_tax

            # Create order item
            POSOrderItem.objects.create(
                order=order,
                product=product,
                item_name=product.name,
                sku=product.sku or '',
                quantity=quantity,
                unit_price=unit_price,
                tax_rate=tax_rate,
                tax_amount=line_tax,
                discount_amount=discount_amount,
                line_total=line_total,
                notes=item_data.get('notes')
            )

            # Update totals
            subtotal += line_subtotal
            total_discount += discount_amount
            total_tax += line_tax

        # Update order totals
        order.subtotal = subtotal
        order.discount_amount = total_discount
        order.tax_amount = total_tax
        order.total = subtotal - total_discount + total_tax
        order.save()

        return order


def void_pos_order(order, void_reason, user):
    """
    Void a POS order (mark as cancelled).
    No inventory reversal needed since inventory wasn't deducted yet.

    Args:
        order: POSOrder instance
        void_reason: Reason for voiding
        user: User voiding the order

    Returns:
        POSOrder: Voided order

    Raises:
        ValueError: If order is not editable or user is not owner
    """
    # Validate order is editable
    if not order.is_editable:
        raise ValueError(f"Order {order.order_number} cannot be voided (status: {order.status})")

    # Validate user has accounting/cashier role
    if user.role not in ['accounting', 'cashier', 'admin']:
        raise ValueError("Only accounting/cashier can void orders")

    with db_transaction.atomic():
        order.status = 'voided'
        order.voided_at = timezone.now()
        order.voided_by = user
        order.void_reason = void_reason
        order.save()

        # Broadcast the order status update to the 'orders' group
        try:
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync
            from .serializers import POSOrderListSerializer

            channel_layer = get_channel_layer()
            if channel_layer:
                serializer = POSOrderListSerializer(order)
                async_to_sync(channel_layer.group_send)(
                    'orders',
                    {
                        'type': 'order_message',
                        'message': {
                            'action': 'order_updated',
                            'order': serializer.data
                        }
                    }
                )
        except Exception as e:
            # Log the error but don't fail the transaction
            print(f"Error broadcasting order void: {e}")

        return order


def complete_pos_order(order, payment_data, cash_drawer_session, user):
    """
    Complete POS order by accepting payment (by accounting/cashier).
    Creates POSTransaction from order, processes payment, deducts inventory.

    Args:
        order: POSOrder instance
        payment_data: List of dicts with: payment_method, amount, reference_number
        cash_drawer_session: CashDrawerSession for the transaction
        user: User completing the order (accounting/cashier)

    Returns:
        POSTransaction: The completed transaction

    Raises:
        ValueError: If user doesn't have accounting/admin role
        InsufficientPaymentError: If payment doesn't cover total
        InsufficientStockError: If stock unavailable
    """
    # Validate user role
    if user.role not in ['accounting', 'cashier', 'admin']:
        raise ValueError("Only accounting staff, cashiers, and admins can complete payments")

    # Validate order status
    if order.status != 'pending_payment':
        raise ValueError(f"Order {order.order_number} is not pending payment (status: {order.status})")

    # Validate account payment requires a customer
    for payment in payment_data:
        if payment.get('payment_method') == 'account' and not order.customer:
            raise ValueError("Account payment requires a customer to be selected. Walk-in customers cannot use account payment.")

    with db_transaction.atomic():
        # Create POSTransaction from order
        transaction = POSTransaction.objects.create(
            receipt_number=POSTransaction.generate_receipt_number(order.location),
            cash_drawer_session=cash_drawer_session,
            location=order.location,
            customer=order.customer,
            subtotal=order.subtotal,
            discount_amount=order.discount_amount,
            tax_amount=order.tax_amount,
            total=order.total,
            notes=order.notes,
            status='completed',
            created_by=user
        )

        # Create transaction items from order items
        for order_item in order.items.all():
            POSTransactionItem.objects.create(
                transaction=transaction,
                product=order_item.product,
                item_name=order_item.item_name,
                sku=order_item.sku,
                quantity=order_item.quantity,
                unit_price=order_item.unit_price,
                tax_rate=order_item.tax_rate,
                tax_amount=order_item.tax_amount,
                discount_amount=order_item.discount_amount,
                line_total=order_item.line_total,
                unit_cost=order_item.product.unit_cost,
                notes=order_item.notes
            )

        # Create payments
        for payment in payment_data:
            POSPayment.objects.create(
                transaction=transaction,
                payment_method=payment['payment_method'],
                amount=Decimal(str(payment['amount'])),
                reference_number=payment.get('reference_number'),
                notes=payment.get('notes'),
                created_by=user
            )

        # Use existing complete_pos_transaction function to:
        # - Validate payment total
        # - Deduct inventory
        # - Update cash drawer
        # - Handle customer account payments
        # - Increment sales count (now handled internally)
        complete_pos_transaction(transaction)

        # Update order to completed
        order.status = 'completed'
        order.completed_at = timezone.now()
        order.completed_by = user
        order.related_transaction = transaction
        order.save()

        # Broadcast the order status update to the 'orders' group
        try:
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync
            from .serializers import POSOrderListSerializer

            channel_layer = get_channel_layer()
            if channel_layer:
                serializer = POSOrderListSerializer(order)
                async_to_sync(channel_layer.group_send)(
                    'orders',
                    {
                        'type': 'order_message',
                        'message': {
                            'action': 'order_updated',
                            'order': serializer.data
                        }
                    }
                )
        except Exception as e:
            # Log the error but don't fail the transaction
            print(f"Error broadcasting order update: {e}")

        return transaction
