// Base types for quotations system

export interface SalesQuotationItem {
  id: number;
  item_id?: number;
  item?: string;
  description?: string;
  quantity?: number;
  unit_price: number;
  price: number;
  costing_sheet?: number;
  costing_sheet_name?: string;
  costing_estimating_id?: number;
  cs_profit_margin?: number;
  cs_profit?: number;
  cs_total?: number;
  // Finished product fields for new structure
  finished_product?: number;
  finished_product_name?: string;
  finished_product_category?: string;
  finished_product_dimensions?: string;
}

export interface SalesQuotationTimeline {
  id: number;
  event_type: string;
  event_type_display: string;
  message: string;
  created_at: string;
  created_by?: number;
  created_by_name?: string;
}

export interface SalesQuotation {
  id: number;
  quot_number: string;
  number_type?: string;
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
  date?: string;
  required_date?: string;
  terms?: string;
  notes?: string;
  private_notes?: string;
  delivery_charge: number;
  discount: number;
  total: number;
  vat_rate?: number;
  vat_amount?: number;
  total_applied: boolean;
  delivery_applied: boolean;
  costing?: number;
  costing_name?: string;
  finalized: boolean;
  is_active: boolean;
  created_by?: number;
  created_date?: string;
  updated_date?: string;
  items?: SalesQuotationItem[];
  timeline?: SalesQuotationTimeline[];
  // Display preference fields
  show_subtotal?: boolean;
  show_delivery_charges?: boolean;
}

// List view types (optimized for performance)
export interface SalesQuotationListItem {
  id: number;
  quot_number: string;
  number_type?: string;
  number_type_display?: string;
  customer_id?: number;
  customer_name?: string;
  date?: string;
  required_date?: string;
  total: number;
  finalized: boolean;
  is_active: boolean;
  created_by_name?: string;
  created_date?: string;
  item_count: number;
}

// API response types
export interface QuotationListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: SalesQuotationListItem[];
}

export type QuotationDetailResponse = SalesQuotation;

export interface QuotationItemsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: SalesQuotationItem[];
}

// Filter and search types
export interface QuotationFilters {
  search?: string;
  finalized?: boolean;
  is_active?: boolean;
  date_gte?: string;
  date_lte?: string;
  total_gte?: number;
  total_lte?: number;
  customer?: number;
  created_by?: number;
  ordering?: string;
  page?: number;
  page_size?: number;
}

// Number type mappings
export const QuotationNumberTypes = {
  1: 'Quote',
  2: 'Estimate',
  3: 'Proposal',
} as const;

export type QuotationNumberType = keyof typeof QuotationNumberTypes;
