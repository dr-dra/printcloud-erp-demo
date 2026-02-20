/**
 * Order Cart Hook for POS System
 *
 * This hook manages the shopping cart functionality for POS orders, including:
 * - Adding/removing items
 * - Updating quantities
 * - Calculating totals (subtotal, tax, grand total)
 * - Managing order editing state
 *
 * This is the core business logic for order management shared across
 * Designer POS and Accounting POS interfaces.
 *
 * Extracted from:
 * - Designer POS: page.tsx (lines 45-314)
 * - Accounting POS: accounting/page.tsx (lines 66-701)
 *
 * @module useOrderCart
 */

'use client';

import { useState, useCallback } from 'react';
import { calculateOrderTotals, type OrderItem } from '../utils/calculations';
import type { POSQuickServiceItem, POSProductSearch } from '@/lib/posApi';

/**
 * Return type of the useOrderCart hook
 */
export interface UseOrderCartReturn {
  // Order items state
  orderItems: OrderItem[];
  setOrderItems: (items: OrderItem[]) => void;

  // Order editing state
  editingOrderId: number | null;
  setEditingOrderId: (id: number | null) => void;
  editingOrderNumber: string;
  setEditingOrderNumber: (number: string) => void;
  editingOrderDisplayCode: string;
  setEditingOrderDisplayCode: (code: string) => void;

  // Calculated totals
  subtotal: number;
  tax: number;
  total: number;

  // Cart operations
  addQuickServiceItem: (service: POSQuickServiceItem, quantityIncrement?: number) => void;
  addSearchItem: (item: POSProductSearch, quantityIncrement?: number) => void;
  addCustomItem: (item: OrderItem) => void;
  updateQuantity: (product_id: number, newQuantity: number) => void;
  removeItem: (product_id: number) => void;
  resetCart: () => void;
}

