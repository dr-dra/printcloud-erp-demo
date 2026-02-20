/**
 * Close Session Modal Component (Z-Report)
 *
 * Modal for closing cash drawer sessions with reconciliation and variance tracking.
 * Generates Z-Report (end-of-day report) upon completion.
 *
 * Features:
 * - Session summary (ID, opened time, order counts)
 * - Expected cash breakdown with adjustable inputs
 * - Commercial printing income and payout tracking
 * - Payment methods summary
 * - Physical cash count with real-time variance calculation
 * - Color-coded variance display (green = balanced, red = discrepancy)
 * - Closing notes for documentation
 * - Warning for pending orders (blocks closure)
 *
 * Business Rules:
 * - Sessions with pending orders cannot be closed
 * - Actual cash count is required (no default value)
 * - Variance warnings shown for any discrepancy >= Rs. 0.01
 * - Commercial income and payouts default to 0
 * - Closing notes are optional but recommended for variance documentation
 *
 * Extracted from:
 * - ManagementView: ManagementView.tsx (lines 1875-2131)
 *
 * @module CloseSessionModal
 */

'use client';

import { useEffect, useState } from 'react';
import { Modal, Button, Label, TextInput, Textarea, Spinner } from 'flowbite-react';
import { toast } from 'sonner';
import {
  getSessionReport,
  type CashDrawerSession,
  type POSZReport,
  type SessionReport,
} from '@/lib/posApi';
import { useCloseSession } from './useCloseSession';

/**
 * Props for CloseSessionModal component
 */
export interface CloseSessionModalProps {
  /**
   * Whether modal is visible
   */
  show: boolean;

  /**
   * Current cash drawer session to close
   */
  session: CashDrawerSession | null;

  /**
   * Callback when modal is closed
   */
  onClose: () => void;

  /**
   * Callback when session is successfully closed
   * Parent should refresh session state
   */
  onSessionClosed: () => void;
}

