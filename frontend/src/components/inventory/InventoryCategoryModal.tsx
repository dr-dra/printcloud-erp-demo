'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from 'react';
import { Modal, Button, Label, Alert } from 'flowbite-react';
import { StandardTextInput } from '@/components/common/inputs';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/utils/errorHandling';
import type { InvCategory } from '@/types/inventory';

interface InventoryCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mode: 'create' | 'edit' | 'view';
  category: InvCategory | null;
}

interface CategoryFormState {
  code: string;
  name: string;
  is_active: boolean;
}

const emptyState: CategoryFormState = {
  code: '',
  name: '',
  is_active: true,
};

export default function InventoryCategoryModal({
  isOpen,
  onClose,
  onSuccess,
  mode,
  category,
}: InventoryCategoryModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState<CategoryFormState>(emptyState);

  const isReadOnly = mode === 'view';
  const isEdit = mode === 'edit';

  useEffect(() => {
    if (!isOpen) return;

    if (category && (mode === 'edit' || mode === 'view')) {
      setFormState({
        code: category.code || '',
        name: category.name || '',
        is_active: category.is_active,
      });
    } else {
      setFormState({
        ...emptyState,
      });
    }
    setError(null);
  }, [isOpen, category, mode]);

  const modalTitle = useMemo(() => {
    if (mode === 'edit') return 'Edit Inventory Category';
    if (mode === 'view') return 'View Inventory Category';
    return 'Add Inventory Category';
  }, [mode]);

  const handleChange = (field: keyof CategoryFormState, value: string | boolean) => {
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
      is_active: formState.is_active,
    };

    try {
      if (isEdit && category) {
        await api.put(`/inventory/categories/${category.id}/`, payload);
      } else {
        await api.post('/inventory/categories/', payload);
      }
      onSuccess();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to save category.'));
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
              {isEdit ? 'Update Category' : 'Create Category'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
