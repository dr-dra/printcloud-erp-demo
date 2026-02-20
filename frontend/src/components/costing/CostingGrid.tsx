'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * COSTING SHEET GRID COMPONENT (Excel-like Grid)
 *
 * This component displays an excel-like grid for costing calculations.
 *
 * STRUCTURE:
 * - Top section: Finished Product dropdown & Quantity input
 * - Middle section: Component rows (Paper, Board, Art Work, Plates, Printing, etc.)
 *   Each row has: Component Name | Formula Input | Calculated Cost
 * - Bottom section: Sub Total, Profit (%), Tax (%), Total, Unit Price
 *
 * DATA FLOW:
 * - User selects finished product (e.g., Books A4, Letterhead)
 * - User enters quantity (e.g., 3000)
 * - User enters formulas for each component (e.g., Paper: "32*120" = 3840)
 * - Formulas are evaluated and costs calculated automatically
 * - All data saved as JSON in the "formulas" field of costing_costing_sheet table
 *
 * IMPORTANT: This is the main costing calculation interface!
 */

import React, { useState, useRef, useEffect } from 'react';
import { CostingVariant, COMPONENT_DEFINITIONS, ComponentType, SheetAction } from '@/types/costing';
import { evaluateFormula, filterFormulaInput, formatCurrency } from '@/utils/formulaUtils';
import { Copy, Trash2, Plus } from 'lucide-react';
import { HiLockClosed } from 'react-icons/hi';
import TypeaheadInput from '@/components/common/TypeaheadInput';
import { api } from '@/lib/api';

interface CostingGridProps {
  variant: CostingVariant;
  onVariantChange: (updatedVariant: CostingVariant) => void;
  isFirstSheet?: boolean;
  isLastSheet?: boolean;
  showOnlyCalculation?: boolean;
  totalSheets?: number;
  sheetIndex?: number;
  onSheetAction?: (action: SheetAction, index?: number) => void;
}

// Default VAT rate from settings (18%)
const DEFAULT_VAT_RATE = 18;

interface FinishedProduct {
  id: number;
  name: string;
  width?: number;
  height?: number;
  dimensions_display?: string;
  is_vat_exempt?: boolean;
}

