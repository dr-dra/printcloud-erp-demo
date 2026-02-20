'use client';

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { HiSearch, HiChevronDown, HiX } from 'react-icons/hi';
import { api } from '@/lib/api';
import type { InvItem } from '@/types/inventory';

interface InventoryItemSelectorProps {
  value: InvItem | null;
  onChange: (item: InvItem | null) => void;
  onNonStockItem?: () => void;
  isNonStock?: boolean;
  placeholder?: string;
  tabIndex?: number;
  disabled?: boolean;
}

export default function InventoryItemSelector({
  value,
  onChange,
  onNonStockItem,
  isNonStock = false,
  placeholder = 'Select or search item...',
  tabIndex,
  disabled = false,
}: InventoryItemSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<InvItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Fetch items
  const fetchItems = useCallback(async (query: string = '') => {
    setLoading(true);
    try {
      const response = await api.get('/inventory/items/', {
        params: {
          search: query,
          is_active: true,
          page_size: 20,
        },
      });
      setItems(response.data.results || []);
    } catch (error) {
      console.error('Error fetching inventory items:', error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Update dropdown position
  const updateDropdownPosition = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  }, []);

  // Load initial items when dropdown opens
  useEffect(() => {
    if (isOpen) {
      updateDropdownPosition();
      fetchItems(search);
      // Focus search input when dropdown opens
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, updateDropdownPosition]);

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      fetchItems(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search, isOpen, fetchItems]);

  // Handle click outside and position updates
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch('');
        setHighlightedIndex(-1);
      }
    };

    const handleScrollResize = () => {
      if (isOpen) {
        updateDropdownPosition();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScrollResize, true);
    window.addEventListener('resize', handleScrollResize);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScrollResize, true);
      window.removeEventListener('resize', handleScrollResize);
    };
  }, [isOpen, updateDropdownPosition]);

  // Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < items.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && items[highlightedIndex]) {
          handleSelect(items[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearch('');
        setHighlightedIndex(-1);
        inputRef.current?.focus();
        break;
      case 'Tab':
        setIsOpen(false);
        setSearch('');
        setHighlightedIndex(-1);
        break;
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const handleSelect = (item: InvItem) => {
    onChange(item);
    setIsOpen(false);
    setSearch('');
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  const handleClear = (e: MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setSearch('');
  };

  const formatPrice = (price: number | string | null | undefined) => {
    const num = typeof price === 'string' ? parseFloat(price) : price;
    if (num === null || num === undefined || isNaN(num)) return '-';
    return `Rs ${num.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`;
  };

  const formatStock = (qty: number | string | null | undefined) => {
    const num = typeof qty === 'string' ? parseFloat(qty) : qty;
    if (num === null || num === undefined || isNaN(num)) return '-';
    return num.toLocaleString('en-LK');
  };

  return (
    <div ref={containerRef} className="relative w-full" onKeyDown={handleKeyDown}>
      {/* Main Input/Trigger */}
      <div
        ref={inputRef}
        tabIndex={disabled ? -1 : tabIndex}
        onClick={() => !disabled && !isNonStock && setIsOpen(true)}
        className={`
          flex items-center justify-between w-full px-3 py-2 text-sm
          bg-white dark:bg-gray-700
          border rounded-lg cursor-pointer
          ${disabled || isNonStock ? 'bg-gray-50 dark:bg-gray-800 cursor-default' : 'hover:border-blue-400'}
          ${isOpen ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-300 dark:border-gray-600'}
          focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500
          transition-colors duration-150
        `}
      >
        <div className="flex-1 truncate">
          {isNonStock ? (
            <span className="text-gray-500 dark:text-gray-400 italic">Non-stock item</span>
          ) : value ? (
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 dark:text-white truncate">
                {value.name}
              </span>
              {value.sku && (
                <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-600 px-1.5 py-0.5 rounded">
                  {value.sku}
                </span>
              )}
            </div>
          ) : (
            <span className="text-gray-400 dark:text-gray-500">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 ml-2">
          {value && !isNonStock && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
              tabIndex={-1}
            >
              <HiX className="w-4 h-4 text-gray-400" />
            </button>
          )}
          {!isNonStock && (
            <HiChevronDown
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            />
          )}
        </div>
      </div>

      {/* Dropdown - Using fixed positioning */}
      {isOpen && !isNonStock && (
        <div
          className="fixed z-[9999] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl overflow-hidden"
          style={{
            top: `${dropdownPosition.top + 4}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
          }}
        >
          {/* Search Input */}
          <div className="p-2 border-b border-gray-200 dark:border-gray-600">
            <div className="relative">
              <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setHighlightedIndex(-1);
                }}
                placeholder="Search by name or SKU..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                autoComplete="off"
              />
            </div>
          </div>

          {/* Items List */}
          <div ref={listRef} className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              </div>
            ) : items.length === 0 ? (
              <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                <p className="text-sm">No items found</p>
                {search && <p className="text-xs mt-1">Try a different search term</p>}
              </div>
            ) : (
              items.map((item, index) => (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className={`
                    px-3 py-2.5 cursor-pointer transition-colors
                    ${
                      highlightedIndex === index
                        ? 'bg-blue-50 dark:bg-blue-900/30'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }
                    ${index !== items.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}
                  `}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: Item Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-white truncate">
                          {item.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {item.sku && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            SKU: {item.sku}
                          </span>
                        )}
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {item.purchase_uom_code || item.stock_uom_code || 'units'}
                        </span>
                      </div>
                    </div>

                    {/* Right: Price & Stock */}
                    <div className="text-right shrink-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatPrice(item.purchase_price || item.cost_price)}
                      </div>
                      <div
                        className={`text-xs ${
                          (parseFloat(String(item.quantity_on_hand)) || 0) > 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-gray-400'
                        }`}
                      >
                        Stock: {formatStock(item.quantity_on_hand)}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer with Non-Stock Option */}
          {onNonStockItem && (
            <div className="p-2 border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setSearch('');
                  onNonStockItem();
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span>Add Non-Stock Item</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
