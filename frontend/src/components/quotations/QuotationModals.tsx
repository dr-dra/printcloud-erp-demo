/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { ReminderModal } from '@/components/ReminderModal';
import ReminderConflictModal from '@/components/common/ReminderConflictModal';
import { EmailModal } from '@/components/EmailModal';
import { WhatsAppModal } from '@/components/WhatsAppModal';
import { PrintModal } from '@/components/PrintModal';
import type { SalesQuotation } from '@/types/quotations';

interface ReminderHandlers {
  handleSetReminder: (reminderData: any) => Promise<void>;
  handleUpdateExistingReminder: () => Promise<void>;
  handleCreateAdditionalReminder: () => Promise<void>;
  handleCancelConflict: () => void;
}

interface QuotationModalsProps {
  quotation: SalesQuotation;
  quotationId: string;
  reminderModalOpen: boolean;
  conflictModalOpen: boolean;
  existingReminder: any;
  processingReminder: boolean;
  pendingReminderData: any;
  emailModalOpen: boolean;
  whatsappModalOpen: boolean;
  printModalState: {
    isOpen: boolean;
    documentType:
      | 'quotation'
      | 'job_ticket'
      | 'invoice'
      | 'receipt'
      | 'order_receipt'
      | 'dispatch_note'
      | 'credit_note';
    documentId: string;
    documentTitle: string;
    copies: number;
  };
  onReminderModalClose: () => void;
  reminderHandlers: ReminderHandlers;
  onEmailModalClose: () => void;
  onWhatsappModalClose: () => void;
  onPrintModalClose: () => void;
  onSendComplete: (result: any) => void;
}

export function QuotationModals({
  quotation,
  quotationId,
  reminderModalOpen,
  conflictModalOpen,
  existingReminder,
  processingReminder,
  pendingReminderData,
  emailModalOpen,
  whatsappModalOpen,
  printModalState,
  onReminderModalClose,
  reminderHandlers,
  onEmailModalClose,
  onWhatsappModalClose,
  onPrintModalClose,
  onSendComplete,
}: QuotationModalsProps) {
  return (
    <>
      {/* Reminder Modal */}
      <ReminderModal
        isOpen={reminderModalOpen}
        onClose={onReminderModalClose}
        onSetReminder={reminderHandlers.handleSetReminder}
        title="Set Follow-up Reminder"
        context={`Quotation #${quotation.quot_number}`}
        quotationData={quotation}
      />

      {/* Reminder Conflict Modal */}
      <ReminderConflictModal
        show={conflictModalOpen}
        existingReminder={existingReminder}
        newReminderData={pendingReminderData}
        loading={processingReminder}
        onUpdate={reminderHandlers.handleUpdateExistingReminder}
        onCreateAdditional={reminderHandlers.handleCreateAdditionalReminder}
        onCancel={reminderHandlers.handleCancelConflict}
      />

      {/* Email Modal */}
      <EmailModal
        isOpen={emailModalOpen}
        onClose={onEmailModalClose}
        quotationId={quotationId}
        quotation={{
          id: quotation.id,
          quot_number: quotation.quot_number,
          costing_name: quotation.costing_name,
          customer: quotation.customer
            ? {
                id: quotation.customer.id,
                name: quotation.customer.name,
                email: quotation.customer.email,
              }
            : undefined,
          items: quotation.items?.map((item) => ({
            item: item.item,
            description: item.description,
            costing_sheet_name: item.costing_sheet_name,
          })),
        }}
        onSendComplete={onSendComplete}
      />

      {/* WhatsApp Modal */}
      <WhatsAppModal
        isOpen={whatsappModalOpen}
        onClose={onWhatsappModalClose}
        quotationId={quotationId}
        quotation={{
          id: quotation.id,
          quot_number: quotation.quot_number,
          costing_name: quotation.costing_name,
          customer: quotation.customer
            ? {
                name: quotation.customer.name,
                phone: quotation.customer.contact,
              }
            : undefined,
          items: quotation.items?.map((item) => ({
            item: item.item,
            description: item.description,
            costing_sheet_name: item.costing_sheet_name,
          })),
        }}
        onSendComplete={onSendComplete}
      />

      {/* Print Modal */}
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
