'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Badge, Button, Spinner } from 'flowbite-react';
import { HiArrowLeft, HiDownload, HiPrinter } from 'react-icons/hi';
import DashboardLayout from '@/components/DashboardLayout';
import ErrorBanner from '@/components/common/ErrorBanner';
import { PrintModal } from '@/components/PrintModal';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { usePrintModal } from '@/hooks/usePrintModal';
import { getErrorMessage } from '@/utils/errorHandling';
import { formatDateSriLankan } from '@/utils/dateUtils';
import { toast } from 'sonner';

type CreditNoteDetail = {
  id: number;
  credit_note_number: string;
  credit_note_type: string;
  customer_name?: string | null;
  amount: string | number;
  status: string;
  credit_note_date: string;
  reason?: string | null;
  detail_note?: string | null;
  payout_method?: string | null;
  payout_voucher_number?: string | null;
  payout_cheque_number?: string | null;
  customer_bank_name?: string | null;
  customer_bank_account_name?: string | null;
  customer_bank_account_number?: string | null;
  created_at?: string | null;
};

const typeColors: Record<string, string> = {
  refund: 'purple',
  product_return: 'info',
  adjustment: 'warning',
  discount: 'success',
};

const statusColors: Record<string, string> = {
  draft: 'gray',
  pending: 'warning',
  approved: 'success',
  paid: 'info',
  void: 'failure',
};

export default function CreditNoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const creditNoteId = params.id as string;
  const { printModalState, openPrintModal, closePrintModal } = usePrintModal();

  const [creditNote, setCreditNote] = useState<CreditNoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCreditNote = useCallback(async () => {
    if (!isAuthenticated || !creditNoteId) return;

    try {
      setLoading(true);
      setError(null);
      const response = await api.get<CreditNoteDetail>(
        `/sales/invoices/credit-notes/${creditNoteId}/`,
      );
      setCreditNote(response.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, creditNoteId]);

  useEffect(() => {
    fetchCreditNote();
  }, [fetchCreditNote]);

  const handleDownloadPDF = async () => {
    if (!creditNote || pdfLoading) return;

    try {
      setPdfLoading(true);
      const resp = await api.get(`/sales/invoices/credit-notes/${creditNote.id}/pdf/`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(resp.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `CreditNote-${creditNote.credit_note_number}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded successfully');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setPdfLoading(false);
    }
  };

  const handlePrintCreditNote = () => {
    if (!creditNote) return;

    openPrintModal({
      documentType: 'credit_note',
      documentId: String(creditNote.id),
      documentTitle: `Credit Note #${creditNote.credit_note_number}`,
      copies: 1,
    });
  };

  const formattedAmount = useMemo(() => {
    if (!creditNote) return '';
    const numAmount = typeof creditNote.amount === 'string' ? parseFloat(creditNote.amount) : creditNote.amount;
    return `Rs. ${Number.isFinite(numAmount) ? numAmount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}`;
  }, [creditNote]);

  const formattedDate = useMemo(() => {
    if (!creditNote?.credit_note_date) return '—';
    return formatDateSriLankan(creditNote.credit_note_date);
  }, [creditNote]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Spinner size="xl" />
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading credit note...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !creditNote) {
    return (
      <DashboardLayout>
        <div className="min-h-screen">
          <div className="px-6 py-5 flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard/accounting/credit-notes')}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <HiArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Credit Note</h1>
          </div>
          <div className="p-6">
            <ErrorBanner
              title="Unable to load credit note"
              error={error || 'Credit note not found'}
              onRetry={fetchCreditNote}
              onDismiss={() => router.push('/dashboard/accounting/credit-notes')}
            />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const typeColor = typeColors[creditNote.credit_note_type] ?? 'gray';
  const statusColor = statusColors[creditNote.status?.toLowerCase()] ?? 'gray';

  return (
    <DashboardLayout>
      <div className="min-h-screen px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard/accounting/credit-notes')}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <HiArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Credit Note #{creditNote.credit_note_number}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Created on {formattedDate}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button color="light" onClick={handleDownloadPDF} isProcessing={pdfLoading}>
              <HiDownload className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
            <Button color="light" onClick={handlePrintCreditNote}>
              <HiPrinter className="mr-2 h-4 w-4" />
              Print
            </Button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Summary
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Customer</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {creditNote.customer_name || 'No Customer'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Amount</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{formattedAmount}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Type</p>
                  <Badge color={typeColor}>{creditNote.credit_note_type.replace(/_/g, ' ').toUpperCase()}</Badge>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                  <Badge color={statusColor}>{creditNote.status?.toUpperCase()}</Badge>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Reason & Notes
              </h2>
              <div className="mt-4 space-y-3 text-sm text-gray-700 dark:text-gray-200">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Reason</p>
                  <p>{creditNote.reason || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Detail Note</p>
                  <p>{creditNote.detail_note || '—'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Payout Details
              </h2>
              <div className="mt-4 space-y-3 text-sm text-gray-700 dark:text-gray-200">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Method</p>
                  <p>{creditNote.payout_method || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Voucher #</p>
                  <p>{creditNote.payout_voucher_number || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Cheque #</p>
                  <p>{creditNote.payout_cheque_number || '—'}</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Customer Bank
              </h2>
              <div className="mt-4 space-y-3 text-sm text-gray-700 dark:text-gray-200">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Bank Name</p>
                  <p>{creditNote.customer_bank_name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Account Name</p>
                  <p>{creditNote.customer_bank_account_name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Account #</p>
                  <p>{creditNote.customer_bank_account_number || '—'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <PrintModal
          isOpen={printModalState.isOpen}
          onClose={closePrintModal}
          documentType={printModalState.documentType}
          documentId={printModalState.documentId}
          documentTitle={printModalState.documentTitle}
          copies={printModalState.copies}
        />
      </div>
    </DashboardLayout>
  );
}
