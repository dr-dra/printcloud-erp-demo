/**
 * Order Success Modal Component
 *
 * A celebratory modal displayed after successfully saving an order.
 * Shows the order code for the customer and provides options to:
 * - Print the order code
 * - Copy the order code to clipboard
 * - Close and start a new order
 *
 * Extracted from:
 * - Designer POS: page.tsx (lines 409-454)
 * - Accounting POS: accounting/page.tsx (lines 761-806)
 *
 * @module OrderSuccessModal
 */

'use client';

import { useState } from 'react';
import { Check, FileText, Copy } from 'lucide-react';
import { Modal } from 'flowbite-react';

/**
 * Props for OrderSuccessModal component
 */
export interface OrderSuccessModalProps {
  /**
   * Whether modal is visible
   */
  show: boolean;

  /**
   * Full order number (e.g., "POS-001-2025-01-15")
   */
  orderNumber: string;

  /**
   * Display code shown to customer (e.g., "001")
   */
  displayCode: string;

  /**
   * Callback when modal is closed
   */
  onClose: () => void;
}

/**
 * Order Success Modal Component
 *
 * Displays a success message after order creation with the order code.
 *
 * @param props - Component props
 * @returns Success modal element
 *
 * @example
 * ```tsx
 * import { OrderSuccessModal } from './components/shared/OrderSuccessModal';
 *
 * function POSPage() {
 *   const [showSuccess, setShowSuccess] = useState(false);
 *   const [orderNumber, setOrderNumber] = useState('');
 *   const [displayCode, setDisplayCode] = useState('');
 *
 *   const handleSaveOrder = async () => {
 *     const order = await saveOrder();
 *     if (order) {
 *       setOrderNumber(order.order_number);
 *       setDisplayCode(order.display_code);
 *       setShowSuccess(true);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handleSaveOrder}>Save Order</button>
 *       <OrderSuccessModal
 *         show={showSuccess}
 *         orderNumber={orderNumber}
 *         displayCode={displayCode}
 *         onClose={() => setShowSuccess(false)}
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
export function OrderSuccessModal({
  show,
  orderNumber,
  displayCode,
  onClose,
}: OrderSuccessModalProps) {
  // Local state for copy feedback
  const [isCopied, setIsCopied] = useState(false);

  /**
   * Handle copy to clipboard
   * Shows temporary "Copied" feedback for 1 second
   */
  const handleCopy = () => {
    navigator.clipboard.writeText(displayCode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1000);
  };

  /**
   * Handle print
   * Triggers browser print dialog
   */
  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal show={show} size="md" onClose={onClose}>
      <Modal.Body>
        <div className="text-center py-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">Order #{orderNumber}</p>
          {/* Success Icon */}
          <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-12 h-12 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
          </div>

          {/* Success Message */}
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Order Saved!</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">Order code for customer:</p>

          {/* Display Code (Large, Prominent) */}
          <div className="bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 mb-4">
            <div className="text-6xl font-bold text-primary-600 dark:text-primary-400 tracking-wider">
              {displayCode}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 justify-center mt-4">
            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <FileText className="w-4 h-4" />
              Print
            </button>

            {/* Copy Button (with feedback) */}
            <button
              onClick={handleCopy}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isCopied
                  ? 'bg-green-100 text-green-700 border border-green-200'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {isCopied ? 'Copied' : 'Copy'}
            </button>

            {/* Close & New Order Button (Primary Action) */}
            <button
              onClick={onClose}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Close & New
            </button>
          </div>
        </div>
      </Modal.Body>
    </Modal>
  );
}