/**
 * Hook for managing POS order cart
 *
 * This hook provides all the functionality needed to manage a shopping cart
 * in the POS system, including adding items, updating quantities, and
 * calculating totals.
 *
 * @returns Object containing cart state and operations
 *
 * @example
 * ```tsx
 * function POSCart() {
 *   const {
 *     orderItems,
 *     subtotal,
 *     tax,
 *     total,
 *     addSearchItem,
 *     updateQuantity,
 *     removeItem,
 *     resetCart
 *   } = useOrderCart();
 *
 *   return (
 *     <div>
 *       {orderItems.map(item => (
 *         <div key={item.product_id}>
 *           {item.name} - Qty: {item.quantity}
 *           <button onClick={() => updateQuantity(item.product_id, item.quantity + 1)}>+</button>
 *           <button onClick={() => removeItem(item.product_id)}>Remove</button>
 *         </div>
 *       ))}
 *       <p>Total: {total}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useOrderCart(): UseOrderCartReturn {
  // ========================================================================
  // STATE
  // ========================================================================

  /**
   * Array of items currently in the cart
   * Each item represents a product with quantity, price, and tax rate
   */
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  /**
   * Order editing state
   * When editing an existing order, these fields track the order being edited
   */
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [editingOrderNumber, setEditingOrderNumber] = useState<string>('');
  const [editingOrderDisplayCode, setEditingOrderDisplayCode] = useState<string>('');

  // ========================================================================
  // CALCULATED TOTALS
  // ========================================================================

  /**
   * Calculate order totals from current items
   * Uses the shared calculation utility to ensure consistency
   */
  const { subtotal, tax, total } = calculateOrderTotals(orderItems);

  // ========================================================================
  // CART OPERATIONS
  // ========================================================================

  /**
   * Add a quick service item to cart
   *
   * Quick service items are pre-configured products with:
   * - Default quantity (e.g., "10 business cards")
   * - Pre-set price
   * - Tax rate
   *
   * If item already exists in cart, increases quantity by default amount.
   *
   * @param service - Quick service item from API
   */
  const addQuickServiceItem = useCallback(
    (service: POSQuickServiceItem, quantityIncrement?: number) => {
      const increment = quantityIncrement ?? service.default_quantity;

      setOrderItems((currentItems) => {
        // Check if item already exists in cart
        const existingItem = currentItems.find((item) => item.product_id === service.product_id);

        if (existingItem) {
          // Item exists: Update quantity
          return currentItems.map((item) =>
            item.product_id === service.product_id
              ? { ...item, quantity: item.quantity + increment }
              : item,
          );
        } else {
          // New item: Add to cart
          return [
            ...currentItems,
            {
              product_id: service.product_id,
              name: service.product_name,
              sku: service.stock_item_sku || service.product_sku,
              unitPrice: parseFloat(service.effective_price) || 0,
              quantity: increment,
              taxRate: parseFloat(service.tax_rate) || 0,
            },
          ];
        }
      });
    },
    [],
  );

  /**
   * Add a product from search results to cart
   *
   * Search items are products found via the product search feature.
   * Always adds with quantity of 1.
   *
   * If item already exists in cart, increments quantity by 1.
   *
   * @param item - Product from search results
   */
  const addSearchItem = useCallback((item: POSProductSearch, quantityIncrement?: number) => {
    const increment = quantityIncrement ?? 1;

    setOrderItems((currentItems) => {
      // Check if item already exists in cart
      const existingItem = currentItems.find((i) => i.product_id === item.id);

      if (existingItem) {
        // Item exists: Increment quantity
        return currentItems.map((i) =>
          i.product_id === item.id ? { ...i, quantity: i.quantity + increment } : i,
        );
      } else {
        // New item: Add to cart with quantity
        return [
          ...currentItems,
          {
            product_id: item.id,
            name: item.name,
            sku: item.sku,
            unitPrice: parseFloat(item.default_selling_price) || 0,
            quantity: increment,
            taxRate: parseFloat(item.tax_rate) || 0,
          },
        ];
      }
    });
  }, []);

  /**
   * Add a custom item to cart
   *
   * Custom items are manually created items (e.g., from "Add Custom Item" modal).
   * The item object is already fully formed with all properties.
   *
   * If item with same product_id and name already exists, increases quantity.
   *
   * @param item - Complete order item object
   */
  const addCustomItem = useCallback((item: OrderItem) => {
    setOrderItems((currentItems) => {
      // Check for existing item (match by product_id AND name for custom items)
      const existingItem = currentItems.find(
        (i) => i.product_id === item.product_id && i.name === item.name,
      );

      if (existingItem) {
        // Item exists: Add quantities
        return currentItems.map((i) =>
          i.product_id === item.product_id && i.name === item.name
            ? { ...i, quantity: i.quantity + item.quantity }
            : i,
        );
      } else {
        // New item: Add to cart
        return [...currentItems, item];
      }
    });
  }, []);

  /**
   * Update the quantity of an item in the cart
   *
   * Business logic:
   * - If new quantity is 0 or negative, removes item from cart
   * - Otherwise, updates the quantity
   *
   * @param product_id - ID of the product to update
   * @param newQuantity - New quantity value
   */
  const updateQuantity = useCallback((product_id: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      // Remove item if quantity is 0 or negative
      setOrderItems((currentItems) =>
        currentItems.filter((item) => item.product_id !== product_id),
      );
    } else {
      // Update quantity
      setOrderItems((currentItems) =>
        currentItems.map((item) =>
          item.product_id === product_id ? { ...item, quantity: newQuantity } : item,
        ),
      );
    }
  }, []);

  /**
   * Remove an item from the cart completely
   *
   * @param product_id - ID of the product to remove
   */
  const removeItem = useCallback((product_id: number) => {
    setOrderItems((currentItems) => currentItems.filter((item) => item.product_id !== product_id));
  }, []);

  /**
   * Reset the entire cart to empty state
   *
   * This clears:
   * - All order items
   * - Editing order ID/number
   *
   * Use this after successful order submission or when starting a new order.
   */
  const resetCart = useCallback(() => {
    setOrderItems([]);
    setEditingOrderId(null);
    setEditingOrderNumber('');
    setEditingOrderDisplayCode('');
  }, []);

  // ========================================================================
  // RETURN
  // ========================================================================

  return {
    // State
    orderItems,
    setOrderItems,

    // Editing state
    editingOrderId,
    setEditingOrderId,
    editingOrderNumber,
    setEditingOrderNumber,
    editingOrderDisplayCode,
    setEditingOrderDisplayCode,

    // Totals
    subtotal,
    tax,
    total,

    // Operations
    addQuickServiceItem,
    addSearchItem,
    addCustomItem,
    updateQuantity,
    removeItem,
    resetCart,
  };
}
