/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Payment Processing Hook for POS System
 *
 * This hook manages payment processing for POS orders, including:
 * - Payment method selection (cash, card, account, etc.)
 * - Cash tender and change calculation
 * - Payment completion and receipt generation
 *
 * Features:
 * - Multiple payment methods support
 * - Real-time change calculation for cash payments
 * - Integration with cash drawer sessions
 * - Automatic receipt printing
 *
 * Extracted from:
 * - Accounting POS: accounting/page.tsx (lines 536-589)
 *
 * @module usePaymentProcessing
 */

'use client';

import { useState, useCallback } from 'react';
import { completeOrderPayment, type PaymentData } from '@/lib/posApi';

/**
 * Supported payment methods in the POS system
 */
export type PaymentMethod = 'cash' | 'card' | 'account' | 'bank_transfer' | 'mobile_payment';

/**
 * Return type of the usePaymentProcessing hook
 */
export interface UsePaymentProcessingReturn {
  // Payment state
  paymentMethod: PaymentMethod;
  setPaymentMethod: (method: PaymentMethod) => void;
  amountTendered: string;
  setAmountTendered: (amount: string) => void;

  // Calculated values
  changeAmount: number;
  isSufficientPayment: boolean;

  // Operations
  processPayment: (params: ProcessPaymentParams) => Promise<PaymentResult>;
  resetPayment: () => void;
}

/**
 * Parameters for processPayment function
 */
export interface ProcessPaymentParams {
  orderId: number;
  orderTotal: number;
  cashDrawerSessionId: number;
  printReceipt?: boolean;
}

/**
 * Result of payment processing
 */
export interface PaymentResult {
  success: boolean;
  receiptNumber?: string;
  error?: string;
}

