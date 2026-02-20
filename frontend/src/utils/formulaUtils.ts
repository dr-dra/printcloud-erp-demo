/* eslint-disable @typescript-eslint/no-explicit-any */
import { FormulaValidation, ComponentType, CostingComponent } from '@/types/costing';

/**
 * Evaluates a mathematical formula safely
 * Only allows basic operators: +, -, *, /, (, )
 */
export function evaluateFormula(formula: string): FormulaValidation {
  if (!formula || formula.trim() === '') {
    return { isValid: true, result: 0 };
  }

  try {
    // Remove all whitespace
    const cleanFormula = formula.replace(/\s+/g, '');

    // Validate allowed characters (numbers, operators, parentheses, decimal point)
    const allowedPattern = /^[0-9+\-*/.()]+$/;
    if (!allowedPattern.test(cleanFormula)) {
      return {
        isValid: false,
        error: 'Invalid characters. Only numbers and +, -, *, /, (, ) allowed.',
      };
    }

    // Check for balanced parentheses
    if (!hasBalancedParentheses(cleanFormula)) {
      return {
        isValid: false,
        error: 'Unbalanced parentheses',
      };
    }

    // Check for valid operator placement
    if (!hasValidOperatorPlacement(cleanFormula)) {
      return {
        isValid: false,
        error: 'Invalid operator placement',
      };
    }

    // Evaluate using Function constructor (safer than eval)
    const result = Function(`"use strict"; return (${cleanFormula})`)();

    if (typeof result !== 'number' || !isFinite(result)) {
      return {
        isValid: false,
        error: 'Invalid calculation result',
      };
    }

    return {
      isValid: true,
      result: Math.round(result), // Round to nearest integer as per requirements
    };
  } catch {
    return {
      isValid: false,
      error: 'Invalid formula',
    };
  }
}

/**
 * Checks if parentheses are balanced
 */
function hasBalancedParentheses(formula: string): boolean {
  let count = 0;
  for (const char of formula) {
    if (char === '(') count++;
    if (char === ')') count--;
    if (count < 0) return false; // Closing before opening
  }
  return count === 0;
}

/**
 * Checks for valid operator placement
 */
