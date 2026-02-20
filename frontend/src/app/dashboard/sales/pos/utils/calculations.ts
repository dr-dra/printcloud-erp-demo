/**
 * Order Calculation Utilities for POS System
 *
 * This file provides standardized calculation functions for order totals,
 * tax amounts, and subtotals used across all POS components.
 *
 * Extracted from:
 * - Designer POS: page.tsx (lines 234-236)
 * - Accounting POS: accounting/page.tsx (lines 617-619)
 */

/**
 * Interface for order items used in calculations
 */
export interface OrderItem {
  product_id: number;
  name: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  taxRate: number;
  discount_amount?: number;
}

/**
 * Interface for order totals result
 */
export interface OrderTotals {
  subtotal: number;
  tax: number;
  total: number;
  discount: number;
}

/**
 * Calculate subtotal from order items (before tax)
 *
 * @param items - Array of order items
 * @returns Subtotal amount (sum of unit price × quantity for all items)
 *
 * @example
 * const items = [
 *   { unitPrice: 100, quantity: 2 },
 *   { unitPrice: 50, quantity: 3 }
 * ];
 * calculateSubtotal(items) // Returns 350
 */
export function calculateSubtotal(items: OrderItem[]): number {
  return items.reduce((sum, item) => {
    const itemTotal = item.unitPrice * item.quantity;
    return sum + itemTotal;
  }, 0);
}

/**
 * Calculate total tax amount from order items
 *
 * @param items - Array of order items
 * @returns Total tax amount (sum of tax for all items)
 *
 * @example
 * const items = [
 *   { unitPrice: 100, quantity: 2, taxRate: 10 }, // Tax: 20
 *   { unitPrice: 50, quantity: 3, taxRate: 5 }    // Tax: 7.5
 * ];
 * calculateTax(items) // Returns 27.5
 */
export function calculateTax(items: OrderItem[]): number {
  return items.reduce((sum, item) => {
    const itemSubtotal = item.unitPrice * item.quantity;
    const itemTax = (itemSubtotal * item.taxRate) / 100;
    return sum + itemTax;
  }, 0);
}

/**
 * Calculate total discount amount from order items
 *
 * @param items - Array of order items
 * @returns Total discount amount
 */
export function calculateDiscount(items: OrderItem[]): number {
  return items.reduce((sum, item) => {
    return sum + (item.discount_amount || 0);
  }, 0);
}

/**
 * Calculate complete order totals (subtotal, tax, and grand total)
 *
 * @param items - Array of order items
 * @returns Object containing subtotal, tax, total, and discount
 *
 * @example
 * const items = [
 *   { unitPrice: 100, quantity: 2, taxRate: 10 },
 *   { unitPrice: 50, quantity: 3, taxRate: 5 }
 * ];
 * calculateOrderTotals(items)
 * // Returns:
 * // {
 * //   subtotal: 350,
 * //   tax: 27.5,
 * //   total: 377.5,
 * //   discount: 0
 * // }
 */
export function calculateOrderTotals(items: OrderItem[]): OrderTotals {
  const subtotal = calculateSubtotal(items);
  const tax = calculateTax(items);
  const discount = calculateDiscount(items);
  const total = subtotal + tax - discount;

  return {
    subtotal,
    tax,
    total,
    discount,
  };
}

/**
 * Calculate change amount for cash payments
 *
 * @param amountTendered - Amount given by customer
 * @param totalDue - Total amount due
 * @returns Change to give back (can be negative if insufficient payment)
 *
 * @example
 * calculateChange(500, 377.5) // Returns 122.5
 * calculateChange(300, 377.5) // Returns -77.5 (insufficient payment)
 */
export function calculateChange(amountTendered: number, totalDue: number): number {
  return amountTendered - totalDue;
}