/**
 * Hook for managing payment processing in POS
 *
 * This hook handles the complete payment flow:
 * 1. Select payment method
 * 2. Enter amount tendered (for cash)
 * 3. Calculate change
 * 4. Process payment through API
 * 5. Generate receipt
 *
 * @param orderTotal - Total amount of the order
 * @returns Object containing payment state and processing functions
 *
 * @example
 * ```tsx
 * function PaymentInterface({ order, total, sessionId }) {
 *   const {
 *     paymentMethod,
 *     setPaymentMethod,
 *     amountTendered,
 *     setAmountTendered,
 *     changeAmount,
 *     isSufficientPayment,
 *     processPayment
 *   } = usePaymentProcessing(total);
 *
 *   const handlePay = async () => {
 *     const result = await processPayment({
 *       orderId: order.id,
 *       orderTotal: total,
 *       cashDrawerSessionId: sessionId,
 *       printReceipt: true
 *     });
 *
 *     if (result.success) {
 *       console.log('Payment successful:', result.receiptNumber);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
 *         <option value="cash">Cash</option>
 *         <option value="card">Card</option>
 *       </select>
 *
 *       {paymentMethod === 'cash' && (
 *         <div>
 *           <input
 *             type="number"
 *             value={amountTendered}
 *             onChange={e => setAmountTendered(e.target.value)}
 *           />
 *           <p>Change: {changeAmount}</p>
 *         </div>
 *       )}
 *
 *       <button onClick={handlePay} disabled={!isSufficientPayment}>
 *         Complete Payment
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function usePaymentProcessing(orderTotal: number): UsePaymentProcessingReturn {
  // ========================================================================
  // STATE
  // ========================================================================

  /**
   * Selected payment method
   * Default: 'cash' (most common in POS)
   */
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');

  /**
   * Amount tendered by customer (for cash payments)
   * Stored as string to preserve user input (e.g., "100.00")
   */
  const [amountTendered, setAmountTendered] = useState<string>('');

  // ========================================================================
  // CALCULATED VALUES
  // ========================================================================

  /**
   * Amount tendered as a number
   * Used for calculations
   */
  const tenderedAmountNum = parseFloat(amountTendered) || 0;

  /**
   * Change to give back to customer
   * = Amount tendered - Order total
   *
   * Positive = give change to customer
   * Negative = customer hasn't paid enough
   * Zero = exact amount
   */
  const changeAmount = tenderedAmountNum - orderTotal;

  /**
   * Check if payment amount is sufficient
   *
   * For cash: amount tendered must be >= order total
   * For other methods: always sufficient (exact amount)
   */
  const isSufficientPayment = paymentMethod === 'cash' ? changeAmount >= 0 : true;

  // ========================================================================
  // PROCESS PAYMENT
  // ========================================================================

  /**
   * Process the payment for an order
   *
   * This function:
   * 1. Validates payment amount (for cash)
   * 2. Constructs payment data array
   * 3. Calls payment API with session ID
   * 4. Optionally triggers receipt printing
   * 5. Returns result with receipt number
   *
   * Payment Flow:
   * - Cash: Uses tendered amount, expects change calculation
   * - Card/Other: Uses exact order total
   *
   * @param params - Payment parameters including order ID, total, session
   * @returns Payment result with success status and receipt number
   *
   * @example
   * ```tsx
   * const result = await processPayment({
   *   orderId: 123,
   *   orderTotal: 1000.00,
   *   cashDrawerSessionId: 5,
   *   printReceipt: true
   * });
   *
   * if (result.success) {
   *   alert(`Payment complete! Receipt: ${result.receiptNumber}`);
   * } else {
   *   alert(`Payment failed: ${result.error}`);
   * }
   * ```
   */
  const processPayment = useCallback(
    async (params: ProcessPaymentParams): Promise<PaymentResult> => {
      const { orderId, orderTotal, cashDrawerSessionId, printReceipt = false } = params;

      // VALIDATION: Check for active session
      if (!cashDrawerSessionId) {
        return {
          success: false,
          error: 'No active cash drawer session. Please open a session first.',
        };
      }

      // VALIDATION: Check payment amount for cash
      if (paymentMethod === 'cash' && !isSufficientPayment) {
        return {
          success: false,
          error: 'Insufficient payment amount',
        };
      }

      try {
        // STEP 1: Prepare payment data
        // Different payment methods handle amounts differently:
        // - Cash: Record tendered amount (for change calculation)
        // - Other: Record exact total (no change)
        const payments: PaymentData[] = [
          {
            payment_method: paymentMethod,
            amount: paymentMethod === 'cash' ? tenderedAmountNum : orderTotal,
            // For card payments, generate a reference number
            reference_number: paymentMethod === 'card' ? `CARD-${Date.now()}` : undefined,
          },
        ];

        // STEP 2: Submit payment to API
        console.log('[usePaymentProcessing] Processing payment:', {
          orderId,
          method: paymentMethod,
          amount: payments[0].amount,
          printReceipt,
        });

        const response = await completeOrderPayment(orderId, {
          cash_drawer_session_id: cashDrawerSessionId,
          payments,
          print_receipt: printReceipt,
        });

        // STEP 3: Extract transaction data
        const transaction = response.data;
        console.log('[usePaymentProcessing] Payment successful:', transaction.receipt_number);

        return {
          success: true,
          receiptNumber: transaction.receipt_number,
        };
      } catch (error: any) {
        // ERROR HANDLING
        console.error('[usePaymentProcessing] Payment failed:', error);
        const errorMessage =
          error.response?.data?.error || 'Failed to complete payment. Please try again.';

        return {
          success: false,
          error: errorMessage,
        };
      }
    },
    [paymentMethod, tenderedAmountNum, isSufficientPayment, orderTotal],
  );

  // ========================================================================
  // RESET PAYMENT
  // ========================================================================

  /**
   * Reset payment state to defaults
   *
   * Call this after:
   * - Successful payment
   * - Cancelled payment
   * - Starting a new order
   */
  const resetPayment = useCallback(() => {
    setPaymentMethod('cash');
    setAmountTendered('');
  }, []);

  // ========================================================================
  // RETURN
  // ========================================================================

  return {
    // State
    paymentMethod,
    setPaymentMethod,
    amountTendered,
    setAmountTendered,

    // Calculated
    changeAmount,
    isSufficientPayment,

    // Operations
    processPayment,
    resetPayment,
  };
}
