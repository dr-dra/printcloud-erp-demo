'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from 'react';
import { Modal, Button, Label, Alert } from 'flowbite-react';
import { StandardTextInput, StandardSelect } from '@/components/common/inputs';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/utils/errorHandling';
import type { InvUnitMeasure } from '@/types/inventory';

interface InventoryUnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mode: 'create' | 'edit' | 'view';
  unit: InvUnitMeasure | null;
}

interface UnitFormState {
  code: string;
  name: string;
  symbol: string;
  base_unit: string;
  conversion_factor: string;
  is_active: boolean;
}

const emptyState: UnitFormState = {
  code: '',
  name: '',
  symbol: '',
  base_unit: '',
  conversion_factor: '1',
  is_active: true,
};

export default function InventoryUnitModal({
  isOpen,
  onClose,
  onSuccess,
  mode,
  unit,
}: InventoryUnitModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [units, setUnits] = useState<InvUnitMeasure[]>([]);
  const [formState, setFormState] = useState<UnitFormState>(emptyState);

  const isReadOnly = mode === 'view';
  const isEdit = mode === 'edit';

  useEffect(() => {
    const fetchUnits = async () => {
      try {
        const response = await api.get('/inventory/units/?page_size=200');
        setUnits(response.data.results || []);
      } catch (err) {
        console.error('Failed to load units:', err);
      }
    };

    if (isOpen) {
      fetchUnits();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    if (unit && (mode === 'edit' || mode === 'view')) {
      setFormState({
        code: unit.code || '',
        name: unit.name || '',
        symbol: unit.symbol || '',
        base_unit: unit.base_unit ? String(unit.base_unit) : '',
        conversion_factor: unit.conversion_factor || '1',
        is_active: unit.is_active,
      });
    } else {
      setFormState({
        ...emptyState,
        base_unit: '',
      });
    }
    setError(null);
  }, [isOpen, unit, mode]);

  const modalTitle = useMemo(() => {
    if (mode === 'edit') return 'Edit Unit of Measure';
    if (mode === 'view') return 'View Unit of Measure';
    return 'Add Unit of Measure';
  }, [mode]);

  const handleChange = (field: keyof UnitFormState, value: string | boolean) => {
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
      code: formState.code.trim(),
      name: formState.name.trim(),
      symbol: formState.symbol.trim(),
      base_unit: formState.base_unit ? Number(formState.base_unit) : null,
      conversion_factor: formState.conversion_factor || '1',
      is_active: formState.is_active,
    };

    try {
      if (isEdit && unit) {
        await api.put(`/inventory/units/${unit.id}/`, payload);
      } else {
        await api.post('/inventory/units/', payload);
      }
      onSuccess();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to save unit.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={isOpen} onClose={onClose} size="lg" className="bg-gray-900/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-h-[85vh] flex flex-col">
        <div className="border-b border-gray-200 dark:border-gray-800 px-6 py-4">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{modalTitle}</h3>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && <Alert color="failure">{error}</Alert>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="code" value="Code" />
              <StandardTextInput
                id="code"
                value={formState.code}
                onChange={(e) => handleChange('code', e.target.value)}
                disabled={isReadOnly}
              />
            </div>
            <div>
              <Label htmlFor="name" value="Name" />
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
              <Label htmlFor="symbol" value="Symbol" />
              <StandardTextInput
                id="symbol"
                value={formState.symbol}
                onChange={(e) => handleChange('symbol', e.target.value)}
                disabled={isReadOnly}
              />
            </div>
            <div>
              <Label htmlFor="conversion_factor" value="Conversion Factor" />
              <StandardTextInput
                id="conversion_factor"
                type="number"
                value={formState.conversion_factor}
                onChange={(e) => handleChange('conversion_factor', e.target.value)}
                disabled={isReadOnly}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="base_unit" value="Base Unit" />
            <StandardSelect
              id="base_unit"
              value={formState.base_unit}
              onChange={(e) => handleChange('base_unit', e.target.value)}
              disabled={isReadOnly}
            >
              <option value="">None</option>
              {units
                .filter((entry) => !unit || entry.id !== unit.id)
                .map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name} ({entry.code})
                  </option>
                ))}
            </StandardSelect>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              checked={formState.is_active}
              onChange={(e) => handleChange('is_active', e.target.checked)}
              disabled={isReadOnly}
            />
            Active
          </label>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end gap-2">
          <Button color="gray" onClick={onClose} disabled={loading}>
            {isReadOnly ? 'Close' : 'Cancel'}
          </Button>
          {!isReadOnly && (
            <Button onClick={handleSubmit} isProcessing={loading}>
              {isEdit ? 'Update Unit' : 'Create Unit'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
