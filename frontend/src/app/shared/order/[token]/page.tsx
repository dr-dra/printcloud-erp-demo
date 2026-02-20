'use client';

import React, { useEffect, useState } from 'react';
import { useParams, notFound } from 'next/navigation';
import { Button, Spinner } from 'flowbite-react';
import { HiEye, HiCalendar } from 'react-icons/hi';
import Image from 'next/image';
import { api } from '@/lib/api';
import { ApiError, getErrorMessage } from '@/utils/errorHandling';
import { formatDateSriLankan } from '@/utils/dateUtils';
import { formatIndianCurrency } from '@/utils/currencyUtils';

interface SharedOrderData {
  order: {
    id: number;
    order_number: string;
    order_date: string | null;
    required_date: string | null;
    status: string;
    customer?: {
      name: string;
      email?: string;
      contact?: string;
    } | null;
    project_name?: string | null;
    notes?: string | null;
    subtotal: number;
    discount: number;
    delivery_charge: number;
    vat_amount: number;
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

export default function SharedOrderPage() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<SharedOrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSharedOrder = async () => {
      try {
        const response = await api.get(`/shared/orders/${token}/`);
        setData(response.data);
      } catch (err) {
        const apiError = err as ApiError;
        console.error('Error fetching shared order:', err);
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
      fetchSharedOrder();
    }
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-2 text-gray-600">Loading order...</p>
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
            This order link has expired. Please contact us for a new link.
          </p>
        </div>
      </div>
    );
  }

  const order = data.order;

  return (
    <div className="min-h-screen bg-[#d9e1dc]">
      {/* Dark Top Bar */}
      <div className="bg-gray-900 px-4 py-3">
        <div className="flex justify-end">
          <Button size="sm" className="bg-gray-700 hover:bg-gray-700" disabled>
            Order Confirmation
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
                <h2 className="text-2xl font-bold text-gray-900 mb-2">ORDER CONFIRMATION</h2>
                <div className="text-lg font-semibold text-gray-700">#{order.order_number}</div>
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

            {/* Customer and Order Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">To:</h3>
                <div className="text-gray-700">
                  <div className="font-semibold">{order.customer?.name || 'Customer'}</div>
                  {order.customer?.contact && (
                    <div className="text-sm text-gray-600">{order.customer.contact}</div>
                  )}
                  {order.customer?.email && (
                    <div className="text-sm text-gray-600">{order.customer.email}</div>
                  )}
                </div>
              </div>
              <div className="text-left md:text-right">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="font-semibold text-gray-900">Order Date</div>
                    <div className="text-gray-700">
                      {order.order_date ? formatDateSriLankan(order.order_date) : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Required Date</div>
                    <div className="text-gray-700">
                      {order.required_date ? formatDateSriLankan(order.required_date) : '-'}
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="font-semibold text-gray-900">Status</div>
                  <div className="text-gray-700">{order.status}</div>
                </div>
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
                    {order.items.map((item) => (
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
                  <span className="text-gray-700">{formatIndianCurrency(order.subtotal)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="font-medium text-gray-900">Discount:</span>
                  <span className="text-gray-700">{formatIndianCurrency(order.discount)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="font-medium text-gray-900">Delivery Charges:</span>
                  <span className="text-gray-700">
                    {formatIndianCurrency(order.delivery_charge)}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="font-medium text-gray-900">VAT:</span>
                  <span className="text-gray-700">{formatIndianCurrency(order.vat_amount)}</span>
                </div>
                <div className="border-t border-gray-300 pt-2 mt-2">
                  <div className="flex justify-between">
                    <span className="text-lg font-bold text-gray-900">Grand Total:</span>
                    <span className="text-lg font-bold text-gray-900">
                      {formatIndianCurrency(order.net_total)}
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
