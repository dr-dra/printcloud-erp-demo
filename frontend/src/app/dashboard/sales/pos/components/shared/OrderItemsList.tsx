/**
 * Order Items List Component
 *
 * Displays the shopping cart / order items list with:
 * - Item details (name, SKU, price)
 * - Quantity controls (+/- buttons)
 * - Remove item button
 * - Empty state message
 *
 * This component is the core cart display used in both Designer and Accounting POS.
 *
 * Extracted from:
 * - Designer POS: page.tsx (lines 562-633)
 * - Accounting POS: accounting/page.tsx (lines 1405-1476)
 *
 * @module OrderItemsList
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Minus, Trash2, ShoppingCart, XCircle } from 'lucide-react';
import { Badge } from 'flowbite-react';
import { formatCurrency } from '../../utils/currency';
import type { OrderItem } from '../../utils/calculations';

/**
 * Props for OrderItemsList component
 */
export interface OrderItemsListProps {
  /**
   * Array of items in the cart
   */
  items: OrderItem[];

  /**
   * Order editing state (null for new orders, number for editing)
   */
  editingOrderId: number | null;

  /**
   * Order number/code being edited (for display)
   */
  editingOrderDisplayCode?: string;

  /**
   * Callback when item quantity is changed
   */
  onQuantityChange: (product_id: number, newQuantity: number) => void;

  /**
   * Callback when item is removed from cart
   */
  onRemove: (product_id: number) => void;

  /**
   * Optional: Disable editing (for read-only view)
   */
  readOnly?: boolean;

  /**
   * Optional: Show void button (for accounting users editing an order)
   */
  showVoidButton?: boolean;

  /**
   * Optional: Callback when void button is clicked
   */
  onVoidOrder?: () => void;

  /**
   * Optional: Whether void operation is in progress
   */
  isVoiding?: boolean;
}

/**
 * Order Items List Component
 *
 * Displays the current order items with quantity controls and remove buttons.
 *
 * @param props - Component props
 * @returns Order items list element
 *
 * @example
 * ```tsx
 * import { OrderItemsList } from './components/shared/OrderItemsList';
 * import { useOrderCart } from './hooks/useOrderCart';
 *
 * function POSPage() {
 *   const cart = useOrderCart();
 *
 *   return (
 *     <OrderItemsList
 *       items={cart.orderItems}
 *       editingOrderId={cart.editingOrderId}
 *       editingOrderDisplayCode={cart.editingOrderDisplayCode}
 *       onQuantityChange={cart.updateQuantity}
 *       onRemove={cart.removeItem}
 *     />
 *   );
 * }
 * ```
 */
