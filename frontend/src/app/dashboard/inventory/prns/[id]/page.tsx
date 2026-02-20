'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import ErrorBanner from '@/components/common/ErrorBanner';
import { getErrorMessage } from '@/utils/errorHandling';
import DataTable from '@/components/common/DataTable';
import type { DataTableColumn } from '@/types/datatable';
import type { InvPrn, InvPrnItem } from '@/types/inventory';
import { Button } from 'flowbite-react';

export default function PrnDetailPage() {
  const params = useParams();
  const router = useRouter();
  const prnId = params.id as string;
  const { isAuthenticated } = useAuth();

  const [prn, setPrn] = useState<InvPrn | null>(null);
  const [items, setItems] = useState<InvPrnItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrn = useCallback(async () => {
    if (!isAuthenticated || !prnId) return;
    try {
      setLoading(true);
      setError(null);
      const [prnResponse, itemsResponse] = await Promise.all([
        api.get(`/inventory/prns/${prnId}/`),
        api.get(`/inventory/prn-items/?prn=${prnId}`),
      ]);
      setPrn(prnResponse.data);
      setItems(itemsResponse.data.results || itemsResponse.data || []);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to load PRN.'));
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, prnId]);

  useEffect(() => {
    fetchPrn();
  }, [fetchPrn]);

  const columns: DataTableColumn[] = [
    { key: 'item_sku', label: 'SKU', sortable: true },
    { key: 'item_name', label: 'Item', sortable: true },
    { key: 'required_qty', label: 'Required', sortable: true, align: 'right' },
    { key: 'ordered_qty', label: 'Ordered', sortable: true, align: 'right' },
    { key: 'received_qty', label: 'Received', sortable: true, align: 'right' },
    { key: 'status', label: 'Status', sortable: true },
  ];

  return (
    <DashboardLayout>
      <div className="p-2">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            PRN {prn?.prn_number || ''}
          </h1>
          <Button color="gray" size="sm" onClick={() => router.back()}>
            Back
          </Button>
        </div>

        {error && (
          <ErrorBanner
            title="Unable to load PRN"
            error={error}
            onRetry={fetchPrn}
            onDismiss={() => setError(null)}
          />
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-gray-500">Status</div>
              <div className="text-gray-900 dark:text-white">{prn?.status || '-'}</div>
            </div>
            <div>
              <div className="text-gray-500">Request Date</div>
              <div className="text-gray-900 dark:text-white">{prn?.request_date || '-'}</div>
            </div>
            <div>
              <div className="text-gray-500">Needed By</div>
              <div className="text-gray-900 dark:text-white">{prn?.needed_by || '-'}</div>
            </div>
            <div>
              <div className="text-gray-500">Job Ticket ID</div>
              <div className="text-gray-900 dark:text-white">{prn?.job_ticket_id ?? '-'}</div>
            </div>
            <div className="md:col-span-2">
              <div className="text-gray-500">Notes</div>
              <div className="text-gray-900 dark:text-white">{prn?.notes || '-'}</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <DataTable title="PRN Items" data={items} columns={columns} loading={loading} />
        </div>
      </div>
    </DashboardLayout>
  );
}
