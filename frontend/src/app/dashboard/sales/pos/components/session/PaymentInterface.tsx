/**
 * Payment Interface Component
 *
 * Payment processing interface displayed after saving an order.
 * Supports multiple payment methods with automatic change calculation.
 *
 * Features:
 * - Multiple payment methods: Cash, Card, Account (for customers)
 * - Cash payment: Amount tendered input with real-time change calculation
 * - Card/Account: Immediate payment without additional input
 * - Two submission options:
 *   1. Save & Print Receipt (opens cash drawer + prints)
 *   2. Save (Open Drawer Only) (just opens cash drawer)
 * - Validation: Prevents payment if insufficient cash tendered
 * - Warning: Shows alert if no cash drawer session is open
 *
 * Business Rules:
 * - Walk-in customers can only pay by Cash or Card
 * - Account customers can also pay on account (invoice to be paid later)
 * - Cash payments require sufficient tender (change must be >= 0)
 * - All payment methods open the cash drawer for security
 *
 * Extracted from:
 * - Accounting POS: accounting/page.tsx (lines 1482-1621)
 *
 * @module PaymentInterface
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Banknote, CreditCard, Building2, Receipt } from 'lucide-react';
import { formatCurrency } from '../../utils/currency';
import { calculateChange } from '../../utils/calculations';
import type { Customer } from '@/lib/api';

/**
 * Payment method options
 */
export type PaymentMethod = 'cash' | 'card' | 'account';

/**
 * Props for PaymentInterface component
 */
export interface PaymentInterfaceProps {
  /**
   * Order number/code being paid for (e.g., "001")
   */
  orderDisplayCode: string;

  /**
   * Total amount to be paid
   */
  orderTotal: number;

  /**
   * Whether customer is walk-in (affects available payment methods)
   */
  isWalkIn: boolean;

  /**
   * Selected customer (null for walk-in)
   * Used to determine if "Account" payment method is available
   */
  selectedCustomer: Customer | null;

  /**
   * Whether a cash drawer session is currently open
   * Shows warning if not open
   */
  hasCashDrawerSession: boolean;

  /**
   * Whether payment processing is in progress
   */
  isLoading: boolean;

  /**
   * Callback when user clicks back to edit order
   */
  onBack: () => void;

  /**
   * Callback when payment is completed
   * @param paymentMethod - Selected payment method
   * @param amountTendered - Cash tendered (only for cash payments)
   * @param printReceipt - Whether to print receipt
   */
  onCompletePayment: (
    paymentMethod: PaymentMethod,
    amountTendered: string,
    printReceipt: boolean,
  ) => Promise<void>;

  /**
   * Callback when user wants to open cash drawer session
   */
  onOpenDrawerSession: () => void;
}

/**
 * Payment Interface Component
 *
 * Displays payment options and processes order payment.
 *
 * @param props - Component props
 * @returns Payment interface element
 *
 * @example
 * ```tsx
 * import { PaymentInterface } from './components/session/PaymentInterface';
 * import { usePaymentProcessing } from './hooks/usePaymentProcessing';
 *
 * function AccountingPOS() {
 *   const [isPaymentMode, setIsPaymentMode] = useState(false);
 *   const payment = usePaymentProcessing(orderTotal);
 *
 *   if (isPaymentMode) {
 *     return (
 *       <PaymentInterface
 *         orderDisplayCode="001"
 *         orderTotal={1500.00}
 *         isWalkIn={false}
 *         selectedCustomer={customer}
 *         hasCashDrawerSession={!!sessionId}
 *         isLoading={payment.isLoading}
 *         onBack={() => setIsPaymentMode(false)}
 *         onCompletePayment={payment.processPayment}
 *         onOpenDrawerSession={() => setShowDrawerModal(true)}
 *       />
 *     );
 *   }
 *
 *   return <OrderCart />;
 * }
 * ```
 */
