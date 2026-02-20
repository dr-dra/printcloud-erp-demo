// Base types for orders system

export interface SalesOrderItem {
  id: number;
  item_name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  amount: number;
  finished_product?: number;
  finished_product_id?: number;
  finished_product_name?: string;
  finished_product_category?: string;
  finished_product_dimensions?: string;
  costing_sheet?: number;
  costing_sheet_id?: number;
  costing_sheet_name?: string;
  costing_estimating_id?: number;
  cs_profit_margin?: number;
  cs_profit?: number;
  cs_total?: number;
  job_ticket_generated: boolean;
  job_ticket_number?: string;
  production_notes?: string;
  item_status?: 'pending' | 'production' | 'completed';
  item_status_display?: string;
}

export interface SalesOrderTimeline {
  id: number;
  event_type: string;
  event_type_display: string;
  message: string;
  old_status?: string;
  new_status?: string;
  created_at: string;
  created_by?: number;
  created_by_name?: string;
}

export interface OrderAttachment {
  id: number;
  title: string;
  description?: string;
  file_type: 'artwork' | 'specification' | 'customer_file' | 'proof' | 'other';
  file_type_display?: string;
  file: string;
  file_url?: string;
  uploaded_by?: number;
  uploaded_by_name?: string;
  uploaded_at: string;
}

export interface CommunicationCount {
  email: number;
  whatsapp: number;
  print: number;
}

// Order Payment (Advance) interface
export interface OrderPayment {
  id: number;
  order: number;
  payment_date: string;
  amount: string | number;
  payment_method: string;
  payment_method_display?: string;
  reference_number?: string;
  notes?: string;
  created_by?: number;
  created_by_name?: string;
  created_at?: string;
  // Receipt tracking
  receipt_number?: string;
  receipt_generated_at?: string;
  // Accounting integration
  deposit_account?: number;
  deposit_account_name?: string;
  journal_entry?: number;
  // Cheque handling
  cheque_number?: string;
  cheque_date?: string;
  cheque_cleared?: boolean;
  cheque_cleared_date?: string;
  cheque_clearance_journal_entry?: number;
  cheque_deposit_account?: number;
  cheque_deposit_account_name?: string;
  // Void tracking
  is_void?: boolean;
  void_reason?: string;
  voided_by?: number;
  voided_by_name?: string;
  voided_at?: string;
  // Reversal tracking
  is_reversed?: boolean;
  reversed_by?: number;
  reversed_by_name?: string;
  reversed_at?: string;
  reversal_journal_entry?: number;
  // Refund tracking
  is_refunded?: boolean;
  refunded_by?: number;
  refunded_by_name?: string;
  refunded_at?: string;
  refund_journal_entry?: number;
}

export interface SalesOrder {
  id: number;
  order_number: string;
  project_name?: string;
  number_type: number;
  customer?: {
    id: number;
    name: string;
    email?: string;
    contact?: string;
    address?: string;
    addresses?: Array<{
      type: 'billing' | 'shipping';
      line1: string;
      line2?: string;
      city: string;
      zip_code?: string;
      province?: string;
      country?: string;
      phone?: string;
      delivery_instructions?: string;
    }>;
  };
  quotation?: number;
  quotation_id?: number;
  quotation_number?: string;
  order_date: string;
  required_date?: string;
  production_start_date?: string;
  completion_date?: string;
  delivered_date?: string;
  status: OrderStatus;
  status_display?: string;
  production_stage?: OrderProductionStage | null;
  po_so_number?: string;
  notes?: string;
  customer_notes?: string;
  delivery_instructions?: string;
  subtotal: number;
  discount: number;
  delivery_charge: number;
  vat_rate?: number;
  vat_amount?: number;
  net_total: number;
  // Payment tracking (advances)
  amount_paid?: number;
  balance_due?: number;
  payments?: OrderPayment[];
  credit_notes?: SalesCreditNote[];
  costing?: number;
  costing_number?: string;
  costing_name?: string;
  prepared_by?: number;
  prepared_from?: string;
  prepared_reff?: string;
  is_active: boolean;
  created_by?: number;
  created_date?: string;
  updated_by?: number;
  updated_date?: string;
  items?: SalesOrderItem[];
  timeline?: SalesOrderTimeline[];
  attachments?: OrderAttachment[];
  communication_count?: CommunicationCount;
}

export interface SalesCreditNote {
  id: number;
  credit_note_number: string;
  credit_note_type: string;
  credit_note_date: string;
  status: string;
  amount: string | number;
  reason: string;
  detail_note: string;
  description?: string;
  payout_method?: string;
  payout_voucher_number?: string;
  payout_cheque_number?: string;
  created_at?: string;
}

// List view types (optimized for performance)
export interface SalesOrderListItem {
  id: number;
  order_number: string;
  number_type: number;
  number_type_display?: string;
  customer_id?: number;
  customer_name?: string;
  quotation_number?: string;
  costing_number?: string;
  order_date: string;
  required_date?: string;
  delivered_date?: string;
  status: OrderStatus;
  status_display?: string;
  production_stage?: OrderProductionStage | null;
  po_so_number?: string;
  net_total: number;
  vat_rate?: number;
  vat_amount?: number;
  amount_paid?: number;
  balance_due?: number;
  is_active: boolean;
  created_by_name?: string;
  created_date?: string;
  item_count: number;
}

// API response types
export interface OrderListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: SalesOrderListItem[];
}

export type OrderDetailResponse = SalesOrder;

// Filter and search types
export interface OrderFilters {
  search?: string;
  status?: OrderStatus;
  is_active?: boolean;
  order_date_gte?: string;
  order_date_lte?: string;
  required_date_gte?: string;
  required_date_lte?: string;
  net_total_gte?: number;
  net_total_lte?: number;
  customer?: number;
  created_by?: number;
  quotation?: number;
  ordering?: string;
  page?: number;
  page_size?: number;
}

// Order status type
export type OrderStatus =
  | 'draft'
  | 'confirmed'
  | 'production'
  | 'ready'
  | 'delivered'
  | 'invoiced'
  | 'completed'
  | 'cancelled';

export type OrderProductionStage = 'pre_press' | 'press' | 'post_press';

// Status display mappings
export const OrderStatusLabels: Record<OrderStatus, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  production: 'In Production',
  ready: 'Ready for Pickup/Delivery',
  delivered: 'Delivered',
  invoiced: 'Invoiced',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

// Status badge colors for UI
export const OrderStatusColors: Record<OrderStatus, string> = {
  draft: 'gray',
  confirmed: 'blue',
  production: 'yellow',
  ready: 'purple',
  delivered: 'green',
  invoiced: 'indigo',
  completed: 'green',
  cancelled: 'red',
};

// Number type mappings
export const OrderNumberTypes = {
  1: 'Order',
  2: 'Work Order',
  3: 'Job Order',
} as const;

export type OrderNumberType = keyof typeof OrderNumberTypes;

// Email data interface
export interface OrderEmailData {
  to: string[];
  cc?: string[];
  subject: string;
  message: string;
}

// Print data interface
export interface OrderPrintData {
  printer_name?: string;
  copies?: number;
}

// WhatsApp data interface
export interface OrderWhatsAppData {
  phone_number: string;
  message?: string;
}

// Status transition interface
export interface OrderStatusTransition {
  status: OrderStatus;
  message?: string;
}
