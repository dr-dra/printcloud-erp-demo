/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Dashboard Tab Component (Management View)
 *
 * Displays comprehensive session statistics dashboard for cashiers and managers.
 * Shows real-time session performance metrics, payment breakdown, and sales analytics.
 *
 * Features:
 * - Session overview: Opening balance, expected cash total, sales volume
 * - Session status with manual refresh button
 * - Payment method breakdown (Cash, Card, LankaQR, Other)
 * - Category performance analysis
 * - Top contributors leaderboard (designer/user rankings)
 * - Completed vs Pending orders statistics
 *
 * Use Cases:
 * - Cashiers: Monitor their current shift performance
 * - Managers: Oversee all cash drawer sessions across locations
 * - End-of-shift review: Verify totals before closing session
 *
 * Extracted from:
 * - ManagementView: ManagementView.tsx (lines 172-313)
 *
 * @module DashboardTab
 */

'use client';

import { Card, Badge, Button } from 'flowbite-react';
import { LayoutDashboard, FileText, RefreshCw } from 'lucide-react';
import { formatCurrency } from '../../utils/currency';
import type { SessionReport } from '@/lib/posApi';

/**
 * Props for DashboardTab component
 */
export interface DashboardTabProps {
  /**
   * Current session report data
   * Null if no session is open or data is loading
   */
  session: SessionReport | null;

  /**
   * Callback when user clicks refresh button
   * Reloads session data from server
   */
  onRefresh: () => void;
}

/**
 * Dashboard Tab Component
 *
 * Displays session statistics and performance metrics.
 *
 * @param props - Component props
 * @returns Dashboard tab element
 *
 * @example
 * ```tsx
 * import { DashboardTab } from './components/management/DashboardTab';
 *
 * function ManagementView() {
 *   const [sessionData, setSessionData] = useState<SessionReport | null>(null);
 *   const [activeTab, setActiveTab] = useState(0);
 *
 *   const loadSession = async () => {
 *     const data = await getSessionReport(sessionId);
 *     setSessionData(data);
 *   };
 *
 *   return (
 *     <div>
 *       {activeTab === 0 && (
 *         <DashboardTab
 *           session={sessionData}
 *           onRefresh={loadSession}
 *         />
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function DashboardTab({ session, onRefresh }: DashboardTabProps) {
  /**
   * Extract payment breakdown from session data
   * Defaults to zero values if no data available
   */
  const paymentBreakdown = session?.payment_breakdown || {
    cash: 0,
    card: 0,
    lanka_qr: 0,
    other: 0,
  };

  /**
   * Extract order statistics from session data
   * Defaults to zero values if no data available
   */
  const stats = session?.stats || {
    completed_orders: 0,
    pending_orders: 0,
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto mt-4">
      {/* TOP TOTALS GRID - 4 Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Opening Balance Card */}
        <Card className="border-l-4 border-l-blue-500">
          <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400">Opening Balance</h3>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {session ? formatCurrency(session.opening_balance) : '-'}
          </p>
        </Card>

        {/* Expected Cash Total Card */}
        <Card className="border-l-4 border-l-emerald-500">
          <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Expected Total (Cash)
          </h3>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
            {session ? formatCurrency(session.expected_balance || 0) : '-'}
          </p>
        </Card>

        {/* Sales Volume Card (Completed + Pending) */}
        <Card className="border-l-4 border-l-primary-500">
          <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400">Sales Volume</h3>
          <div className="flex justify-between items-end">
            {/* Completed Orders */}
            <div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {session ? stats.completed_orders : '-'}
              </p>
              <p className="text-[10px] text-gray-500">Completed</p>
            </div>
            {/* Pending Orders */}
            <div className="text-right">
              <p className="text-lg font-semibold text-amber-500">
                {session ? stats.pending_orders : '-'}
              </p>
              <p className="text-[10px] text-gray-500">Pending</p>
            </div>
          </div>
        </Card>

        {/* Session Status Card with Refresh */}
        <Card className="border-l-4 border-l-purple-500">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400">Session Status</h3>
            <Button size="xs" color="gray" onClick={onRefresh}>
              <RefreshCw className="w-3 h-3" />
            </Button>
          </div>
          <Badge color={session?.status === 'open' ? 'success' : 'failure'} className="w-fit">
            {session?.status?.toUpperCase() || '-'}
          </Badge>
        </Card>
      </div>

      {/* DETAILED ANALYTICS GRID - 3 Analysis Sections */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Payment Breakdown Card */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <FileText className="w-5 h-5 text-emerald-600" />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white">Payment Breakdown</h3>
          </div>

          <div className="space-y-3">
            {/* Cash */}
            <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-sm text-gray-600 dark:text-gray-400">Cash</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatCurrency(paymentBreakdown.cash)}
              </span>
            </div>

            {/* Card */}
            <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-sm text-gray-600 dark:text-gray-400">Card</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatCurrency(paymentBreakdown.card)}
              </span>
            </div>

            {/* LankaQR */}
            <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-sm text-gray-600 dark:text-gray-400">LankaQR</span>
              <span className="font-semibold text-primary-600 dark:text-primary-400">
                {formatCurrency(paymentBreakdown.lanka_qr)}
              </span>
            </div>

            {/* Other */}
            <div className="flex justify-between items-center pt-1">
              <span className="text-xs text-gray-400 italic">Other</span>
              <span className="text-xs text-gray-400">
                {formatCurrency(paymentBreakdown.other)}
              </span>
            </div>
          </div>
        </Card>

        {/* Category Performance Card */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <LayoutDashboard className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white">Category Performance</h3>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {session?.category_performance?.length > 0 ? (
              session.category_performance.map((cat: any, i: number) => (
                <div
                  key={i}
                  className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <span
                    className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate mr-2"
                    title={cat.name}
                  >
                    {cat.name}
                  </span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white whitespace-nowrap">
                    {formatCurrency(cat.value)}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No sales data available</p>
            )}
          </div>
        </Card>

        {/* Top Contributors Leaderboard */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <RefreshCw className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white">Top Contributors</h3>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {session?.leaderboard?.length > 0 ? (
              session.leaderboard.map((user: any, i: number) => (
                <div
                  key={i}
                  className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  {/* Rank & Name */}
                  <div className="flex items-center gap-2 overflow-hidden">
                    {/* Rank Badge */}
                    <div className="w-6 h-6 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center text-[10px] font-bold text-primary-600 flex-shrink-0">
                      {i + 1}
                    </div>
                    {/* User Name */}
                    <span
                      className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate"
                      title={user.name}
                    >
                      {user.name}
                    </span>
                  </div>

                  {/* Sales Total */}
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap ml-2">
                    {formatCurrency(user.value)}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No designer data available</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
