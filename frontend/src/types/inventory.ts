export interface FinishedProductCategory {
  id: number;
  category_name: string;
  description: string;
  parent_category: number | null;
  parent_category_name: string | null;
  income_account_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  subcategories_count?: number;
  products_count?: number;
}

export interface FinishedProduct {
  id: number;
  name: string;
  width: number | null;
  height: number | null;
  description: string;
  category: number;
  category_name: string;
  category_full_path: string;
  dimensions_display: string;
  is_active: boolean;
  is_vat_exempt: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinishedProductListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: FinishedProduct[];
}

export interface FinishedProductCategoryListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: FinishedProductCategory[];
}

export interface FinishedProductFormData {
  name: string;
  width: number | null;
  height: number | null;
  description: string;
  category: number;
  is_active: boolean;
  is_vat_exempt: boolean;
}

export interface FinishedProductCategoryFormData {
  category_name: string;
  description: string;
  parent_category: number | null;
  income_account_id: string;
  is_active: boolean;
}

export interface InvCategory {
  id: number;
  code: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InvUnitMeasure {
  id: number;
  code: string;
  name: string;
  symbol: string;
  base_unit: number | null;
  base_unit_code: string | null;
  conversion_factor: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InvItem {
  id: number;
  sku: string;
  name: string;
  category: number;
  category_name: string;
  preferred_supplier: number | null;
  preferred_supplier_name: string | null;
  stock_uom: number;
  stock_uom_code: string;
  purchase_uom: number | null;
  purchase_uom_code: string | null;
  purchase_to_stock_factor: string;
  gsm: number | null;
  width_mm: string | null;
  height_mm: string | null;
  is_offcut: boolean;
  parent_item: number | null;
  exclude_from_valuation: boolean;
  reorder_level: string;
  reorder_quantity: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InvCategoryListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: InvCategory[];
}

export interface InvUnitMeasureListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: InvUnitMeasure[];
}

export interface InvItemListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: InvItem[];
}

export interface InvStockMovement {
  id: number;
  item: number;
  item_sku: string;
  item_name: string;
  movement_type: string;
  quantity: string;
  quantity_before: string;
  quantity_after: string;
  unit_cost: string | null;
  total_value: string | null;
  reference_type: string;
  reference_id: number | null;
  notes: string;
  created_by: number | null;
  created_at: string;
}

export interface InvStockMovementListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: InvStockMovement[];
}

export interface InvStockPosition {
  item_id: number;
  item_sku: string;
  item_name: string;
  category_name: string;
  stock_uom_code: string | null;
  location: string;
  on_hand: string;
  allocated: string;
  available: string;
  on_order: string;
  reorder_level: string;
  status: string;
}

export interface InvStockPositionListResponse {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: InvStockPosition[];
}

export interface InvMrn {
  id: number;
  mrn_number: string;
  request_date: string;
  required_date: string | null;
  status: string;
  job_reference: string;
  notes: string;
}

export interface InvMrnListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: InvMrn[];
}

export interface InvPrn {
  id: number;
  prn_number: string;
  request_date: string;
  needed_by: string | null;
  status: string;
  job_ticket_id: number | null;
  notes: string;
}

export interface InvPrnListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: InvPrn[];
}

export interface InvPrnItem {
  id: number;
  prn: number;
  prn_number?: string;
  item: number;
  item_sku: string;
  item_name: string;
  required_qty: string;
  ordered_qty: string;
  received_qty: string;
  status: string;
  remaining_to_order: string;
}

export interface InvPrnItemListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: InvPrnItem[];
}

export interface InvGin {
  id: number;
  gin_number: string;
  issue_date: string;
  status: string;
  job_reference: string;
  prn: number | null;
  prn_number?: string | null;
  cost_center: string | null;
  notes: string;
}

export interface InvGinListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: InvGin[];
}

export interface InvStockAdjustment {
  id: number;
  adjustment_number: string;
  adjustment_date: string;
  status: string;
  reason: string;
  notes: string;
}

export interface InvStockAdjustmentListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: InvStockAdjustment[];
}

export interface InvUsageReport {
  id: number;
  report_number: string;
  report_date: string;
  job_reference: string;
  notes: string;
}

export interface InvUsageReportListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: InvUsageReport[];
}

export interface InvDispatchNote {
  id: number;
  dispatch_number: string;
  dispatch_date: string;
  status: string;
  invoice_reference: string;
  job_reference: string;
  notes: string;
}

export interface InvDispatchNoteListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: InvDispatchNote[];
}

export interface InvWastageCategory {
  id: number;
  code: string;
  name: string;
  description: string;
  is_active: boolean;
}

export interface InvWastageCategoryListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: InvWastageCategory[];
}
