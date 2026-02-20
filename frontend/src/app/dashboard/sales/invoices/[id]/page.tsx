'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Spinner, Badge, Button, Modal } from 'flowbite-react';
import { BsCheckLg, BsSend } from 'react-icons/bs';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import ErrorBanner from '@/components/common/ErrorBanner';
import { usePrintModal } from '@/hooks/usePrintModal';
import { useInvoiceDetail } from '@/hooks/useInvoiceDetail';
import { InvoiceViewHeader } from '@/components/invoices/InvoiceViewHeader';
import { InvoiceActionCards } from '@/components/invoices/InvoiceActionCards';
import { InvoiceDocument } from '@/components/invoices/InvoiceDocument';
import { InvoiceModals } from '@/components/invoices/InvoiceModals';
import { invoicesAPI, accountingAPI } from '@/lib/api';
import { getErrorMessage } from '@/utils/errorHandling';
import { toast } from 'sonner';
import type { InvoicePayment, SalesCreditNote } from '@/types/invoices';

export default function InvoiceDetail() {
  const params = useParams();
  const searchParams = useSearchParams();
  const invoiceId = params.id as string;
  const { isAuthenticated } = useAuth();

  const [pdfLoading, setPdfLoading] = useState(false);
  const [printing] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [refreshCommunications, setRefreshCommunications] = useState(0);

  // Receipt modal state
  const [receiptOptionsModalOpen, setReceiptOptionsModalOpen] = useState(false);
  const [lastRecordedPayment, setLastRecordedPayment] = useState<InvoicePayment | null>(null);
  const [receiptEmailModalOpen, setReceiptEmailModalOpen] = useState(false);
  const [receiptWhatsappModalOpen, setReceiptWhatsappModalOpen] = useState(false);
  const [receiptPrintModalOpen, setReceiptPrintModalOpen] = useState(false);
  const [paymentData, setPaymentData] = useState({
    amount: '',
    payment_method: 'cash',
    payment_date: new Date().toISOString(),
    reference_number: '',
    notes: '',
    cheque_number: '',
    cheque_date: '',
    bank_account_id: '',
    cheque_deposit_account: '',
  });
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Payment action state
  const [depositAccounts, setDepositAccounts] = useState<
    Array<{ id: number; account_code: string; account_name: string }>
  >([]);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<InvoicePayment | null>(null);
  const [actionType, setActionType] = useState<'clear_cheque' | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);

  const { printModalState, openPrintModal, closePrintModal } = usePrintModal();
  const { invoice, loading, error, handleRetry, refetchInvoice, setError } = useInvoiceDetail(
    invoiceId,
    isAuthenticated,
  );

  useEffect(() => {
    if (searchParams.get('recordPayment') === 'true') {
      setPaymentModalOpen(true);
    }
  }, [searchParams]);

  // Fetch bank accounts for payment deposit selection
  useEffect(() => {
    const fetchBankAccounts = async () => {
      try {
        const response = await accountingAPI.getBankAccounts();
        if (response.data && response.data.results) {
          setDepositAccounts(response.data.results);
        }
      } catch (err) {
        console.error('[InvoiceDetail] Error fetching bank accounts:', err);
      }
    };

    if (isAuthenticated) {
      fetchBankAccounts();
    }
  }, [isAuthenticated]);

  const paymentHistory = useMemo(() => {
    if (!invoice) return [];

    const payments = (invoice.payments || []).map((payment) => ({
      type: 'payment' as const,
      date: payment.payment_date,
      payment,
    }));

    const creditNotes = (invoice.credit_notes || []).map((note: SalesCreditNote) => ({
      type: 'credit_note' as const,
      date: note.credit_note_date,
      creditNote: note,
    }));

    return [...payments, ...creditNotes].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [invoice]);

  // Handle PDF download
  const handleDownloadPDF = async () => {
    if (!invoice || pdfLoading) return;

    try {
      setPdfLoading(true);
      const blob = await invoicesAPI.getInvoicePDF(invoiceId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Invoice-${invoice.invoice_number}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded successfully');
    } catch (err) {
      console.error('[InvoiceDetail] Error downloading PDF:', err);
      toast.error(getErrorMessage(err));
    } finally {
      setPdfLoading(false);
    }
  };

  // Handle print invoice
  const handlePrintInvoice = () => {
    if (!invoice) return;

    openPrintModal({
      documentType: 'invoice',
      documentId: invoiceId,
      documentTitle: `Invoice #${invoice.invoice_number}`,
      copies: 1,
    });

    // Trigger communication refresh
    setRefreshCommunications((prev) => prev + 1);
  };

  // Handle send complete callback
  const handleSendComplete = () => {
    setRefreshCommunications((prev) => prev + 1);
    // Refetch invoice to update communication counts
    refetchInvoice();
  };

  // Handle void invoice
  const handleVoidInvoice = async () => {
    if (!invoice) return;

    if (
      !confirm(
        `Are you sure you want to void Invoice #${invoice.invoice_number}? This action cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      await invoicesAPI.voidInvoice(invoice.id);
      toast.success('Invoice voided successfully');
      refetchInvoice();
    } catch (err) {
      console.error('[InvoiceDetail] Error voiding invoice:', err);
      toast.error(getErrorMessage(err));
    }
  };

  // Handle clear cheque
  const handleClearCheque = (payment: InvoicePayment) => {
    setSelectedPayment(payment);
    setActionType('clear_cheque');
    setActionModalOpen(true);
  };

  // Handle send receipt (opens options modal with Email/WhatsApp/Print)
  const handleSendReceipt = (payment: InvoicePayment) => {
    setLastRecordedPayment(payment);
    setReceiptOptionsModalOpen(true);
  };

  // Submit payment action
  const handleSubmitAction = async () => {
    if (!selectedPayment) return;

    setSubmittingAction(true);
    try {
      if (actionType === 'clear_cheque') {
        await invoicesAPI.clearCheque(selectedPayment.id, {
          cleared_date: new Date().toISOString().split('T')[0],
        });
        toast.success('Cheque cleared successfully');
      }

      setActionModalOpen(false);
      setSelectedPayment(null);
      setActionType(null);
      refetchInvoice();
    } catch (err: any) {
      console.error('[InvoiceDetail] Error processing payment action:', err);
      toast.error(err.response?.data?.detail || getErrorMessage(err));
    } finally {
      setSubmittingAction(false);
    }
  };

  // Handle receipt actions
  const handleReceiptEmail = () => {
    setReceiptOptionsModalOpen(false);
    setReceiptEmailModalOpen(true);
  };

  const handleReceiptWhatsApp = () => {
    setReceiptOptionsModalOpen(false);
    setReceiptWhatsappModalOpen(true);
  };

  const handleReceiptPrint = () => {
    setReceiptOptionsModalOpen(false);
    setReceiptPrintModalOpen(true);
  };

  // Handle record payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;

    setSubmittingPayment(true);
    try {
      const response = await invoicesAPI.recordPayment(invoice.id, {
        ...paymentData,
        amount: parseFloat(paymentData.amount),
      });

      // Store the payment data from response
      const payment = response.data;
      console.log('[InvoiceDetail] Payment recorded, response:', payment);
      setLastRecordedPayment(payment);

      toast.success('Payment recorded successfully');
      setPaymentModalOpen(false);
      setPaymentData({
        amount: '',
        payment_method: 'cash',
        payment_date: new Date().toISOString(),
        reference_number: '',
        notes: '',
        cheque_number: '',
        cheque_date: '',
        bank_account_id: '',
        cheque_deposit_account: '',
      });
      refetchInvoice();

      // Open receipt options modal after successful payment
      setReceiptOptionsModalOpen(true);
    } catch (err: any) {
      console.error('[InvoiceDetail] Error recording payment:', err);

      // Extract error message from DRF validation errors
      let errorMessage = 'Failed to record payment';
      if (err.response?.data) {
        const data = err.response.data;
        // Check for field-specific errors first
        if (typeof data === 'object') {
          const errors = Object.entries(data)
            .map(([field, messages]: [string, any]) => {
              const msg = Array.isArray(messages) ? messages[0] : messages;
              return `${field}: ${msg}`;
            })
            .join('\n');
          if (errors) errorMessage = errors;
        } else if (data.detail) {
          errorMessage = data.detail;
        }
      }
      toast.error(errorMessage);
    } finally {
      setSubmittingPayment(false);
    }
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
            title="Unable to load invoice"
            error={error}
            onRetry={handleRetry}
            onDismiss={() => setError(null)}
          />
        </div>
      </DashboardLayout>
    );
  }

  if (!invoice) {
    return (
      <DashboardLayout>
        <div className="p-4">
          <div className="text-center text-gray-500">Invoice not found</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-3 lg:p-4">
        {/* Compact Header */}
        <InvoiceViewHeader
          invoice={invoice}
          pdfLoading={pdfLoading}
          printing={printing}
          onDownloadPDF={handleDownloadPDF}
          onPrint={handlePrintInvoice}
          onEmail={() => setEmailModalOpen(true)}
          onWhatsApp={() => setWhatsappModalOpen(true)}
          onVoid={handleVoidInvoice}
        />

        {/* Two-column layout: Document + Action Sidebar */}
        <div className="flex flex-col xl:flex-row gap-4">
          {/* Main Document Area */}
          <div className="flex-1 min-w-0">
            <InvoiceDocument invoice={invoice} onPrint={handlePrintInvoice} />

            {/* Payments Section */}
            {paymentHistory.length > 0 && (
              <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Payment History
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                          Date
                        </th>
                        <th className="text-left py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                          Method
                        </th>
                        <th className="text-right py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                          Amount
                        </th>
                        <th className="text-left py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                          Reference
                        </th>
                        <th className="text-left py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                          Status
                        </th>
                        <th className="text-right py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentHistory.map((row) => {
                        if (row.type === 'credit_note') {
                          const note = row.creditNote;
                          return (
                            <tr
                              key={`cn-${note.id}`}
                              className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                            >
                              <td className="py-3 px-3 text-sm text-gray-900 dark:text-white">
                                {new Date(note.credit_note_date).toLocaleDateString()}
                              </td>
                              <td className="py-3 px-3 text-sm">
                                <Badge color="purple">Credit Note</Badge>
                              </td>
                              <td className="py-3 px-3 text-sm font-semibold text-rose-600 dark:text-rose-400 text-right">
                                - Rs. {parseFloat(note.amount as string).toLocaleString()}
                              </td>
                              <td className="py-3 px-3 text-sm text-gray-600 dark:text-gray-400">
                                {note.credit_note_number}
                              </td>
                              <td className="py-3 px-3 text-sm">
                                <Badge color="gray">CREDIT NOTE</Badge>
                              </td>
                              <td className="py-3 px-3 text-sm text-right"></td>
                            </tr>
                          );
                        }

                        const payment = row.payment;
                        return (
                          <tr
                            key={`pay-${payment.id}`}
                            className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                          >
                            <td className="py-3 px-3 text-sm text-gray-900 dark:text-white">
                              {new Date(payment.payment_date).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-3 text-sm">
                              <Badge color="gray" className="capitalize">
                                {payment.payment_method.replace('_', ' ')}
                              </Badge>
                            </td>
                            <td className="py-3 px-3 text-sm font-semibold text-gray-900 dark:text-white text-right">
                              Rs. {parseFloat(payment.amount as string).toLocaleString()}
                            </td>
                            <td className="py-3 px-3 text-sm text-gray-600 dark:text-gray-400">
                              {payment.reference_number || '-'}
                            </td>
                            <td className="py-3 px-3 text-sm">
                              {payment.is_refunded ? (
                                <Badge color="warning">REFUNDED</Badge>
                              ) : payment.is_reversed ? (
                                <Badge color="red">REVERSED</Badge>
                              ) : payment.is_void ? (
                                <Badge color="red">VOID</Badge>
                              ) : payment.payment_method === 'cheque' && !payment.cheque_cleared ? (
                                <Badge color="yellow">Pending</Badge>
                              ) : (
                                <Badge color="green">Cleared</Badge>
                              )}
                            </td>
                            <td className="py-3 px-3 text-sm text-right space-x-2">
                              {payment.payment_method === 'cheque' &&
                                !payment.cheque_cleared &&
                                !payment.is_void &&
                                !payment.is_reversed &&
                                !payment.is_refunded && (
                                  <button
                                    type="button"
                                    onClick={() => handleClearCheque(payment)}
                                    className="inline-flex items-center justify-center rounded-md p-1 text-emerald-600 hover:text-emerald-700 hover:bg-gray-100 dark:text-emerald-400 dark:hover:text-emerald-300 dark:hover:bg-gray-700"
                                    title="Mark cheque as cleared"
                                  >
                                    <BsCheckLg className="w-4 h-4" />
                                  </button>
                                )}

                              {!payment.is_void &&
                                !payment.is_reversed &&
                                !payment.is_refunded &&
                                payment.receipt_number && (
                                  <button
                                    type="button"
                                    onClick={() => handleSendReceipt(payment)}
                                    className="inline-flex items-center justify-center rounded-md p-1 text-primary-600 hover:text-primary-700 hover:bg-gray-100 dark:text-primary-400 dark:hover:text-primary-300 dark:hover:bg-gray-700"
                                    title="Send receipt (Email/WhatsApp/Print)"
                                  >
                                    <BsSend className="w-4 h-4" />
                                  </button>
                                )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Action Sidebar */}
          <div className="w-full xl:w-72 flex-shrink-0">
            <InvoiceActionCards
              invoice={invoice}
              onRecordPayment={() => setPaymentModalOpen(true)}
              onEmail={() => setEmailModalOpen(true)}
              onWhatsApp={() => setWhatsappModalOpen(true)}
              refreshCommunications={refreshCommunications}
            />
          </div>
        </div>
      </div>

      <InvoiceModals
        invoice={invoice}
        invoiceId={invoiceId}
        emailModalOpen={emailModalOpen}
        whatsappModalOpen={whatsappModalOpen}
        paymentModalOpen={paymentModalOpen}
        printModalState={printModalState}
        paymentData={paymentData}
        submittingPayment={submittingPayment}
        onEmailModalClose={() => setEmailModalOpen(false)}
        onWhatsappModalClose={() => setWhatsappModalOpen(false)}
        onPaymentModalClose={() => setPaymentModalOpen(false)}
        onPrintModalClose={closePrintModal}
        onPaymentDataChange={setPaymentData}
        onRecordPayment={handleRecordPayment}
        onSendComplete={handleSendComplete}
        depositAccounts={depositAccounts}
        receiptOptionsModalOpen={receiptOptionsModalOpen}
        receiptEmailModalOpen={receiptEmailModalOpen}
        receiptWhatsappModalOpen={receiptWhatsappModalOpen}
        receiptPrintModalOpen={receiptPrintModalOpen}
        lastRecordedPayment={lastRecordedPayment}
        onReceiptOptionsModalClose={() => setReceiptOptionsModalOpen(false)}
        onReceiptEmailModalClose={() => setReceiptEmailModalOpen(false)}
        onReceiptWhatsappModalClose={() => setReceiptWhatsappModalOpen(false)}
        onReceiptPrintModalClose={() => setReceiptPrintModalOpen(false)}
        onReceiptEmail={handleReceiptEmail}
        onReceiptWhatsApp={handleReceiptWhatsApp}
        onReceiptPrint={handleReceiptPrint}
      />

      {/* Payment Action Modal */}
      <Modal
        show={actionModalOpen}
        onClose={() => {
          setActionModalOpen(false);
          setSelectedPayment(null);
          setActionType(null);
        }}
      >
        <Modal.Header>Clear Cheque</Modal.Header>
        <Modal.Body>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">Payment Amount</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  Rs. {parseFloat(selectedPayment.amount as string).toLocaleString()}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  This will mark the cheque {selectedPayment.cheque_number} as cleared and move the
                  funds from 1040 (Cheques Received) to 1010 (Bank).
                </p>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={handleSubmitAction} disabled={submittingAction} color="success">
            {submittingAction ? <Spinner size="sm" /> : 'Clear Cheque'}
          </Button>
          <Button
            color="gray"
            onClick={() => {
              setActionModalOpen(false);
              setSelectedPayment(null);
              setActionType(null);
            }}
          >
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>
    </DashboardLayout>
  );
}
