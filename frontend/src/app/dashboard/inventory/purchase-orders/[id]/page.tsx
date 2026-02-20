'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Spinner } from 'flowbite-react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import ErrorBanner from '@/components/common/ErrorBanner';
import { usePrintModal } from '@/hooks/usePrintModal';
import { purchaseOrdersAPI } from '@/lib/api';
import { getErrorMessage } from '@/utils/errorHandling';
import { toast } from 'sonner';
import type { PurchaseOrder } from '@/types/suppliers';
import { PurchaseOrderViewHeader } from '@/components/purchaseOrders/PurchaseOrderViewHeader';
import { PurchaseOrderActionCards } from '@/components/purchaseOrders/PurchaseOrderActionCards';
import { PurchaseOrderDocument } from '@/components/purchaseOrders/PurchaseOrderDocument';
import { PurchaseOrderModals } from '@/components/purchaseOrders/PurchaseOrderModals';
import { formatDateSriLankan } from '@/utils/dateUtils';

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const purchaseOrderId = params.id as string;
  const { isAuthenticated } = useAuth();

  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [refreshCommunications, setRefreshCommunications] = useState(0);

  const { printModalState, openPrintModal, closePrintModal } = usePrintModal();

  const fetchPurchaseOrder = useCallback(async () => {
    if (!isAuthenticated || !purchaseOrderId || purchaseOrderId === 'new') {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await purchaseOrdersAPI.getPurchaseOrder(parseInt(purchaseOrderId, 10));
      setPurchaseOrder(response.data);
    } catch (err) {
      const errorMessage = getErrorMessage(err as any);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, purchaseOrderId]);

  useEffect(() => {
    fetchPurchaseOrder();
  }, [fetchPurchaseOrder]);

  const handleDownloadPDF = async () => {
    if (!purchaseOrder || pdfLoading) return;

    try {
      setPdfLoading(true);
      const response = await purchaseOrdersAPI.getPurchaseOrderPDF(purchaseOrder.id);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Purchase-Order-${purchaseOrder.po_number}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded successfully');
    } catch (err) {
      toast.error(getErrorMessage(err as any));
    } finally {
      setPdfLoading(false);
    }
  };

  const handlePrintPurchaseOrder = () => {
    if (!purchaseOrder) return;

    openPrintModal({
      documentType: 'purchase_order',
      documentId: purchaseOrderId,
      documentTitle: `Purchase Order #${purchaseOrder.po_number}`,
      copies: 1,
    });

    setRefreshCommunications((prev) => prev + 1);
  };

  const handleSendComplete = () => {
    setRefreshCommunications((prev) => prev + 1);
    fetchPurchaseOrder();
  };

  const handleSendPurchaseOrder = async () => {
    if (!purchaseOrder) return;
    try {
      await purchaseOrdersAPI.sendPurchaseOrder(purchaseOrder.id);
      toast.success('Purchase order marked as sent');
      fetchPurchaseOrder();
    } catch (err) {
      toast.error(getErrorMessage(err as any));
    }
  };

  const handleConfirmPurchaseOrder = async () => {
    if (!purchaseOrder) return;
    try {
      await purchaseOrdersAPI.confirmPurchaseOrder(purchaseOrder.id);
      toast.success('Purchase order confirmed');
      fetchPurchaseOrder();
    } catch (err) {
      toast.error(getErrorMessage(err as any));
    }
  };

  const handleCancelPurchaseOrder = async () => {
    if (!purchaseOrder) return;
    if (!confirm(`Cancel purchase order #${purchaseOrder.po_number}?`)) {
      return;
    }
    try {
      await purchaseOrdersAPI.cancelPurchaseOrder(purchaseOrder.id);
      toast.success('Purchase order cancelled');
      fetchPurchaseOrder();
    } catch (err) {
      toast.error(getErrorMessage(err as any));
    }
  };

  if (loading)
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-64">
          <Spinner size="xl" />
        </div>
      </DashboardLayout>
    );

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-4">
          <ErrorBanner
            title="Unable to load purchase order"
            error={error}
            onRetry={() => fetchPurchaseOrder()}
            onDismiss={() => setError(null)}
          />
        </div>
      </DashboardLayout>
    );
  }

  if (!purchaseOrder) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="p-3 lg:p-4">
        <PurchaseOrderViewHeader
          purchaseOrder={purchaseOrder}
          pdfLoading={pdfLoading}
          onDownloadPDF={handleDownloadPDF}
          onPrint={handlePrintPurchaseOrder}
          onEmail={() => setEmailModalOpen(true)}
          onWhatsApp={() => setWhatsappModalOpen(true)}
          onSend={handleSendPurchaseOrder}
          onConfirm={handleConfirmPurchaseOrder}
          onCancel={handleCancelPurchaseOrder}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <PurchaseOrderDocument
              purchaseOrder={purchaseOrder}
              onPrint={handlePrintPurchaseOrder}
            />

            {purchaseOrder.timeline_entries && purchaseOrder.timeline_entries.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
                  Timeline
                </h3>
                <div className="space-y-3">
                  {purchaseOrder.timeline_entries.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-3">
                      <div className="mt-1 h-2 w-2 rounded-full bg-blue-500"></div>
                      <div>
                        <div className="text-sm text-gray-900 dark:text-white">{entry.message}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {entry.created_by_name || 'System'} •{' '}
                          {formatDateSriLankan(entry.created_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <PurchaseOrderActionCards
              purchaseOrder={purchaseOrder}
              onSend={handleSendPurchaseOrder}
              onConfirm={handleConfirmPurchaseOrder}
              onCancel={handleCancelPurchaseOrder}
              onEmail={() => setEmailModalOpen(true)}
              onWhatsApp={() => setWhatsappModalOpen(true)}
              onPrint={handlePrintPurchaseOrder}
              refreshCommunications={refreshCommunications}
            />
          </div>
        </div>
      </div>

      <PurchaseOrderModals
        purchaseOrder={purchaseOrder}
        purchaseOrderId={purchaseOrderId}
        emailModalOpen={emailModalOpen}
        whatsappModalOpen={whatsappModalOpen}
        printModalState={printModalState}
        onEmailModalClose={() => setEmailModalOpen(false)}
        onWhatsappModalClose={() => setWhatsappModalOpen(false)}
        onPrintModalClose={closePrintModal}
        onSendComplete={handleSendComplete}
      />
    </DashboardLayout>
  );
}
