/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Customer Search Hook for POS System
 *
 * This hook provides customer search functionality with debouncing and typeahead support.
 * It manages the search state, triggers API calls, and handles customer selection.
 *
 * Features:
 * - Debounced search (300ms delay) to reduce API calls
 * - Typeahead dropdown with customer suggestions
 * - Walk-in vs registered customer toggle
 * - Customer selection and clearing
 *
 * Extracted from:
 * - Designer POS: page.tsx (lines 59-97)
 * - Accounting POS: accounting/page.tsx (lines 80-126)
 *
 * @module useCustomerSearch
 */

'use client';

import { useState, useEffect } from 'react';
import { searchCustomers } from '@/lib/posApi';

/**
 * Customer object returned from API
 */
export interface Customer {
  id: string;
  name: string;
  company?: string;
  contact?: string;
  email?: string;
  customer_type?: 'individual' | 'business';
}

/**
 * Return type of the useCustomerSearch hook
 */
export interface UseCustomerSearchReturn {
  // Walk-in mode state
  isWalkIn: boolean;
  setIsWalkIn: (value: boolean) => void;

  // Selected customer
  selectedCustomer: Customer | null;
  setSelectedCustomer: (customer: Customer | null) => void;

  // Search state
  customerSearchQuery: string;
  setCustomerSearchQuery: (query: string) => void;
  customerSearchResults: Customer[];
  isCustomerSearchOpen: boolean;
  setIsCustomerSearchOpen: (open: boolean) => void;

  // Actions
  selectCustomer: (customer: any) => void;
  clearCustomer: () => void;
}

/**
 * Hook for managing customer search and selection in POS
 *
 * @returns Object containing customer search state and methods
 *
 * @example
 * ```tsx
 * function POSComponent() {
 *   const {
 *     isWalkIn,
 *     selectedCustomer,
 *     customerSearchQuery,
 *     customerSearchResults,
 *     isCustomerSearchOpen,
 *     setCustomerSearchQuery,
 *     selectCustomer
 *   } = useCustomerSearch();
 *
 *   return (
 *     <div>
 *       {!isWalkIn && (
 *         <input
 *           value={customerSearchQuery}
 *           onChange={(e) => setCustomerSearchQuery(e.target.value)}
 *         />
 *       )}
 *       {selectedCustomer && <p>Customer: {selectedCustomer.name}</p>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useCustomerSearch(): UseCustomerSearchReturn {
  // Walk-in mode: true = walk-in customer, false = registered customer
  const [isWalkIn, setIsWalkIn] = useState(true);

  // Selected customer object
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Search state
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState<Customer[]>([]);
  const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false);

  /**
   * Customer Search Effect - Debounced API Call
   *
   * This effect triggers when the search query changes and:
   * 1. Waits 300ms before making API call (debounce)
   * 2. Only searches if query is at least 2 characters
   * 3. Handles both paginated and direct array responses from API
   * 4. Opens the dropdown with results
   */
  useEffect(() => {
    // Don't search if query is too short
    if (!customerSearchQuery || customerSearchQuery.length < 2) {
      setCustomerSearchResults([]);
      return;
    }

    // Debounce: Wait 300ms before searching
    // This prevents API calls on every keystroke
    const timer = setTimeout(async () => {
      try {
        const response = await searchCustomers(customerSearchQuery);

        // Handle different response formats from API
        // - Standard: Direct array of customers
        // - Paginated: { results: [...] } from DRF pagination
        const data = response.data as any;
        const results = Array.isArray(data) ? data : data.results || [];

        setCustomerSearchResults(results);
        setIsCustomerSearchOpen(true);
      } catch (error) {
        console.error('[useCustomerSearch] Customer search failed:', error);
        setCustomerSearchResults([]);
      }
    }, 300); // 300ms debounce delay

    // Cleanup: Cancel pending search if query changes again
    return () => clearTimeout(timer);
  }, [customerSearchQuery]);

  /**
   * Select a customer from search results
   *
   * This function:
   * 1. Sets the customer as selected
   * 2. Clears the search query
   * 3. Closes the dropdown
   * 4. Switches from walk-in to customer mode
   *
   * @param customer - Customer object from search results
   */
  const selectCustomer = (customer: any) => {
    setSelectedCustomer({
      id: customer.id.toString(),
      name: customer.name,
      // For business customers, use company name
      company: customer.customer_type === 'business' ? customer.name : undefined,
    });

    // Clean up search state
    setCustomerSearchQuery('');
    setIsCustomerSearchOpen(false);

    // Switch to customer mode (not walk-in)
    setIsWalkIn(false);
  };

  /**
   * Clear the selected customer and return to walk-in mode
   */
  const clearCustomer = () => {
    setSelectedCustomer(null);
    setIsWalkIn(true);
    setCustomerSearchQuery('');
    setCustomerSearchResults([]);
    setIsCustomerSearchOpen(false);
  };

  return {
    // Walk-in state
    isWalkIn,
    setIsWalkIn,

    // Customer state
    selectedCustomer,
    setSelectedCustomer,

    // Search state
    customerSearchQuery,
    setCustomerSearchQuery,
    customerSearchResults,
    isCustomerSearchOpen,
    setIsCustomerSearchOpen,

    // Actions
    selectCustomer,
    clearCustomer,
  };
}
