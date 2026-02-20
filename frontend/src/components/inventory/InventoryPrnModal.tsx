'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from 'react';
import { Modal, Button, Label, Alert } from 'flowbite-react';
import { StandardTextInput, StandardTextarea, StandardSelect } from '@/components/common/inputs';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/utils/errorHandling';
import type { InvItem, InvItemListResponse } from '@/types/inventory';

interface InventoryPrnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface PrnLine {
  id: string;
  itemId: string;
  requiredQty: string;
}

const createEmptyLine = (): PrnLine => ({
  id: crypto.randomUUID(),
  itemId: '',
  requiredQty: '1',
});

export default function InventoryPrnModal({ isOpen, onClose, onSuccess }: InventoryPrnModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<InvItem[]>([]);

  const [jobTicketId, setJobTicketId] = useState('');
  const [requestDate, setRequestDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [neededBy, setNeededBy] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<PrnLine[]>([createEmptyLine()]);

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

  const updateLine = (lineId: string, field: keyof PrnLine, value: string) => {
    setLines((prev) =>
      prev.map((line) => (line.id === lineId ? { ...line, [field]: value } : line)),
    );
  };

  const isReady = useMemo(
    () => lines.some((line) => line.itemId && Number(line.requiredQty) > 0),
    [lines],
  );

  const handleSubmit = async () => {
    if (!isReady) {
      setError('Please add at least one item with quantity.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const prnResponse = await api.post('/inventory/prns/', {
        request_date: requestDate,
        needed_by: neededBy || null,
        job_ticket_id: jobTicketId ? Number(jobTicketId) : null,
        notes,
        status: 'draft',
      });

      const prnId = prnResponse.data.id;
      const payloadLines = lines
        .filter((line) => line.itemId && Number(line.requiredQty) > 0)
        .map((line) => ({
          prn: prnId,
          item: Number(line.itemId),
          required_qty: line.requiredQty,
          status: 'draft',
        }));

      await Promise.all(payloadLines.map((payload) => api.post('/inventory/prn-items/', payload)));

      onSuccess();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to create PRN.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={isOpen} onClose={onClose} size="4xl" className="bg-gray-900/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-h-[85vh] flex flex-col">
        <div className="border-b border-gray-200 dark:border-gray-800 px-6 py-4">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Create PRN</h3>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && <Alert color="failure">{error}</Alert>}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="job_ticket_id" value="Job Ticket ID (optional)" />
              <StandardTextInput
                id="job_ticket_id"
                value={jobTicketId}
                onChange={(e) => setJobTicketId(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="request_date" value="Request Date" />
              <StandardTextInput
                id="request_date"
                type="date"
                value={requestDate}
                onChange={(e) => setRequestDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="needed_by" value="Needed By" />
              <StandardTextInput
                id="needed_by"
                type="date"
                value={neededBy}
                onChange={(e) => setNeededBy(e.target.value)}
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
                Requested Items
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
                  <Label value="Qty Required" />
                  <StandardTextInput
                    type="number"
                    value={line.requiredQty}
                    onChange={(e) => updateLine(line.id, 'requiredQty', e.target.value)}
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
            Create PRN
          </Button>
        </div>
      </div>
    </Modal>
  );
}
