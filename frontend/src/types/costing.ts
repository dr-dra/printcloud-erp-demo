// Costing component types matching the 15 fixed components
export type ComponentType =
  | 'paper'
  | 'board'
  | 'artwork'
  | 'plates'
  | 'printing'
  | 'ink'
  | 'blocks'
  | 'cutting'
  | 'folding'
  | 'binding'
  | 'misc'
  | 'transport'
  | 'discount'
  | 'lamination'
  | 'overheads';

// Fixed component definitions with display names
export const COMPONENT_DEFINITIONS: Record<ComponentType, string> = {
  paper: 'Paper',
  board: 'Board',
  artwork: 'Art Work',
  plates: 'Plates',
  printing: 'Printing Impression',
  ink: 'Ink',
  blocks: 'Blocks / Cutter Chrgs.',
  cutting: 'Cutting Charges',
  folding: 'Folding & Gathering',
  binding: 'Binding',
  misc: 'Misc',
  transport: 'Packing & Transport',
  discount: 'Commission / Discount',
  lamination: 'Lamination',
  overheads: 'Overheads & Other',
};

// Component data structure
export interface CostingComponent {
  id?: number;
  component_type: ComponentType;
  name: string;
  formula: string;
  calculated_cost: number;
  sort_order: number;
  is_active: boolean;
}

// Costing variant (sheet) data structure
export interface CostingVariant {
  id?: number;
  name: string;
  finished_product_id?: number; // Store the selected FinishedProduct ID
  quantity: number;
  profit_margin: number;
  profit_amount: number;
  tax_percentage: number;
  tax_profit_amount: number;
  sub_total: number;
  total: number;
  unit_price: number;
  is_included: boolean;
  is_locked: boolean;
  linked_quotation_id?: number | null; // ID of the quotation that locked this sheet
  linked_quotation_number?: string | null; // Quotation number that locked this sheet
  linked_order_id?: number | null; // ID of the order that locked this sheet
  linked_order_number?: string | null; // Order number that locked this sheet
  sort_order: number;
  components: CostingComponent[];
}

// Main costing sheet structure
export interface CostingSheet {
  id?: number;
  project_name: string;
  customer?: number;
  customer_name?: string;
  sales_person?: number;
  sales_person_name?: string;
  notes?: string;
  is_outbound: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  variants: CostingVariant[];
}

// Formula validation result
export interface FormulaValidation {
  isValid: boolean;
  result?: number;
  error?: string;
}

// Sheet tab actions
export type SheetAction = 'clone' | 'delete' | 'lock' | 'add';

// Excel cell data for rendering
export interface ExcelCell {
  value: string;
  isEditable: boolean;
  isError: boolean;
  errorMessage?: string;
  type: 'text' | 'formula' | 'currency' | 'number';
}

// Row data for the Excel-like grid
export interface ExcelRow {
  componentType: ComponentType;
  componentName: string;
  formulaCell: ExcelCell;
  resultCell: ExcelCell;
}
