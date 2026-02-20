'use client';

import React from 'react';
import { Modal, Button } from 'flowbite-react';
import { HiExclamation } from 'react-icons/hi';

interface ConfirmDialogProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title: _title = 'Confirm Action',
  message,
  confirmLabel = 'Yes',
  cancelLabel = 'No',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal show={isOpen} size="md" onClose={onCancel} popup>
      <Modal.Header />
      <Modal.Body>
        <div className="text-center">
          <HiExclamation className="mx-auto mb-4 h-14 w-14 text-gray-400 dark:text-gray-200" />
          <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">{message}</h3>
          <div className="flex justify-center gap-4">
            <Button color="failure" onClick={onConfirm}>
              {confirmLabel}
            </Button>
            <Button color="gray" onClick={onCancel}>
              {cancelLabel}
            </Button>
          </div>
        </div>
      </Modal.Body>
    </Modal>
  );
}
