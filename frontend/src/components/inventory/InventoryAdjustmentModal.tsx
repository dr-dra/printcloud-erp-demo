'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from 'react';
import { Modal, Button, Label, Alert } from 'flowbite-react';
import { StandardTextInput, StandardTextarea, StandardSelect } from '@/components/common/inputs';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/utils/errorHandling';
import type { InvItem, InvItemListResponse } from '@/types/inventory';

interface InventoryAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface AdjustmentLine {
  id: string;
  itemId: string;
  quantityChange: string;
  unitCost: string;
  notes: string;
}

const createEmptyLine = (): AdjustmentLine => ({
  id: crypto.randomUUID(),
  itemId: '',
  quantityChange: '0',
  unitCost: '0',
  notes: '',
});

export default function InventoryAdjustmentModal({
  isOpen,
  onClose,
  onSuccess,
}: InventoryAdjustmentModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<InvItem[]>([]);

  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<AdjustmentLine[]>([createEmptyLine()]);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const response = await api.get('/inventory/items/?page_size=500');
        const data: InvItemListResponse = response.data;
        setItems(data.results || []);
      } catch (err) {
        console.error('Failed to load items:', err);
      }
    };

    if (isOpen) {
      fetchItems();
      setError(null);
    }
  }, [isOpen]);

  const addLine = () => {
    setLines((prev) => [...prev, createEmptyLine()]);
  };

  const removeLine = (lineId: string) => {
    setLines((prev) => (prev.length > 1 ? prev.filter((line) => line.id !== lineId) : prev));
  };

  const updateLine = (lineId: string, field: keyof AdjustmentLine, value: string) => {
    setLines((prev) =>
      prev.map((line) => (line.id === lineId ? { ...line, [field]: value } : line)),
    );
  };

  const isReady = useMemo(
    () => lines.some((line) => line.itemId && Number(line.quantityChange) !== 0),
    [lines],
  );

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError('Please provide an adjustment reason.');
      return;
    }
    if (!isReady) {
      setError('Please add at least one item with quantity change.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const adjustmentResponse = await api.post('/inventory/adjustments/', {
        reason,
        notes,
        status: 'pending',
      });

      const adjustmentId = adjustmentResponse.data.id;
      const payloadLines = lines
        .filter((line) => line.itemId && Number(line.quantityChange) !== 0)
        .map((line) => ({
          adjustment: adjustmentId,
          item: Number(line.itemId),
          quantity_change: line.quantityChange,
          unit_cost: line.unitCost || '0',
          notes: line.notes,
        }));

      await Promise.all(
        payloadLines.map((payload) => api.post('/inventory/adjustment-items/', payload)),
      );

      onSuccess();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to create adjustment.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={isOpen} onClose={onClose} size="4xl" className="bg-gray-900/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-h-[85vh] flex flex-col">
        <div className="border-b border-gray-200 dark:border-gray-800 px-6 py-4">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            Create Stock Adjustment
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && <Alert color="failure">{error}</Alert>}

          <div>
            <Label htmlFor="reason" value="Reason" />
            <StandardTextInput
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="notes" value="Notes" />
            <StandardTextarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Adjustment Lines
              </h4>
              <Button size="sm" onClick={addLine}>
                Add Line
              </Button>
            </div>
            {lines.map((line) => (
              <div key={line.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                <div className="md:col-span-5">
                  <Label value="Item" />
                  <StandardSelect
                    value={line.itemId}
                    onChange={(e) => updateLine(line.id, 'itemId', e.target.value)}
                  >
                    <option value="">Select item</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.sku})
                      </option>
                    ))}
                  </StandardSelect>
                </div>
                <div className="md:col-span-2">
                  <Label value="Qty Change" />
                  <StandardTextInput
                    type="number"
                    value={line.quantityChange}
                    onChange={(e) => updateLine(line.id, 'quantityChange', e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label value="Unit Cost" />
                  <StandardTextInput
                    type="number"
                    value={line.unitCost}
                    onChange={(e) => updateLine(line.id, 'unitCost', e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label value="Notes" />
                  <StandardTextInput
                    value={line.notes}
                    onChange={(e) => updateLine(line.id, 'notes', e.target.value)}
                  />
                </div>
                <div className="md:col-span-1 flex justify-end">
                  <Button color="gray" size="xs" onClick={() => removeLine(line.id)}>
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end gap-2">
          <Button color="gray" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} isProcessing={loading}>
            Create Adjustment
          </Button>
        </div>
      </div>
    </Modal>
  );
}
