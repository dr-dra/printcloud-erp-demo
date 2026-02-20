'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from 'react';
import { Modal, Button, Label, Alert } from 'flowbite-react';
import { Info } from 'lucide-react';
import { StandardTextInput, StandardSelect } from '@/components/common/inputs';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/utils/errorHandling';
import type { InvCategory, InvUnitMeasure, InvItem } from '@/types/inventory';

interface InventoryItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mode: 'create' | 'edit' | 'view';
  item: InvItem | null;
}

interface ItemFormState {
  sku: string;
  name: string;
  category: string;
  stock_uom: string;
  purchase_uom: string;
  purchase_to_stock_factor: string;
  gsm: string;
  width_mm: string;
  height_mm: string;
  reorder_level: string;
  reorder_quantity: string;
  is_active: boolean;
  is_offcut: boolean;
  exclude_from_valuation: boolean;
}

const emptyState: ItemFormState = {
  sku: '',
  name: '',
  category: '',
  stock_uom: '',
  purchase_uom: '',
  purchase_to_stock_factor: '1',
  gsm: '',
  width_mm: '',
  height_mm: '',
  reorder_level: '0',
  reorder_quantity: '0',
  is_active: true,
  is_offcut: false,
  exclude_from_valuation: false,
};

const buildFormStateFromItem = (
  source: InvItem,
  overrides: Partial<ItemFormState> = {},
): ItemFormState => ({
  sku: source.sku || '',
  name: source.name || '',
  category: source.category ? String(source.category) : '',
  stock_uom: source.stock_uom ? String(source.stock_uom) : '',
  purchase_uom: source.purchase_uom ? String(source.purchase_uom) : '',
  purchase_to_stock_factor: source.purchase_to_stock_factor || '1',
  gsm: source.gsm ? String(source.gsm) : '',
  width_mm: source.width_mm || '',
  height_mm: source.height_mm || '',
  reorder_level: source.reorder_level || '0',
  reorder_quantity: source.reorder_quantity || '0',
  is_active: source.is_active,
  is_offcut: source.is_offcut,
  exclude_from_valuation: source.exclude_from_valuation,
  ...overrides,
});

const formatMillimeters = (value: number) => {
  const rounded = Math.round(value * 100) / 100;
  return rounded.toString().replace(/\.?0+$/, '');
};

