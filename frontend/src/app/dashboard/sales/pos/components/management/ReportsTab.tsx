/**
 * Reports Tab Component (Management View)
 *
 * Session reporting interface with X-Report and Z-Report functionality.
 *
 * Features:
 * - X-Report: Read-only snapshot of current session (doesn't close register)
 * - Z-Report: End-of-day report that closes the session
 * - Session reconciliation with variance tracking
 * - Cash drawer closing with commercial income and payout adjustments
 *
 * Reports Explained:
 * - **X-Report**: Interim report showing current session status, useful for shift changes
 *   or mid-day reviews. Does not affect the session state.
 * - **Z-Report**: Final report that closes the session, reconciles cash, and generates
 *   the official end-of-day report. This action is permanent and cannot be undone.
 *
 * Business Rules:
 * - X-Report is always available when a session is active
 * - Z-Report requires all pending orders to be completed or cancelled
 * - Closing a session generates a permanent financial record
 * - Variance tracking ensures accountability for cash discrepancies
 *
 * Extracted from:
 * - ManagementView: ManagementView.tsx (lines 1691-2133)
 *
 * @module ReportsTab
 */

'use client';

import { useState } from 'react';
import { Card, Button } from 'flowbite-react';
import { FileText, AlertTriangle } from 'lucide-react';
import { CloseSessionModal } from './reports/CloseSessionModal';
import type { CashDrawerSession } from '@/lib/posApi';

/**
 * Props for ReportsTab component
 */
export interface ReportsTabProps {
  /**
   * Current active session (null if no session open)
   */
  session: CashDrawerSession | null;

  /**
   * Callback to refresh session data
   */
  onRefresh: () => void;

  /**
   * Callback when session is closed
   * Parent should refresh session state and possibly navigate away
   */
  onSessionClosed?: () => void;
}

/**
 * Reports Tab Component
 *
 * Displays X-Report and Z-Report interfaces for session management.
 *
 * @param props - Component props
 * @returns Reports tab element
 *
 * @example
 * ```tsx
 * import { ReportsTab } from './components/management/ReportsTab';
 *
 * function ManagementView() {
 *   const [sessionData, setSessionData] = useState<CashDrawerSession | null>(null);
 *   const [activeTab, setActiveTab] = useState(0);
 *
 *   const loadSession = async () => {
 *     const data = await getOpenCashDrawerSession(locationId);
 *     setSessionData(data);
 *   };
 *
 *   const handleSessionClosed = () => {
 *     loadSession(); // Refresh to get new session state
 *     // Optionally navigate back to POS or show success message
 *   };
 *
 *   return (
 *     <div>
 *       {activeTab === 1 && (
 *         <ReportsTab
 *           session={sessionData}
 *           onRefresh={loadSession}
 *           onSessionClosed={handleSessionClosed}
 *         />
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function ReportsTab({ session, onRefresh: _onRefresh, onSessionClosed }: ReportsTabProps) {
  // Close session modal state
  const [showCloseModal, setShowCloseModal] = useState(false);

  /**
   * Handle successful session closure
   */
  const handleSessionClosed = () => {
    setShowCloseModal(false);
    if (onSessionClosed) {
      onSessionClosed();
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
      {/* X-REPORT CARD (Current Status - Read-Only) */}
      <Card className="h-fit">
        <div className="flex items-center gap-3 mb-4">
          <FileText className="w-8 h-8 text-blue-600" />
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">X-Report</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Current Session Snapshot</p>
          </div>
        </div>

        {session ? (
          <>
            {/* Session Details */}
            <div className="space-y-3 border-t border-gray-100 dark:border-gray-700 pt-4">
              {/* Session ID */}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Session ID</span>
                <span className="font-mono text-gray-900 dark:text-white">
                  {session.session_number}
                </span>
              </div>

              {/* Opening Balance */}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Opening Balance</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  Rs. {session.opening_balance}
                </span>
              </div>

              {/* Expected Cash in Drawer */}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Expected Cash in Drawer</span>
                <span className="font-bold text-lg text-emerald-600 dark:text-emerald-400">
                  Rs. {session.expected_balance || '0.00'}
                </span>
              </div>
            </div>

            {/* Information Notice */}
            <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <p className="text-xs text-blue-700 dark:text-blue-300 text-center">
                X-Report is a read-only snapshot. It does not close the register.
              </p>
            </div>
          </>
        ) : (
          /* No Active Session */
          <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6 text-center">
              <FileText className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                No active session. Open a session in POS-Payment to view current status.
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Z-REPORT CARD (Close Session - Destructive Action) */}
      <Card className="h-fit border-l-4 border-l-red-500">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-8 h-8 text-red-600" />
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Z-Report</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">End of Day / Close Register</p>
          </div>
        </div>

        {/* Warning Message */}
        <div className="text-gray-600 dark:text-gray-400 text-sm mb-6">
          Performing a Z-Report will close the current session, reconcile cash, and generate the
          final daily report. This action cannot be undone.
        </div>

        {/* Close Session Button */}
        <Button color="failure" onClick={() => setShowCloseModal(true)} disabled={!session}>
          {session ? 'Perform Z-Report & Close' : 'No Active Session'}
        </Button>
      </Card>

      {/* CLOSE SESSION MODAL */}
      <CloseSessionModal
        show={showCloseModal}
        session={session}
        onClose={() => setShowCloseModal(false)}
        onSessionClosed={handleSessionClosed}
      />
    </div>
  );
}
