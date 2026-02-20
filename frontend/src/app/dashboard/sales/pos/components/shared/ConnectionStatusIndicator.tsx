/**
 * Connection Status Indicator Component
 *
 * A small status indicator showing WebSocket connection status for real-time updates.
 * Displays as a colored dot with tooltip explaining the current status.
 *
 * Status Colors:
 * - Green: Connected and receiving real-time updates
 * - Amber: Connecting or reconnecting
 * - Red: Error (will retry automatically)
 *
 * Extracted from:
 * - Designer POS: page.tsx (lines 322-352)
 * - Accounting POS: accounting/page.tsx (lines 709-739)
 *
 * @module ConnectionStatusIndicator
 */

'use client';

import type { ConnectionStatus } from '@/hooks/useOrders';

/**
 * Props for ConnectionStatusIndicator component
 */
export interface ConnectionStatusIndicatorProps {
  /**
   * Current WebSocket connection status
   */
  status: ConnectionStatus;

  /**
   * Optional custom class name for styling
   */
  className?: string;
}

/**
 * Connection Status Indicator Component
 *
 * Displays a small colored dot indicating the WebSocket connection status.
 * Includes hover tooltip with descriptive status message.
 *
 * @param props - Component props
 * @returns Status indicator element
 *
 * @example
 * ```tsx
 * import { ConnectionStatusIndicator } from './components/shared/ConnectionStatusIndicator';
 * import { useOrders } from '@/hooks/useOrders';
 *
 * function POSHeader() {
 *   const { connectionStatus } = useOrders({});
 *
 *   return (
 *     <div className="header">
 *       <h1>POS System</h1>
 *       <ConnectionStatusIndicator status={connectionStatus} />
 *     </div>
 *   );
 * }
 * ```
 */
export function ConnectionStatusIndicator({
  status,
  className = '',
}: ConnectionStatusIndicatorProps) {
  /**
   * Status Configuration Map
   *
   * Defines visual appearance and tooltip text for each connection state:
   * - color: Tailwind CSS class for dot color
   * - title: Tooltip text explaining current status
   */
  const statusConfig = {
    connected: {
      color: 'bg-green-500',
      title: 'Real-time sync active',
    },
    connecting: {
      color: 'bg-amber-500',
      title: 'Connecting to server...',
    },
    disconnected: {
      color: 'bg-amber-500',
      title: 'Reconnecting to server...',
    },
    error: {
      color: 'bg-red-500',
      title: 'Connection error - retrying...',
    },
  };

  // Get configuration for current status
  const config = statusConfig[status];

  return (
    <div
      className={`flex items-center px-1 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-help ${className}`}
      title={config.title}
    >
      {/* Status Dot */}
      <div
        className={`
          w-2 h-2 rounded-full
          ${config.color}
          ${status === 'connecting' || status === 'disconnected' ? 'animate-pulse' : ''}
        `}
      />
    </div>
  );
}
