'use client';

import React from 'react';
import { Alert, Button } from 'flowbite-react';
import { HiInformationCircle } from 'react-icons/hi';
import { Trash2 } from 'lucide-react';

interface ArchiveCustomerAlertProps {
  show: boolean;
  customerName: string;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ArchiveCustomerAlert({
  show,
  customerName,
  loading,
  onConfirm,
  onCancel,
}: ArchiveCustomerAlertProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50 p-4">
      <div className="max-w-md w-full">
        <Alert
          color="warning"
          icon={HiInformationCircle}
          additionalContent={
            <div className="mt-4">
              <div className="flex justify-end gap-3">
                <Button color="light" onClick={onCancel} disabled={loading} size="sm">
                  Cancel
                </Button>
                <Button color="warning" onClick={onConfirm} disabled={loading} size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  {loading ? 'Archiving...' : 'Archive Customer'}
                </Button>
              </div>
            </div>
          }
        >
          <span className="font-medium">Archive Customer</span> Are you sure you want to archive{' '}
          <strong>{customerName}</strong>?
        </Alert>
      </div>
    </div>
  );
}
