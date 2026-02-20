'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from 'react';
import { Modal, Button, Label, Alert } from 'flowbite-react';
import { StandardTextInput, StandardTextarea, StandardSelect } from '@/components/common/inputs';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/utils/errorHandling';
import type { InvItem, InvItemListResponse, InvPrn, InvPrnListResponse } from '@/types/inventory';

interface InventoryGinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface GinLine {
  id: string;
  itemId: string;
  quantityIssued: string;
}

const createEmptyLine = (): GinLine => ({
  id: crypto.randomUUID(),
  itemId: '',
  quantityIssued: '1',
});

export default function InventoryGinModal({ isOpen, onClose, onSuccess }: InventoryGinModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<InvItem[]>([]);
  const [prns, setPrns] = useState<InvPrn[]>([]);

  const [issueType, setIssueType] = useState<'prn' | 'cost_center'>('prn');
  const [selectedPrn, setSelectedPrn] = useState('');
  const [costCenter, setCostCenter] = useState('');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<GinLine[]>([createEmptyLine()]);

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
      setSelectedPrn('');
      setCostCenter('');
    }
  }, [isOpen]);

  useEffect(() => {
    const fetchPrns = async () => {
      try {
        const response = await api.get('/inventory/prns/', { params: { page_size: 200 } });
        const data: InvPrnListResponse = response.data;
        const allowed = (data.results || []).filter((prn) =>
          ['approved', 'partially_ordered'].includes(prn.status),
        );
        setPrns(allowed);
      } catch (err) {
        console.error('Failed to load PRNs:', err);
      }
    };

    if (isOpen) {
      fetchPrns();
    }
  }, [isOpen]);

  const addLine = () => {
    setLines((prev) => [...prev, createEmptyLine()]);
  };

  const removeLine = (lineId: string) => {
    setLines((prev) => (prev.length > 1 ? prev.filter((line) => line.id !== lineId) : prev));
  };

  const updateLine = (lineId: string, field: keyof GinLine, value: string) => {
    setLines((prev) =>
      prev.map((line) => (line.id === lineId ? { ...line, [field]: value } : line)),
    );
  };

  const isReady = useMemo(
    () => lines.some((line) => line.itemId && Number(line.quantityIssued) > 0),
    [lines],
  );

  const handleSubmit = async () => {
    if (!isReady) {
      setError('Please add at least one item with quantity.');
      return;
    }

    if (issueType === 'prn' && !selectedPrn) {
      setError('Please select a PRN.');
      return;
    }

    if (issueType === 'cost_center' && !costCenter) {
      setError('Please select a cost center.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const ginResponse = await api.post('/inventory/gins/', {
        issue_date: issueDate,
        prn: issueType === 'prn' ? Number(selectedPrn) : null,
        cost_center: issueType === 'cost_center' ? costCenter : null,
        notes,
        status: 'draft',
      });

      const ginId = ginResponse.data.id;
      const payloadLines = lines
        .filter((line) => line.itemId && Number(line.quantityIssued) > 0)
        .map((line) => ({
          gin: ginId,
          item: Number(line.itemId),
          quantity_issued: line.quantityIssued,
        }));

      await Promise.all(payloadLines.map((payload) => api.post('/inventory/gin-items/', payload)));

      onSuccess();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to create GIN.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={isOpen} onClose={onClose} size="4xl" className="bg-gray-900/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-h-[85vh] flex flex-col">
        <div className="border-b border-gray-200 dark:border-gray-800 px-6 py-4">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Create GIN</h3>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && <Alert color="failure">{error}</Alert>}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="issue_type" value="Issue Type" />
              <StandardSelect
                id="issue_type"
                value={issueType}
                onChange={(e) => setIssueType(e.target.value as 'prn' | 'cost_center')}
              >
                <option value="prn">Issue to PRN</option>
                <option value="cost_center">Issue to Cost Center</option>
              </StandardSelect>
            </div>
            {issueType === 'prn' ? (
              <div>
                <Label htmlFor="prn_id" value="PRN" />
                <StandardSelect
                  id="prn_id"
                  value={selectedPrn}
                  onChange={(e) => setSelectedPrn(e.target.value)}
                >
                  <option value="">Select PRN</option>
                  {prns.map((prn) => (
                    <option key={prn.id} value={prn.id}>
                      {prn.prn_number}
                    </option>
                  ))}
                </StandardSelect>
              </div>
            ) : (
              <div>
                <Label htmlFor="cost_center" value="Cost Center" />
                <StandardSelect
                  id="cost_center"
                  value={costCenter}
                  onChange={(e) => setCostCenter(e.target.value)}
                >
                  <option value="">Select cost center</option>
                  <option value="PREPRESS">Pre-Press</option>
                  <option value="PRESS">Press</option>
                  <option value="POSTPRESS">Post-Press</option>
                  <option value="MAINT">Maintenance</option>
                  <option value="GENERAL">General</option>
                </StandardSelect>
              </div>
            )}
            <div>
              <Label htmlFor="issue_date" value="Issue Date" />
              <StandardTextInput
                id="issue_date"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
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
                Issued Items
              </h4>
              <Button size="sm" onClick={addLine}>
                Add Item
              </Button>
            </div>
            {lines.map((line) => (
              <div key={line.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                <div className="md:col-span-8">
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
                <div className="md:col-span-3">
                  <Label value="Qty Issued" />
                  <StandardTextInput
                    type="number"
                    value={line.quantityIssued}
                    onChange={(e) => updateLine(line.id, 'quantityIssued', e.target.value)}
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
            Create GIN
          </Button>
        </div>
      </div>
    </Modal>
  );
}
