/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * POS System API Client
 * Handles all API calls for POS orders, quick services, and inventory search
 */

import { api } from './api';

// =============================================================================
// Type Definitions
// =============================================================================

export interface POSOrderItem {
  product_id: number;
  quantity: number;
  unit_price: number;
  tax_rate?: number;
  discount_amount?: number;
  notes?: string;
}

export interface POSOrder {
  id: number;
  order_number: string;
  display_code: string;
  status: 'pending_payment' | 'completed' | 'voided';
  location: number;
  location_name: string;
  customer?: number;
  customer_name?: string;
  subtotal: string;
  discount_amount: string;
  tax_amount: string;
  total: string;
  notes?: string;
  items: POSOrderItemDetail[];
  created_by: number;
  created_by_email: string;
  created_at: string;
  updated_at: string;
  completed_by?: number;
  completed_by_email?: string;
  completed_at?: string;
  voided_by?: number;
  voided_by_email?: string;
  voided_at?: string;
  void_reason?: string;
  is_editable: boolean;
  related_transaction?: number;
}

export interface POSOrderItemDetail {
  id: number;
  product: number;
  product_name: string;
  product_sku: string;
  item_name: string;
  sku: string;
  quantity: number;
  unit_price: string;
  tax_rate: string;
  tax_amount: string;
  discount_amount: string;
  line_total: string;
  notes?: string;
}

export interface POSOrderListItem {
  id: number;
  order_number: string;
  display_code: string;
  status: 'pending_payment' | 'completed' | 'voided';
  customer?: number;
  customer_name?: string;
  total: string;
  created_at: string;
  created_by_email: string;
  item_count: number;
}

export interface CreateOrderData {
  location_id: number;
  customer_id?: number;
  notes?: string;
  items: POSOrderItem[];
}

export interface UpdateOrderData {
  items: POSOrderItem[];
}

export interface PaymentData {
  payment_method: 'cash' | 'card' | 'account' | 'bank_transfer' | 'mobile_payment' | 'other';
  amount: number;
  reference_number?: string;
  notes?: string;
}

export interface CompletePaymentData {
  cash_drawer_session_id: number;
  payments: PaymentData[];
  print_receipt?: boolean;
}

export interface POSQuickServiceItem {
  id: number;
  product_id: number;
  product_name: string;
  product_sku: string;
  effective_price: string;
  tax_rate: string;
  default_quantity: number;
  is_active: boolean;
  sku: string;
  sales_count: number;
}

export interface POSProductSearch {
  id: number;
  name: string;
  sku: string;
  category_name?: string;
  default_selling_price: string;
  unit_cost: string;
  tax_rate: string;
  quantity_on_hand: number;
  track_inventory: boolean;
  allow_backorder: boolean;
  low_stock: boolean;
  is_active: boolean;
  sales_count: number;
  is_quick_access: boolean;
}

export interface POSTransaction {
  id: number;
  receipt_number: string;
  cash_drawer_session: number;
  location: number;
  customer?: number;
  customer_name?: string;
  transaction_date: string;
  subtotal: string;
  discount_amount: string;
  discount_reason?: string;
  tax_amount: string;
  total: string;
  total_paid: string;
  change_given: string;
  status: 'completed' | 'voided' | 'refunded' | 'partial_refund';
  voided_at?: string;
  voided_by?: number;
  void_reason?: string;
  notes?: string;
  created_by: number;
  updated_at: string;
  items: POSTransactionItem[];
  payments: POSPayment[];
}

export interface POSTransactionItem {
  id: number;
  product: number;
  item_name: string;
  sku: string;
  quantity: number;
  unit_price: string;
  tax_rate: string;
  tax_amount: string;
  discount_amount: string;
  line_total: string;
  unit_cost?: string;
  profit?: string;
  notes?: string;
}

export interface POSPayment {
  id: number;
  payment_method: string;
  amount: string;
  reference_number?: string;
  customer_account_balance_before?: string;
  customer_account_balance_after?: string;
  notes?: string;
  created_at: string;
  created_by: number;
}

// =============================================================================
// POS Order Management API
// =============================================================================

/**
 * Create a new POS order (Designer role)
 */
export const createPOSOrder = (orderData: CreateOrderData) => {
  return api.post<POSOrder>('/pos/orders/', orderData);
};

/**
 * Get all orders with optional filters
 */
export const getPOSOrders = (params?: { status?: string; created_by_me?: boolean }) => {
  return api.get<POSOrderListItem[]>('/pos/orders/', { params });
};

/**
 * Get order detail by ID
 */
export const getPOSOrderById = (orderId: number) => {
  return api.get<POSOrder>(`/pos/orders/${orderId}/`);
};

/**
 * Get order by 6-digit order number (Accounting role)
 */