/**
 * Close Session Modal Component
 *
 * Z-Report generation and session reconciliation interface.
 *
 * @param props - Component props
 * @returns Close session modal element
 *
 * @example
 * ```tsx
 * import { CloseSessionModal } from './components/management/reports/CloseSessionModal';
 *
 * function ReportsTab() {
 *   const [showCloseModal, setShowCloseModal] = useState(false);
 *   const [currentSession, setCurrentSession] = useState<CashDrawerSession | null>(null);
 *
 *   return (
 *     <div>
 *       <button onClick={() => setShowCloseModal(true)}>
 *         Perform Z-Report & Close
 *       </button>
 *       <CloseSessionModal
 *         show={showCloseModal}
 *         session={currentSession}
 *         onClose={() => setShowCloseModal(false)}
 *         onSessionClosed={() => {
 *           loadSession(); // Refresh session state
 *           setShowCloseModal(false);
 *         }}
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
export function CloseSessionModal({
  show,
  session,
  onClose,
  onSessionClosed,
}: CloseSessionModalProps) {
  // Session closing logic
  const closeSession = useCloseSession();

  // Report data state
  const [reportData, setReportData] = useState<SessionReport | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);

  /**
   * Load session report data when modal opens
   */
  useEffect(() => {
    if (show && session) {
      loadReportData();
    }
  }, [show, session?.id]);

  useEffect(() => {
    if (!show) {
      closeSession.clearClosedSessionResult();
    }
  }, [show, closeSession.clearClosedSessionResult]);

  /**
   * Load detailed session report from API
   */
  const loadReportData = async () => {
    if (!session) return;

    setIsLoadingReport(true);
    try {
      const response = await getSessionReport(session.id);
      setReportData(response.data);
    } catch (error) {
      console.error('Failed to load report data:', error);
      toast.error('Failed to load session report data');
    } finally {
      setIsLoadingReport(false);
    }
  };

  /**
   * Handle successful session closure
   */
  const handleSuccess = () => {
    closeSession.resetForm();
    setReportData(null);
  };

  /**
   * Calculate values for display
   */
  const expectedBalance = closeSession.calculateExpectedBalance(session, reportData);
  const variance = closeSession.calculateVariance(session, reportData);
  const variancePercentage = closeSession.calculateVariancePercentage(session, reportData);
  const zReport = closeSession.closedSessionResult?.z_report || null;
  const isClosed = Boolean(zReport);

  const formatMoney = (value?: string) => `Rs. ${parseFloat(value || '0').toFixed(2)}`;
  const totalPayments = (report: POSZReport | null) => {
    if (!report) return '0.00';
    const total =
      parseFloat(report.cash_total || '0') +
      parseFloat(report.card_total || '0') +
      parseFloat(report.on_account_total || '0');
    return total.toFixed(2);
  };

  /**
   * Calculate subtotal for expected cash (before payouts)
   */
  const subtotal =
    parseFloat(session?.opening_balance || '0') +
    (reportData?.payment_breakdown.cash || 0) +
    parseFloat(closeSession.formState.commercialPrintingIncome || '0');

  return (
    <Modal show={show} onClose={onClose} size="3xl">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            Close Session (Z-Report)
          </h3>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoadingReport ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="lg" />
              <span className="ml-3 text-gray-600 dark:text-gray-400 text-sm">
                Loading session data...
              </span>
            </div>
          ) : (
            <div className="space-y-4">
              {zReport && (
                <div className="bg-white dark:bg-gray-800 border border-green-200 dark:border-green-700 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Z-Report Summary (Posted)
                    </h3>
                    <Button color="light" size="xs" onClick={() => window.print()}>
                      Print Z-Report
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm mt-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Gross Sales</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatMoney(zReport.gross_sales)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Discounts</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatMoney(zReport.discounts_total)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Net Sales</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {formatMoney(zReport.net_sales)}
                      </span>
                    </div>
                    <div className="flex justify-between bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-md px-2 py-1">
                      <span className="text-yellow-800 dark:text-yellow-200 font-semibold">
                        VAT Amount
                      </span>
                      <span className="text-yellow-800 dark:text-yellow-200 font-bold">
                        {formatMoney(zReport.vat_amount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Cash</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatMoney(zReport.cash_total)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Card/Bank</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatMoney(zReport.card_total)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">On Account</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatMoney(zReport.on_account_total)}
                      </span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span className="text-gray-900 dark:text-white">Total Payments</span>
                      <span className="text-gray-900 dark:text-white">
                        Rs. {totalPayments(zReport)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-3">
                    <span>
                      Journal Entry:{' '}
                      {zReport.journal_entry ? `JE-${zReport.journal_entry}` : 'Pending'}
                    </span>
                    <span>
                      Posted:{' '}
                      {zReport.posted_at ? new Date(zReport.posted_at).toLocaleString() : 'N/A'}
                    </span>
                  </div>
                </div>
              )}

              {/* Session Info Header */}
              <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <div className="grid grid-cols-4 gap-3 text-xs">
                  <div>
                    <div className="text-gray-500 dark:text-gray-400 mb-1">Session</div>
                    <div className="font-mono font-medium text-gray-900 dark:text-white">
                      {session?.session_number}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 dark:text-gray-400 mb-1">Opened</div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {session?.opened_at
                        ? new Date(session.opened_at).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 dark:text-gray-400 mb-1">Completed</div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {reportData?.stats.completed_orders || 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 dark:text-gray-400 mb-1">Pending</div>
                    <div className="font-semibold text-orange-600">
                      {reportData?.stats.pending_orders || 0}
                    </div>
                  </div>
                </div>
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Expected Cash Breakdown (2/3 width) */}
                <div className="lg:col-span-2">
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                        Expected Cash Breakdown
                      </h3>
                    </div>
                    <div className="p-3 space-y-2">
                      {/* Opening Balance */}
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Opening Balance</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          Rs. {parseFloat(session?.opening_balance || '0').toFixed(2)}
                        </span>
                      </div>

                      {/* POS Cash Sales */}
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">POS Cash Sales</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          Rs. {(reportData?.payment_breakdown.cash || 0).toFixed(2)}
                        </span>
                      </div>

                      {/* Commercial Printing Income (Editable) */}
                      <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                        <Label
                          htmlFor="commercial"
                          className="text-xs text-gray-600 dark:text-gray-400 mb-1 block"
                        >
                          Commercial Printing Income
                        </Label>
                        <TextInput
                          id="commercial"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={closeSession.formState.commercialPrintingIncome}
                          onChange={(e) =>
                            closeSession.setFormState({
                              ...closeSession.formState,
                              commercialPrintingIncome: e.target.value,
                            })
                          }
                          sizing="sm"
                          addon="Rs."
                        />
                      </div>

                      {/* Subtotal */}
                      <div className="flex justify-between text-sm pt-2 border-t border-gray-200 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          Rs. {subtotal.toFixed(2)}
                        </span>
                      </div>

                      {/* Payouts (Editable) */}
                      <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                        <Label
                          htmlFor="payouts"
                          className="text-xs text-gray-600 dark:text-gray-400 mb-1 block"
                        >
                          Less: Payouts
                        </Label>
                        <TextInput
                          id="payouts"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={closeSession.formState.payouts}
                          onChange={(e) =>
                            closeSession.setFormState({
                              ...closeSession.formState,
                              payouts: e.target.value,
                            })
                          }
                          sizing="sm"
                          addon="Rs."
                        />
                      </div>

                      {/* Expected Cash Total */}
                      <div className="flex justify-between items-center pt-2 border-t-2 border-gray-900 dark:border-gray-100 mt-2">
                        <span className="font-semibold text-gray-900 dark:text-white">
                          Expected Cash
                        </span>
                        <span className="font-bold text-lg text-gray-900 dark:text-white">
                          Rs. {expectedBalance.toFixed(2)}
                        </span>
                      </div>

                      {/* Account Payment Note */}
                      {reportData && reportData.payment_breakdown.account > 0 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 italic pt-2">
                          Note: Account payments (Rs.{' '}
                          {reportData.payment_breakdown.account.toFixed(2)}) excluded
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Payment Methods Summary (1/3 width) */}
                <div>
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                        Payment Summary
                      </h3>
                    </div>
                    <div className="p-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Cash</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          Rs. {(reportData?.payment_breakdown.cash || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Card</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          Rs. {(reportData?.payment_breakdown.card || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">LankaQR</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          Rs. {(reportData?.payment_breakdown.lanka_qr || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Account</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          Rs. {(reportData?.payment_breakdown.account || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Other</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          Rs. {(reportData?.payment_breakdown.other || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm font-semibold pt-2 border-t border-gray-900 dark:border-gray-100">
                        <span className="text-gray-900 dark:text-white">Total</span>
                        <span className="text-gray-900 dark:text-white">
                          Rs.{' '}
                          {Object.values(reportData?.payment_breakdown || {})
                            .reduce((a, b) => a + b, 0)
                            .toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Physical Cash Count */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Physical Cash Count
                  </h3>
                </div>
                <div className="p-3">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Actual Cash Input */}
                    <div>
                      <Label
                        htmlFor="actual"
                        className="text-xs text-gray-600 dark:text-gray-400 mb-1 block"
                      >
                        Actual Cash Counted *
                      </Label>
                      <TextInput
                        id="actual"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={closeSession.formState.actualBalance}
                        onChange={(e) =>
                          closeSession.setFormState({
                            ...closeSession.formState,
                            actualBalance: e.target.value,
                          })
                        }
                        autoFocus
                        required
                        sizing="md"
                        addon="Rs."
                      />
                    </div>

                    {/* Variance Display */}
                    {closeSession.formState.actualBalance && (
                      <div>
                        <Label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">
                          Variance
                        </Label>
                        <div
                          className={`h-[42px] flex items-center justify-center rounded-lg border-2 ${
                            Math.abs(variance) < 0.01
                              ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
                              : 'bg-red-50 dark:bg-red-900/20 border-red-500'
                          }`}
                        >
                          <div
                            className={`font-bold ${
                              Math.abs(variance) < 0.01
                                ? 'text-green-700 dark:text-green-300'
                                : 'text-red-700 dark:text-red-300'
                            }`}
                          >
                            <span>
                              {variance >= 0 ? '+' : ''}Rs. {variance.toFixed(2)}
                              {Math.abs(variancePercentage) >= 0.01 && (
                                <span className="text-xs ml-1">
                                  ({variancePercentage >= 0 ? '+' : ''}
                                  {variancePercentage.toFixed(2)}%)
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Closing Notes */}
              <div>
                <Label
                  htmlFor="notes"
                  className="text-xs text-gray-600 dark:text-gray-400 mb-1 block"
                >
                  Closing Notes
                </Label>
                <Textarea
                  id="notes"
                  placeholder="Denomination breakdown, variance explanation..."
                  rows={2}
                  value={closeSession.formState.closingNotes}
                  onChange={(e) =>
                    closeSession.setFormState({
                      ...closeSession.formState,
                      closingNotes: e.target.value,
                    })
                  }
                />
              </div>

              {/* Variance Warning */}
              {closeSession.formState.actualBalance && Math.abs(variance) >= 0.01 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-xs text-red-800 dark:text-red-200">
                    Cash variance detected. Please verify count and document reason in closing
                    notes.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <Button
            color="gray"
            onClick={isClosed ? onSessionClosed : onClose}
            disabled={closeSession.isSubmitting}
          >
            {isClosed ? 'Done' : 'Cancel'}
          </Button>
          <Button
            color="failure"
            onClick={() => closeSession.handleCloseSession(session, handleSuccess)}
            disabled={
              isClosed ||
              !closeSession.formState.actualBalance ||
              closeSession.isSubmitting ||
              isLoadingReport
            }
          >
            {closeSession.isSubmitting ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Closing...
              </>
            ) : isClosed ? (
              'Session Closed'
            ) : (
              'Close Session & Generate Z-Report'
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