const toMillimeters = (rawValue: string) => {
  const trimmed = rawValue.trim().toLowerCase();
  if (!trimmed) return '';

  const match = trimmed.match(/^(-?\d+(?:\.\d+)?)(?:\s*(mm|cm|in|inch|inches|"))?$/);
  if (!match) return rawValue;

  const numeric = Number(match[1]);
  if (Number.isNaN(numeric)) return rawValue;

  const unit = match[2];
  if (!unit || unit === 'mm') return formatMillimeters(numeric);
  if (unit === 'cm') return formatMillimeters(numeric * 10);
  if (unit === 'in' || unit === 'inch' || unit === 'inches' || unit === '"') {
    return formatMillimeters(numeric * 25.4);
  }
  return rawValue;
};

export default function InventoryItemModal({
  isOpen,
  onClose,
  onSuccess,
  mode,
  item,
}: InventoryItemModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<InvCategory[]>([]);
  const [units, setUnits] = useState<InvUnitMeasure[]>([]);
  const [formState, setFormState] = useState<ItemFormState>(emptyState);

  const isReadOnly = mode === 'view';
  const isEdit = mode === 'edit';

  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const [categoriesResponse, unitsResponse] = await Promise.all([
          api.get('/inventory/categories/?page_size=200'),
          api.get('/inventory/units/?page_size=200'),
        ]);
        setCategories(categoriesResponse.data.results || []);
        setUnits(unitsResponse.data.results || []);
      } catch (err) {
        console.error('Failed to load inventory lookups:', err);
      }
    };

    if (isOpen) {
      fetchLookups();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    if (item && (mode === 'edit' || mode === 'view')) {
      setFormState(buildFormStateFromItem(item));
    } else if (item && mode === 'create') {
      setFormState(
        buildFormStateFromItem(item, {
          sku: '',
          name: item.name ? `${item.name} (Copy)` : '',
        }),
      );
    } else {
      setFormState({
        ...emptyState,
        category: categories[0] ? String(categories[0].id) : '',
        stock_uom: units[0] ? String(units[0].id) : '',
        purchase_uom: units[0] ? String(units[0].id) : '',
      });
    }
    setError(null);
  }, [isOpen, item, mode, categories, units]);

  const modalTitle = useMemo(() => {
    if (mode === 'edit') return 'Edit Inventory Item';
    if (mode === 'view') return 'View Inventory Item';
    return 'Add Inventory Item';
  }, [mode]);

  const handleChange = (field: keyof ItemFormState, value: string | boolean) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (isReadOnly) {
      onClose();
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      sku: formState.sku.trim(),
      name: formState.name.trim(),
      category: formState.category ? Number(formState.category) : null,
      stock_uom: formState.stock_uom ? Number(formState.stock_uom) : null,
      purchase_uom: formState.purchase_uom ? Number(formState.purchase_uom) : null,
      purchase_to_stock_factor: formState.purchase_to_stock_factor || '1',
      gsm: formState.gsm ? Number(formState.gsm) : null,
      width_mm: formState.width_mm || null,
      height_mm: formState.height_mm || null,
      reorder_level: formState.reorder_level || '0',
      reorder_quantity: formState.reorder_quantity || '0',
      is_active: formState.is_active,
      is_offcut: formState.is_offcut,
      exclude_from_valuation: formState.exclude_from_valuation,
    };

    try {
      if (isEdit && item) {
        await api.put(`/inventory/items/${item.id}/`, payload);
      } else {
        await api.post('/inventory/items/', payload);
      }
      onSuccess();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to save inventory item.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={isOpen} onClose={onClose} size="2xl" className="bg-gray-900/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-h-[85vh] flex flex-col">
        <div className="border-b border-gray-200 dark:border-gray-800 px-6 py-4">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{modalTitle}</h3>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && <Alert color="failure">{error}</Alert>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="sku" value="SKU *" />
              <StandardTextInput
                id="sku"
                value={formState.sku}
                onChange={(e) => handleChange('sku', e.target.value)}
                disabled={isReadOnly}
              />
            </div>
            <div>
              <Label htmlFor="name" value="Item Name *" />
              <StandardTextInput
                id="name"
                value={formState.name}
                onChange={(e) => handleChange('name', e.target.value)}
                disabled={isReadOnly}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category" value="Category" />
              <StandardSelect
                id="category"
                value={formState.category}
                onChange={(e) => handleChange('category', e.target.value)}
                disabled={isReadOnly}
              >
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </StandardSelect>
            </div>
            <div>
              <Label htmlFor="stock_uom" value="Stock Unit" />
              <StandardSelect
                id="stock_uom"
                value={formState.stock_uom}
                onChange={(e) => handleChange('stock_uom', e.target.value)}
                disabled={isReadOnly}
              >
                <option value="">Select unit</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name} ({unit.code})
                  </option>
                ))}
              </StandardSelect>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="purchase_uom" value="Purchase Unit" />
              <StandardSelect
                id="purchase_uom"
                value={formState.purchase_uom}
                onChange={(e) => handleChange('purchase_uom', e.target.value)}
                disabled={isReadOnly}
              >
                <option value="">Select unit</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name} ({unit.code})
                  </option>
                ))}
              </StandardSelect>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Label htmlFor="purchase_to_stock_factor" value="Purchase to Stock Factor" />
                <span
                  className="inline-flex items-center text-gray-400 cursor-help"
                  title="How many stock units make up one purchase unit (e.g., 1 ream = 500 sheets)."
                >
                  <Info className="w-4 h-4" />
                </span>
              </div>
              <StandardTextInput
                id="purchase_to_stock_factor"
                type="number"
                value={formState.purchase_to_stock_factor}
                onChange={(e) => handleChange('purchase_to_stock_factor', e.target.value)}
                disabled={isReadOnly}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="gsm" value="GSM" />
              <StandardTextInput
                id="gsm"
                type="number"
                value={formState.gsm}
                onChange={(e) => handleChange('gsm', e.target.value)}
                disabled={isReadOnly}
              />
            </div>
            <div>
              <Label htmlFor="width_mm" value="Width (mm)" />
              <StandardTextInput
                id="width_mm"
                type="text"
                inputMode="decimal"
                value={formState.width_mm}
                onChange={(e) => handleChange('width_mm', e.target.value)}
                onBlur={(e) => handleChange('width_mm', toMillimeters(e.target.value))}
                disabled={isReadOnly}
              />
            </div>
            <div>
              <Label htmlFor="height_mm" value="Height (mm)" />
              <StandardTextInput
                id="height_mm"
                type="text"
                inputMode="decimal"
                value={formState.height_mm}
                onChange={(e) => handleChange('height_mm', e.target.value)}
                onBlur={(e) => handleChange('height_mm', toMillimeters(e.target.value))}
                disabled={isReadOnly}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Label htmlFor="reorder_level" value="Reorder Level" />
                <span
                  className="inline-flex items-center text-gray-400 cursor-help"
                  title="Trigger point in stock units (e.g., 1000 sheets)."
                >
                  <Info className="w-4 h-4" />
                </span>
              </div>
              <StandardTextInput
                id="reorder_level"
                type="number"
                value={formState.reorder_level}
                onChange={(e) => handleChange('reorder_level', e.target.value)}
                disabled={isReadOnly}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Label htmlFor="reorder_quantity" value="Reorder Quantity" />
                <span
                  className="inline-flex items-center text-gray-400 cursor-help"
                  title="Suggested restock amount in stock units (e.g., 1500 sheets)."
                >
                  <Info className="w-4 h-4" />
                </span>
              </div>
              <StandardTextInput
                id="reorder_quantity"
                type="number"
                value={formState.reorder_quantity}
                onChange={(e) => handleChange('reorder_quantity', e.target.value)}
                disabled={isReadOnly}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                checked={formState.is_active}
                onChange={(e) => handleChange('is_active', e.target.checked)}
                disabled={isReadOnly}
              />
              Active
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                checked={formState.is_offcut}
                onChange={(e) => handleChange('is_offcut', e.target.checked)}
                disabled={isReadOnly}
              />
              Offcut Item
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                checked={formState.exclude_from_valuation}
                onChange={(e) => handleChange('exclude_from_valuation', e.target.checked)}
                disabled={isReadOnly}
              />
              Exclude from Valuation
            </label>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end gap-2">
          <Button color="gray" onClick={onClose} disabled={loading}>
            {isReadOnly ? 'Close' : 'Cancel'}
          </Button>
          {!isReadOnly && (
            <Button onClick={handleSubmit} isProcessing={loading}>
              {isEdit ? 'Update Item' : 'Create Item'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
