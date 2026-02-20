'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect } from 'react';
import { useParams, notFound } from 'next/navigation';
import { Button, Spinner } from 'flowbite-react';
import { HiDownload, HiEye, HiCalendar } from 'react-icons/hi';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/utils/errorHandling';
import { formatDateSriLankan } from '@/utils/dateUtils';
import { formatIndianCurrency } from '@/utils/currencyUtils';
import Image from 'next/image';

interface SharedQuotation {
  id: number;
  quot_number: string;
  costing_name?: string;
  customer?: {
    name: string;
    email?: string;
    contact?: string;
    address?: string;
    addresses?: Array<{
      type: string;
      line1: string;
      line2?: string;
      city: string;
      zip_code?: string;
    }>;
  };
  date?: string;
  required_date?: string;
  created_date?: string;
  terms?: string;
  notes?: string;
  delivery_charge: number;
  discount: number;
  total: number;
  items?: Array<{
    id: number;
    item?: string;
    description?: string;
    quantity?: number;
    unit_price: number;
    price: number;
  }>;
  show_subtotal?: boolean;
  show_delivery_charges?: boolean;
}

interface ShareLinkData {
  quotation: SharedQuotation;
  token: string;
  created_at: string;
  expires_at: string;
  is_expired: boolean;
}

