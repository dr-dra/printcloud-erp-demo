'use client';

import { useState, useCallback } from 'react';

interface PrintModalState {
  isOpen: boolean;
  documentType:
    | 'quotation'
    | 'invoice'
    | 'order'
    | 'purchase_order'
    | 'receipt'
    | 'order_receipt'
    | 'job_ticket'
    | 'dispatch_note'
    | 'credit_note';
  documentId: string;
  documentTitle: string;
  copies: number;
}

interface UsePrintModalReturn {
  printModalState: PrintModalState;
  openPrintModal: (params: {
    documentType: PrintModalState['documentType'];
    documentId: string;
    documentTitle: string;
    copies?: number;
  }) => void;
  closePrintModal: () => void;
}

const initialState: PrintModalState = {
  isOpen: false,
  documentType: 'quotation',
  documentId: '',
  documentTitle: '',
  copies: 1,
};

/**
 * Hook for managing print modal state and operations
 * Provides a clean interface for opening/closing print modals from any component
 */
export const usePrintModal = (): UsePrintModalReturn => {
  const [printModalState, setPrintModalState] = useState<PrintModalState>(initialState);

  const openPrintModal = useCallback(
    (params: {
      documentType: PrintModalState['documentType'];
      documentId: string;
      documentTitle: string;
      copies?: number;
    }) => {
      setPrintModalState({
        isOpen: true,
        documentType: params.documentType,
        documentId: params.documentId,
        documentTitle: params.documentTitle,
        copies: params.copies || 1,
      });
    },
    [],
  );

  const closePrintModal = useCallback(() => {
    setPrintModalState(initialState);
  }, []);

  return {
    printModalState,
    openPrintModal,
    closePrintModal,
  };
};
