/**
 * Open Session View Component
 *
 * Full-screen view displayed when no active cash drawer session exists.
 * Shows previous session summary (if available) and form to open a new session.
 *
 * Features:
 * - Display last closed session stats (sales, variance, etc.)
 * - Payment method breakdown from last session
 * - Recommended float amount
 * - Opening balance input form
 * - Optional opening notes
 *
 * Extracted from:
 * - Accounting POS: accounting/page.tsx (lines 1040-1205)
 *
 * @module OpenSessionView
 */

'use client';

import { useState } from 'react';
import { TbCashRegister } from 'react-icons/tb';
import type { LastClosedSession } from '@/lib/posApi';

/**
 * Props for OpenSessionView component
 */
export interface OpenSessionViewProps {
  /**
   * Last closed session data (null if first session ever)
   */
  lastClosedSession: LastClosedSession | null;

  /**
   * Whether session data is loading
   */
  isLoadingSession: boolean;

  /**
   * Whether open action is in progress
   */
  isLoading: boolean;

  /**
   * Callback when user opens a new session
   */
  onOpenSession: (openingBalance: string, openingNotes: string) => Promise<void>;
}

/**
 * Open Session View Component
 *
 * Displays when cashier needs to open a new cash drawer session.
 *
 * @param props - Component props
 * @returns Open session view element
 *
 * @example
 * ```tsx
 * import { OpenSessionView } from './components/session/OpenSessionView';
 * import { useSessionManagement } from './hooks/useSessionManagement';
 *
 * function AccountingPOS() {
 *   const session = useSessionManagement(locationId);
 *
 *   if (!session.cashDrawerSessionId) {
 *     return (
 *       <OpenSessionView
 *         lastClosedSession={session.lastClosedSession}
 *         isLoadingSession={session.isLoadingSession}
 *         isLoading={session.isLoadingSession}
 *         onOpenSession={session.handleOpenDrawer}
 *       />
 *     );
 *   }
 *
 *   return <POSInterface />;
 * }
 * ```
 */
export function OpenSessionView({
  lastClosedSession,
  isLoadingSession: _isLoadingSession,
  isLoading: _isLoading,
  onOpenSession,
}: OpenSessionViewProps) {
  // Local state for form inputs
  const [openingBalance, setOpeningBalance] = useState('');
  const [openingNotes, setOpeningNotes] = useState('');

  // Local loading state for submit operation
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Handle form submission
   */
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const success = await onOpenSession(openingBalance, openingNotes);
      // Clear form only on success
      if (success) {
        setOpeningBalance('');
        setOpeningNotes('');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
      {/* LEFT COLUMN: Last Session Summary */}
      <div className="flex flex-col gap-4 overflow-y-auto">
        {lastClosedSession ? (
          /* Last Session Data Display */
          <>
            {/* Session Summary Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h4 className="text-base font-bold text-gray-900 dark:text-white mb-4">
                Last Session Summary
              </h4>

              {/* Session Metadata Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Closed By
                  </label>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {lastClosedSession.user_email}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Closed At
                  </label>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {new Date(lastClosedSession.closed_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Duration
                  </label>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {lastClosedSession.duration_hours.toFixed(1)} hours
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Transactions
                  </label>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {lastClosedSession.transaction_count}
                  </p>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total Sales</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    Rs. {parseFloat(lastClosedSession.total_sales).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Actual Balance</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    Rs. {parseFloat(lastClosedSession.actual_balance).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Expected Balance</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    Rs. {parseFloat(lastClosedSession.expected_balance).toFixed(2)}
                  </span>
                </div>

                {/* Variance (with color coding) */}
                <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Variance
                  </span>
                  <span
                    className={`text-base font-bold ${
                      Math.abs(parseFloat(lastClosedSession.variance)) < 0.01
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {parseFloat(lastClosedSession.variance) >= 0 ? '+' : ''}
                    Rs. {parseFloat(lastClosedSession.variance).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Methods Breakdown */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h4 className="text-base font-bold text-gray-900 dark:text-white mb-4">
                Payment Methods
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Cash</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    Rs. {lastClosedSession.payment_breakdown.cash.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Card</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    Rs. {lastClosedSession.payment_breakdown.card.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">LankaQR</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    Rs. {lastClosedSession.payment_breakdown.lanka_qr.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Account</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    Rs. {lastClosedSession.payment_breakdown.account.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Other</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    Rs. {lastClosedSession.payment_breakdown.other.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* No Previous Session */
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <TbCashRegister className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              No previous session found. This is your first session at this location.
            </p>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Open Session Form */}
      <div className="flex flex-col gap-4">
        {/* Recommended Float Amount */}
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-300 dark:border-emerald-700 rounded-lg p-6">
          <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-200 mb-1">
            Standard Float Amount
          </p>
          <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">Rs. 5,000.00</p>
          <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-2">
            Recommended cash to keep in drawer at start of shift
          </p>
        </div>

        {/* Opening Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex-1 flex flex-col">
          <h4 className="text-base font-bold text-gray-900 dark:text-white mb-4">
            Start Your Shift
          </h4>

          <div className="space-y-4 flex-1">
            {/* Opening Balance Input */}
            <div>
              <label
                htmlFor="openingBalance"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Opening Balance <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                {/* Currency Prefix */}
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 text-sm font-semibold">Rs.</span>
                </div>
                <input
                  type="number"
                  id="openingBalance"
                  className="pl-12 w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-base font-semibold rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-3"
                  placeholder="5000.00"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  step="0.01"
                  autoFocus
                />
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Physically count the cash in the drawer and enter the exact amount
              </p>
            </div>

            {/* Opening Notes (Optional) */}
            <div className="flex-1">
              <label
                htmlFor="openingNotes"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Opening Notes (Optional)
              </label>
              <textarea
                id="openingNotes"
                rows={3}
                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-3 resize-none"
                placeholder="Any notes about the opening (e.g., denomination breakdown)..."
                value={openingNotes}
                onChange={(e) => setOpeningNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={!openingBalance || isSubmitting}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors mt-4"
            title={!openingBalance ? 'Please enter opening balance' : ''}
          >
            {isSubmitting ? 'Opening Session...' : 'Start Shift'}
          </button>
        </div>
      </div>
    </div>
  );
}
