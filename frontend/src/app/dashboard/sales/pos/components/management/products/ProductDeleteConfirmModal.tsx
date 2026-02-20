/**
 * Product Delete Confirmation Modal Component
 *
 * Confirmation dialog for product deletion with intelligent handling:
 * - Products WITH sales history: Offers to discontinue (preserves data)
 * - Products WITHOUT sales history: Offers to delete (soft delete)
 *
 * Features:
 * - Visual distinction between delete and discontinue actions
 * - Product details preview (SKU, price, stock, sales count)
 * - Warning badge for products with sales history
 * - Explanatory text about data preservation
 * - Loading state during operation
 *
 * Business Logic:
 * - Discontinuing: Sets is_active = false, hides from POS, preserves all data
 * - Deleting: Soft delete (backend marks as deleted, preserves historical records)
 * - Products with sales_count > 0 can only be discontinued, never deleted
 *
 * Extracted from:
 * - ManagementView: ManagementView.tsx (lines 562-675)
 *
 * @module ProductDeleteConfirmModal
 */

'use client';

import { AlertTriangle, Info, Archive, Trash2 } from 'lucide-react';
import { Spinner } from 'flowbite-react';
import type { POSProduct } from '@/lib/posApi';

/**
 * Props for ProductDeleteConfirmModal component
 */
export interface ProductDeleteConfirmModalProps {
  /**
   * Whether modal is visible
   */
  show: boolean;

  /**
   * Product to be deleted/discontinued
   */
  product: POSProduct;

  /**
   * Whether deletion operation is in progress
   */
  isDeleting: boolean;

  /**
   * Callback when user confirms deletion/discontinuation
   */
  onConfirm: () => Promise<void>;

  /**
   * Callback when user cancels operation
   */
  onCancel: () => void;
}

/**
 * Product Delete Confirmation Modal Component
 *
 * Displays appropriate confirmation based on product's sales history.
 *
 * @param props - Component props
 * @returns Delete confirmation modal element
 *
 * @example
 * ```tsx
 * import { ProductDeleteConfirmModal } from './components/management/products/ProductDeleteConfirmModal';
 *
 * function ItemsTab() {
 *   const [productToDelete, setProductToDelete] = useState<POSProduct | null>(null);
 *   const [isDeleting, setIsDeleting] = useState(false);
 *
 *   const handleConfirm = async () => {
 *     setIsDeleting(true);
 *     if (productToDelete.sales_count > 0) {
 *       await updatePOSProduct(productToDelete.id, { is_active: false });
 *     } else {
 *       await deletePOSProduct(productToDelete.id);
 *     }
 *     setIsDeleting(false);
 *   };
 *
 *   return (
 *     <ProductDeleteConfirmModal
 *       show={!!productToDelete}
 *       product={productToDelete}
 *       isDeleting={isDeleting}
 *       onConfirm={handleConfirm}
 *       onCancel={() => setProductToDelete(null)}
 *     />
 *   );
 * }
 * ```
 */
export function ProductDeleteConfirmModal({
  show,
  product,
  isDeleting,
  onConfirm,
  onCancel,
}: ProductDeleteConfirmModalProps) {
  if (!show) return null;

  /**
   * Determine if product has sales history
   * Products with sales can only be discontinued, not deleted
   */
  const hasSalesHistory = product.sales_count > 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-start gap-4">
          {/* Warning Icon */}
          <div className="flex-shrink-0">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center ${
                hasSalesHistory
                  ? 'bg-amber-100 dark:bg-amber-900/20'
                  : 'bg-red-100 dark:bg-red-900/20'
              }`}
            >
              <AlertTriangle
                className={`h-6 w-6 ${
                  hasSalesHistory
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1">
            {/* Title */}
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {hasSalesHistory ? 'Discontinue Product' : 'Delete Product'}
            </h3>

            {/* Description */}
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
              {hasSalesHistory ? (
                <>
                  This product has sales history and cannot be deleted. Would you like to
                  discontinue <strong>"{product.name}"</strong>?
                </>
              ) : (
                <>
                  Are you sure you want to delete <strong>"{product.name}"</strong>?
                </>
              )}
            </p>

            {/* Product Details Panel */}
            <div className="mt-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-1">
              {/* SKU */}
              <p className="text-xs text-gray-600 dark:text-gray-400">
                <span className="font-medium">SKU:</span> {product.sku || 'N/A'}
              </p>

              {/* Price */}
              <p className="text-xs text-gray-600 dark:text-gray-400">
                <span className="font-medium">Price:</span> Rs. {product.default_selling_price}
              </p>

              {/* Stock (if inventory tracked) */}
              {product.track_inventory && (
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Stock:</span> {product.quantity_on_hand}
                </p>
              )}

              {/* Sales History Warning Badge */}
              {hasSalesHistory && (
                <div className="mt-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded p-2">
                  <p className="text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
                    <Info className="h-3 w-3 flex-shrink-0" />
                    Sold {product.sales_count} time(s)
                  </p>
                </div>
              )}
            </div>

            {/* Explanation Note */}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
              <strong>Note:</strong>{' '}
              {hasSalesHistory
                ? 'Discontinuing will hide this product from the POS while preserving all historical records and transaction data.'
                : 'This will mark the product as inactive. It will be hidden from the POS but preserved in historical records.'}
            </p>

            {/* Final Warning (for products without sales) */}
            {!hasSalesHistory && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-2 font-medium">
                This action cannot be undone.
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 mt-6">
          {/* Cancel Button */}
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>

          {/* Confirm Button (Delete or Discontinue) */}
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 flex items-center gap-2 transition-colors ${
              hasSalesHistory ? 'bg-amber-600 hover:bg-amber-700' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {isDeleting ? (
              <>
                <Spinner size="sm" />
                {hasSalesHistory ? 'Discontinuing...' : 'Deleting...'}
              </>
            ) : (
              <>
                {hasSalesHistory ? (
                  <>
                    <Archive className="h-4 w-4" />
                    Discontinue Product
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete Product
                  </>
                )}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
