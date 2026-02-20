/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Quick Access Grid Component
 *
 * Displays a grid of quick-access products or search results, allowing users to
 * quickly add popular items to their order with a single click.
 *
 * Features:
 * - Grid layout of product cards
 * - Hover effects with add button
 * - Supports both quick service items and search results
 * - Optional "Add Custom Item" button
 * - Empty state messages
 *
 * Extracted from:
 * - Designer POS: page.tsx (lines 506-557)
 * - Accounting POS: accounting/page.tsx (lines 1237-1288)
 *
 * @module QuickAccessGrid
 */

'use client';

import { Plus, X, Search } from 'lucide-react';
import { formatCurrency } from '../../utils/currency';
import type { POSQuickServiceItem, POSProductSearch } from '@/lib/posApi';

/**
 * Props for QuickAccessGrid component
 */
export interface QuickAccessGridProps {
  /**
   * Array of items to display (can be quick service items or search results)
   */
  items: (POSQuickServiceItem | POSProductSearch)[];

  /**
   * Current search query (for display purposes)
   */
  searchQuery: string;

  /**
   * Callback when search query changes
   */
  onSearchChange: (query: string) => void;

  /**
   * Callback when an item is clicked/added to cart
   */
  onAddItem: (item: POSQuickServiceItem | POSProductSearch, quantityIncrement?: number) => void;

  /**
   * Callback when "Add Custom Item" button is clicked
   */
  onAddCustomItem?: () => void;

  /**
   * Whether custom item button is enabled
   */
  canAddCustom?: boolean;
}

/**
 * Quick Access Grid Component
 *
 * Displays a grid of clickable product cards for quick ordering.
 *
 * @param props - Component props
 * @returns Quick access grid element
 *
 * @example
 * ```tsx
 * import { QuickAccessGrid } from './components/shared/QuickAccessGrid';
 * import { useOrderCart } from './hooks/useOrderCart';
 *
 * function POSPage() {
 *   const cart = useOrderCart();
 *   const [searchQuery, setSearchQuery] = useState('');
 *   const [searchResults, setSearchResults] = useState([]);
 *   const [quickServices, setQuickServices] = useState([]);
 *
 *   const displayedItems = searchQuery.length >= 2 ? searchResults : quickServices;
 *
 *   return (
 *     <QuickAccessGrid
 *       items={displayedItems}
 *       searchQuery={searchQuery}
 *       onSearchQueryChange={setSearchQuery}
 *       onItemClick={(item) => cart.addSearchItem(item)}
 *       onAddCustomItem={() => setShowModal(true)}
 *       canAddCustom={true}
 *       isSearchMode={searchQuery.length >= 2}
 *     />
 *   );
 * }
 * ```
 */
export function QuickAccessGrid({
  items,
  searchQuery,
  onSearchChange,
  onAddItem,
  onAddCustomItem,
  canAddCustom = false,
}: QuickAccessGridProps) {
  // Determine if we're in search mode
  const isSearchMode = searchQuery.length >= 2;

  return (
    <div className="lg:col-span-4 flex flex-col gap-3 min-h-0">
      {/* Search Input Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex-shrink-0">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Search Items</h2>
        <div className="relative">
          {/* Search Icon */}
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />

          {/* Search Input */}
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-10 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg focus:ring-primary-500 focus:border-primary-500"
          />

          {/* Clear Button (shown when search has text) */}
          {searchQuery.length > 0 && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Quick Access / Search Results Grid */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex-1 flex flex-col min-h-0">
        {/* Grid Header */}
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Quick Access {isSearchMode && '(Search Results)'}
          </h2>

          {/* Add Custom Item Button */}
          {onAddCustomItem && (
            <button
              onClick={onAddCustomItem}
              disabled={!canAddCustom}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white rounded-md transition-colors"
              title="Add custom item"
            >
              <Plus className="w-3 h-3" />
              Custom
            </button>
          )}
        </div>

        {/* Product Grid (Scrollable) */}
        <div className="grid grid-cols-3 gap-2 overflow-y-auto pr-1">
          {items.map((item) => {
            // Determine product name and price based on item type
            const productName = (item as any).product_name || (item as any).name;
            const productPrice =
              (item as any).effective_price || (item as any).default_selling_price;

            return (
              <button
                key={item.id}
                onClick={(event) => {
                  const increment = event.shiftKey ? 10 : undefined;
                  onAddItem(item, increment);
                }}
                className="group relative bg-gray-50 dark:bg-gray-700 hover:bg-primary-50 dark:hover:bg-primary-900/20 border border-gray-200 dark:border-gray-600 hover:border-primary-500 dark:hover:border-primary-500 rounded-lg p-2 transition-all text-left"
              >
                {/* Hover Add Icon */}
                <div className="absolute top-2 right-2 w-5 h-5 bg-primary-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Plus className="w-3 h-3 text-white" />
                </div>

                {/* Product Name */}
                <div className="text-xs font-medium text-gray-900 dark:text-white mb-1">
                  {productName}
                </div>

                {/* Product Price */}
                <div className="text-xs font-semibold text-primary-600 dark:text-primary-400 mt-1">
                  {formatCurrency(productPrice)}
                </div>
              </button>
            );
          })}

          {/* Empty State Message */}
          {items.length === 0 && (
            <div className="col-span-3 text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
              {isSearchMode
                ? 'No products found matching your search'
                : 'No quick access items configured'}
            </div>
          )}
        </div>
        <div className="mt-auto pt-1 text-[9px] font-light text-gray-400 dark:text-gray-500">
          Tip: Hold Shift while clicking, to add 10x at a time.
        </div>
      </div>
    </div>
  );
}
