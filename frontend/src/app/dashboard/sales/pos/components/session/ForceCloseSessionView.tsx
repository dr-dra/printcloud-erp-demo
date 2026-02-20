/**
 * Force Close Session View Component
 *
 * Full-screen view displayed when a stale cash drawer session is detected.
 * A "stale session" is an unclosed session from a previous day/shift that must
 * be closed before a new session can be opened.
 *
 * Features:
 * - Prominent warning message about unclosed session
 * - Display old session details (ID, opened date, opening balance)
 * - Force close form requiring actual cash count
 * - Mandatory closing notes (minimum 10 characters) to document the reason
 * - Validation to ensure both fields are filled before submission
 *
 * Business Rule:
 * Sessions should be closed at the end of each shift. If a cashier forgets to
 * close their session, the next user must force-close it before opening a new one.
 * This ensures accountability and prevents multiple concurrent sessions.
 *
 * Extracted from:
 * - Accounting POS: accounting/page.tsx (lines 940-1036)
 *
 * @module ForceCloseSessionView
 */

'use client';

import { useState } from 'react';
import type { CashDrawerSession } from '@/lib/posApi';

/**
 * Props for ForceCloseSessionView component
 */
export interface ForceCloseSessionViewProps {
  /**
   * The stale session that needs to be force-closed
   */
  currentSession: CashDrawerSession;

  /**
   * Whether force close action is in progress
   */
  isLoading: boolean;

  /**
   * Callback when user force-closes the old session
   * @param actualBalance - Actual cash counted in drawer
   * @param closingNotes - Reason for force close (min 10 chars)
   */
  onForceClose: (actualBalance: string, closingNotes: string) => Promise<void>;
}

/**
 * Force Close Session View Component
 *
 * Displayed when a session from a previous shift is still open.
 * Forces the current user to close the old session before proceeding.
 *
 * @param props - Component props
 * @returns Force close session view element
 *
 * @example
 * ```tsx
 * import { ForceCloseSessionView } from './components/session/ForceCloseSessionView';
 * import { useSessionManagement } from './hooks/useSessionManagement';
 *
 * function AccountingPOS() {
 *   const session = useSessionManagement(locationId);
 *
 *   if (session.currentSession?.is_stale) {
 *     return (
 *       <ForceCloseSessionView
 *         currentSession={session.currentSession}
 *         isLoading={session.isLoading}
 *         onForceClose={session.handleForceCloseOldSession}
 *       />
 *     );
 *   }
 *
 *   return <POSInterface />;
 * }
 * ```
 */
export function ForceCloseSessionView({
  currentSession,
  isLoading,
  onForceClose,
}: ForceCloseSessionViewProps) {
  // Local state for force close form inputs
  const [forceCloseActualBalance, setForceCloseActualBalance] = useState('');
  const [forceCloseNotes, setForceCloseNotes] = useState('');

  /**
   * Handle force close form submission
   * Validates that both fields are filled and notes meet minimum length
   */
  const handleSubmit = async () => {
    await onForceClose(forceCloseActualBalance, forceCloseNotes);
    // Clear form on success (parent will handle UI transition)
    setForceCloseActualBalance('');
    setForceCloseNotes('');
  };

  /**
   * Determine if form is valid for submission
   * Requirements:
   * - Actual balance must be entered
   * - Closing notes must be at least 10 characters
   */
  const isFormValid = forceCloseActualBalance.trim() !== '' && forceCloseNotes.trim().length >= 10;

  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
      {/* LEFT COLUMN: Warning & Previous Session Info */}
      <div className="flex flex-col gap-4">
        {/* Warning Message */}
        <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-lg p-6">
          <h3 className="text-lg font-bold text-red-900 dark:text-red-100 mb-2">
            ⚠️ Unclosed Session Detected
          </h3>
          <p className="text-sm text-red-800 dark:text-red-200">
            You have an open session from a previous shift that must be closed before opening a new
            session.
          </p>
        </div>

        {/* Previous Session Details Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex-1">
          <h4 className="text-base font-bold text-gray-900 dark:text-white mb-4">
            Previous Session Details
          </h4>

          <div className="space-y-4">
            {/* Session ID */}
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Session ID
              </label>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {currentSession.session_number}
              </p>
            </div>

            {/* Opened Date (Long Format) */}
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Opened On
              </label>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {new Date(currentSession.opened_at).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>

            {/* Opening Balance */}
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Opening Balance
              </label>
              <p className="text-lg font-bold text-primary-600 dark:text-primary-400">
                Rs. {parseFloat(currentSession.opening_balance).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Force Close Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex flex-col">
        <h4 className="text-base font-bold text-gray-900 dark:text-white mb-4">
          Close Previous Session
        </h4>

        <div className="space-y-4 flex-1">
          {/* Actual Cash Counted Input */}
          <div>
            <label
              htmlFor="forceCloseActualBalance"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Actual Cash Counted on{' '}
              {new Date(currentSession.opened_at).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}{' '}
              <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              {/* Currency Prefix */}
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 text-sm font-semibold">Rs.</span>
              </div>
              <input
                type="number"
                id="forceCloseActualBalance"
                className="pl-12 w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-base font-semibold rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-3"
                placeholder="0.00"
                value={forceCloseActualBalance}
                onChange={(e) => setForceCloseActualBalance(e.target.value)}
                step="0.01"
                autoFocus
              />
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Count the physical cash in the drawer and enter the exact amount
            </p>
          </div>

          {/* Closing Notes (Mandatory Explanation) */}
          <div className="flex-1">
            <label
              htmlFor="forceCloseNotes"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Closing Notes <span className="text-red-500">*</span>
            </label>
            <textarea
              id="forceCloseNotes"
              rows={4}
              className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-3 resize-none"
              placeholder="Explain why this session wasn't closed properly (minimum 10 characters)..."
              value={forceCloseNotes}
              onChange={(e) => setForceCloseNotes(e.target.value)}
            />
            {/* Character Counter */}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {forceCloseNotes.length}/10 characters minimum
            </p>
          </div>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={!isFormValid || isLoading}
          className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors mt-4"
        >
          {isLoading ? 'Closing Session...' : 'Close Old Session & Continue'}
        </button>
      </div>
    </div>
  );
}
