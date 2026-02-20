/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Customer Selection Panel Component
 *
 * A comprehensive customer selection interface for POS orders that provides:
 * - Walk-in vs registered customer toggle
 * - Customer search with typeahead dropdown
 * - Add new customer button
 * - Selected customer display with clear option
 *
 * This component is used in both Designer and Accounting POS interfaces.
 *
 * Extracted from:
 * - Designer POS: page.tsx (lines 639-730)
 * - Accounting POS: accounting/page.tsx (lines 1626-1717)
 *
 * @module CustomerSelectionPanel
 */

'use client';

import { User, Users, Plus, X, ChevronDown } from 'lucide-react';
import type { Customer } from '../../hooks/useCustomerSearch';

/**
 * Props for CustomerSelectionPanel component
 */
export interface CustomerSelectionPanelProps {
  // Walk-in mode state
  isWalkIn: boolean;
  onToggleWalkIn: (isWalkIn: boolean) => void;

  // Customer state
  selectedCustomer: Customer | null;
  onClearCustomer: () => void;

  // Search state
  customerSearchQuery: string;
  onSearchQueryChange: (query: string) => void;
  customerSearchResults: any[];
  isCustomerSearchOpen: boolean;
  onSearchOpenChange: (open: boolean) => void;

  // Actions
  onSelectCustomer: (customer: any) => void;
  onAddCustomer: () => void;
}

/**
 * Customer Selection Panel Component
 *
 * Provides a complete UI for selecting or adding customers to POS orders.
 *
 * @param props - Component props
 * @returns Customer selection panel element
 *
 * @example
 * ```tsx
 * import { CustomerSelectionPanel } from './components/shared/CustomerSelectionPanel';
 * import { useCustomerSearch } from './hooks/useCustomerSearch';
 *
 * function POSPage() {
 *   const customerSearch = useCustomerSearch();
 *   const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
 *
 *   return (
 *     <div>
 *       <CustomerSelectionPanel
 *         isWalkIn={customerSearch.isWalkIn}
 *         onToggleWalkIn={customerSearch.setIsWalkIn}
 *         selectedCustomer={customerSearch.selectedCustomer}
 *         onClearCustomer={customerSearch.clearCustomer}
 *         customerSearchQuery={customerSearch.customerSearchQuery}
 *         onSearchQueryChange={customerSearch.setCustomerSearchQuery}
 *         customerSearchResults={customerSearch.customerSearchResults}
 *         isCustomerSearchOpen={customerSearch.isCustomerSearchOpen}
 *         onSearchOpenChange={customerSearch.setIsCustomerSearchOpen}
 *         onSelectCustomer={customerSearch.selectCustomer}
 *         onAddCustomer={() => setShowAddCustomerModal(true)}
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
export function CustomerSelectionPanel({
  isWalkIn,
  onToggleWalkIn,
  selectedCustomer,
  onClearCustomer,
  customerSearchQuery,
  onSearchQueryChange,
  customerSearchResults,
  isCustomerSearchOpen,
  onSearchOpenChange,
  onSelectCustomer,
  onAddCustomer,
}: CustomerSelectionPanelProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex-shrink-0">
      {/* Panel Header */}
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Customer</h2>

      {/* Walk-In / Customer Toggle Buttons */}
      <div className="flex gap-2 mb-3">
        {/* Walk-In Button */}
        <button
          onClick={() => {
            onToggleWalkIn(true);
            if (selectedCustomer) {
              onClearCustomer();
            }
          }}
          className={`
            flex-1 flex items-center justify-center gap-2 py-2 px-3 text-sm rounded-lg font-medium transition-all
            ${
              isWalkIn
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }
          `}
        >
          <User className="w-4 h-4" />
          Walk-In
        </button>

        {/* Registered Customer Button */}
        <button
          onClick={() => onToggleWalkIn(false)}
          className={`
            flex-1 flex items-center justify-center gap-2 py-2 px-3 text-sm rounded-lg font-medium transition-all
            ${
              !isWalkIn
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }
          `}
        >
          <Users className="w-4 h-4" />
          Customer
        </button>
      </div>

      {/* Customer Selection Area (only shown when not walk-in) */}
      {!isWalkIn && (
        <div className="text-sm text-center text-gray-500">
          {selectedCustomer ? (
            /* Selected Customer Display */
            <div className="font-medium text-gray-900 dark:text-white flex justify-between items-center px-1 bg-gray-50 dark:bg-gray-700 rounded-lg py-2 border border-gray-200 dark:border-gray-600">
              <span className="truncate flex-1 text-left px-2">{selectedCustomer.name}</span>
              {/* Clear Customer Button */}
              <button
                onClick={onClearCustomer}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md text-gray-500 hover:text-red-500 transition-colors"
                title="Clear customer selection"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            /* Customer Search Interface */
            <div className="flex gap-2 relative">
              <div className="relative w-full">
                {/* Search Input */}
                <input
                  type="text"
                  placeholder="Search customer..."
                  value={customerSearchQuery}
                  onChange={(e) => {
                    onSearchQueryChange(e.target.value);
                    onSearchOpenChange(true);
                  }}
                  onFocus={() => {
                    if (customerSearchQuery.length >= 2) {
                      onSearchOpenChange(true);
                    }
                  }}
                  className="w-full px-4 py-2 pr-10 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg focus:ring-primary-500 focus:border-primary-500"
                />

                {/* Dropdown Icon */}
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-500 dark:text-gray-400">
                  <ChevronDown className="w-4 h-4" />
                </div>

                {/* Typeahead Dropdown Results */}
                {isCustomerSearchOpen && customerSearchResults.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {customerSearchResults.map((customer) => (
                      <button
                        key={customer.id}
                        onClick={() => onSelectCustomer(customer)}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-0"
                      >
                        {/* Customer Name */}
                        <div className="font-medium text-gray-900 dark:text-white text-sm">
                          {customer.name}
                        </div>

                        {/* Customer Contact Info (if available) */}
                        {(customer.contact || customer.email) && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {[customer.contact, customer.email].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Add New Customer Button */}
              <button
                onClick={onAddCustomer}
                className="flex items-center justify-center px-3 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-gray-700 dark:text-gray-300 flex-shrink-0"
                title="Add new customer"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
