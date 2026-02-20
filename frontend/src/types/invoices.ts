/* eslint-disable @typescript-eslint/no-explicit-any */
export type InvoiceStatus = 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'void';
export type InvoiceType = 'proforma' | 'tax_invoice';

export interface SalesInvoice {
  id: number;
  invoice_number: string;
  invoice_type: InvoiceType;
  invoice_type_display?: string;
  customer: number | null;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;
  customer_detail?: any; // Replace with proper Customer type when available
  order?: number | null;
  order_detail?: any;
  invoice_date: string;
  due_date: string | null;
  status: InvoiceStatus;
  po_so_number?: string;
  notes?: string;
  customer_notes?: string;
  subtotal: string | number;
  discount: string | number;
  tax_amount: string | number;
  net_total: string | number;
  amount_paid: string | number;
  balance_due: string | number;
  // VAT fields
  vat_rate: string | number;
  advances_applied: string | number;
  converted_to_tax_invoice_at?: string;
  items: SalesInvoiceItem[];
  payments: InvoicePayment[];
  credit_notes?: SalesCreditNote[];
  timeline_entries: SalesInvoiceTimeline[];
  created_by_name?: string;
  created_date: string;
}

// Alias for convenience
export type Invoice = SalesInvoice;

export interface SalesInvoiceItem {
  id?: number;
  item_name: string;
  description?: string;
  quantity: string | number;
  unit_price: string | number;
  amount: string | number;
  // VAT fields
  is_vat_exempt?: boolean;
  tax_rate?: string | number;
  tax_amount?: string | number;
}

export interface InvoicePayment {
  id: number;
  payment_date: string;
  amount: string | number;
  payment_method: string;
  reference_number?: string;
  notes?: string;
  created_by_name?: string;
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

export interface SalesInvoiceTimeline {
  id: number;
  event_type: string;
  message: string;
  old_status?: string;
  new_status?: string;
  created_by_name?: string;
  created_at: string;
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

export const InvoiceStatusLabels: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  partially_paid: 'Partially Paid',
  paid: 'Paid',
  overdue: 'Overdue',
  void: 'Void',
};

export const InvoiceStatusColors: Record<InvoiceStatus, string> = {
  draft: 'gray',
  sent: 'blue',
  partially_paid: 'yellow',
  paid: 'green',
  overdue: 'red',
  void: 'purple',
};

export const InvoiceTypeLabels: Record<InvoiceType, string> = {
  proforma: 'Proforma Invoice',
  tax_invoice: 'Tax Invoice',
};

export const InvoiceTypeColors: Record<InvoiceType, string> = {
  proforma: 'yellow',
  tax_invoice: 'green',
};

export interface SalesInvoiceListItem {
  id: number;
  invoice_number: string;
  invoice_type: InvoiceType;
  invoice_type_display?: string;
  invoice_date: string;
  customer_name?: string;
  created_by_name?: string;
  status: InvoiceStatus;
  net_total: number | string;
  amount_paid?: number | string;
  balance_due: number | string;
  advances_applied?: number | string;
}

export interface InvoiceListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: SalesInvoiceListItem[];
}

export interface InvoiceFilters {
  status?: InvoiceStatus | '';
  search?: string;
  [key: string]: any;
}

export interface BankAccount {
  id: number;
  account_code: string;
  account_name: string;
}
