/**
 * TypeScript types for Suppliers & Purchases Module
 */

// Suppliers
export interface Supplier {
  id: number;
  supplier_code: string;
  name: string;
  company_name?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  country: string;
  payment_terms_days: number;
  credit_limit: string;
  current_balance: string;
  tax_id?: string;
  is_active: boolean;
  created_by: number;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
  contacts?: SupplierContact[];
}

export interface SupplierList {
  id: number;
  supplier_code: string;
  name: string;
  email?: string;
  phone?: string;
  current_balance: string;
  is_active: boolean;
}

export interface SupplierContact {
  id: number;
  supplier: number;
  name: string;
  position?: string;
  email?: string;
  phone?: string;
  is_primary: boolean;
}

// Purchase Orders
export interface PurchaseOrderItem {
  id: number;
  item?: number | null;
  item_sku?: string;
  item_display_name?: string;
  item_name: string;
  description?: string;
  line_number?: number;
  quantity: string;
  unit_of_measure?: string;
  unit_price: string;
  tax_rate: string;
  amount: string;
  quantity_received?: string;
  quantity_pending?: string;
  is_fully_received?: boolean;
}

export type PurchaseOrderStatus =
  | 'draft'
  | 'sent'
  | 'confirmed'
  | 'partially_received'
  | 'received'
  | 'completed'
  | 'cancelled';

export interface PurchaseOrderTimelineEntry {
  id: number;
  event_type: string;
  message: string;
  old_status?: string;
  new_status?: string;
  created_by_name?: string;
  created_at: string;
}

export const PurchaseOrderStatusLabels: Record<PurchaseOrderStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  confirmed: 'Confirmed',
  partially_received: 'Partially Received',
  received: 'Received',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const PurchaseOrderStatusColors: Record<PurchaseOrderStatus, string> = {
  draft: 'gray',
  sent: 'blue',
  confirmed: 'info',
  partially_received: 'yellow',
  received: 'green',
  completed: 'green',
  cancelled: 'red',
};

export interface PurchaseOrder {
  id: number;
  po_number: string;
  supplier: number;
  supplier_name: string;
  supplier_detail?: Supplier;
  order_date: string;
  expected_delivery_date?: string;
  status: PurchaseOrderStatus;
  subtotal: string;
  tax_amount: string;
  discount_amount?: string;
  total: string;
  notes?: string;
  supplier_notes?: string;
  delivery_address?: string;
  shipping_method?: string;
  items: PurchaseOrderItem[];
  created_by: number;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  timeline_entries?: PurchaseOrderTimelineEntry[];
}

export interface PurchaseOrderList {
  id: number;
  po_number: string;
  supplier_name: string;
  order_date: string;
  status: PurchaseOrderStatus;
  total: string;
  created_by_name?: string;
}

// Supplier Bills
export interface SupplierBill {
  id: number;
  bill_number: string;
  internal_reference: string;
  supplier: number;
  supplier_name: string;
  purchase_order?: number;
  po_number?: string;
  bill_date: string;
  due_date: string;
  status: 'draft' | 'approved' | 'partially_paid' | 'paid' | 'void';
  subtotal: string;
  tax_amount: string;
  total: string;
  amount_paid: string;
  balance_due: string;
  notes?: string;
  approved_by?: number;
  approved_by_name?: string;
  approved_at?: string;
  created_by: number;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  scan_file_url?: string;
  scan_summary?: string;
}

export interface SupplierBillList {
  id: number;
  bill_number: string;
  internal_reference: string;
  supplier_name: string;
  bill_date: string;
  due_date: string;
  status: string;
  total: string;
  balance_due: string;
  has_scan?: boolean;
}

export interface BillPayment {
  id: number;
  bill: number;
  payment_date: string;
  amount: string;
  payment_method: 'cash' | 'bank_transfer' | 'cheque' | 'card' | 'other';
  reference_number?: string;
  notes?: string;
  cheque_number?: string;
  cheque_date?: string;
  cheque_cleared: boolean;
  cheque_cleared_date?: string;
  created_by: number;
  created_by_name: string;
  created_at: string;
}

// Form types for creating/updating
export interface CreateSupplier {
  supplier_code?: string;
  name: string;
  company_name?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  country?: string;
  payment_terms_days?: number;
  credit_limit?: string;
  tax_id?: string;
  is_active?: boolean;
}

export interface CreatePurchaseOrder {
  supplier: number;
  order_date: string;
  expected_delivery_date?: string;
  items: Array<{
    item_name: string;
    description?: string;
    quantity: string;
    unit_price: string;
    tax_rate?: string;
  }>;
  notes?: string;
  delivery_address?: string;
}

export interface CreateSupplierBill {
  internal_reference: string;
  bill_number: string;
  supplier: number;
  purchase_order?: number;
  bill_date: string;
  due_date: string;
  subtotal: string;
  tax_amount?: string;
  discount_amount?: string;
  notes?: string;
}

export interface CreateBillPayment {
  bill: number;
  payment_date: string;
  amount: string;
  payment_method: 'cash' | 'bank_transfer' | 'cheque' | 'card' | 'other';
  reference_number?: string;
  notes?: string;
  cheque_number?: string;
  cheque_date?: string;
}

// Bill Scanning (AI Extraction)
export interface BillScanExtractedField {
  value: string | null;
  confidence: number; // 0.0 to 1.0
}

export interface BillScanExtractedData {
  bill_number?: BillScanExtractedField;
  supplier_name?: BillScanExtractedField;
  bill_date?: BillScanExtractedField;
  due_date?: BillScanExtractedField;
  subtotal?: BillScanExtractedField;
  tax_amount?: BillScanExtractedField;
  total?: BillScanExtractedField;
  discount_amount?: BillScanExtractedField;
}

export interface BillScan {
  id: number;
  file: string; // URL
  file_name: string;
  file_type: string;
  file_size: number;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  processing_started_at?: string;
  processing_completed_at?: string;
  processing_error?: string;
  extracted_data?: BillScanExtractedData;
  summary?: string;
  matched_supplier?: number;
  matched_supplier_name?: string;
  supplier_match_confidence?: number;
  user_edited_fields: Record<string, boolean>;
  created_bill?: number;
  uploaded_by: number;
  uploaded_by_name: string;
  uploaded_at: string;
  updated_at: string;
}