export function PaymentInterface({
  orderDisplayCode,
  orderTotal,
  isWalkIn,
  selectedCustomer,
  hasCashDrawerSession,
  isLoading,
  onBack,
  onCompletePayment,
  onOpenDrawerSession,
}: PaymentInterfaceProps) {
  // Payment method selection state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');

  // Amount tendered for cash payments
  const [amountTendered, setAmountTendered] = useState('');

  // Reference to amount input for auto-focus
  const amountTenderedInputRef = useRef<HTMLInputElement>(null);

  /**
   * Auto-focus amount input when cash payment method is selected
   */
  useEffect(() => {
    if (paymentMethod === 'cash' && amountTenderedInputRef.current) {
      amountTenderedInputRef.current.focus();
    }
  }, [paymentMethod]);

  /**
   * Parse tendered amount as number
   */
  const tenderedAmountNum = parseFloat(amountTendered) || 0;

  /**
   * Calculate change amount (negative if insufficient)
   */
  const changeAmount = calculateChange(tenderedAmountNum, orderTotal);

  /**
   * Determine if payment can be processed
   * - For cash: Must have sufficient tender (change >= 0)
   * - For card/account: Always valid
   */
  const canProcessPayment = paymentMethod === 'cash' ? changeAmount >= 0 : true;

  /**
   * Handle payment completion
   * @param printReceipt - Whether to print receipt
   */
  const handleCompletePayment = async (printReceipt: boolean) => {
    await onCompletePayment(paymentMethod, amountTendered, printReceipt);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex-shrink-0 border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Payment for {orderDisplayCode}
        </h2>
        <button
          onClick={onBack}
          className="text-sm flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Edit
        </button>
      </div>

      {/* Total Due */}
      <div className="space-y-1 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Total Due</span>
          <span className="font-bold text-gray-900 dark:text-white text-lg">
            {formatCurrency(orderTotal)}
          </span>
        </div>
      </div>

      {/* Payment Method Selection */}
      <div className="mb-4">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
          Payment Method
        </label>
        {/* Grid: 2 columns for walk-in, 3 columns for customers */}
        <div
          className={`grid gap-2 ${isWalkIn || !selectedCustomer ? 'grid-cols-2' : 'grid-cols-3'}`}
        >
          {/* Cash Button */}
          <button
            onClick={() => setPaymentMethod('cash')}
            className={`py-2 px-2 text-xs rounded-lg font-medium transition-all flex flex-col items-center gap-1 ${
              paymentMethod === 'cash'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <Banknote className="w-4 h-4" />
            <span>Cash</span>
          </button>

          {/* Card Button */}
          <button
            onClick={() => setPaymentMethod('card')}
            className={`py-2 px-2 text-xs rounded-lg font-medium transition-all flex flex-col items-center gap-1 ${
              paymentMethod === 'card'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Card</span>
          </button>

          {/* Account Button (Only for Non-Walk-In Customers) */}
          {!isWalkIn && selectedCustomer && (
            <button
              onClick={() => setPaymentMethod('account')}
              className={`py-2 px-2 text-xs rounded-lg font-medium transition-all flex flex-col items-center gap-1 ${
                paymentMethod === 'account'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Account</span>
            </button>
          )}
        </div>
      </div>

      {/* Cash Payment Fields */}
      {paymentMethod === 'cash' && (
        <div className="space-y-2 mb-4">
          {/* Amount Tendered Input */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Amount Tendered
            </label>
            <input
              ref={amountTenderedInputRef}
              type="number"
              step="0.01"
              value={amountTendered}
              onChange={(e) => setAmountTendered(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg text-lg font-semibold focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Change Calculation Display */}
          {tenderedAmountNum > 0 && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Change Due
                </span>
                {/* Color: Green if sufficient, Red if insufficient */}
                <span
                  className={`text-xl font-bold ${
                    changeAmount >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {formatCurrency(Math.abs(changeAmount))}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payment Action Buttons */}
      <div className="space-y-2 flex-shrink-0">
        {/* Primary: Save & Print Receipt */}
        <button
          onClick={() => handleCompletePayment(true)}
          disabled={isLoading || !canProcessPayment}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <Receipt className="w-5 h-5" />
          {isLoading ? 'Processing...' : 'Save & Print Receipt'}
        </button>

        {/* Secondary: Save (Open Drawer Only) */}
        <button
          onClick={() => handleCompletePayment(false)}
          disabled={isLoading || !canProcessPayment}
          className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors"
        >
          {isLoading ? 'Processing...' : 'Save (Open Drawer Only)'}
        </button>
      </div>

      {/* Warning: No Cash Drawer Session */}
      {!hasCashDrawerSession && (
        <div className="mt-2 text-center">
          <p className="text-xs text-red-500 dark:text-red-400 mb-2">No open cash drawer session</p>
          <button
            onClick={onOpenDrawerSession}
            className="text-xs text-primary-600 hover:text-primary-700 dark:hover:text-primary-500 font-medium underline transition-colors"
          >
            Open Register Now
          </button>
        </div>
      )}
    </div>
  );
}
