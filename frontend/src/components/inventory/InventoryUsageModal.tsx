'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from 'react';
import { Modal, Button, Label, Alert } from 'flowbite-react';
import { StandardTextInput, StandardTextarea, StandardSelect } from '@/components/common/inputs';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/utils/errorHandling';
import type {
  InvItem,
  InvItemListResponse,
  InvWastageCategory,
  InvWastageCategoryListResponse,
} from '@/types/inventory';

interface InventoryUsageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface UsageLine {
  id: string;
  itemId: string;
  issuedQty: string;
  usedQty: string;
  returnedQty: string;
  spoiledQty: string;
  wastageCategory: string;
  notes: string;
}

const createEmptyLine = (): UsageLine => ({
  id: crypto.randomUUID(),
  itemId: '',
  issuedQty: '0',
  usedQty: '0',
  returnedQty: '0',
  spoiledQty: '0',
  wastageCategory: '',
  notes: '',
});

export default function InventoryUsageModal({
  isOpen,
  onClose,
  onSuccess,
}: InventoryUsageModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<InvItem[]>([]);
  const [wastageCategories, setWastageCategories] = useState<InvWastageCategory[]>([]);

  const [jobReference, setJobReference] = useState('');
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<UsageLine[]>([createEmptyLine()]);

  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const [itemsResponse, wastageResponse] = await Promise.all([
          api.get('/inventory/items/?page_size=500'),
          api.get('/inventory/wastage-categories/?page_size=200'),
        ]);
        const itemsData: InvItemListResponse = itemsResponse.data;
        const wastageData: InvWastageCategoryListResponse = wastageResponse.data;
        setItems(itemsData.results || []);
        setWastageCategories(wastageData.results || []);
      } catch (err) {
        console.error('Failed to load usage lookups:', err);
      }
    };

    if (isOpen) {
      fetchLookups();
      setError(null);
    }
  }, [isOpen]);

  const addLine = () => {
    setLines((prev) => [...prev, createEmptyLine()]);
  };

  const removeLine = (lineId: string) => {
    setLines((prev) => (prev.length > 1 ? prev.filter((line) => line.id !== lineId) : prev));
  };

  const updateLine = (lineId: string, field: keyof UsageLine, value: string) => {
    setLines((prev) =>
      prev.map((line) => (line.id === lineId ? { ...line, [field]: value } : line)),
    );
  };

  const isReady = useMemo(() => lines.some((line) => line.itemId), [lines]);

  const handleSubmit = async () => {
    if (!isReady) {
      setError('Please add at least one usage line.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const reportResponse = await api.post('/inventory/usage-reports/', {
        job_reference: jobReference,
        report_date: reportDate,
        notes,
      });

      const reportId = reportResponse.data.id;
      const payloadLines = lines
        .filter((line) => line.itemId)
        .map((line) => ({
          usage_report: reportId,
          item: Number(line.itemId),
          issued_qty: line.issuedQty || '0',
          used_qty: line.usedQty || '0',
          returned_qty: line.returnedQty || '0',
          spoiled_qty: line.spoiledQty || '0',
          wastage_category: line.wastageCategory ? Number(line.wastageCategory) : null,
          notes: line.notes,
        }));

      await Promise.all(
        payloadLines.map((payload) => api.post('/inventory/usage-items/', payload)),
      );

      onSuccess();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to create usage report.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={isOpen} onClose={onClose} size="5xl" className="bg-gray-900/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-h-[85vh] flex flex-col">
        <div className="border-b border-gray-200 dark:border-gray-800 px-6 py-4">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            Create Usage Report
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && <Alert color="failure">{error}</Alert>}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="job_reference" value="Job Reference" />
              <StandardTextInput
                id="job_reference"
                value={jobReference}
                onChange={(e) => setJobReference(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="report_date" value="Report Date" />
              <StandardTextInput
                id="report_date"
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
              />
            </div>
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
                Usage Lines
              </h4>
              <Button size="sm" onClick={addLine}>
                Add Line
              </Button>
            </div>
            {lines.map((line) => (
              <div key={line.id} className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-end">
                <div className="lg:col-span-3">
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
                <div className="lg:col-span-1">
                  <Label value="Issued" />
                  <StandardTextInput
                    type="number"
                    value={line.issuedQty}
                    onChange={(e) => updateLine(line.id, 'issuedQty', e.target.value)}
                  />
                </div>
                <div className="lg:col-span-1">
                  <Label value="Used" />
                  <StandardTextInput
                    type="number"
                    value={line.usedQty}
                    onChange={(e) => updateLine(line.id, 'usedQty', e.target.value)}
                  />
                </div>
                <div className="lg:col-span-1">
                  <Label value="Returned" />
                  <StandardTextInput
                    type="number"
                    value={line.returnedQty}
                    onChange={(e) => updateLine(line.id, 'returnedQty', e.target.value)}
                  />
                </div>
                <div className="lg:col-span-1">
                  <Label value="Spoiled" />
                  <StandardTextInput
                    type="number"
                    value={line.spoiledQty}
                    onChange={(e) => updateLine(line.id, 'spoiledQty', e.target.value)}
                  />
                </div>
                <div className="lg:col-span-2">
                  <Label value="Wastage" />
                  <StandardSelect
                    value={line.wastageCategory}
                    onChange={(e) => updateLine(line.id, 'wastageCategory', e.target.value)}
                  >
                    <option value="">Select</option>
                    {wastageCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </StandardSelect>
                </div>
                <div className="lg:col-span-2">
                  <Label value="Notes" />
                  <StandardTextInput
                    value={line.notes}
                    onChange={(e) => updateLine(line.id, 'notes', e.target.value)}
                  />
                </div>
                <div className="lg:col-span-1 flex justify-end">
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
            Create Usage Report
          </Button>
        </div>
      </div>
    </Modal>
  );
}
