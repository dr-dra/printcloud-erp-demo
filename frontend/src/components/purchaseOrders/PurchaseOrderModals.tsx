/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { EmailModal } from '@/components/EmailModal';
import { WhatsAppModal } from '@/components/WhatsAppModal';
import { PrintModal } from '@/components/PrintModal';
import type { PurchaseOrder } from '@/types/suppliers';

interface PurchaseOrderModalsProps {
  purchaseOrder: PurchaseOrder | null;
  purchaseOrderId: string;
  emailModalOpen: boolean;
  whatsappModalOpen: boolean;
  printModalState: {
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
  };
  onEmailModalClose: () => void;
  onWhatsappModalClose: () => void;
  onPrintModalClose: () => void;
  onSendComplete?: (result: any) => void;
}

export function PurchaseOrderModals({
  purchaseOrder,
  purchaseOrderId,
  emailModalOpen,
  whatsappModalOpen,
  printModalState,
  onEmailModalClose,
  onWhatsappModalClose,
  onPrintModalClose,
  onSendComplete,
}: PurchaseOrderModalsProps) {
  return (
    <>
      {purchaseOrder && (
        <EmailModal
          isOpen={emailModalOpen}
          onClose={onEmailModalClose}
          documentId={purchaseOrderId}
          documentType="purchase_order"
          document={{
            id: purchaseOrder.id,
            po_number: purchaseOrder.po_number,
            customer: purchaseOrder.supplier_detail
              ? {
                  name: purchaseOrder.supplier_detail.name,
                  email: purchaseOrder.supplier_detail.email,
                }
              : {
                  name: purchaseOrder.supplier_name,
                },
          }}
          onSendComplete={onSendComplete}
        />
      )}

      {purchaseOrder && (
        <WhatsAppModal
          isOpen={whatsappModalOpen}
          onClose={onWhatsappModalClose}
          documentId={purchaseOrderId}
          documentType="purchase_order"
          document={{
            id: purchaseOrder.id,
            po_number: purchaseOrder.po_number,
            customer: purchaseOrder.supplier_detail
              ? {
                  name: purchaseOrder.supplier_detail.name,
                  phone:
                    purchaseOrder.supplier_detail.phone || purchaseOrder.supplier_detail.mobile,
                }
              : {
                  name: purchaseOrder.supplier_name,
                },
          }}
          onSendComplete={onSendComplete}
        />
      )}

      <PrintModal
        isOpen={printModalState.isOpen}
        onClose={onPrintModalClose}
        documentType={printModalState.documentType}
        documentId={printModalState.documentId}
        documentTitle={printModalState.documentTitle}
        copies={printModalState.copies}
        onSendComplete={onSendComplete}
      />
    </>
  );
}