export const getOrderByNumber = (orderNumber: string) => {
  return api.get<POSOrder>('/pos/orders/by_order_number/', {
    params: { order_number: orderNumber },
  });
};

/**
 * Update POS order items (Designer role, own orders only)
 */
export const updatePOSOrder = (orderId: number, orderData: UpdateOrderData) => {
  return api.patch<POSOrder>(`/pos/orders/${orderId}/`, orderData);
};

/**
 * Void a POS order (Designer role, own orders only)
 */
export const voidPOSOrder = (orderId: number, voidReason: string) => {
  return api.post<POSOrder>(`/pos/orders/${orderId}/void_order/`, {
    void_reason: voidReason,
  });
};

/**
 * Complete payment for order (Accounting role)
 */
export const completeOrderPayment = (orderId: number, paymentData: CompletePaymentData) => {
  return api.post<POSTransaction>(`/pos/orders/${orderId}/complete_payment/`, paymentData);
};

/**
 * Get all pending payment orders (Accounting role)
 */
export const getPendingOrders = () => {
  return api.get<POSOrderListItem[]>('/pos/orders/pending_orders/');
};

// =============================================================================
// Quick Service Items & Product Search API
// =============================================================================

/**
 * Get quick access service items (manual + popular suggestions) with optional limit
 */
export const getQuickServiceItems = (search?: string, limit?: number) => {
  const params: any = {};

  if (search) {
    params.search = search;
  }

  if (limit) {
    params.limit = limit;
  }

  return api.get<POSQuickServiceItem[]>('/pos/quick-services/', {
    params: Object.keys(params).length > 0 ? params : undefined,
  });
};

/**
 * Search POS products by name or SKU with optional limit and sorting
 */
export const searchPOSProducts = (
  query: string,
  limit?: number,
  sortBy: 'name' | 'sales_count' = 'sales_count',
) => {
  const params: any = {
    search: query,
    active_only: 'true',
  };

  if (limit) {
    params.limit = limit;
  }

  if (sortBy) {
    params.sort_by = sortBy;
  }

  return api.get<POSProductSearch[]>('/pos/products/', { params });
};

// =============================================================================
// POS Location API
// =============================================================================

