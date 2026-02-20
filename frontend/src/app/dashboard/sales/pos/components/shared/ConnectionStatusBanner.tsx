/**
 * Connection Status Banner Component
 *
 * A prominent banner that appears when connection issues occur, providing
 * detailed information about the connection problem and reassurance to the user.
 *
 * Only displays when status is 'error' or 'disconnected'.
 * Automatically hides when connection is restored.
 *
 * Extracted from:
 * - Designer POS: page.tsx (lines 374-406)
 * - Accounting POS: accounting/page.tsx (lines 857-889)
 *
 * @module ConnectionStatusBanner
 */

'use client';

import type { ConnectionStatus } from '@/hooks/useOrders';

/**
 * Props for ConnectionStatusBanner component
 */
export interface ConnectionStatusBannerProps {
  /**
   * Current WebSocket connection status
   */
  status: ConnectionStatus;
}

/**
 * Connection Status Banner Component
 *
 * Displays a prominent banner when connection issues occur.
 * Provides context-appropriate messaging and visual feedback.
 *
 * @param props - Component props
 * @returns Banner element (or null if connected)
 *
 * @example
 * ```tsx
 * import { ConnectionStatusBanner } from './components/shared/ConnectionStatusBanner';
 * import { useOrders } from '@/hooks/useOrders';
 *
 * function POSPage() {
 *   const { connectionStatus } = useOrders({});
 *
 *   return (
 *     <div>
 *       <ConnectionStatusBanner status={connectionStatus} />
 *     </div>
 *   );
 * }
 * ```
 */
export function ConnectionStatusBanner({ status }: ConnectionStatusBannerProps) {
  // Don't show banner if connected or connecting normally
  if (status === 'connected' || status === 'connecting') {
    return null;
  }

  /**
   * Banner Styling Based on Status
   *
   * Error state (critical): Red background, more urgent messaging
   * Disconnected state (recoverable): Amber background, reassuring messaging
   */
  const isError = status === 'error';

  const bannerClasses = isError
    ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
    : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800';

  const titleClasses = isError
    ? 'text-red-800 dark:text-red-200'
    : 'text-amber-800 dark:text-amber-200';

  const descriptionClasses = isError
    ? 'text-red-600 dark:text-red-300'
    : 'text-amber-600 dark:text-amber-300';

  const dotColor = isError ? 'bg-red-500' : 'bg-amber-500';

  return (
    <div className={`mb-3 px-4 py-2 rounded-lg flex items-center justify-between ${bannerClasses}`}>
      <div className="flex items-center gap-3">
        {/* Pulsing Status Dot */}
        <div className={`w-2 h-2 rounded-full ${dotColor} animate-pulse`} />

        {/* Status Message */}
        <div>
          {/* Title */}
          <p className={`text-sm font-medium ${titleClasses}`}>
            {isError ? 'Connection Lost' : 'Reconnecting...'}
          </p>

          {/* Description */}
          <p className={`text-xs ${descriptionClasses}`}>
            {isError
              ? 'Attempting to reconnect. Your work is saved locally.'
              : 'Connection interrupted. Attempting to reconnect...'}
          </p>
        </div>
      </div>
    </div>
  );
}
