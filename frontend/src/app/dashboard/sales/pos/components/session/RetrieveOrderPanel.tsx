/**
 * Retrieve Order Panel Component
 *
 * Panel for loading existing orders by their 3-digit display code.
 * Also displays a real-time list of pending (unpaid) orders.
 *
 * Features:
 * - Quick lookup: Enter 3-digit code to load order
 * - Keyboard support: Press Enter to submit
 * - Real-time pending orders list (updates via WebSocket)
 * - Shows up to 10 most recent pending orders
 * - Clear button to reset current order
 * - Connection status indicator
 *
 * Use Cases:
 * 1. Customer returns to pay for previously saved order
 * 2. Cashier needs to edit/complete order started by another user
 * 3. View all pending orders waiting for payment
 *
 * Business Rules:
 * - Orders are identified by 3-digit display codes (e.g., "001", "042")
 * - Only pending (unpaid) orders can be loaded for editing
 * - Completed orders cannot be reopened
 *
 * Extracted from:
 * - Accounting POS: accounting/page.tsx (lines 1294-1402)
 *
 * @module RetrieveOrderPanel
 */

'use client';

import { useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { Clock, User } from 'lucide-react';
import { Badge } from 'flowbite-react';
import { ConnectionStatusIndicator } from '../shared/ConnectionStatusIndicator';
import { formatCurrency } from '../../utils/currency';
import type { POSOrderListItem } from '@/lib/posApi';
import type { ConnectionStatus } from '@/hooks/useOrders';

/**
 * Props for RetrieveOrderPanel component
 */
export interface RetrieveOrderPanelProps {
  /**
   * Array of pending orders to display
   * Updates in real-time via WebSocket
   */
  pendingOrders: POSOrderListItem[];

  /**
   * Whether an order is currently being edited
   * Shows clear button when true
   */
  isEditingOrder: boolean;

  /**
   * Whether retrieve operation is in progress
   */
  isLoading: boolean;

  /**
   * Current WebSocket connection status
   */
  connectionStatus: ConnectionStatus;

  /**
   * Callback when user retrieves order by code
   * @param orderNumber - Full order number to retrieve
   */
  onRetrieveOrder: (orderNumber: string) => Promise<void>;

  /**
   * Callback when user clicks on a pending order
   * @param orderNumber - Full order number to load
   */
  onLoadOrder: (orderNumber: string) => Promise<void>;

  /**
   * Callback when user clicks clear button
   */
  onClear: () => void;
}

/**
 * Retrieve Order Panel Component
 *
 * Displays order lookup interface and pending orders list.
 *
 * @param props - Component props
 * @returns Retrieve order panel element
 *
 * @example
 * ```tsx
 * import { RetrieveOrderPanel } from './components/session/RetrieveOrderPanel';
 * import { useOrderOperations } from './hooks/useOrderOperations';
 * import { useOrders } from './hooks/useOrders';
 *
 * function AccountingPOS() {
 *   const operations = useOrderOperations();
 *   const { pendingOrders, connectionStatus } = useOrders({ locationId });
 *
 *   return (
 *     <RetrieveOrderPanel
 *       pendingOrders={pendingOrders}
 *       isEditingOrder={!!editingOrderId}
 *       isLoading={operations.isLoading}
 *       connectionStatus={connectionStatus}
 *       onRetrieveOrder={operations.retrieveOrderByNumber}
 *       onLoadOrder={operations.loadOrderForEditing}
 *       onClear={resetForm}
 *     />
 *   );
 * }
 * ```
 */
export function RetrieveOrderPanel({
  pendingOrders,
  isEditingOrder,
  isLoading,
  connectionStatus,
  onRetrieveOrder,
  onLoadOrder,
  onClear,
}: RetrieveOrderPanelProps) {
  // Local state for order lookup input (3-digit code)
  const [orderLookupInput, setOrderLookupInput] = useState('');

  /**
   * Handle order code input change
   * Restricts input to numeric characters only, max 3 digits
   */
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const numericValue = e.target.value.replace(/\D/g, '').slice(0, 3);
    setOrderLookupInput(numericValue);
  };

  /**
   * Handle order retrieval
   * Converts display code to full order number format
   */
  const handleRetrieve = async () => {
    if (orderLookupInput.length === 3) {
      await onRetrieveOrder(orderLookupInput);
      setOrderLookupInput(''); // Clear input after successful retrieval
    }
  };

  /**
   * Handle Enter key press for quick submission
   */
  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleRetrieve();
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow flex-shrink-0">
      {/* Header */}
      <div className="flex justify-between items-center p-3 pb-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Retrieve Order</h2>
          <ConnectionStatusIndicator status={connectionStatus} />
        </div>

        {/* Clear Button (shown when editing) */}
        {isEditingOrder && (
          <button
            onClick={onClear}
            className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Order Lookup Input Section */}
      <div className="p-3">
        <div className="flex gap-2">
          {/* 3-Digit Code Input */}
          <input
            type="text"
            placeholder="3-digit code"
            value={orderLookupInput}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            className="flex-1 px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg focus:ring-primary-500 focus:border-primary-500 tracking-widest font-bold text-center text-base"
            maxLength={3}
            autoComplete="off"
          />

          {/* Load Button */}
          <button
            onClick={handleRetrieve}
            disabled={orderLookupInput.length !== 3 || isLoading}
            className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors"
          >
            Load
          </button>
        </div>
      </div>

      {/* Pending Orders List */}
      {pendingOrders.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          {/* List Header */}
          <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Pending Orders
              </span>
              <Badge color="warning" size="sm">
                {pendingOrders.length}
              </Badge>
            </div>
          </div>

          {/* Scrollable Order List (max 10 visible) */}
          <div className="max-h-40 overflow-y-auto px-3 py-2 space-y-1.5 thin-scrollbar">
            {pendingOrders.slice(0, 10).map((order) => (
              <button
                key={order.id}
                onClick={() => onLoadOrder(order.order_number)}
                className="w-full text-left px-2.5 py-2 bg-white dark:bg-gray-700/50 hover:bg-primary-50 dark:hover:bg-primary-900/20 border border-gray-200 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-700 rounded-md transition-all group"
              >
                <div className="flex items-center justify-between gap-2">
                  {/* Left Side: Order Code & Details */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {/* Order Display Code */}
                    <div className="flex-shrink-0">
                      <div className="text-sm font-bold text-primary-600 dark:text-primary-400 group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors">
                        #{order.display_code}
                      </div>
                    </div>

                    {/* Order Metadata */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400">
                        {/* Created Time */}
                        <Clock className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">
                          {new Date(order.created_at).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>

                        {/* Customer Name (if exists) */}
                        {order.customer_name && (
                          <>
                            <span>•</span>
                            <User className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{order.customer_name}</span>
                          </>
                        )}

                        {/* Item Count */}
                        <span>•</span>
                        <span>{order.item_count} items</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Order Total */}
                  <div className="flex-shrink-0">
                    <div className="text-xs font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(order.total)}
                    </div>
                  </div>
                </div>
              </button>
            ))}

            {/* "More orders" indicator */}
            {pendingOrders.length > 10 && (
              <div className="text-center py-2 text-xs text-gray-500 dark:text-gray-400">
                +{pendingOrders.length - 10} more orders
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
