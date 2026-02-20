'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { Spinner } from 'flowbite-react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import ErrorBanner from '@/components/common/ErrorBanner';
import { useQuotationPrint } from '@/hooks/useQuotationPrint';
import { usePrintModal } from '@/hooks/usePrintModal';
import { useQuotationDetail } from '@/hooks/useQuotationDetail';
import { QuotationViewHeader } from '@/components/quotations/QuotationViewHeader';
import { QuotationActionCards } from '@/components/quotations/QuotationActionCards';
import { QuotationDocument } from '@/components/quotations/QuotationDocument';
import { QuotationModals } from '@/components/quotations/QuotationModals';

export default function QuotationViewPage() {
  const params = useParams();
  const quotationId = params.id as string;
  const { isAuthenticated } = useAuth();

  const [pdfLoading] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [refreshSendCard, setRefreshSendCard] = useState(0);

  const { printQuotationToPDF, printing } = useQuotationPrint();
  const { printModalState, openPrintModal, closePrintModal } = usePrintModal();

  // Use custom hook for quotation data and reminder logic
  const {
    quotation,
    loading,
    error,
    reminderModalOpen,
    conflictModalOpen,
    existingReminder,
    processingReminder,
    setReminderModalOpen,
    handleSetReminder,
    handleUpdateExistingReminder,
    handleCreateAdditionalReminder,
    handleCancelConflict,
    handleRetry,
    setError,
  } = useQuotationDetail(quotationId, isAuthenticated);

  // Handle PDF download
  const handleDownloadPDF = async () => {
    if (!quotation || pdfLoading) return;

    try {
      await printQuotationToPDF(quotationId);
    } catch (err) {
      console.error('Error downloading PDF:', err);
    }
  };

  // Handle print quotation using new smart modal
  const handlePrintQuotation = () => {
    if (!quotation) return;

    openPrintModal({
      documentType: 'quotation',
      documentId: quotationId,
      documentTitle: `Quotation #${quotation.quot_number}`,
      copies: 1,
    });

    // Trigger SendCard polling immediately
    setRefreshSendCard((prev) => prev + 1);
  };

  // Handle send complete callback
  const handleSendComplete = () => {
    setRefreshSendCard((prev) => prev + 1);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-64">
          <Spinner size="xl" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-4">
          <ErrorBanner
            title="Unable to load quotation"
            error={error}
            onRetry={handleRetry}
            onDismiss={() => setError(null)}
          />
        </div>
      </DashboardLayout>
    );
  }

  if (!quotation) {
    return (
      <DashboardLayout>
        <div className="p-4">
          <div className="text-center text-gray-500">Quotation not found</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-3 lg:p-4">
        {/* Compact Header */}
        <QuotationViewHeader
          quotation={quotation}
          pdfLoading={pdfLoading}
          printing={printing}
          onDownloadPDF={handleDownloadPDF}
          onPrint={handlePrintQuotation}
          onEmail={() => setEmailModalOpen(true)}
          onEdit={() => {}}
        />

        {/* Two-column layout: Document + Action Sidebar */}
        <div className="flex flex-col xl:flex-row gap-4">
          {/* Main Document Area */}
          <div className="flex-1 min-w-0">
            <QuotationDocument quotation={quotation} onPrint={handlePrintQuotation} />
          </div>

          {/* Action Sidebar */}
          <div className="w-full xl:w-72 flex-shrink-0">
            <QuotationActionCards
              quotation={quotation}
              onSetReminder={() => setReminderModalOpen(true)}
              onEmail={() => setEmailModalOpen(true)}
              onWhatsApp={() => setWhatsappModalOpen(true)}
              refreshSendCard={refreshSendCard}
            />
          </div>
        </div>
      </div>

      <QuotationModals
        quotation={quotation}
        quotationId={quotationId}
        reminderModalOpen={reminderModalOpen}
        conflictModalOpen={conflictModalOpen}
        existingReminder={existingReminder}
        processingReminder={processingReminder}
        pendingReminderData={existingReminder}
        emailModalOpen={emailModalOpen}
        whatsappModalOpen={whatsappModalOpen}
        printModalState={printModalState}
        onReminderModalClose={() => setReminderModalOpen(false)}
        reminderHandlers={{
          handleSetReminder,
          handleUpdateExistingReminder,
          handleCreateAdditionalReminder,
          handleCancelConflict,
        }}
        onEmailModalClose={() => setEmailModalOpen(false)}
        onWhatsappModalClose={() => setWhatsappModalOpen(false)}
        onPrintModalClose={closePrintModal}
        onSendComplete={handleSendComplete}
      />
    </DashboardLayout>
  );
}
