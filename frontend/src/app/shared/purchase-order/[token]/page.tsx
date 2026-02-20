'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button, Card, Spinner } from 'flowbite-react';
import { HiDownload, HiExclamationCircle } from 'react-icons/hi';
import { api } from '@/lib/api';
import { ApiError, getErrorMessage } from '@/utils/errorHandling';
import { toast } from 'sonner';

interface SharedPurchaseOrderData {
  purchase_order: {
    id: number;
    po_number: string;
    order_date: string | null;
    expected_delivery_date: string | null;
    status: string;
    supplier?: {
      name: string;
      email?: string;
      contact?: string;
    } | null;
    delivery_address?: string | null;
    supplier_notes?: string | null;
    subtotal: number;
    tax_amount: number;
    discount_amount: number;
    total: number;
    items: Array<{
      id: number;
      item?: string;
      description?: string;
      quantity: number;
      unit_price: number;
      amount: number;
      unit_of_measure?: string;
    }>;
  };
  token: string;
  created_at: string;
  expires_at: string;
  is_expired: boolean;
}

export default function SharedPurchaseOrderPage() {
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SharedPurchaseOrderData | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const fetchPurchaseOrder = async () => {
      if (!token) {
        setError('Invalid purchase order link');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await api.get(`/shared/purchase-orders/${token}/`);
        setData(response.data);
        setError(null);
      } catch (err) {
        console.error('[SharedPurchaseOrderPage] Error fetching purchase order:', err);
        setError(getErrorMessage(err as ApiError));
      } finally {
        setLoading(false);
      }
    };

    fetchPurchaseOrder();
  }, [token]);

  const handleDownloadPDF = async () => {
    if (!token || downloading) return;

    try {
      setDownloading(true);
      const response = await api.get(`/shared/purchase-orders/${token}/pdf/`, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Purchase-Order-${data?.purchase_order.po_number || 'download'}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);

      toast.success('Purchase order PDF downloaded successfully');
    } catch (err) {
      console.error('[SharedPurchaseOrderPage] Error downloading PDF:', err);
      toast.error(getErrorMessage(err as ApiError));
    } finally {
      setDownloading(false);
    }
  };

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-lg w-full text-center">
          <div className="flex flex-col items-center gap-2">
            <HiExclamationCircle className="w-8 h-8 text-red-500" />
            <h2 className="text-lg font-semibold text-gray-800">Unable to load purchase order</h2>
            <p className="text-sm text-gray-600">{error}</p>
          </div>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { purchase_order } = data;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-4">
        {data.is_expired && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-md text-sm">
            This purchase order link has expired. Please contact us for a new link.
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Purchase Order #{purchase_order.po_number}
            </h1>
            <p className="text-sm text-gray-600">Status: {purchase_order.status}</p>
          </div>
          <Button onClick={handleDownloadPDF} disabled={downloading || data.is_expired}>
            <HiDownload className="mr-2 h-4 w-4" />
            {downloading ? 'Downloading...' : 'Download PDF'}
          </Button>
        </div>

        <Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-500">Supplier</div>
              <div className="font-medium text-gray-900">
                {purchase_order.supplier?.name || 'Supplier'}
              </div>
              {purchase_order.supplier?.email && (
                <div className="text-gray-600">{purchase_order.supplier.email}</div>
              )}
              {purchase_order.supplier?.contact && (
                <div className="text-gray-600">{purchase_order.supplier.contact}</div>
              )}
            </div>
            <div>
              <div className="text-gray-500">Order Date</div>
              <div className="font-medium text-gray-900">
                {formatDate(purchase_order.order_date)}
              </div>
              <div className="text-gray-500 mt-2">Expected Delivery</div>
              <div className="font-medium text-gray-900">
                {formatDate(purchase_order.expected_delivery_date)}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-gray-500 border-b">
                <tr>
                  <th className="py-2">Item</th>
                  <th className="py-2">Description</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2">UOM</th>
                  <th className="py-2 text-right">Unit Price</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {purchase_order.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 font-medium text-gray-900">{item.item || '-'}</td>
                    <td className="py-2 text-gray-600">{item.description || '-'}</td>
                    <td className="py-2 text-right">{item.quantity}</td>
                    <td className="py-2">{item.unit_of_measure || '-'}</td>
                    <td className="py-2 text-right">{formatAmount(item.unit_price)}</td>
                    <td className="py-2 text-right">{formatAmount(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 border-t pt-4 text-sm">
            <div className="flex justify-end">
              <div className="w-full max-w-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">{formatAmount(purchase_order.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tax</span>
                  <span className="font-medium">{formatAmount(purchase_order.tax_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Discount</span>
                  <span className="font-medium">
                    {formatAmount(purchase_order.discount_amount)}
                  </span>
                </div>
                <div className="flex justify-between text-base font-semibold">
                  <span>Total</span>
                  <span>{formatAmount(purchase_order.total)}</span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {purchase_order.supplier_notes && (
          <Card>
            <div className="text-sm text-gray-700 whitespace-pre-wrap">
              {purchase_order.supplier_notes}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
