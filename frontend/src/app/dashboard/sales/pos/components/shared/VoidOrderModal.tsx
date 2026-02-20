/**
 * Void Order Modal Component
 *
 * Confirmation modal for voiding POS orders with predefined reasons.
 * Accounting/cashier use this to void pending orders with mistakes.
 *
 * @module VoidOrderModal
 */

'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Spinner } from 'flowbite-react';

/**
 * Predefined void reasons
 */
const VOID_REASONS = [
  'Customer cancelled',
  'Duplicate order',
  'Wrong items entered',
  'Payment method unavailable',
  'Customer not present',
  'Pricing error',
  'Other (see notes)',
];

/**
 * Props for VoidOrderModal
 */
export interface VoidOrderModalProps {
  /**
   * Whether modal is visible
   */
  show: boolean;

  /**
   * Order display code (3-digit code)
   */
  orderNumber: string;

  /**
   * Customer name or "Walk-in Customer"
   */
  customerName: string;

  /**
   * Formatted order total (e.g., "Rs. 5,000.00")
   */
  orderTotal: string;

  /**
   * Total quantity of items
   */
  itemCount: number;

  /**
   * Whether void operation is in progress
   */
  isVoiding: boolean;

  /**
   * Callback when void is confirmed
   * @param voidReason - Combined reason string (predefined + notes)
   */
  onConfirm: (voidReason: string) => void;

  /**
   * Callback when modal is cancelled
   */
  onCancel: () => void;
}

/**
 * Void Order Modal Component
 *
 * Displays order details and allows selecting void reason before confirmation.
 */
export function VoidOrderModal({
  show,
  orderNumber,
  customerName,
  orderTotal,
  itemCount,
  isVoiding,
  onConfirm,
  onCancel,
}: VoidOrderModalProps) {
  const [selectedReason, setSelectedReason] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  if (!show) return null;

  const handleConfirm = () => {
    if (!selectedReason) {
      alert('Please select a void reason');
      return;
    }

    // Combine reason and notes
    const fullReason = additionalNotes ? `${selectedReason} - ${additionalNotes}` : selectedReason;

    onConfirm(fullReason);
  };

  const handleCancel = () => {
    // Reset form
    setSelectedReason('');
    setAdditionalNotes('');
    onCancel();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Void Order</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                This action cannot be undone
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Order Details */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Order Number:</span>
              <span className="font-semibold text-gray-900 dark:text-white">#{orderNumber}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Customer:</span>
              <span className="font-medium text-gray-900 dark:text-white">{customerName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Items:</span>
              <span className="font-medium text-gray-900 dark:text-white">{itemCount}</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-gray-200 dark:border-gray-600">
              <span className="text-gray-600 dark:text-gray-400">Total:</span>
              <span className="font-bold text-gray-900 dark:text-white">{orderTotal}</span>
            </div>
          </div>

          {/* Void Reason Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Reason for Voiding <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              disabled={isVoiding}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:opacity-50"
              required
            >
              <option value="">-- Select a reason --</option>
              {VOID_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </div>

          {/* Additional Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Additional Notes (Optional)
            </label>
            <textarea
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              disabled={isVoiding}
              placeholder="Add any additional details..."
              rows={3}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:opacity-50 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-6 flex gap-3">
          <button
            onClick={handleCancel}
            disabled={isVoiding}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isVoiding || !selectedReason}
            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isVoiding && <Spinner size="sm" />}
            {isVoiding ? 'Voiding...' : 'Void Order'}
          </button>
        </div>
      </div>
    </div>
  );
}
