'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from 'react';
import { Modal, Button, Label, Alert } from 'flowbite-react';
import { StandardTextInput, StandardTextarea } from '@/components/common/inputs';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/utils/errorHandling';

interface InventoryDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface DispatchLine {
  id: string;
  itemDescription: string;
  quantity: string;
  parcels: string;
}

const createEmptyLine = (): DispatchLine => ({
  id: crypto.randomUUID(),
  itemDescription: '',
  quantity: '1',
  parcels: '0',
});

export default function InventoryDispatchModal({
  isOpen,
  onClose,
  onSuccess,
}: InventoryDispatchModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dispatchDate, setDispatchDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [invoiceReference, setInvoiceReference] = useState('');
  const [jobReference, setJobReference] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DispatchLine[]>([createEmptyLine()]);

  const addLine = () => {
    setLines((prev) => [...prev, createEmptyLine()]);
  };

  const removeLine = (lineId: string) => {
    setLines((prev) => (prev.length > 1 ? prev.filter((line) => line.id !== lineId) : prev));
  };

  const updateLine = (lineId: string, field: keyof DispatchLine, value: string) => {
    setLines((prev) =>
      prev.map((line) => (line.id === lineId ? { ...line, [field]: value } : line)),
    );
  };

  const isReady = useMemo(() => lines.some((line) => line.itemDescription.trim()), [lines]);

  const handleSubmit = async () => {
    if (!isReady) {
      setError('Please add at least one dispatch line.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const dispatchResponse = await api.post('/inventory/dispatch-notes/', {
        dispatch_date: dispatchDate,
        invoice_reference: invoiceReference,
        job_reference: jobReference,
        notes,
        status: 'draft',
      });

      const dispatchId = dispatchResponse.data.id;
      const payloadLines = lines
        .filter((line) => line.itemDescription.trim())
        .map((line) => ({
          dispatch_note: dispatchId,
          item_description: line.itemDescription,
          quantity: line.quantity,
          parcels: line.parcels || '0',
        }));

      await Promise.all(
        payloadLines.map((payload) => api.post('/inventory/dispatch-items/', payload)),
      );

      onSuccess();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to create dispatch note.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={isOpen} onClose={onClose} size="4xl" className="bg-gray-900/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-h-[85vh] flex flex-col">
        <div className="border-b border-gray-200 dark:border-gray-800 px-6 py-4">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            Create Dispatch Note
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && <Alert color="failure">{error}</Alert>}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="dispatch_date" value="Dispatch Date" />
              <StandardTextInput
                id="dispatch_date"
                type="date"
                value={dispatchDate}
                onChange={(e) => setDispatchDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="invoice_reference" value="Invoice Reference" />
              <StandardTextInput
                id="invoice_reference"
                value={invoiceReference}
                onChange={(e) => setInvoiceReference(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="job_reference" value="Job Reference" />
              <StandardTextInput
                id="job_reference"
                value={jobReference}
                onChange={(e) => setJobReference(e.target.value)}
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
                Dispatch Lines
              </h4>
              <Button size="sm" onClick={addLine}>
                Add Line
              </Button>
            </div>
            {lines.map((line) => (
              <div key={line.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                <div className="md:col-span-7">
                  <Label value="Item Description" />
                  <StandardTextInput
                    value={line.itemDescription}
                    onChange={(e) => updateLine(line.id, 'itemDescription', e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label value="Quantity" />
                  <StandardTextInput
                    type="number"
                    value={line.quantity}
                    onChange={(e) => updateLine(line.id, 'quantity', e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label value="Parcels" />
                  <StandardTextInput
                    type="number"
                    value={line.parcels}
                    onChange={(e) => updateLine(line.id, 'parcels', e.target.value)}
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
            Create Dispatch Note
          </Button>
        </div>
      </div>
    </Modal>
  );
}