export default function SharedQuotationPage() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<ShareLinkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Convert bullet points to HTML for display (same as dashboard)
  const convertBulletsToHtml = (text: string): React.ReactElement => {
    if (!text) return <span></span>;

    const lines = text.split('\n');
    const elements: React.ReactElement[] = [];
    type ListItem = { level: number; items: React.ReactElement[] };
    let currentList: ListItem | null = null;
    let listStack: ListItem[] = [];

    lines.forEach((line, index) => {
      // Parse bullet line
      const bulletMatch = line.match(/^(\s*)(•|◦|▪)\s(.*)$/);

      if (bulletMatch) {
        const indentStr = bulletMatch[1];
        const content = bulletMatch[3];
        const level = Math.floor(indentStr.length / 2);

        // If this is the first bullet or we're at a different level
        if (!currentList || level !== currentList.level) {
          // If we have a current list and this level is deeper, push to stack
          if (currentList && level > currentList.level) {
            listStack.push(currentList);
          }
          // If this level is shallower, close previous lists
          else if (currentList && level < currentList.level) {
            // Close lists until we reach the right level
            while (listStack.length > 0 && listStack[listStack.length - 1].level >= level) {
              const closedList = listStack.pop()!;
              elements.push(
                <ul
                  key={`list-${elements.length}`}
                  className="list-disc list-inside ml-4 space-y-1"
                >
                  {closedList.items}
                </ul>,
              );
            }
          }

          // Start new list
          currentList = { level, items: [] };
        }

        // Add item to current list
        currentList.items.push(
          <li key={`item-${index}`} className={`${level > 0 ? 'ml-4' : ''}`}>
            {content}
          </li>,
        );
      } else if (line.trim()) {
        // Regular text line - close any open lists first
        if (currentList) {
          const list = currentList as ListItem;
          elements.push(
            <ul key={`list-${elements.length}`} className="list-disc list-inside ml-4 space-y-1">
              {list.items}
            </ul>,
          );
          currentList = null;
        }

        // Add regular text
        elements.push(<div key={`text-${index}`}>{line}</div>);
      } else {
        // Empty line - add space if not in a list
        if (!currentList) {
          elements.push(<div key={`space-${index}`} className="h-2"></div>);
        }
      }
    });

    // Close any remaining lists
    if (currentList) {
      const list = currentList as ListItem;
      elements.push(
        <ul key={`list-${elements.length}`} className="list-disc list-inside ml-4 space-y-1">
          {list.items}
        </ul>,
      );
    }

    // Close any lists remaining in stack
    while (listStack.length > 0) {
      const closedList = listStack.pop()!;
      elements.push(
        <ul key={`list-${elements.length}`} className="list-disc list-inside ml-4 space-y-1">
          {closedList.items}
        </ul>,
      );
    }

    return <div>{elements}</div>;
  };

  // Format project description from first 3 item names (same as dashboard)
  const formatProjectDescription = () => {
    if (!data?.quotation?.items || data.quotation.items.length === 0) {
      return 'No items';
    }

    const itemNames = data.quotation.items
      .slice(0, 3)
      .map((item) => item.item)
      .filter((name): name is string => name !== undefined && name !== null && name.trim() !== '');

    if (itemNames.length === 0) {
      return 'No item names available';
    }

    // Remove duplicates while preserving order
    const uniqueNames: string[] = [];
    for (const name of itemNames) {
      if (!uniqueNames.includes(name)) {
        uniqueNames.push(name);
      }
    }

    if (uniqueNames.length <= 2) {
      return uniqueNames.join(' & ');
    } else {
      return uniqueNames.slice(0, 2).join(', ') + ' & ' + uniqueNames[2];
    }
  };

  useEffect(() => {
    const fetchSharedQuotation = async () => {
      try {
        const response = await api.get(`/shared/quotations/${token}/`);
        setData(response.data);
      } catch (err: any) {
        console.error('Error fetching shared quotation:', err);
        if (err.response?.status === 404) {
          notFound();
        } else {
          setError(getErrorMessage(err));
        }
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchSharedQuotation();
    }
  }, [token]);

  const handleDownloadPDF = async () => {
    setDownloadingPdf(true);
    try {
      const response = await api.get(`/shared/quotations/${token}/pdf/`, {
        responseType: 'blob',
      });

      // Create blob and download
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Quotation-${data?.quotation.quot_number}.pdf`;
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
          <p className="mt-2 text-gray-600">Loading quotation...</p>
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
            This quotation link has expired. Please contact us for a new link.
          </p>
        </div>
      </div>
    );
  }

  const quotation = data.quotation;

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
                <h2 className="text-2xl font-bold text-gray-900 mb-2">QUOTATION</h2>
                <div className="text-lg font-semibold text-gray-700">#{quotation.quot_number}</div>
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

            {/* Customer and Project Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">To:</h3>
                <div className="text-gray-700">
                  <div className="font-semibold">{quotation.customer?.name}</div>
                  {quotation.customer?.addresses && quotation.customer.addresses.length > 0 ? (
                    (() => {
                      const billingAddress = quotation.customer.addresses.find(
                        (addr) => addr.type === 'billing',
                      );
                      const primaryAddress = billingAddress || quotation.customer.addresses[0];

                      return (
                        <div className="text-sm text-gray-600">
                          <div>{primaryAddress.line1}</div>
                          {primaryAddress.line2 && <div>{primaryAddress.line2}</div>}
                          <div>
                            {primaryAddress.city}
                            {primaryAddress.zip_code ? `, ${primaryAddress.zip_code}` : ''}
                          </div>
                        </div>
                      );
                    })()
                  ) : quotation.customer?.address && quotation.customer.address !== 'No address' ? (
                    <div className="text-sm text-gray-600">{quotation.customer.address}</div>
                  ) : null}
                  {quotation.customer?.contact && (
                    <div className="text-sm text-gray-600">{quotation.customer.contact}</div>
                  )}
                  {quotation.customer?.email && (
                    <div className="text-sm text-gray-600">{quotation.customer.email}</div>
                  )}
                </div>
              </div>
              <div className="text-left md:text-right">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="font-semibold text-gray-900">Issued Date</div>
                    <div className="text-gray-700">
                      {quotation.date
                        ? formatDateSriLankan(quotation.date)
                        : formatDateSriLankan(quotation.created_date)}
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Valid Till</div>
                    <div className="text-gray-700">
                      {quotation.required_date
                        ? formatDateSriLankan(quotation.required_date)
                        : 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Project Info */}
            <div className="mb-8">
              <div className="font-semibold text-gray-900 mb-2">Project</div>
              <div className="text-gray-700">{formatProjectDescription()}</div>
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
                    {quotation.items?.map((item, index) => (
                      <tr key={index}>
                        <td className="border-b border-gray-300 px-4 py-3 text-gray-700">
                          <div className="font-semibold text-base">{item.item}</div>
                          {item.description && (
                            <div className="text-sm text-gray-600 mt-1">
                              {convertBulletsToHtml(item.description)}
                            </div>
                          )}
                        </td>
                        <td className="border-b border-gray-300 px-4 py-3 text-center text-gray-700 text-base">
                          {item.quantity ? Math.round(item.quantity).toLocaleString() : '0'}
                        </td>
                        <td className="border-b border-gray-300 px-4 py-3 text-right text-gray-700 text-base">
                          {formatIndianCurrency(item.unit_price)}
                        </td>
                        <td className="border-b border-gray-300 px-4 py-3 text-right text-gray-700 text-base">
                          {formatIndianCurrency(item.price)}
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
                  <span className="text-gray-700">
                    {formatIndianCurrency(quotation.total - quotation.delivery_charge)}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="font-medium text-gray-900">Delivery Charges:</span>
                  <span className="text-gray-700">
                    {formatIndianCurrency(quotation.delivery_charge)}
                  </span>
                </div>
                <div className="border-t border-gray-300 pt-2 mt-2">
                  <div className="flex justify-between">
                    <span className="text-lg font-bold text-gray-900">Grand Total:</span>
                    <span className="text-lg font-bold text-gray-900">
                      {formatIndianCurrency(quotation.total)}
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
