/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Order Operations Hook for POS System
 *
 * This hook handles order CRUD operations (Create, Read, Update) for the POS system.
 * It manages saving new orders, updating existing orders, and retrieving orders by number.
 *
 * Features:
 * - Create new orders with location and customer info
 * - Update existing orders (edit mode)
 * - Retrieve orders by order number or display code
 * - Load order data into editing state
 *
 * Extracted from:
 * - Designer POS: page.tsx (lines 154-203)
 * - Accounting POS: accounting/page.tsx (lines 400-510)
 *
 * @module useOrderOperations
 */

'use client';

import { useState, useCallback } from 'react';
import {
  createPOSOrder,
  updatePOSOrder,
  getOrderByNumber,
  voidPOSOrder,
  type POSOrder,
  type POSOrderItem,
} from '@/lib/posApi';
import type { OrderItem } from '../utils/calculations';

/**
 * Return type of the useOrderOperations hook
 */
export interface UseOrderOperationsReturn {
  // Loading state
  isLoading: boolean;

  // Operations
  saveOrUpdateOrder: (params: SaveOrderParams) => Promise<POSOrder | null>;
  retrieveOrderByNumber: (orderNumber: string) => Promise<POSOrder | null>;
  loadOrderForEditing: (
    orderNumber: string,
    onLoad: (order: POSOrder, items: OrderItem[]) => void,
  ) => Promise<void>;
  voidOrder: (orderId: number, voidReason: string) => Promise<boolean>;
}

/**
 * Parameters for saveOrUpdateOrder function
 */
export interface SaveOrderParams {
  orderItems: OrderItem[];
  editingOrderId: number | null;
  selectedLocation: number;
  selectedCustomer?: { id: string } | null;
}

/**
 * Hook for managing POS order operations (save, update, retrieve)
 *
 * @returns Object containing order operation functions and loading state
 *
 * @example
 * ```tsx
 * function POSComponent() {
 *   const { saveOrUpdateOrder, isLoading } = useOrderOperations();
 *   const cart = useOrderCart();
 *
 *   const handleSave = async () => {
 *     const order = await saveOrUpdateOrder({
 *       orderItems: cart.orderItems,
 *       editingOrderId: cart.editingOrderId,
 *       selectedLocation: 1,
 *       selectedCustomer: { id: '123' }
 *     });
 *     if (order) {
 *       console.log('Order saved:', order.order_number);
 *     }
 *   };
 *
 *   return <button onClick={handleSave} disabled={isLoading}>Save Order</button>;
 * }
 * ```
 */
