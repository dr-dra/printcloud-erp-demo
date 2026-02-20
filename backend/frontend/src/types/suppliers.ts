/**
 * TypeScript type definitions for Suppliers and related entities
 */

// =============================================================================
// Supplier Types
// =============================================================================

export interface Supplier {
  id: number;
  name: string;
  company_name?: string;
  email?: string;
  phone?: string;
  is_active: boolean;
  balance: string;
  payment_terms?: string;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// Supplier Bill Types
// =============================================================================

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
  discount_amount: string;
  total: string;
  amount_paid: string;
  balance_due: string;
  notes?: string;
  approved_by?: number;
  approved_at?: string;
  created_by: number;
  created_at: string;
  updated_at: string;
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
  created_at: string;
}

// =============================================================================
// Bill Scan Types (AI-Powered Bill Extraction)
// =============================================================================

export interface BillScanExtractedField {
  value: string | null;
  confidence: number;  // 0.0 to 1.0
}

export interface BillScanExtractedData {
  bill_number: BillScanExtractedField;
  supplier_name: BillScanExtractedField;
  bill_date: BillScanExtractedField;
  due_date: BillScanExtractedField;
  subtotal: BillScanExtractedField;
  tax_amount: BillScanExtractedField;
  total: BillScanExtractedField;
  discount_amount: BillScanExtractedField;
}

export interface BillScan {
  id: number;
  file: string;
  file_url: string;
  file_name: string;
  file_size: number;
  file_type: string;  // MIME type: application/pdf, image/jpeg, image/png
  processing_status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  processing_started_at?: string;
  processing_completed_at?: string;
  processing_error?: string;
  extracted_data?: BillScanExtractedData;
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

// =============================================================================
// Purchase Order Types
// =============================================================================

export interface PurchaseOrder {
  id: number;
  po_number: string;
  supplier: number;
  supplier_name: string;
  order_date: string;
  expected_delivery_date?: string;
  actual_delivery_date?: string;
  status: 'draft' | 'sent' | 'confirmed' | 'partially_received' | 'received' | 'completed' | 'cancelled';
  subtotal: string;
  tax_amount: string;
  shipping_cost: string;
  total: string;
  notes?: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}
