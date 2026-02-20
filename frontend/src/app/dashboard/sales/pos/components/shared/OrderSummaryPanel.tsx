/**
 * Order Summary Panel Component
 *
 * Displays order totals (subtotal, tax, grand total) and action buttons.
 * Includes WebSocket connection status indicator.
 *
 * This component serves as the "checkout" panel showing financial summary
 * and providing the main action button (Save Order / Pay Now).
 *
 * Extracted from:
 * - Designer POS: page.tsx (lines 733-768)
 * - Accounting POS: accounting/page.tsx (lines 1720-1763)
 *
 * @module OrderSummaryPanel
 */

'use client';

import type { ReactNode } from 'react';
import { formatCurrency } from '../../utils/currency';
import { ConnectionStatusIndicator } from './ConnectionStatusIndicator';
import type { ConnectionStatus } from '@/hooks/useOrders';

/**
 * Props for OrderSummaryPanel component
 */
export interface OrderSummaryPanelProps {
  /**
   * Order subtotal (before tax)
   */
  subtotal: number;

  /**
   * Total tax amount
   */
  tax: number;

  /**
   * Grand total (subtotal + tax)
   */
  total: number;

  /**
   * Current WebSocket connection status
   */
  connectionStatus: ConnectionStatus;

  /**
   * Main action button label
   */
  actionLabel: string;

  /**
   * Callback when action button is clicked
   */
  onAction: () => void;

  /**
   * Whether action button is disabled
   */
  actionDisabled: boolean;

  /**
   * Whether action is in progress (shows loading state)
   */
  isLoading: boolean;

  /**
   * Optional additional content (e.g., secondary buttons)
   */
  children?: ReactNode;
}

/**
 * Order Summary Panel Component
 *
 * Displays order financial summary and primary action button.
 *
 * @param props - Component props
 * @returns Order summary panel element
 *
 * @example
 * ```tsx
 * import { OrderSummaryPanel } from './components/shared/OrderSummaryPanel';
 * import { useOrderCart } from './hooks/useOrderCart';
 * import { useOrders } from './hooks/useOrders';
 *
 * function POSPage() {
 *   const cart = useOrderCart();
 *   const { connectionStatus } = useOrders({});
 *   const [isLoading, setIsLoading] = useState(false);
 *
 *   const handleSave = async () => {
 *     setIsLoading(true);
 *     await saveOrder();
 *     setIsLoading(false);
 *   };
 *
 *   return (
 *     <OrderSummaryPanel
 *       subtotal={cart.subtotal}
 *       tax={cart.tax}
 *       total={cart.total}
 *       connectionStatus={connectionStatus}
 *       actionLabel="Save Order"
 *       onAction={handleSave}
 *       actionDisabled={cart.orderItems.length === 0}
 *       isLoading={isLoading}
 *     />
 *   );
 * }
 * ```
 */
export function OrderSummaryPanel({
  subtotal,
  tax,
  total,
  connectionStatus,
  actionLabel,
  onAction,
  actionDisabled,
  isLoading,
  children,
}: OrderSummaryPanelProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex-1 flex flex-col min-h-0">
      {/* Panel Header with Connection Status */}
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Order Summary</h2>
        <ConnectionStatusIndicator status={connectionStatus} />
      </div>

      {/* Summary Content */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Order Totals */}
        <div className="space-y-2 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          {/* Subtotal Row */}
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {formatCurrency(subtotal)}
            </span>
          </div>

          {/* Tax Row */}
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600 dark:text-gray-400">Tax</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {formatCurrency(tax)}
            </span>
          </div>
        </div>

        {/* Grand Total */}
        <div className="flex justify-between items-center mb-6 flex-shrink-0">
          <span className="text-lg font-semibold text-gray-900 dark:text-white">TOTAL</span>
          <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">
            {formatCurrency(total)}
          </span>
        </div>

        {/* Action Buttons Area */}
        <div className="space-y-3">
          {/* Primary Action Button */}
          <button
            onClick={onAction}
            disabled={actionDisabled || isLoading}
            className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors flex-shrink-0"
          >
            {isLoading ? 'Processing...' : actionLabel}
          </button>

          {/* Additional Action Buttons (via children prop) */}
          {children}
        </div>
      </div>
    </div>
  );
}