export function useOrderOperations(): UseOrderOperationsReturn {
  // ========================================================================
  // STATE
  // ========================================================================

  /**
   * Loading state for API operations
   * True while save/update/retrieve operations are in progress
   */
  const [isLoading, setIsLoading] = useState(false);

  // ========================================================================
  // SAVE/UPDATE ORDER
  // ========================================================================

  /**
   * Save a new order or update an existing order
   *
   * This function handles both create and update operations:
   * - If editingOrderId is null: Creates a new order
   * - If editingOrderId exists: Updates the existing order
   *
   * The function:
   * 1. Validates required data (location, items)
   * 2. Transforms order items to API format
   * 3. Calls appropriate API endpoint (create or update)
   * 4. Returns the saved/updated order object
   *
   * @param params - Order data including items, location, customer
   * @returns The saved/updated order object, or null if operation failed
   *
   * @example
   * ```tsx
   * const order = await saveOrUpdateOrder({
   *   orderItems: [{ product_id: 1, quantity: 2, ... }],
   *   editingOrderId: null, // New order
   *   selectedLocation: 1,
   *   selectedCustomer: { id: '123' }
   * });
   * ```
   */
  const saveOrUpdateOrder = useCallback(
    async (params: SaveOrderParams): Promise<POSOrder | null> => {
      const { orderItems, editingOrderId, selectedLocation, selectedCustomer } = params;

      // VALIDATION: Check for required location
      if (!selectedLocation) {
        alert('Please select a location');
        return null;
      }

      // VALIDATION: Check for at least one item
      if (orderItems.length === 0) {
        alert('Please add items to the order');
        return null;
      }

      setIsLoading(true);

      try {
        // STEP 1: Transform order items to API format
        // Convert from frontend OrderItem format to backend POSOrderItem format
        const itemsPayload = orderItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          tax_rate: item.taxRate,
          discount_amount: item.discount_amount || 0,
        }));

        let order: POSOrder;

        // STEP 2: Determine operation type and call appropriate API
        if (editingOrderId) {
          // UPDATE EXISTING ORDER
          // Only update the items (location and customer cannot be changed)
          console.log('[useOrderOperations] Updating order:', editingOrderId);
          const response = await updatePOSOrder(editingOrderId, {
            items: itemsPayload,
          });
          order = response.data;
        } else {
          // CREATE NEW ORDER
          // Include location and optional customer
          console.log('[useOrderOperations] Creating new order at location:', selectedLocation);
          const response = await createPOSOrder({
            location_id: selectedLocation,
            customer_id: selectedCustomer ? parseInt(selectedCustomer.id) : undefined,
            items: itemsPayload,
          });
          order = response.data;
        }

        // STEP 3: Return the saved order
        console.log('[useOrderOperations] Order saved successfully:', {
          order_number: order.order_number,
          display_code: order.display_code,
          full_order: order,
        });
        return order;
      } catch (error: any) {
        // ERROR HANDLING
        console.error('[useOrderOperations] Failed to save order:', error);
        const errorMessage =
          error.response?.data?.error || 'Failed to save order. Please try again.';
        alert(errorMessage);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // ========================================================================
  // RETRIEVE ORDER
  // ========================================================================

  /**
   * Retrieve an order by its order number or display code
   *
   * This function fetches an order from the API using either:
   * - Full order number (e.g., "POS-001-2025-01-15")
   * - 3-digit display code (e.g., "001")
   *
   * @param orderNumber - Order number or display code
   * @returns The order object, or null if not found
   *
   * @example
   * ```tsx
   * const order = await retrieveOrderByNumber("001");
   * if (order) {
   *   console.log('Order found:', order.order_number);
   * }
   * ```
   */
  const retrieveOrderByNumber = useCallback(
    async (orderNumber: string): Promise<POSOrder | null> => {
      setIsLoading(true);

      try {
        console.log('[useOrderOperations] Retrieving order:', orderNumber);
        const response = await getOrderByNumber(orderNumber);
        return response.data;
      } catch (error: any) {
        console.error('[useOrderOperations] Failed to retrieve order:', error);
        const errorMessage = error.response?.data?.error || 'Order not found.';
        alert(errorMessage);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // ========================================================================
  // LOAD ORDER FOR EDITING
  // ========================================================================

  /**
   * Load an order into editing mode
   *
   * This function:
   * 1. Retrieves the order from API
   * 2. Validates that order can be edited (must be pending_payment status)
   * 3. Transforms API order items to frontend OrderItem format
   * 4. Calls the onLoad callback with order data
   *
   * The caller is responsible for updating their state with the loaded data.
   *
   * @param orderNumber - Order number or display code to load
   * @param onLoad - Callback function to handle loaded order data
   *
   * @example
   * ```tsx
   * await loadOrderForEditing("001", (order, items) => {
   *   cart.setOrderItems(items);
   *   cart.setEditingOrderId(order.id);
   *   cart.setEditingOrderNumber(order.order_number);
   * });
   * ```
   */
  const loadOrderForEditing = useCallback(
    async (
      orderNumber: string,
      onLoad: (order: POSOrder, items: OrderItem[]) => void,
    ): Promise<void> => {
      setIsLoading(true);

      try {
        // STEP 1: Retrieve the order
        const response = await getOrderByNumber(orderNumber);
        const order = response.data;

        // STEP 2: Validate order status
        // Only pending orders can be edited/paid
        if (order.status !== 'pending_payment') {
          alert(`Order is ${order.status}. Only pending orders can be edited/paid.`);
          return;
        }

        // STEP 3: Transform API items to frontend format
        // API returns POSOrderItem[], we need OrderItem[]
        const mappedItems: OrderItem[] = order.items.map((item: POSOrderItem) => ({
          product_id: item.product, // API uses 'product' field for product ID
          name: item.item_name,
          sku: item.product_sku || item.sku,
          unitPrice: parseFloat(item.unit_price),
          quantity: item.quantity,
          taxRate: parseFloat(item.tax_rate),
          discount_amount: parseFloat(item.discount_amount),
        }));

        // STEP 4: Call the onLoad callback with order data
        console.log('[useOrderOperations] Order loaded for editing:', order.order_number);
        onLoad(order, mappedItems);
      } catch (error: any) {
        console.error('[useOrderOperations] Failed to load order for editing:', error);
        const errorMessage = error.response?.data?.error || 'Order not found.';
        alert(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  /**
   * Void an order with a reason
   *
   * @param orderId - ID of order to void
   * @param voidReason - Reason for voiding (required)
   * @returns Promise resolving to true if successful, false otherwise
   */
  const voidOrder = useCallback(async (orderId: number, voidReason: string): Promise<boolean> => {
    setIsLoading(true);

    try {
      console.log('[useOrderOperations] Voiding order:', orderId, 'Reason:', voidReason);

      await voidPOSOrder(orderId, voidReason);

      console.log('[useOrderOperations] Order voided successfully');
      return true;
    } catch (error: any) {
      console.error('[useOrderOperations] Failed to void order:', error);
      const errorMessage = error.response?.data?.error || 'Failed to void order. Please try again.';
      alert(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ========================================================================
  // RETURN
  // ========================================================================

  return {
    isLoading,
    saveOrUpdateOrder,
    retrieveOrderByNumber,
    loadOrderForEditing,
    voidOrder,
  };
}
