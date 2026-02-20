/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Use Close Session Hook
 *
 * Custom hook for managing cash drawer session closing logic and calculations.
 * Handles Z-Report generation with variance tracking and reconciliation.
 *
 * Features:
 * - Expected cash balance calculation (opening + cash sales + commercial - payouts)
 * - Variance calculation and percentage tracking
 * - Session closing API integration
 * - Error handling for pending orders and already-closed sessions
 * - Form state management for closing inputs
 *
 * Business Logic:
 * - Expected Cash = Opening Balance + POS Cash Sales + Commercial Income - Payouts
 * - Variance = Actual Cash Counted - Expected Cash
 * - Variance % = (Variance / Expected Cash) × 100
 * - Sessions with pending orders cannot be closed (must complete or cancel orders first)
 *
 * Extracted from:
 * - ManagementView: ManagementView.tsx (lines 1693-1802)
 *
 * @module useCloseSession
 */

'use client';

import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { toast } from 'sonner';
import { updateCashDrawerSession, type CashDrawerSession, type SessionReport } from '@/lib/posApi';

/**
 * Form state for session closing
 */
export interface CloseSessionFormState {
  actualBalance: string;
  closingNotes: string;
  commercialPrintingIncome: string;
  payouts: string;
}

/**
 * Return type for useCloseSession hook
 */
export interface UseCloseSessionReturn {
  /**
   * Form state values
   */
  formState: CloseSessionFormState;

  /**
   * Update form state
   */
  setFormState: Dispatch<SetStateAction<CloseSessionFormState>>;

  /**
   * Whether close operation is in progress
   */
  isSubmitting: boolean;

  /**
   * Calculate expected cash balance
   */
  calculateExpectedBalance: (
    session: CashDrawerSession | null,
    reportData: SessionReport | null,
  ) => number;

  /**
   * Calculate variance (actual - expected)
   */
  calculateVariance: (
    session: CashDrawerSession | null,
    reportData: SessionReport | null,
  ) => number;

  /**
   * Calculate variance as percentage of expected
   */
  calculateVariancePercentage: (
    session: CashDrawerSession | null,
    reportData: SessionReport | null,
  ) => number;

  /**
   * Submit session closure
   */
  handleCloseSession: (session: CashDrawerSession | null, onSuccess: () => void) => Promise<void>;

  /**
   * Reset form to initial state
   */
  resetForm: () => void;

  /**
   * Latest closed session response (includes Z-report)
   */
  closedSessionResult: CashDrawerSession | null;

  /**
   * Clear the closed session result
   */
  clearClosedSessionResult: () => void;
}

/**
 * Initial form state
 */
const initialFormState: CloseSessionFormState = {
  actualBalance: '',
  closingNotes: '',
  commercialPrintingIncome: '0',
  payouts: '0',
};