function hasValidOperatorPlacement(formula: string): boolean {
  // Cannot start or end with operators (except minus for negative numbers)
  if (/^[+*/]|[+*/-]$/.test(formula)) return false;

  // Cannot have consecutive operators (except for negative numbers)
  if (/[+*/-]{2,}/.test(formula.replace(/^-/, '').replace(/\(-/, '('))) return false;

  return true;
}

/**
 * Filters input to only allow valid characters
 */
export function filterFormulaInput(input: string): string {
  // Only allow numbers, basic operators, parentheses, and decimal points
  return input.replace(/[^0-9+\-*/.()]/g, '');
}

/**
 * Formats currency value
 */
export function formatCurrency(value: number): string {
  if (isNaN(value) || !isFinite(value)) return 'Rs. 0';
  return `Rs. ${Math.round(value).toLocaleString('en-IN')}`;
}

/**
 * Formats percentage value
 */
export function formatPercentage(value: number): string {
  return `${value}%`;
}

/**
 * Creates a default costing component
 */
export function createDefaultComponent(componentType: string, name: string, sortOrder: number) {
  return {
    component_type: componentType,
    name,
    formula: '',
    calculated_cost: 0,
    sort_order: sortOrder,
    is_active: true,
  };
}

/**
 * Creates default costing variant (sheet)
 */
export function createDefaultVariant(name: string, quantity: number, sortOrder: number) {
  return {
    name,
    quantity,
    profit_margin: 20, // Default 20%
    profit_amount: 0,
    tax_percentage: 0, // Default 0%
    tax_profit_amount: 0,
    sub_total: 0,
    total: 0,
    unit_price: 0,
    is_included: true,
    is_locked: false,
    sort_order: sortOrder,
    components: [],
  };
}

/**
 * Calculates sheet totals
 */
export function calculateSheetTotals(
  components: any[],
  quantity: number,
  profitPercentage: number,
  taxPercentage: number,
) {
  const subTotal = components.reduce((sum, comp) => sum + (comp.calculated_cost || 0), 0);
  const profitAmount = (subTotal * profitPercentage) / 100;
  const totalAfterProfit = subTotal + profitAmount;
  const taxAmount = (totalAfterProfit * taxPercentage) / 100;
  const total = totalAfterProfit + taxAmount;
  const unitPrice = quantity > 0 ? total / quantity : 0;

  return {
    sub_total: Math.round(subTotal),
    profit_amount: Math.round(profitAmount),
    tax_profit_amount: Math.round(taxAmount),
    total: Math.round(total),
    unit_price: Math.round(unitPrice * 100) / 100, // Keep 2 decimal places for unit price
  };
}

/**
 * Maps JSON formula data to component structure
 * Handles both NEW format (nested objects) and LEGACY format (flat structure)
 */
export function mapJsonToComponents(formulasJson: any): CostingComponent[] {
  if (!formulasJson) return [];

  // Check if this is the NEW format (nested objects with component_type as key)
  // New format: { "paper": { "name": "Paper", "formula": "...", "calculated_cost": 123 } }
  const isNewFormat =
    formulasJson.paper && typeof formulasJson.paper === 'object' && 'formula' in formulasJson.paper;

  // Component order as per requirements
  const componentOrder: ComponentType[] = [
    'paper',
    'board',
    'artwork',
    'plates',
    'printing',
    'ink',
    'blocks',
    'cutting',
    'folding',
    'binding',
    'misc',
    'transport',
    'discount',
    'lamination',
    'overheads',
  ];

  // Component definitions for display names
  const COMPONENT_DEFINITIONS = {
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

  if (isNewFormat) {
    // NEW FORMAT: Direct mapping from nested objects
    return componentOrder.map((componentType, index) => {
      const componentData = formulasJson[componentType] || {};
      return {
        component_type: componentType,
        name: componentData.name || COMPONENT_DEFINITIONS[componentType],
        formula: componentData.formula || '',
        calculated_cost: componentData.calculated_cost || 0,
        sort_order: componentData.sort_order !== undefined ? componentData.sort_order : index,
        is_active: componentData.is_active !== undefined ? componentData.is_active : true,
      };
    });
  } else {
    // LEGACY FORMAT: Flat structure with _formula suffix
    const componentMapping = {
      paper: { formula: 'paper_formula', value: 'paper' },
      board: { formula: 'board_formula', value: 'board' },
      artwork: { formula: 'artwork_formula', value: 'artwork' },
      plates: { formula: 'plates_formula', value: 'plates' },
      printing: { formula: 'printhours_formula', value: 'printhours' }, // Special mapping
      ink: { formula: 'ink_formula', value: 'ink' },
      blocks: { formula: 'blocks_formula', value: 'blocks' },
      cutting: { formula: 'cutting_formula', value: 'cutting' },
      folding: { formula: 'folding_formula', value: 'folding' },
      binding: { formula: 'binding_formula', value: 'binding' },
      misc: { formula: 'misc_formula', value: 'misc' },
      transport: { formula: 'transport_formula', value: 'transport' },
      discount: { formula: 'discount_formula', value: 'discount' },
      lamination: { formula: 'lamination_formula', value: 'lamination' },
      overheads: { formula: 'other_formula', value: 'other' }, // Special mapping
    };

    return componentOrder.map((componentType, index) => {
      const mapping = componentMapping[componentType];
      const formula = formulasJson[mapping.formula] || '';
      const calculatedCost = parseFloat(formulasJson[mapping.value]) || 0;

      return {
        component_type: componentType,
        name: COMPONENT_DEFINITIONS[componentType],
        formula: formula,
        calculated_cost: calculatedCost,
        sort_order: index,
        is_active: true,
      };
    });
  }
}

/**
 * Converts components back to JSON format for storage
 * Reverses the mapJsonToComponents function
 */
export function mapComponentsToJson(components: CostingComponent[], variant: any): any {
  const jsonData: any = {};

  // Create reverse mapping from component types to JSON keys
  const reverseMapping = {
    paper: { formula: 'paper_formula', value: 'paper' },
    board: { formula: 'board_formula', value: 'board' },
    artwork: { formula: 'artwork_formula', value: 'artwork' },
    plates: { formula: 'plates_formula', value: 'plates' },
    printing: { formula: 'printhours_formula', value: 'printhours' }, // Special mapping
    ink: { formula: 'ink_formula', value: 'ink' },
    blocks: { formula: 'blocks_formula', value: 'blocks' },
    cutting: { formula: 'cutting_formula', value: 'cutting' },
    folding: { formula: 'folding_formula', value: 'folding' },
    binding: { formula: 'binding_formula', value: 'binding' },
    misc: { formula: 'misc_formula', value: 'misc' },
    transport: { formula: 'transport_formula', value: 'transport' },
    discount: { formula: 'discount_formula', value: 'discount' },
    lamination: { formula: 'lamination_formula', value: 'lamination' },
    overheads: { formula: 'other_formula', value: 'other' }, // Special mapping
  };

  // Map components back to JSON format
  components.forEach((component) => {
    const mapping = reverseMapping[component.component_type as keyof typeof reverseMapping];
    if (mapping) {
      jsonData[mapping.formula] = component.formula || '';
      jsonData[mapping.value] = component.calculated_cost || 0;
    }
  });

  // Add sheet-level data
  jsonData.quantity = variant.quantity?.toString() || '0';
  jsonData.sub_total = variant.sub_total?.toString() || '0';
  jsonData.profit_margin = variant.profit_margin?.toString() || '0';
  jsonData.profit_amount = variant.profit_amount?.toString() || '0';
  jsonData.tax_percentage = variant.tax_percentage?.toString() || '0';
  jsonData.taxprofit_amount = variant.tax_profit_amount?.toString() || '0';
  jsonData.total = variant.total?.toString() || '0';
  jsonData.unit_price = variant.unit_price?.toString() || '0';
  jsonData.sheet_name = variant.name || 'Sheet 01';
  jsonData.active_sheet = variant.is_included ? 1 : 0;

  // Add view formatted values (for compatibility)
  jsonData.sub_total_view = `Rs. ${variant.sub_total || 0}`;
  jsonData.profit_amount_view = `Rs. ${variant.profit_amount || 0}`;
  jsonData.taxprofit_amount_view = `Rs. ${variant.tax_profit_amount || 0}`;
  jsonData.total_view = `Rs. ${variant.total || 0}`;
  jsonData.unit_price_view = `Rs. ${variant.unit_price || 0}`;

  return jsonData;
}
