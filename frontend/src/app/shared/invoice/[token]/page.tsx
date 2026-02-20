'use client';

import React, { useEffect, useState } from 'react';
import { useParams, notFound } from 'next/navigation';
import { Button, Spinner } from 'flowbite-react';
import { HiDownload, HiEye, HiCalendar } from 'react-icons/hi';
import Image from 'next/image';
import { api } from '@/lib/api';
import { ApiError, getErrorMessage } from '@/utils/errorHandling';
import { formatDateSriLankan } from '@/utils/dateUtils';
import { formatIndianCurrency } from '@/utils/currencyUtils';

interface SharedInvoiceData {
  invoice: {
    id: number;
    invoice_number: string;
    invoice_type: string;
    invoice_date: string | null;
    due_date: string | null;
    status: string;
    customer?: {
      name: string;
      email?: string;
      contact?: string;
    } | null;
    po_so_number?: string | null;
    notes?: string | null;
    subtotal: number;
    discount: number;
    tax_amount: number;
    net_total: number;
    items: Array<{
      id: number;
      item?: string;
      description?: string;
      quantity: number;
      unit_price: number;
      amount: number;
    }>;
  };
  token: string;
  created_at: string;
  expires_at: string;
  is_expired: boolean;
}

export default function SharedInvoicePage() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<SharedInvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    const fetchSharedInvoice = async () => {
      try {
        const response = await api.get(`/shared/invoices/${token}/`);
        setData(response.data);
      } catch (err) {
        const apiError = err as ApiError;
        console.error('Error fetching shared invoice:', err);
        if (apiError.response?.status === 404) {
          notFound();
        } else {
          setError(getErrorMessage(apiError));
        }
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchSharedInvoice();
    }
  }, [token]);

  const handleDownloadPDF = async () => {
    setDownloadingPdf(true);
    try {
      const response = await api.get(`/shared/invoices/${token}/pdf/`, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Invoice-${data?.invoice.invoice_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading PDF:', err);
      alert('Failed to download PDF. Please try again.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-2 text-gray-600">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="max-w-md mx-auto text-center p-8 border border-gray-200 rounded-lg shadow-sm">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <HiEye className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Access Error</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!data || data.is_expired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="max-w-md mx-auto text-center p-8 border border-gray-200 rounded-lg shadow-sm">
          <div className="w-16 h-16 mx-auto mb-4 bg-yellow-100 rounded-full flex items-center justify-center">
            <HiCalendar className="w-8 h-8 text-yellow-600" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Link Expired</h1>
          <p className="text-gray-600">
            This invoice link has expired. Please contact us for a new link.
          </p>
        </div>
      </div>
    );
  }

  const invoice = data.invoice;

  return (
    <div className="min-h-screen bg-[#d9e1dc]">
      {/* Dark Top Bar with Download Button */}
      <div className="bg-gray-900 px-4 py-3">
        <div className="flex justify-end">
          <Button
            onClick={handleDownloadPDF}
            disabled={downloadingPdf}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
          >
            {downloadingPdf ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Downloading...
              </>
            ) : (
              <>
                <HiDownload className="mr-2 h-4 w-4" />
                Download PDF
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 sm:p-8 lg:p-16">
        {/* White Card Container - A4 Paper Size */}
        <div className="max-w-3xl mx-auto">
          <div className="bg-white border border-gray-300 rounded-lg shadow-sm p-4 sm:p-6 md:p-8 lg:p-12">
            {/* Header with Logo */}
            <div className="flex flex-col sm:flex-row justify-between items-start mb-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">INVOICE</h2>
                <div className="text-lg font-semibold text-gray-700">#{invoice.invoice_number}</div>
              </div>
              <div className="text-right mt-4 sm:mt-0">
                <div className="mb-4 flex justify-end">
                  <Image
                    src="/images/layout/kandyoffset-logo-light.svg"
                    alt="Kandy Offset"
                    width={220}
                    height={66}
                    className="block"
                  />
                </div>
                <div className="text-sm text-gray-600">
                  <div>No. 947 Peradeniya Road Kandy</div>
                  <div>0814946426</div>
                  <div>info@printsrilanka.com</div>
                  <div>kandyoffset.com</div>
                </div>
              </div>
            </div>

            {/* Customer and Invoice Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">To:</h3>
                <div className="text-gray-700">
                  <div className="font-semibold">{invoice.customer?.name || 'Customer'}</div>
                  {invoice.customer?.contact && (
                    <div className="text-sm text-gray-600">{invoice.customer.contact}</div>
                  )}
                  {invoice.customer?.email && (
                    <div className="text-sm text-gray-600">{invoice.customer.email}</div>
                  )}
                </div>
              </div>
              <div className="text-left md:text-right">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="font-semibold text-gray-900">Invoice Date</div>
                    <div className="text-gray-700">
                      {invoice.invoice_date ? formatDateSriLankan(invoice.invoice_date) : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Due Date</div>
                    <div className="text-gray-700">
                      {invoice.due_date ? formatDateSriLankan(invoice.due_date) : '-'}
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="font-semibold text-gray-900">Invoice Type</div>
                  <div className="text-gray-700">
                    {invoice.invoice_type === 'tax_invoice' ? 'Tax Invoice' : 'Proforma Invoice'}
                  </div>
                </div>
                {invoice.po_so_number && (
                  <div className="mt-2">
                    <div className="font-semibold text-gray-900">PO/SO #</div>
                    <div className="text-gray-700">{invoice.po_so_number}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Items Table */}
            <div className="mb-8">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border-t border-b border-gray-300">
                  <colgroup>
                    <col className="w-3/5" />
                    <col className="w-2/15" />
                    <col className="w-2/15" />
                    <col className="w-2/15" />
                  </colgroup>
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border-b border-gray-300 px-4 py-2.5 text-left font-semibold text-gray-900">
                        Item/Description
                      </th>
                      <th className="border-b border-gray-300 px-4 py-2.5 text-center font-semibold text-gray-900">
                        Quantity
                      </th>
                      <th className="border-b border-gray-300 px-4 py-2.5 text-right font-semibold text-gray-900">
                        Unit Price
                      </th>
                      <th className="border-b border-gray-300 px-4 py-2.5 text-right font-semibold text-gray-900">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((item) => (
                      <tr key={item.id}>
                        <td className="border-b border-gray-300 px-4 py-3 text-gray-700">
                          <div className="font-semibold text-base">{item.item || 'Item'}</div>
                          {item.description && (
                            <div className="text-sm text-gray-600 mt-1">{item.description}</div>
                          )}
                        </td>
                        <td className="border-b border-gray-300 px-4 py-3 text-center text-gray-700 text-base">
                          {Math.round(item.quantity).toLocaleString()}
                        </td>
                        <td className="border-b border-gray-300 px-4 py-3 text-right text-gray-700 text-base">
                          {formatIndianCurrency(item.unit_price)}
                        </td>
                        <td className="border-b border-gray-300 px-4 py-3 text-right text-gray-700 text-base">
                          {formatIndianCurrency(item.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals Section */}
            <div className="flex justify-end">
              <div className="w-80">
                <div className="flex justify-between py-2">
                  <span className="font-medium text-gray-900">Sub Total:</span>
                  <span className="text-gray-700">{formatIndianCurrency(invoice.subtotal)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="font-medium text-gray-900">Discount:</span>
                  <span className="text-gray-700">{formatIndianCurrency(invoice.discount)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="font-medium text-gray-900">VAT:</span>
                  <span className="text-gray-700">{formatIndianCurrency(invoice.tax_amount)}</span>
                </div>
                <div className="border-t border-gray-300 pt-2 mt-2">
                  <div className="flex justify-between">
                    <span className="text-lg font-bold text-gray-900">Grand Total:</span>
                    <span className="text-lg font-bold text-gray-900">
                      {formatIndianCurrency(invoice.net_total)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Outside the white card */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p className="mb-2">If you have any questions, please contact us directly.</p>
          <p className="text-xs text-gray-500">
            Link expires on {formatDateSriLankan(data.expires_at)}
          </p>
        </div>
      </div>
    </div>
  );
}
