'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from 'react';
import { Modal, Button, Label, Alert } from 'flowbite-react';
import { StandardTextarea } from '@/components/common/inputs';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/utils/errorHandling';

interface InventoryGrnInspectModalProps {
  isOpen: boolean;
  grnId: number;
  grnNumber: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function InventoryGrnInspectModal({
  isOpen,
  grnId,
  grnNumber,
  onClose,
  onSuccess,
}: InventoryGrnInspectModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qualityPassed, setQualityPassed] = useState(true);
  const [notes, setNotes] = useState('');

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      await api.post(`/inventory/grns/${grnId}/inspect/`, {
        quality_passed: qualityPassed,
        inspection_notes: notes,
      });
      onSuccess();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to inspect GRN.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={isOpen} onClose={onClose} size="lg" className="bg-gray-900/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-h-[85vh] flex flex-col">
        <div className="border-b border-gray-200 dark:border-gray-800 px-6 py-4">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            Inspect GRN {grnNumber}
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && <Alert color="failure">{error}</Alert>}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              checked={qualityPassed}
              onChange={(e) => setQualityPassed(e.target.checked)}
            />
            Quality passed
          </label>

          <div>
            <Label htmlFor="notes" value="Inspection Notes" />
            <StandardTextarea
              id="notes"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end gap-2">
          <Button color="gray" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} isProcessing={loading}>
            Mark Inspected
          </Button>
        </div>
      </div>
    </Modal>
  );
}