export function OrderItemsList({
  items,
  editingOrderId,
  editingOrderDisplayCode,
  onQuantityChange,
  onRemove,
  readOnly = false,
  showVoidButton = false,
  onVoidOrder,
  isVoiding = false,
}: OrderItemsListProps) {
  const [quantityInputs, setQuantityInputs] = useState<Record<number, string>>({});
  const quantityInputRefs = useRef<Map<number, HTMLInputElement | null>>(new Map());
  const previousItemIds = useRef<Set<number>>(new Set());

  useEffect(() => {
    setQuantityInputs(() => {
      const next: Record<number, string> = {};
      items.forEach((item) => {
        next[item.product_id] = String(item.quantity);
      });
      return next;
    });
  }, [items]);

  useEffect(() => {
    const previousIds = previousItemIds.current;
    const currentIds = new Set(items.map((item) => item.product_id));
    const newItem = items.find((item) => !previousIds.has(item.product_id));

    if (newItem) {
      const input = quantityInputRefs.current.get(newItem.product_id);
      if (input) {
        input.focus();
        input.select();
      }
    }

    previousItemIds.current = currentIds;
  }, [items]);

  const commitQuantity = (productId: number, rawValue: string, fallback: number) => {
    const parsed = Math.floor(Number(rawValue));
    if (!Number.isFinite(parsed)) {
      setQuantityInputs((previous) => ({
        ...previous,
        [productId]: String(fallback),
      }));
      return;
    }

    const clamped = Math.min(9999, Math.max(1, parsed));
    setQuantityInputs((previous) => ({
      ...previous,
      [productId]: String(clamped),
    }));
    if (clamped !== fallback) {
      onQuantityChange(productId, clamped);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {editingOrderId ? `Order #${editingOrderDisplayCode}` : 'Current Order'}
        </h2>
        {/* Item Count Badge */}
        <Badge color={editingOrderId ? 'warning' : 'gray'}>{items.length} items</Badge>
      </div>

      {/* Items List (Scrollable) */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
        {items.length === 0 ? (
          /* Empty State */
          <div className="h-full flex items-center justify-center text-center">
            <div>
              <ShoppingCart className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">No items</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Add items to start</p>
            </div>
          </div>
        ) : (
          /* Item Cards */
          items.map((item, index) => (
            <div
              key={`${item.product_id}-${index}`}
              className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3"
            >
              {/* Item Header: Name and Remove Button */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  {/* Product Name */}
                  <h3 className="font-medium text-gray-900 dark:text-white text-sm">{item.name}</h3>

                  {/* SKU and Unit Price */}
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {item.sku} · {formatCurrency(item.unitPrice)}
                  </p>
                </div>

                {/* Remove Button */}
                {!readOnly && (
                  <button
                    onClick={() => onRemove(item.product_id)}
                    className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded p-1 transition-colors"
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Item Footer: Quantity Controls and Total */}
              <div className="flex items-center justify-between">
                {/* Quantity Controls */}
                <div className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg">
                  {/* Decrease Quantity Button */}
                  <button
                    onClick={(event) => {
                      const step = event.shiftKey ? 10 : 1;
                      onQuantityChange(item.product_id, item.quantity - step);
                    }}
                    disabled={readOnly}
                    className="text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed p-1.5 rounded-l-lg transition-colors"
                    title="Decrease quantity"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>

                  {/* Quantity Input */}
                  <input
                    ref={(element) => {
                      if (element) {
                        quantityInputRefs.current.set(item.product_id, element);
                      } else {
                        quantityInputRefs.current.delete(item.product_id);
                      }
                    }}
                    type="text"
                    min={1}
                    max={9999}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={quantityInputs[item.product_id] ?? String(item.quantity)}
                    onChange={(event) =>
                      setQuantityInputs((previous) => ({
                        ...previous,
                        [item.product_id]: event.target.value,
                      }))
                    }
                    onBlur={(event) =>
                      commitQuantity(item.product_id, event.target.value, item.quantity)
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                        event.preventDefault();
                        const step = event.shiftKey ? 10 : 1;
                        const delta = event.key === 'ArrowUp' ? step : -step;
                        const nextValue = Math.min(9999, Math.max(1, item.quantity + delta));
                        setQuantityInputs((previous) => ({
                          ...previous,
                          [item.product_id]: String(nextValue),
                        }));
                        onQuantityChange(item.product_id, nextValue);
                        return;
                      }
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        event.currentTarget.blur();
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        setQuantityInputs((previous) => ({
                          ...previous,
                          [item.product_id]: String(item.quantity),
                        }));
                        event.currentTarget.blur();
                      }
                    }}
                    disabled={readOnly}
                    className="w-16 bg-transparent text-center text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-0"
                    aria-label={`${item.name} quantity`}
                  />

                  {/* Increase Quantity Button */}
                  <button
                    onClick={(event) => {
                      const step = event.shiftKey ? 10 : 1;
                      onQuantityChange(item.product_id, item.quantity + step);
                    }}
                    disabled={readOnly}
                    className="text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed p-1.5 rounded-r-lg transition-colors"
                    title="Increase quantity"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Line Total (Unit Price × Quantity) */}
                <div className="text-right">
                  <div className="text-base font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(item.unitPrice * item.quantity)}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer: Void Button (if applicable) */}
      {showVoidButton && editingOrderId && onVoidOrder && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <button
            onClick={onVoidOrder}
            disabled={isVoiding || readOnly}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Void this order"
          >
            <XCircle className="w-4 h-4" />
            {isVoiding ? 'Voiding...' : 'Void Order'}
          </button>
        </div>
      )}
    </div>
  );
}
