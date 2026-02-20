'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Spinner, Button, Card } from 'flowbite-react';
import { HiDownload, HiCheckCircle } from 'react-icons/hi';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/utils/errorHandling';
import { toast } from 'sonner';

interface ReceiptData {
  document_type?: 'invoice' | 'order';
  payment: {
    id: number;
    amount: string;
    payment_date: string;
    payment_method: string;
    reference_number?: string;
    receipt_number: string;
    receipt_generated_at: string;
    cheque_number?: string;
    cheque_date?: string;
  };
  invoice?: {
    id: number;
    invoice_number: string;
    customer_name?: string;
    customer_email?: string;
    customer_phone?: string;
  };
  order?: {
    id: number;
    order_number: string;
    customer_name?: string;
    customer_email?: string;
    customer_phone?: string;
  };
  cashier_name: string;
}

export default function PublicReceiptView() {
  const params = useParams();
  const receiptNo = params.receiptno as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Fetch receipt data
  useEffect(() => {
    const fetchReceipt = async () => {
      if (!receiptNo) {
        setError('Invalid receipt number');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await api.get(`/sales/invoices/receipts/${receiptNo}/`);
        setReceiptData(response.data);
        setError(null);
      } catch {
        try {
          const response = await api.get(`/sales/orders/receipts/${receiptNo}/`);
          setReceiptData(response.data);
          setError(null);
        } catch (orderErr) {
          console.error('[PublicReceiptView] Error fetching receipt:', orderErr);
          setError(getErrorMessage(orderErr));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchReceipt();
  }, [receiptNo]);

  // Handle download PDF
  const handleDownloadPDF = async () => {
    if (!receiptNo || downloading) return;

    try {
      setDownloading(true);
      const documentType = receiptData?.document_type || (receiptData?.order ? 'order' : 'invoice');
      const downloadEndpoint =
        documentType === 'order'
          ? `/sales/orders/receipts/${receiptNo}/download/`
          : `/sales/invoices/receipts/${receiptNo}/download/`;

      const response = await api.get(downloadEndpoint, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Receipt-${receiptData?.payment.receipt_number || 'download'}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);

      toast.success('Receipt PDF downloaded successfully');
    } catch (err) {
      console.error('[PublicReceiptView] Error downloading PDF:', err);
      toast.error(getErrorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  // Format payment method display
  const formatPaymentMethod = (method: string) => {
    return method
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Format date display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Format amount display
  const formatAmount = (amount: string) => {
    return parseFloat(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Spinner size="xl" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading receipt...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20">
              <svg
                className="h-6 w-6 text-red-600 dark:text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
              Unable to Load Receipt
            </h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{error}</p>
            <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
              This receipt link may be invalid. Please check the receipt number.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (!receiptData) {
    return null;
  }

  const { payment, invoice, order, cashier_name } = receiptData;
  const documentType = receiptData.document_type || (order ? 'order' : 'invoice');
  const documentNumber = documentType === 'order' ? order?.order_number : invoice?.invoice_number;
  const customerName = documentType === 'order' ? order?.customer_name : invoice?.customer_name;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Success Banner */}
        <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center">
            <HiCheckCircle className="h-6 w-6 text-green-600 dark:text-green-400 mr-3" />
            <div>
              <h2 className="text-lg font-semibold text-green-800 dark:text-green-200">
                Payment Receipt
              </h2>
              <p className="text-sm text-green-700 dark:text-green-300">
                This is a valid payment receipt from PrintCloud
              </p>
            </div>
          </div>
        </div>

        {/* Receipt Card */}
        <Card>
          <div className="space-y-6">
            {/* Header */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    Payment Receipt
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Receipt #{payment.receipt_number}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Date</p>
                  <p className="text-base font-medium text-gray-900 dark:text-white">
                    {formatDate(payment.payment_date)}
                  </p>
                </div>
              </div>
            </div>

            {/* Customer Information */}
            {customerName && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Received From
                </h3>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {customerName}
                </p>
              </div>
            )}

            {/* Payment Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  {documentType === 'order' ? 'Order Number' : 'Invoice Number'}
                </h3>
                <p className="text-base font-medium text-gray-900 dark:text-white">
                  {documentNumber}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Payment Method
                </h3>
                <p className="text-base font-medium text-gray-900 dark:text-white">
                  {formatPaymentMethod(payment.payment_method)}
                </p>
              </div>

              {payment.reference_number && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Reference Number
                  </h3>
                  <p className="text-base font-medium text-gray-900 dark:text-white">
                    {payment.reference_number}
                  </p>
                </div>
              )}

              {payment.cheque_number && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Cheque Number
                  </h3>
                  <p className="text-base font-medium text-gray-900 dark:text-white">
                    {payment.cheque_number}
                  </p>
                </div>
              )}

              {payment.cheque_date && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Cheque Date
                  </h3>
                  <p className="text-base font-medium text-gray-900 dark:text-white">
                    {formatDate(payment.cheque_date)}
                  </p>
                </div>
              )}

              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Processed By
                </h3>
                <p className="text-base font-medium text-gray-900 dark:text-white">
                  {cashier_name}
                </p>
              </div>
            </div>

            {/* Amount - Large and prominent */}
            <div className="border-t border-b border-gray-200 dark:border-gray-700 py-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Amount Received
                </h3>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                  Rs. {formatAmount(payment.amount)}
                </p>
              </div>
            </div>

            {/* Download Button */}
            <div className="flex justify-center pt-4">
              <Button
                onClick={handleDownloadPDF}
                disabled={downloading}
                size="lg"
                color="blue"
                className="px-6"
              >
                {downloading ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <HiDownload className="mr-2 h-5 w-5" />
                    Download PDF Receipt
                  </>
                )}
              </Button>
            </div>

            {/* Footer */}
            <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                This is a computer-generated receipt and is valid without signature.
                <br />
                Generated on {formatDate(payment.receipt_generated_at)}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