export interface POSLocation {
  id: number;
  name: string;
  code: string;
  address: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Get all active POS locations
 */
export const getPOSLocations = (params?: { active_only?: boolean }) => {
  return api.get<POSLocation[]>('/pos/locations/', {
    params: params || { active_only: true },
  });
};

// =============================================================================
// Cash Drawer Session API
// =============================================================================

export interface POSZReport {
  id: number;
  cash_drawer_session: number;
  gross_sales: string;
  net_sales: string;
  vat_amount: string;
  discounts_total: string;
  cash_total: string;
  card_total: string;
  on_account_total: string;
  journal_entry?: number;
  posted_at?: string;
  created_at: string;
}

export interface CashDrawerSession {
  id: number;
  session_number: string;
  user: number;
  location: number;
  opened_at: string;
  opening_balance: string;
  expected_balance?: string;
  actual_balance?: string;
  variance?: string;
  commercial_printing_income?: string;
  payouts?: string;
  status: 'open' | 'closed' | 'reconciled';
  closed_at?: string;
  opening_notes?: string;
  closing_notes?: string;
  reconciled_at?: string;
  reconciled_by?: number;
  is_from_today?: boolean;
  is_stale?: boolean;
  z_report?: POSZReport;
}

export interface LastClosedSession {
  id: number;
  session_number: string;
  user_email: string;
  opened_at: string;
  closed_at: string;
  duration_hours: number;
  opening_balance: string;
  actual_balance: string;
  expected_balance: string;
  variance: string;
  transaction_count: number;
  total_sales: string;
  payment_breakdown: {
    cash: number;
    card: number;
    lanka_qr: number;
    account: number;
    other: number;
  };
}

export interface SessionReport {
  id: number;
  session_number: string;
  user: number;
  location: number;
  opened_at: string;
  status: string;
  opening_balance: string;
  expected_balance?: string;
  payment_breakdown: {
    cash: number;
    card: number;
    lanka_qr: number;
    account: number;
    other: number;
  };
  stats: {
    completed_orders: number;
    pending_orders: number;
  };
  category_performance: Array<{ name: string; value: number }>;
  leaderboard: Array<{ name: string; value: number }>;
}

/**
 * Get or create open cash drawer session
 * Note: This endpoint needs to be implemented in the backend
 */
export const getOpenCashDrawerSession = () => {
  return api.get<CashDrawerSession>('/pos/cash-drawer-sessions/open/');
};

/**
 * Create a new cash drawer session
 * Note: This endpoint needs to be implemented in the backend
 */
export const createCashDrawerSession = (data: {
  location_id: number;
  opening_balance: number;
  opening_notes?: string;
}) => {
  return api.post<CashDrawerSession>('/pos/cash-drawer-sessions/', data);
};

// =============================================================================
// Customer Search API
// =============================================================================

export interface Customer {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  pos_customer: boolean;
}

/**
 * Search customers for POS (only shows POS customers)
 */
export const searchCustomers = (query: string) => {
  return api.get<Customer[]>('/customers/', {
    params: { search: query, pos_customer: 'true' },
  });
};

// =============================================================================
// Management Mode API (Products, Categories, Reports, Settings)
// =============================================================================

export interface POSProduct {
  id: number;
  name: string;
  sku?: string;
  description?: string;
  category?: number;
  category_name?: string;
  default_selling_price: string;
  unit_cost: string;
  tax_rate: string;
  is_quick_access: boolean;
  default_quantity: number;
  track_inventory: boolean;
  quantity_on_hand: string;
  allow_backorder: boolean;
  low_stock_threshold: string;
  low_stock: boolean;
  is_active: boolean;
  sales_count: number;
  created_by?: number;
  created_by_email?: string;
  created_at: string;
  updated_at: string;
}

export interface POSCategory {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
  display_order: number;
  product_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Get all POS products (for management view)
 */
export const getPOSProducts = (params?: {
  page?: number;
  limit?: number;
  active_only?: boolean;
  category_id?: number;
}) => {
  return api.get<POSProduct[]>('/pos/products/', { params });
};

/**
 * Create a new POS product
 */
export const createPOSProduct = (data: Partial<POSProduct>) => {
  return api.post<POSProduct>('/pos/products/', data);
};

/**
 * Update a POS product
 */
export const updatePOSProduct = (productId: number, data: Partial<POSProduct>) => {
  return api.patch<POSProduct>(`/pos/products/${productId}/`, data);
};

/**
 * Delete a POS product (soft delete with safety checks)
 */
export const deletePOSProduct = async (productId: number): Promise<void> => {
  try {
    await api.delete(`/pos/products/${productId}/`);
  } catch (error: any) {
    // Extract error message from backend
    if (error.response?.data?.error) {
      const backendError = error.response.data.error;
      const details = error.response.data.details;

      // Create detailed error message
      let errorMessage = backendError;
      if (details && details.total_sales > 0) {
        errorMessage += `\n\nBreakdown:\n`;
        errorMessage += `- Orders: ${details.orders}\n`;
        errorMessage += `- Transactions: ${details.transactions}`;
      }

      throw new Error(errorMessage);
    }
    throw new Error('Failed to delete product. Please try again.');
  }
};

/**
 * Get all POS categories
 */
export const getPOSCategories = (params?: { active_only?: boolean }) => {
  return api.get<POSCategory[]>('/pos/categories/', { params });
};

/**
 * Create a new POS category
 */
export const createPOSCategory = (data: {
  name: string;
  description?: string;
  display_order?: number;
}) => {
  return api.post<POSCategory>('/pos/categories/', data);
};

/**
 * Update an existing POS category
 */
export const updatePOSCategory = (
  categoryId: number,
  data: { name: string; description?: string; display_order?: number },
) => {
  return api.put<POSCategory>(`/pos/categories/${categoryId}/`, data);
};

/**
 * Delete a POS category (soft delete)
 */
export const deletePOSCategory = async (categoryId: number): Promise<void> => {
  try {
    await api.delete(`/pos/categories/${categoryId}/`);
  } catch (error: any) {
    // Re-throw with error message from backend
    if (error.response?.data?.error) {
      throw new Error(error.response.data.error);
    }
    throw new Error('Failed to delete category. Please try again.');
  }
};

/**
 * Update cash drawer session (e.g. Close Session / Z-Report)
 */
export const updateCashDrawerSession = (
  sessionId: number,
  data: {
    status?: 'closed';
    closing_balance?: number;
    closing_notes?: string;
    actual_balance?: number;
    commercial_printing_income?: number;
    payouts?: number;
  },
) => {
  return api.patch<CashDrawerSession>(`/pos/cash-drawer-sessions/${sessionId}/`, data);
};

/**
 * Get detailed session report (X-Report)
 * Uses the session ID to fetch transaction summary
 */
export const getSessionReport = (sessionId: number) => {
  return api.get<SessionReport>(`/pos/cash-drawer-sessions/${sessionId}/report/`);
};

/**
 * Get last closed session for a location
 */
export const getLastClosedSession = (locationId: number) => {
  return api.get<LastClosedSession>('/pos/cash-drawer-sessions/last_closed/', {
    params: { location_id: locationId },
  });
};

/**
 * Force close an old/stale session
 */
export const forceCloseSession = (
  sessionId: number,
  data: {
    actual_balance: number;
    closing_notes: string;
  },
) => {
  return api.post<CashDrawerSession>(`/pos/cash-drawer-sessions/${sessionId}/force_close/`, data);
};
