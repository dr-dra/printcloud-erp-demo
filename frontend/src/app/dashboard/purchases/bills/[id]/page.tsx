'use client';

import { use, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Spinner } from 'flowbite-react';
import {
  HiOutlineArrowLeft,
  HiOutlineCheckCircle,
  HiOutlineCurrencyDollar,
  HiOutlineCalendar,
  HiOutlineInformationCircle,
  HiOutlineDocumentText,
} from 'react-icons/hi';
import DashboardLayout from '@/components/DashboardLayout';
import DataTable from '@/components/common/DataTable';
import {
  useApproveSupplierBill,
  useBillPayments,
  useCreateBillPayment,
  useMarkChequeCleared,
  useSupplierBill,
} from '@/hooks/useSuppliers';
import type { DataTableColumn } from '@/types/datatable';
import type { BillPayment } from '@/types/suppliers';
import { getErrorMessage } from '@/utils/errorHandling';
import ErrorBanner from '@/components/common/ErrorBanner';

interface PageProps {
  params: Promise<{ id: string }>;
}

type BillPaymentMethod = 'cash' | 'bank_transfer' | 'cheque' | 'card' | 'other';

export default function SupplierBillDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const billId = Number(id);
  const router = useRouter();
  const { data: bill, isLoading, error } = useSupplierBill(billId);
  const { data: payments } = useBillPayments(billId);
  const approveBill = useApproveSupplierBill();
  const createPayment = useCreateBillPayment();
  const markChequeCleared = useMarkChequeCleared();

  const [paymentForm, setPaymentForm] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    amount: '',
    payment_method: 'bank_transfer' as BillPaymentMethod,
    reference_number: '',
    notes: '',
    cheque_number: '',
    cheque_date: '',
  });
  const [showDocumentModal, setShowDocumentModal] = useState(false);

  useEffect(() => {
    if (!bill) return;
    setPaymentForm((prev) => ({
      ...prev,
      amount: bill.balance_due,
    }));
  }, [bill]);

  const isPaymentAllowed = bill && ['approved', 'partially_paid'].includes(bill.status);

  const updatePaymentForm = (field: string, value: string) => {
    setPaymentForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleApprove = async () => {
    if (!bill) return;
    if (!window.confirm(`Approve bill ${bill.bill_number}? This will post it to AP.`)) {
      return;
    }
    try {
      await approveBill.mutateAsync(bill.id);
      alert('Bill approved successfully.');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      alert(getErrorMessage(err, 'Failed to approve bill.'));
    }
  };

  const handlePayment = async (event: FormEvent) => {
    event.preventDefault();
    if (!bill) return;
    if (!paymentForm.amount) {
      alert('Payment amount is required.');
      return;
    }

    try {
      await createPayment.mutateAsync({
        billId: bill.id,
        payment: {
          bill: bill.id,
          payment_date: paymentForm.payment_date,
          amount: paymentForm.amount,
          payment_method: paymentForm.payment_method,
          reference_number: paymentForm.reference_number || undefined,
          notes: paymentForm.notes || undefined,
          cheque_number:
            paymentForm.payment_method === 'cheque'
              ? paymentForm.cheque_number || undefined
              : undefined,
          cheque_date:
            paymentForm.payment_method === 'cheque'
              ? paymentForm.cheque_date || undefined
              : undefined,
        },
      });
      alert('Payment recorded successfully.');
      setPaymentForm((prev) => ({
        ...prev,
        amount: '',
        reference_number: '',
        notes: '',
        cheque_number: '',
        cheque_date: '',
      }));
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      alert(getErrorMessage(err, 'Failed to record payment.'));
    }
  };

  const handleMarkCleared = async (payment: BillPayment) => {
    if (!window.confirm(`Mark cheque ${payment.cheque_number} as cleared?`)) {
      return;
    }
    try {
      await markChequeCleared.mutateAsync(payment.id);
      alert('Cheque marked as cleared.');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      alert(getErrorMessage(err, 'Failed to clear cheque.'));
    }
  };

  const paymentColumns: DataTableColumn<BillPayment>[] = useMemo(
    () => [
      {
        key: 'payment_date',
        label: 'Date',
        sortable: true,
        render: (payment) => new Date(payment.payment_date).toLocaleDateString(),
      },
      {
        key: 'amount',
        label: 'Amount',
        sortable: true,
        render: (payment) => (
          <span className="font-mono font-semibold text-gray-900 dark:text-white">
            {new Intl.NumberFormat('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }).format(parseFloat(payment.amount))}
          </span>
        ),
      },
      {
        key: 'payment_method',
        label: 'Method',
        render: (payment) => (
          <span className="uppercase text-xs text-gray-600 dark:text-gray-300">
            {payment.payment_method.replace('_', ' ')}
          </span>
        ),
      },
      {
        key: 'status',
        label: 'Status',
        render: (payment) => {
          if (payment.payment_method !== 'cheque') {
            return <Badge color="success">Cleared</Badge>;
          }
          return payment.cheque_cleared ? (
            <Badge color="success">Cleared</Badge>
          ) : (
            <Badge color="warning">Pending</Badge>
          );
        },
      },
      {
        key: 'actions',
        label: 'Actions',
        render: (payment) =>
          payment.payment_method === 'cheque' && !payment.cheque_cleared ? (
            <Button
              size="xs"
              color="gray"
              onClick={(e) => {
                e.stopPropagation();
                handleMarkCleared(payment);
              }}
              disabled={markChequeCleared.isPending}
            >
              Mark Cleared
            </Button>
          ) : (
            <span className="text-gray-400">-</span>
          ),
      },
    ],
    [handleMarkCleared, markChequeCleared.isPending],
  );

  if (isLoading) {
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
            title="Unable to load bill"
            error={getErrorMessage(error, 'Unable to load bill.')}
            onRetry={() => router.refresh()}
            showDismiss={false}
          />
        </div>
      </DashboardLayout>
    );
  }

  if (!bill) {
    return (
      <DashboardLayout>
        <div className="p-4">
          <div className="text-center text-gray-500">Bill not found</div>
        </div>
      </DashboardLayout>
    );
  }

  const statusColor =
    bill.status === 'draft'
      ? 'gray'
      : bill.status === 'approved'
        ? 'info'
        : bill.status === 'paid'
          ? 'success'
          : 'warning';

  return (
    <DashboardLayout>
      <div className="p-3 lg:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <Button
              color="gray"
              size="sm"
              onClick={() => router.push('/dashboard/purchases/bills')}
            >
              <HiOutlineArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Bill {bill.bill_number}
              </h1>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <span>{bill.supplier_name}</span>
                {bill.internal_reference && (
                  <>
                    <span className="text-gray-300 dark:text-gray-600">•</span>
                    <span>{bill.internal_reference}</span>
                  </>
                )}
              </div>
              {bill.scan_summary && (
                <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                  {bill.scan_summary}
                </div>
              )}
            </div>
          </div>
          <Badge color={statusColor}>{bill.status.replace('_', ' ').toUpperCase()}</Badge>
        </div>

        <div className="flex flex-col xl:flex-row gap-4">
          <div className="flex-1 min-w-0 space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Record Payment
                </h2>
              </div>
              <div className="p-4">
                {!isPaymentAllowed && (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/50 dark:bg-amber-900/20">
                    <div className="flex gap-3">
                      <HiOutlineInformationCircle className="h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        Payments can be recorded after the bill is approved.
                      </p>
                    </div>
                  </div>
                )}
                <form className="space-y-5" onSubmit={handlePayment}>
                  <div className="grid gap-5 md:grid-cols-2">
                    <div>
                      <label
                        htmlFor="payment_date"
                        className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        <span className="flex items-center gap-2">
                          <HiOutlineCalendar className="h-4 w-4 text-gray-400" />
                          Payment Date
                        </span>
                      </label>
                      <input
                        id="payment_date"
                        type="date"
                        value={paymentForm.payment_date}
                        onChange={(e) => updatePaymentForm('payment_date', e.target.value)}
                        disabled={!isPaymentAllowed}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="amount"
                        className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        <span className="flex items-center gap-2">
                          <HiOutlineCurrencyDollar className="h-4 w-4 text-gray-400" />
                          Amount
                        </span>
                      </label>
                      <input
                        id="amount"
                        type="number"
                        step="0.01"
                        value={paymentForm.amount}
                        onChange={(e) => updatePaymentForm('amount', e.target.value)}
                        disabled={!isPaymentAllowed}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right font-mono text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="payment_method"
                        className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        Payment Method
                      </label>
                      <select
                        id="payment_method"
                        value={paymentForm.payment_method}
                        onChange={(e) => updatePaymentForm('payment_method', e.target.value)}
                        disabled={!isPaymentAllowed}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      >
                        <option value="cash">Cash</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="cheque">Cheque</option>
                        <option value="card">Card</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor="reference_number"
                        className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        Reference Number
                      </label>
                      <input
                        id="reference_number"
                        type="text"
                        value={paymentForm.reference_number}
                        onChange={(e) => updatePaymentForm('reference_number', e.target.value)}
                        disabled={!isPaymentAllowed}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                  </div>

                  {paymentForm.payment_method === 'cheque' && (
                    <div className="grid gap-5 md:grid-cols-2">
                      <div>
                        <label
                          htmlFor="cheque_number"
                          className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                          Cheque Number
                        </label>
                        <input
                          id="cheque_number"
                          type="text"
                          value={paymentForm.cheque_number}
                          onChange={(e) => updatePaymentForm('cheque_number', e.target.value)}
                          disabled={!isPaymentAllowed}
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="cheque_date"
                          className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                          <span className="flex items-center gap-2">
                            <HiOutlineCalendar className="h-4 w-4 text-gray-400" />
                            Cheque Date
                          </span>
                        </label>
                        <input
                          id="cheque_date"
                          type="date"
                          value={paymentForm.cheque_date}
                          onChange={(e) => updatePaymentForm('cheque_date', e.target.value)}
                          disabled={!isPaymentAllowed}
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="notes"
                      className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Notes
                    </label>
                    <textarea
                      id="notes"
                      rows={3}
                      value={paymentForm.notes}
                      onChange={(e) => updatePaymentForm('notes', e.target.value)}
                      disabled={!isPaymentAllowed}
                      placeholder="Add any relevant notes..."
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!isPaymentAllowed || createPayment.isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {createPayment.isPending ? (
                      <>
                        <Spinner size="sm" />
                        Recording...
                      </>
                    ) : (
                      <>
                        <HiOutlineCurrencyDollar className="h-5 w-5" />
                        Record Payment
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                Payment History
              </h2>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="overflow-x-auto">
                  <DataTable
                    title="Payments"
                    data={Array.isArray(payments) ? payments : []}
                    columns={paymentColumns}
                    searchFields={['reference_number', 'cheque_number']}
                    uniqueId={`bill-${billId}-payments`}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="w-full xl:w-72 flex-shrink-0 space-y-3">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Total Amount
              </div>
              <div className="mt-2 font-mono text-xl font-semibold text-gray-900 dark:text-white">
                {new Intl.NumberFormat('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }).format(parseFloat(bill.total))}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Balance Due
              </div>
              <div className="mt-2 font-mono text-xl font-semibold text-rose-600 dark:text-rose-400">
                {new Intl.NumberFormat('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }).format(parseFloat(bill.balance_due))}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Actions
              </div>
              <div className="mt-3 space-y-2">
                {bill.status === 'draft' && (
                  <button
                    onClick={handleApprove}
                    disabled={approveBill.isPending}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <HiOutlineCheckCircle className="h-5 w-5" />
                    Approve Bill
                  </button>
                )}
                {bill.scan_file_url && (
                  <button
                    onClick={() => setShowDocumentModal(true)}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  >
                    <HiOutlineDocumentText className="h-5 w-5" />
                    View Original
                  </button>
                )}
                <button
                  onClick={() => router.push(`/dashboard/suppliers/${bill.supplier}`)}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                >
                  View Supplier
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Document Viewer Modal */}
        {showDocumentModal && bill.scan_file_url && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowDocumentModal(false)}
          >
            <div
              className="relative w-full max-w-5xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-lg shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4 py-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Original Document
                </h3>
                <button
                  onClick={() => setShowDocumentModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <div className="overflow-auto max-h-[calc(90vh-60px)] p-4">
                {bill.scan_file_url.toLowerCase().endsWith('.pdf') ? (
                  <iframe
                    src={bill.scan_file_url}
                    className="w-full h-[75vh] border-0"
                    title="Bill Document"
                  />
                ) : (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={bill.scan_file_url} alt="Bill Document" className="w-full h-auto" />
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