/**
 * Use Close Session Hook
 *
 * Manages session closing logic, calculations, and API integration.
 *
 * @returns Hook state and functions
 *
 * @example
 * ```tsx
 * import { useCloseSession } from './hooks/useCloseSession';
 *
 * function CloseSessionModal({ session, reportData, onSuccess }) {
 *   const closeSession = useCloseSession();
 *
 *   const expectedCash = closeSession.calculateExpectedBalance(session, reportData);
 *   const variance = closeSession.calculateVariance(session, reportData);
 *
 *   return (
 *     <div>
 *       <input
 *         value={closeSession.formState.actualBalance}
 *         onChange={(e) => closeSession.setFormState({
 *           ...closeSession.formState,
 *           actualBalance: e.target.value
 *         })}
 *       />
 *       <p>Expected: Rs. {expectedCash.toFixed(2)}</p>
 *       <p>Variance: Rs. {variance.toFixed(2)}</p>
 *       <button
 *         onClick={() => closeSession.handleCloseSession(session, onSuccess)}
 *         disabled={closeSession.isSubmitting}
 *       >
 *         Close Session
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useCloseSession(): UseCloseSessionReturn {
  // Form state
  const [formState, setFormState] = useState<CloseSessionFormState>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [closedSessionResult, setClosedSessionResult] = useState<CashDrawerSession | null>(null);

  /**
   * Calculate expected cash balance
   *
   * Formula: Opening Balance + POS Cash Sales + Commercial Income - Payouts
   *
   * @param session - Current cash drawer session
   * @param reportData - Session report with payment breakdown
   * @returns Expected cash amount
   */
  const calculateExpectedBalance = (
    session: CashDrawerSession | null,
    reportData: SessionReport | null,
  ): number => {
    if (!session || !reportData) return 0;

    const opening = parseFloat(session.opening_balance || '0');
    const posCashSales = reportData.payment_breakdown.cash || 0;
    const commercial = parseFloat(formState.commercialPrintingIncome || '0');
    const payoutAmount = parseFloat(formState.payouts || '0');

    return opening + posCashSales + commercial - payoutAmount;
  };

  /**
   * Calculate variance between actual and expected cash
   *
   * Formula: Actual Cash Counted - Expected Cash
   * - Positive variance = Over (more cash than expected)
   * - Negative variance = Short (less cash than expected)
   *
   * @param session - Current cash drawer session
   * @param reportData - Session report with payment breakdown
   * @returns Variance amount (can be positive or negative)
   */
  const calculateVariance = (
    session: CashDrawerSession | null,
    reportData: SessionReport | null,
  ): number => {
    const expected = calculateExpectedBalance(session, reportData);
    const actual = parseFloat(formState.actualBalance || '0');
    return actual - expected;
  };

  /**
   * Calculate variance as percentage of expected balance
   *
   * Formula: (Variance / Expected Cash) × 100
   *
   * @param session - Current cash drawer session
   * @param reportData - Session report with payment breakdown
   * @returns Variance percentage
   */
  const calculateVariancePercentage = (
    session: CashDrawerSession | null,
    reportData: SessionReport | null,
  ): number => {
    const expected = calculateExpectedBalance(session, reportData);
    if (expected === 0) return 0;
    return (calculateVariance(session, reportData) / expected) * 100;
  };

  /**
   * Handle session closure submission
   *
   * Validates form and submits to API. Handles specific error cases:
   * - Pending orders: Cannot close session with unpaid orders
   * - Already closed: Session was closed by another user
   *
   * @param session - Current cash drawer session
   * @param onSuccess - Callback after successful closure
   */
  const handleCloseSession = async (
    session: CashDrawerSession | null,
    onSuccess: () => void,
  ): Promise<void> => {
    if (!session) {
      toast.error('No active session to close');
      return;
    }

    if (!formState.actualBalance) {
      toast.error('Please enter actual cash counted');
      return;
    }

    setIsSubmitting(true);

    try {
      const closeData = {
        status: 'closed',
        actual_balance: parseFloat(formState.actualBalance),
        commercial_printing_income: parseFloat(formState.commercialPrintingIncome),
        payouts: parseFloat(formState.payouts),
        closing_notes: formState.closingNotes,
      };

      console.log('[Close Session] Sending data:', {
        session_id: session.id,
        data: closeData,
        form_state: formState,
      });

      const response = await updateCashDrawerSession(session.id, closeData);
      setClosedSessionResult(response.data);

      toast.success('Session closed successfully (Z-Report generated)');

      // Reset form fields, keep close result for display
      resetForm();

      // Notify parent component
      onSuccess();
    } catch (error: any) {
      console.error('[Close Session] Failed:', error);
      console.error('[Close Session] Error response:', error.response?.data);

      // Handle specific error cases
      if (error.response?.data?.error === 'Cannot close session with pending orders') {
        const detail = error.response.data.detail;
        const pendingCount = error.response.data.pending_count;
        const orderCodes = error.response.data.pending_orders?.join(', ') || '';

        toast.error(
          `${detail}\n\nPending orders: ${orderCodes}${pendingCount > 5 ? ` and ${pendingCount - 5} more...` : ''}`,
          { duration: 6000 },
        );
      } else if (error.response?.data?.error === 'Session is already closed') {
        toast.error('This session has already been closed. Refreshing...');
        onSuccess(); // Refresh parent state
      } else {
        toast.error(error.response?.data?.error || 'Failed to close session');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Reset form to initial state
   */
  const resetForm = () => {
    setFormState(initialFormState);
  };

  const clearClosedSessionResult = useCallback(() => {
    setClosedSessionResult(null);
  }, []);

  return {
    formState,
    setFormState,
    isSubmitting,
    calculateExpectedBalance,
    calculateVariance,
    calculateVariancePercentage,
    handleCloseSession,
    resetForm,
    closedSessionResult,
    clearClosedSessionResult,
  };
}
