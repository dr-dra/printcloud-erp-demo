/**
 * Currency Formatting Utilities for POS System
 *
 * This file provides standardized currency formatting functions used across
 * all POS components to ensure consistent display of monetary values.
 *
 * Extracted from:
 * - Designer POS: page.tsx (line 316-319)
 * - Accounting POS: accounting/page.tsx (line 703-706)
 * - Management View: ManagementView.tsx (line 173-176)
 */

/**
 * Format a numeric value as Sri Lankan Rupees currency
 *
 * @param amount - The amount to format (can be number or string)
 * @returns Formatted currency string in format "Rs. X,XXX.XX"
 *
 * @example
 * formatCurrency(1234.56) // Returns "Rs. 1,234.56"
 * formatCurrency("5000") // Returns "Rs. 5,000.00"
 * formatCurrency(0) // Returns "Rs. 0.00"
 * formatCurrency(null) // Returns "Rs. 0.00"
 * formatCurrency(undefined) // Returns "Rs. 0.00"
 */
export function formatCurrency(amount: number | string | null | undefined): string {
  // Handle null/undefined
  if (amount === null || amount === undefined) {
    console.warn('[formatCurrency] Received null/undefined, defaulting to 0');
    return 'Rs. 0.00';
  }

  // Convert string to number if needed
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;

  // Handle NaN
  if (isNaN(num)) {
    console.warn('[formatCurrency] Received NaN value:', amount);
    return 'Rs. 0.00';
  }

  // Format with Sri Lankan locale settings
  // - Uses comma as thousands separator
  // - Always shows 2 decimal places
  // - Prefix with "Rs." for Sri Lankan Rupees
  return `Rs. ${num.toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