export default function CostingGrid({
  variant,
  onVariantChange,
  isFirstSheet: _isFirstSheet = true,
  isLastSheet = true,
  showOnlyCalculation = false,
  totalSheets = 1,
  sheetIndex = 0,
  onSheetAction,
}: CostingGridProps) {
  const [focusedCell, setFocusedCell] = useState<{
    row: number;
    col: 'formula' | 'quantity';
  } | null>(null);
  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const quantityRef = useRef<HTMLInputElement>(null);
  const [selectedFinishedProduct, setSelectedFinishedProduct] = useState<{
    id: number | string;
    name: string;
    secondary?: string;
    is_vat_exempt?: boolean;
  } | null>(null);

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

  // Format formula for display with proper spacing and styling
  const formatFormulaDisplay = (formula: string): string => {
    if (!formula) return '';

    // Only normalize double asterisks to single asterisks
    let formatted = formula.replace(/\*\*/g, '*');

    return formatted;
  };

  // Search function for finished products
  const searchFinishedProducts = async (query: string) => {
    try {
      const response = await api.get(
        `/sales/finished-products/?search=${encodeURIComponent(query)}`,
      );
      return response.data.results.map((product: FinishedProduct) => ({
        id: product.id,
        name: product.name,
        secondary: product.dimensions_display ? `(${product.dimensions_display})` : '',
        is_vat_exempt: product.is_vat_exempt || false,
      }));
    } catch (error) {
      console.error('Error searching finished products:', error);
      return [];
    }
  };

  const getTopFinishedProducts = async () => {
    try {
      console.log('🔍 Fetching top finished products...');
      const response = await api.get(`/sales/finished-products/?limit=5`);
      console.log('✅ Top finished products response:', response.data);
      const mappedResults = response.data.results.map((product: FinishedProduct) => ({
        id: product.id,
        name: product.name,
        secondary: product.dimensions_display ? `(${product.dimensions_display})` : '',
        is_vat_exempt: product.is_vat_exempt || false,
      }));
      console.log('✅ Mapped finished products:', mappedResults);
      return mappedResults;
    } catch (error) {
      console.error('❌ Error getting top finished products:', error);
      return [];
    }
  };

  // Initialize components if not present
  useEffect(() => {
    if (variant.components.length === 0) {
      const newComponents = componentOrder.map((type, index) => ({
        component_type: type,
        name: COMPONENT_DEFINITIONS[type],
        formula: '',
        calculated_cost: 0,
        sort_order: index,
        is_active: true,
      }));

      onVariantChange({
        ...variant,
        components: newComponents,
      });
    }
  }, [variant, onVariantChange]);

  // Recalculate totals when components change (for initial load with existing formulas)
  useEffect(() => {
    if (variant.components.length > 0) {
      // Calculate costs for all components with formulas
      const updatedComponents = variant.components.map((component) => {
        if (component.formula) {
          const validation = evaluateFormula(component.formula);
          return {
            ...component,
            calculated_cost: validation.isValid ? validation.result || 0 : 0,
          };
        }
        return component;
      });

      // Recalculate totals
      const subTotal = updatedComponents.reduce((sum, comp) => sum + comp.calculated_cost, 0);
      const profitAmount = (subTotal * variant.profit_margin) / 100;
      const totalAfterProfit = subTotal + profitAmount;
      const taxAmount = (totalAfterProfit * variant.tax_percentage) / 100;
      const total = totalAfterProfit + taxAmount;
      const unitPrice = variant.quantity > 0 ? total / variant.quantity : 0;

      // Only update if calculations have changed
      if (
        subTotal !== variant.sub_total ||
        profitAmount !== variant.profit_amount ||
        taxAmount !== variant.tax_profit_amount ||
        total !== variant.total ||
        unitPrice !== variant.unit_price
      ) {
        onVariantChange({
          ...variant,
          components: updatedComponents,
          sub_total: Math.round(subTotal),
          profit_amount: Math.round(profitAmount),
          tax_profit_amount: Math.round(taxAmount),
          total: Math.round(total),
          unit_price: Math.round(unitPrice * 100) / 100,
        });
      }
    }
  }, [variant.components.length, variant.profit_margin, variant.tax_percentage, variant.quantity]);

  // Initialize selectedFinishedProduct based on variant name and finished_product_id
  useEffect(() => {
    if (variant.finished_product_id && !selectedFinishedProduct) {
      // If we have a finished_product_id, fetch the product directly
      const fetchProduct = async () => {
        try {
          const response = await api.get(
            `/sales/finished-products/${variant.finished_product_id}/`,
          );
          const product = response.data;
          setSelectedFinishedProduct({
            id: product.id,
            name: product.name,
            secondary: product.dimensions_display ? `(${product.dimensions_display})` : '',
            is_vat_exempt: product.is_vat_exempt || false,
          });
          // Also sync the name back to the variant if it's empty or different
          if (!variant.name || variant.name !== product.name) {
            onVariantChange({
              ...variant,
              name: product.name,
            });
          }
        } catch (error) {
          console.warn(
            `Could not fetch finished product with ID ${variant.finished_product_id}:`,
            error,
          );
          // Fall back to manual entry if ID-based fetch fails
          if (variant.name && variant.name.trim()) {
            setSelectedFinishedProduct({
              id: 'manual',
              name: variant.name,
              secondary: '',
            });
          }
        }
      };
      fetchProduct();
    } else if (
      variant.name &&
      variant.name.trim() &&
      !selectedFinishedProduct &&
      !variant.finished_product_id
    ) {
      // For entries with name but no finished_product_id - try to find matching product
      const searchAndSetProduct = async () => {
        try {
          const response = await api.get(
            `/sales/finished-products/?search=${encodeURIComponent(variant.name)}`,
          );
          const exactMatch = response.data.results?.find(
            (product: any) => product.name.toLowerCase() === variant.name.toLowerCase(),
          );

          if (exactMatch) {
            // Found a matching product - set both display and variant
            setSelectedFinishedProduct({
              id: exactMatch.id,
              name: exactMatch.name,
              secondary: exactMatch.dimensions_display ? `(${exactMatch.dimensions_display})` : '',
              is_vat_exempt: exactMatch.is_vat_exempt || false,
            });
            // Update variant with the found finished_product_id
            onVariantChange({
              ...variant,
              name: exactMatch.name,
              finished_product_id: exactMatch.id,
            });
          } else {
            // No match found - use as manual entry
            setSelectedFinishedProduct({
              id: 'manual',
              name: variant.name,
              secondary: '',
            });
          }
        } catch (error) {
          console.warn(`Could not search for finished product "${variant.name}":`, error);
          // Fall back to manual entry
          setSelectedFinishedProduct({
            id: 'manual',
            name: variant.name,
            secondary: '',
          });
        }
      };
      searchAndSetProduct();
    } else if (!variant.name && selectedFinishedProduct) {
      // Clear selected product if variant name is empty
      setSelectedFinishedProduct(null);
    }
  }, [variant.name, variant.finished_product_id, selectedFinishedProduct]);

  // Handle finished product selection
  const handleFinishedProductChange = (
    finishedProduct: {
      id: number | string;
      name: string;
      secondary?: string;
      is_vat_exempt?: boolean;
    } | null,
  ) => {
    setSelectedFinishedProduct(finishedProduct);

    // Determine VAT percentage based on product's VAT exemption status
    // If VAT exempt (e.g., Books) → 0%, otherwise → default rate (18%)
    const vatPercentage = finishedProduct?.is_vat_exempt ? 0 : DEFAULT_VAT_RATE;

    onVariantChange({
      ...variant,
      name: finishedProduct?.name || '',
      finished_product_id: finishedProduct ? Number(finishedProduct.id) : undefined,
      tax_percentage: vatPercentage,
    });

    // Only focus on quantity field if a finished product was actually selected (not when cleared)
    if (finishedProduct && finishedProduct.name) {
      setTimeout(() => {
        quantityRef.current?.focus();
        quantityRef.current?.select(); // Also select the text for easy editing
      }, 100);
    }
  };

  // Handle formula input (typing) - no validation, just update the formula text
  const handleFormulaInput = (componentIndex: number, newFormula: string) => {
    // Filter input to only allow valid characters
    let filteredFormula = filterFormulaInput(newFormula);

    // Normalize double asterisks to single asterisks
    filteredFormula = filteredFormula.replace(/\*\*/g, '*');

    // Update component formula without validation
    const updatedComponents = [...variant.components];
    updatedComponents[componentIndex] = {
      ...updatedComponents[componentIndex],
      formula: filteredFormula,
    };

    onVariantChange({
      ...variant,
      components: updatedComponents,
    });
  };

  // Handle formula blur (validation and calculation)
  const handleFormulaBlur = (componentIndex: number) => {
    const component = variant.components[componentIndex];
    if (!component?.formula) return;

    // Evaluate formula
    const validation = evaluateFormula(component.formula);

    // Update component with calculated cost
    const updatedComponents = [...variant.components];
    updatedComponents[componentIndex] = {
      ...updatedComponents[componentIndex],
      calculated_cost: validation.isValid ? validation.result || 0 : 0,
    };

    // Recalculate totals
    const subTotal = updatedComponents.reduce((sum, comp) => sum + comp.calculated_cost, 0);
    const profitAmount = (subTotal * variant.profit_margin) / 100;
    const totalAfterProfit = subTotal + profitAmount;
    const taxAmount = (totalAfterProfit * variant.tax_percentage) / 100;
    const total = totalAfterProfit + taxAmount;
    const unitPrice = variant.quantity > 0 ? total / variant.quantity : 0;

    onVariantChange({
      ...variant,
      components: updatedComponents,
      sub_total: Math.round(subTotal),
      profit_amount: Math.round(profitAmount),
      tax_profit_amount: Math.round(taxAmount),
      total: Math.round(total),
      unit_price: Math.round(unitPrice * 100) / 100,
    });
  };

  const handleQuantityChange = (newQuantity: string) => {
    const quantity = parseFloat(newQuantity) || 0;

    if (quantity < 0) {
      // Show error for negative quantity
      return;
    }

    // Recalculate unit price
    const unitPrice = quantity > 0 ? variant.total / quantity : 0;

    onVariantChange({
      ...variant,
      quantity,
      unit_price: Math.round(unitPrice * 100) / 100,
    });
  };

  const handleProfitChange = (newProfit: string) => {
    const profitMargin = parseFloat(newProfit) || 0;
    const profitAmount = (variant.sub_total * profitMargin) / 100;
    const totalAfterProfit = variant.sub_total + profitAmount;
    const taxAmount = (totalAfterProfit * variant.tax_percentage) / 100;
    const total = totalAfterProfit + taxAmount;
    const unitPrice = variant.quantity > 0 ? total / variant.quantity : 0;

    onVariantChange({
      ...variant,
      profit_margin: profitMargin,
      profit_amount: Math.round(profitAmount),
      tax_profit_amount: Math.round(taxAmount),
      total: Math.round(total),
      unit_price: Math.round(unitPrice * 100) / 100,
    });
  };

  const handleTaxChange = (newTax: string) => {
    const taxPercentage = parseFloat(newTax) || 0;
    const totalAfterProfit = variant.sub_total + variant.profit_amount;
    const taxAmount = (totalAfterProfit * taxPercentage) / 100;
    const total = totalAfterProfit + taxAmount;
    const unitPrice = variant.quantity > 0 ? total / variant.quantity : 0;

    onVariantChange({
      ...variant,
      tax_percentage: taxPercentage,
      tax_profit_amount: Math.round(taxAmount),
      total: Math.round(total),
      unit_price: Math.round(unitPrice * 100) / 100,
    });
  };

  const getFormulaError = (componentIndex: number): string | null => {
    const component = variant.components[componentIndex];
    if (!component?.formula) return null;

    // Don't show validation errors while user is actively typing in this field
    if (focusedCell?.row === componentIndex && focusedCell?.col === 'formula') {
      return null;
    }

    const validation = evaluateFormula(component.formula);
    return validation.isValid ? null : validation.error || 'Invalid formula';
  };

  return (
    <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
      {/* Sheet Info Row */}
      <div
        className={`grid border-b border-gray-300 dark:border-gray-600 ${showOnlyCalculation ? 'grid-cols-[1.5fr_120px]' : 'grid-cols-[160px_1fr_120px]'}`}
      >
        {!showOnlyCalculation && (
          <div className="px-1 py-1 bg-gray-100 dark:bg-gray-700 border-r border-gray-300 dark:border-gray-600 font-semibold text-xs leading-none text-gray-900 dark:text-gray-100 flex items-center">
            {totalSheets} Sheet{totalSheets !== 1 ? 's' : ''}
          </div>
        )}
        <div className="px-1 py-1 bg-gray-50 dark:bg-gray-700 border-r border-gray-300 dark:border-gray-600 flex items-center col-span-2">
          {/* Lock Icon - positioned before the title */}
          {variant.is_locked && (
            <div
              className="p-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400 mr-1 flex-shrink-0"
              title="This sheet is locked"
            >
              <HiLockClosed className="w-3 h-3" />
            </div>
          )}

          <div style={{ flex: 1 }} className={variant.is_locked ? 'ml-1' : ''}>
            <TypeaheadInput
              value={selectedFinishedProduct}
              onChange={handleFinishedProductChange}
              placeholder="Sheet name..."
              searchFunction={searchFinishedProducts}
              getInitialOptions={getTopFinishedProducts}
              disabled={variant.is_locked}
              outlined={false}
              className="bg-transparent font-semibold text-xs leading-none text-gray-900 dark:text-gray-100"
              sizing="sm"
            />
          </div>

          {/* Top Sheet Action Buttons */}
          {onSheetAction && (
            <div className="flex items-center space-x-1 ml-2">
              {/* Clone Button */}
              <button
                onClick={() => onSheetAction('clone', sheetIndex)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                title="Clone Sheet"
              >
                <Copy className="w-3 h-3" />
              </button>

              {/* Bin Button (only if not locked and more than 1 sheet) */}
              {!variant.is_locked && totalSheets > 1 && (
                <button
                  onClick={() => onSheetAction('delete', sheetIndex)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                  title="Delete Sheet"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}

              {/* Add Button (only on last sheet) */}
              {isLastSheet && (
                <button
                  onClick={() => onSheetAction('add')}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                  title="Add New Sheet"
                >
                  <Plus className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quantity Row */}
      <div
        className={`grid border-b-2 border-gray-300 dark:border-gray-600 ${showOnlyCalculation ? 'grid-cols-[1.5fr_120px]' : 'grid-cols-[160px_1.5fr_120px]'}`}
      >
        {!showOnlyCalculation && (
          <div className="px-1 py-1 bg-gray-100 dark:bg-gray-700 border-r border-gray-300 dark:border-gray-600 font-semibold text-xs leading-none text-gray-900 dark:text-gray-100 flex items-center">
            Quantity
          </div>
        )}
        <div className="px-1 py-1 bg-gray-50 dark:bg-gray-700 border-r border-gray-300 dark:border-gray-600 col-span-2 flex items-center">
          {showOnlyCalculation ? (
            <div className="flex items-center justify-between">
              <span className="text-xs leading-none font-semibold text-gray-700 dark:text-gray-300">
                Qty:
              </span>
              <input
                type="number"
                value={variant.quantity}
                readOnly={variant.is_locked}
                onChange={
                  variant.is_locked ? undefined : (e) => handleQuantityChange(e.target.value)
                }
                className={`w-16 px-1 py-0 text-xs leading-none text-right bg-transparent border-none outline-none focus:ring-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield] ${
                  variant.is_locked
                    ? 'text-gray-500 dark:text-gray-400 cursor-not-allowed'
                    : 'text-gray-900 dark:text-gray-100'
                }`}
              />
            </div>
          ) : (
            <input
              ref={quantityRef}
              type="number"
              value={variant.quantity}
              readOnly={variant.is_locked}
              onChange={variant.is_locked ? undefined : (e) => handleQuantityChange(e.target.value)}
              className={`w-full px-1 py-0 text-xs leading-none text-right bg-transparent border-none outline-none focus:ring-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield] ${
                variant.is_locked
                  ? 'text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : 'text-gray-900 dark:text-gray-100'
              }`}
            />
          )}
        </div>
      </div>

      {/* Component Rows */}
      {componentOrder.map((componentType, index) => {
        const component = variant.components.find((c) => c.component_type === componentType);
        const error = component ? getFormulaError(index) : null;

        return (
          <div
            key={componentType}
            className={`grid border-b border-gray-200 dark:border-gray-600 ${
              index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-slate-50 dark:bg-gray-700/50'
            } hover:bg-gray-50 dark:hover:bg-gray-600 ${showOnlyCalculation ? 'grid-cols-[1.5fr_120px]' : 'grid-cols-[160px_1.5fr_120px]'}`}
          >
            {/* Component Name */}
            {!showOnlyCalculation && (
              <div className="px-1 py-1 border-r border-gray-200 dark:border-gray-600 text-xs leading-none font-medium bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 flex items-center">
                {COMPONENT_DEFINITIONS[componentType]}
              </div>
            )}

            {/* Formula Input */}
            <div className="relative border-r border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 flex items-center">
              <input
                ref={(el) => {
                  inputRefs.current[`formula-${index}`] = el;
                }}
                type="text"
                value={component?.formula || ''}
                readOnly={variant.is_locked}
                onChange={
                  variant.is_locked ? undefined : (e) => handleFormulaInput(index, e.target.value)
                }
                onFocus={
                  variant.is_locked
                    ? undefined
                    : () => setFocusedCell({ row: index, col: 'formula' })
                }
                onBlur={
                  variant.is_locked
                    ? undefined
                    : () => {
                        setFocusedCell(null);
                        handleFormulaBlur(index);
                      }
                }
                onKeyDown={
                  variant.is_locked
                    ? undefined
                    : (e) => {
                        if (e.key === 'Enter' || e.key === 'Tab') {
                          // Validate and calculate before moving to next row
                          handleFormulaBlur(index);

                          if (e.key === 'Enter') {
                            // Move to next row
                            const nextIndex = index + 1;
                            if (nextIndex < componentOrder.length) {
                              inputRefs.current[`formula-${nextIndex}`]?.focus();
                            }
                          }
                        }
                      }
                }
                placeholder={
                  component?.formula ? '' : `${COMPONENT_DEFINITIONS[componentType].toLowerCase()}`
                }
                className={`
                  w-full px-1 py-1.5 text-xs leading-none border-none outline-none font-mono
                  ${variant.is_locked ? 'text-gray-500 dark:text-gray-400 cursor-not-allowed' : ''}
                  ${
                    focusedCell?.row === index && focusedCell?.col === 'formula'
                      ? 'bg-gray-50 dark:bg-gray-700 ring-2 ring-gray-300 dark:ring-gray-500 text-gray-900 dark:text-gray-100'
                      : 'bg-transparent text-transparent caret-transparent'
                  }
                `}
              />
              {/* Display formatted formula when not focused and has content */}
              {(!focusedCell || focusedCell.row !== index || focusedCell.col !== 'formula') &&
              component?.formula ? (
                <div
                  className={`absolute inset-0 px-1 py-1.5 text-xs leading-none pointer-events-none overflow-hidden font-mono flex items-center ${
                    variant.is_locked
                      ? 'text-gray-500 dark:text-gray-400'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                  title={formatFormulaDisplay(component.formula)}
                >
                  {formatFormulaDisplay(component.formula)}
                </div>
              ) : null}
            </div>

            {/* Result */}
            <div
              className={`
                px-1 py-1.5 text-xs leading-none text-right bg-gray-50 dark:bg-gray-700 flex items-center justify-end
                ${error ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900' : 'text-gray-900 dark:text-gray-100 font-medium'}
              `}
            >
              {error ? (
                <span className="text-xs leading-none font-normal">{error}</span>
              ) : (
                formatCurrency(component?.calculated_cost || 0)
              )}
            </div>
          </div>
        );
      })}

      {/* Summary Section */}
      <div className="mt-1 border-t-2 border-gray-300 dark:border-gray-600">
        {/* Sub Total */}
        <div
          className={`grid border-b border-gray-200 dark:border-gray-600 ${showOnlyCalculation ? 'grid-cols-[1.5fr_120px]' : 'grid-cols-[160px_1.5fr_120px]'}`}
        >
          {!showOnlyCalculation && (
            <div className="px-1 py-2 bg-gray-100 dark:bg-gray-700 border-r border-gray-200 dark:border-gray-600 text-xs leading-none font-semibold text-gray-800 dark:text-gray-300 flex items-center">
              Sub Total
            </div>
          )}
          <div className="px-1 py-2 bg-gray-50 dark:bg-gray-700 border-r border-gray-200 dark:border-gray-600 flex items-center"></div>
          <div className="px-1 py-2 bg-gray-100 dark:bg-gray-700 text-xs leading-none text-right font-semibold text-gray-800 dark:text-gray-300 flex items-center justify-end">
            {formatCurrency(variant.sub_total)}
          </div>
        </div>

        {/* Profit Margin */}
        <div
          className={`grid border-b border-gray-200 dark:border-gray-600 ${showOnlyCalculation ? 'grid-cols-[1.5fr_120px]' : 'grid-cols-[160px_1.5fr_120px]'}`}
        >
          {!showOnlyCalculation && (
            <div className="px-1 py-1 bg-gray-100 dark:bg-gray-700 border-r border-gray-200 dark:border-gray-600 text-xs leading-none font-medium text-gray-800 dark:text-gray-300 flex items-center">
              Profit %
            </div>
          )}
          <div className="px-1 py-1 bg-gray-50 dark:bg-gray-700 border-r border-gray-200 dark:border-gray-600 text-right flex items-center justify-end">
            <input
              type="number"
              value={variant.profit_margin}
              readOnly={variant.is_locked}
              onChange={variant.is_locked ? undefined : (e) => handleProfitChange(e.target.value)}
              className={`w-10 text-right bg-transparent border-none outline-none text-xs leading-none font-medium [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield] ${
                variant.is_locked
                  ? 'text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : 'text-gray-800 dark:text-gray-300'
              }`}
              step="0.1"
            />
            <span className="text-xs leading-none ml-1 text-gray-800 dark:text-gray-300">%</span>
          </div>
          <div className="px-1 py-1 bg-gray-100 dark:bg-gray-700 text-xs leading-none text-right font-medium text-gray-800 dark:text-gray-300 flex items-center justify-end">
            {formatCurrency(variant.profit_amount)}
          </div>
        </div>

        {/* Unit Price (Ex-VAT) - Highlighted as this is used for Quotations/Orders */}
        <div
          className={`grid border-b border-amber-300 dark:border-amber-600 ${showOnlyCalculation ? 'grid-cols-[1.5fr_120px]' : 'grid-cols-[160px_1.5fr_120px]'}`}
        >
          {!showOnlyCalculation && (
            <div className="px-1 py-2 bg-amber-50 dark:bg-amber-900/30 border-r border-amber-200 dark:border-amber-700 text-xs leading-none font-semibold text-amber-800 dark:text-amber-300 flex items-center">
              Unit Price (Ex-VAT)
            </div>
          )}
          <div className="px-1 py-2 bg-amber-50/50 dark:bg-amber-900/20 border-r border-amber-200 dark:border-amber-700 flex items-center"></div>
          <div className="px-1 py-2 bg-amber-50 dark:bg-amber-900/30 text-xs leading-none text-right font-semibold text-amber-800 dark:text-amber-300 flex items-center justify-end">
            Rs.{' '}
            {(variant.quantity > 0
              ? (variant.sub_total + variant.profit_amount) / variant.quantity
              : 0
            ).toFixed(2)}
          </div>
        </div>

        {/* VAT Percentage */}
        <div
          className={`grid border-b border-gray-200 dark:border-gray-600 ${showOnlyCalculation ? 'grid-cols-[1.5fr_120px]' : 'grid-cols-[160px_1.5fr_120px]'}`}
        >
          {!showOnlyCalculation && (
            <div className="px-1 py-1 bg-gray-100 dark:bg-gray-700 border-r border-gray-200 dark:border-gray-600 text-xs leading-none font-medium text-gray-800 dark:text-gray-300 flex items-center">
              VAT %
            </div>
          )}
          <div className="px-1 py-1 bg-gray-50 dark:bg-gray-700 border-r border-gray-200 dark:border-gray-600 text-right flex items-center justify-end">
            <input
              type="number"
              value={variant.tax_percentage}
              readOnly={variant.is_locked}
              onChange={variant.is_locked ? undefined : (e) => handleTaxChange(e.target.value)}
              className={`w-10 text-right bg-transparent border-none outline-none text-xs leading-none font-medium [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield] ${
                variant.is_locked
                  ? 'text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : 'text-gray-800 dark:text-gray-300'
              }`}
              step="0.1"
            />
            <span className="text-xs leading-none ml-1 text-gray-800 dark:text-gray-300">%</span>
          </div>
          <div className="px-1 py-1 bg-gray-100 dark:bg-gray-700 text-xs leading-none text-right font-medium text-gray-800 dark:text-gray-300 flex items-center justify-end">
            {formatCurrency(variant.tax_profit_amount)}
          </div>
        </div>

        {/* Total (Inc-VAT) */}
        <div
          className={`grid border-b-2 border-gray-400 dark:border-gray-500 ${showOnlyCalculation ? 'grid-cols-[1.5fr_120px]' : 'grid-cols-[160px_1.5fr_120px]'}`}
        >
          {!showOnlyCalculation && (
            <div className="px-1 py-2 bg-gray-200 dark:bg-gray-600 border-r border-gray-300 dark:border-gray-600 text-xs leading-none font-bold text-gray-900 dark:text-gray-200 flex items-center">
              Total (Inc-VAT)
            </div>
          )}
          <div className="px-1 py-2 bg-gray-100 dark:bg-gray-600 border-r border-gray-300 dark:border-gray-600 flex items-center"></div>
          <div className="px-1 py-2 bg-gray-200 dark:bg-gray-600 text-xs leading-none text-right font-bold text-gray-900 dark:text-gray-200 flex items-center justify-end">
            {formatCurrency(variant.total)}
          </div>
        </div>

        {/* Unit Price (Inc-VAT) */}
        <div
          className={`grid ${showOnlyCalculation ? 'grid-cols-[1.5fr_120px]' : 'grid-cols-[160px_1.5fr_120px]'}`}
        >
          {!showOnlyCalculation && (
            <div className="px-1 py-2 bg-gray-100 dark:bg-gray-700 border-r border-gray-200 dark:border-gray-600 text-xs leading-none font-semibold text-gray-800 dark:text-gray-300 flex items-center">
              Unit Price (Inc-VAT)
            </div>
          )}
          <div className="px-1 py-2 bg-gray-50 dark:bg-gray-700 border-r border-gray-200 dark:border-gray-600 flex items-center"></div>
          <div className="px-1 py-2 bg-gray-100 dark:bg-gray-700 text-xs leading-none text-right font-semibold text-gray-800 dark:text-gray-300 flex items-center justify-end">
            Rs. {(parseFloat(String(variant.unit_price || 0)) || 0).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Include This Checkbox */}
      <div
        className={`mt-1 grid ${showOnlyCalculation ? 'grid-cols-[1.5fr_120px]' : 'grid-cols-[160px_1.5fr_120px]'}`}
      >
        {!showOnlyCalculation && <div className=""></div>}
        <div className="col-span-2 p-1 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between">
            {/* Show linked document info when locked, otherwise show Include checkbox */}
            {variant.is_locked && variant.linked_quotation_number ? (
              <a
                href={`/dashboard/sales/quotations/${variant.linked_quotation_id}`}
                className="flex items-center space-x-1 text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 hover:underline transition-colors"
                title={`Navigate to Quotation #${variant.linked_quotation_number}`}
              >
                <input
                  type="checkbox"
                  checked={true}
                  disabled={true}
                  className="w-3 h-3 text-gray-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                />
                <span className="text-xs leading-none font-medium">
                  Linked to Q#{variant.linked_quotation_number}
                </span>
              </a>
            ) : variant.is_locked && variant.linked_order_number ? (
              <a
                href={`/dashboard/sales/orders/${variant.linked_order_id}`}
                className="flex items-center space-x-1 text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 hover:underline transition-colors"
                title={`Navigate to Order #${variant.linked_order_number}`}
              >
                <input
                  type="checkbox"
                  checked={true}
                  disabled={true}
                  className="w-3 h-3 text-gray-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                />
                <span className="text-xs leading-none font-medium">
                  Linked to O#{variant.linked_order_number}
                </span>
              </a>
            ) : (
              <label className="flex items-center space-x-1">
                <input
                  type="checkbox"
                  checked={variant.is_included}
                  onChange={(e) => onVariantChange({ ...variant, is_included: e.target.checked })}
                  disabled={variant.is_locked}
                  className="w-3 h-3 text-gray-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-gray-500 focus:ring-2"
                />
                <span className="text-xs leading-none font-medium text-gray-900 dark:text-gray-200">
                  Include
                </span>
              </label>
            )}

            {/* Sheet Action Buttons */}
            {onSheetAction && (
              <div className="flex items-center space-x-1">
                {/* Clone Button */}
                <button
                  onClick={() => onSheetAction('clone', sheetIndex)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                  title="Clone Sheet"
                >
                  <Copy className="w-3 h-3" />
                </button>

                {/* Bin Button (only if not locked and more than 1 sheet) */}
                {!variant.is_locked && totalSheets > 1 && (
                  <button
                    onClick={() => onSheetAction('delete', sheetIndex)}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                    title="Delete Sheet"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}

                {/* Add Button (only on last sheet) */}
                {isLastSheet && (
                  <button
                    onClick={() => onSheetAction('add')}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                    title="Add New Sheet"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
