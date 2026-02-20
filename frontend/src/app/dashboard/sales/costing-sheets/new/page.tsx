'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  CostingSheet,
  CostingVariant,
  SheetAction,
  COMPONENT_DEFINITIONS,
  ComponentType,
} from '@/types/costing';
import { createDefaultVariant } from '@/utils/formulaUtils';
import SheetTabs from '@/components/costing/SheetTabs';
import CostingGrid from '@/components/costing/CostingGrid';
import PageHeader from '@/components/common/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

export default function NewCostingSheetPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [costingSheet, setCostingSheet] = useState<CostingSheet>({
    project_name: '',
    customer: undefined,
    sales_person: (user as any)?.id,
    notes: '',
    is_outbound: false,
    is_active: true,
    variants: [],
  });
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize with one default sheet
  useEffect(() => {
    if (costingSheet.variants.length === 0) {
      const defaultVariant = createDefaultVariant('Sheet 01', 500, 0);

      // Create default components
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

      const defaultComponents = componentOrder.map((type, index) => ({
        component_type: type,
        name: COMPONENT_DEFINITIONS[type],
        formula: '',
        calculated_cost: 0,
        sort_order: index,
        is_active: true,
      }));

      setCostingSheet((prev) => ({
        ...prev,
        variants: [
          {
            ...defaultVariant,
            components: defaultComponents,
          },
        ],
      }));
    }
  }, []);

  const handleSheetAction = (action: SheetAction, index?: number) => {
    switch (action) {
      case 'add': {
        const newSheetNumber = costingSheet.variants.length + 1;
        const newVariant = createDefaultVariant(
          `Sheet ${newSheetNumber.toString().padStart(2, '0')}`,
          500,
          costingSheet.variants.length,
        );

        // Create default components for new sheet
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

        const defaultComponents = componentOrder.map((type, sortIndex) => ({
          component_type: type,
          name: COMPONENT_DEFINITIONS[type],
          formula: '',
          calculated_cost: 0,
          sort_order: sortIndex,
          is_active: true,
        }));

        setCostingSheet((prev) => ({
          ...prev,
          variants: [...prev.variants, { ...newVariant, components: defaultComponents }],
        }));
        setActiveSheetIndex(costingSheet.variants.length);
        break;
      }

      case 'clone': {
        if (index !== undefined && costingSheet.variants[index]) {
          const sourceVariant = costingSheet.variants[index];
          const clonedVariant = {
            ...sourceVariant,
            id: undefined, // Remove ID for new variant
            name: `${sourceVariant.name} - Copy`,
            sort_order: costingSheet.variants.length,
            is_locked: false, // Cloned sheets are never locked
            components: sourceVariant.components.map((comp) => ({
              ...comp,
              id: undefined, // Remove ID for new components
            })),
          };

          setCostingSheet((prev) => ({
            ...prev,
            variants: [...prev.variants, clonedVariant],
          }));
          setActiveSheetIndex(costingSheet.variants.length);
        }
        break;
      }

      case 'delete': {
        if (
          index !== undefined &&
          costingSheet.variants.length > 1 &&
          !costingSheet.variants[index].is_locked
        ) {
          setCostingSheet((prev) => ({
            ...prev,
            variants: prev.variants.filter((_, i) => i !== index),
          }));

          // Adjust active sheet index if necessary
          if (activeSheetIndex >= costingSheet.variants.length - 1) {
            setActiveSheetIndex(Math.max(0, costingSheet.variants.length - 2));
          } else if (index <= activeSheetIndex) {
            setActiveSheetIndex(Math.max(0, activeSheetIndex - 1));
          }
        }
        break;
      }
    }
  };

  const handleSheetRename = (index: number, newName: string) => {
    setCostingSheet((prev) => ({
      ...prev,
      variants: prev.variants.map((variant, i) =>
        i === index ? { ...variant, name: newName } : variant,
      ),
    }));
  };

  const _handleVariantChange = (updatedVariant: CostingVariant) => {
    setCostingSheet((prev) => ({
      ...prev,
      variants: prev.variants.map((variant, i) =>
        i === activeSheetIndex ? updatedVariant : variant,
      ),
    }));
  };

  const handleSaveCosting = async () => {
    if (!costingSheet.project_name.trim()) {
      alert('Please enter a project name');
      return;
    }

    setIsSaving(true);
    try {
      const response = await api.post('/costing/costing-sheets/', costingSheet);

      if (response.data.id) {
        router.push('/dashboard/sales/costing-sheets');
      }
    } catch (error) {
      console.error('Error saving costing sheet:', error);
      alert('Error saving costing sheet. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateQuotation = () => {
    // Future feature - create quotation from included sheets
    alert('Create quotation feature coming soon!');
  };

  const _currentVariant = costingSheet.variants[activeSheetIndex];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Header */}
      <PageHeader title="New Costing Sheet" />

      {/* Header Form Section */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="max-w-md">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Project Name
          </label>
          <input
            type="text"
            value={costingSheet.project_name}
            onChange={(e) => setCostingSheet((prev) => ({ ...prev, project_name: e.target.value }))}
            placeholder="Enter project name..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Sheet Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6">
        <SheetTabs
          variants={costingSheet.variants}
          activeSheetIndex={activeSheetIndex}
          onSheetSelect={setActiveSheetIndex}
          onSheetAction={handleSheetAction}
          onSheetRename={handleSheetRename}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 px-6 py-4">
        <div className="flex space-x-1">
          {costingSheet.variants.map((variant, index) => (
            <div
              key={variant.id || index}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm"
            >
              <CostingGrid
                variant={variant}
                onVariantChange={(updatedVariant) => {
                  setCostingSheet((prev) => ({
                    ...prev,
                    variants: prev.variants.map((v, i) => (i === index ? updatedVariant : v)),
                  }));
                }}
                isFirstSheet={index === 0}
                showOnlyCalculation={index > 0}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/dashboard/sales/costing-sheets')}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-lg"
          >
            Back
          </button>

          <div className="flex space-x-3">
            <button
              onClick={handleCreateQuotation}
              className="px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 border border-blue-300 dark:border-blue-600 rounded-lg"
            >
              Create Quotation
            </button>

            <button
              onClick={handleSaveCosting}
              disabled={isSaving || !costingSheet.project_name.trim()}
              className="px-6 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Update Costing'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
