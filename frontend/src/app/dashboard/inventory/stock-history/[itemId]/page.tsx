'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from 'flowbite-react';
import DashboardLayout from '@/components/DashboardLayout';
import DataTable from '@/components/common/DataTable';
import type { DataTableColumn } from '@/types/datatable';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { usePageInitialization } from '@/hooks/usePageInitialization';
import ErrorBanner from '@/components/common/ErrorBanner';
import { getErrorMessage } from '@/utils/errorHandling';
import type { InvItem, InvStockMovement, InvStockMovementListResponse } from '@/types/inventory';
import { DateRangePicker } from '@/components/DateRangePicker';
import type { DateRange } from '@/types/dateRange';
import { formatDateForAPI, formatDateSriLankan } from '@/utils/dateUtils';

const movementLabels: Record<string, string> = {
  grn: 'GRN',
  gin: 'GIN',
  adjustment: 'ADJ',
  allocation: 'ALLOC',
  release: 'RELEASE',
  return: 'RETURN',
};

export default function StockHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const itemId = params.itemId as string;
  const { loading: authLoading, isAuthenticated } = useAuth();

  const {
    pageReady,
    calculatedRowsPerPage,
    rowsPerPage,
    isAutoCalculated,
    setRowsPerPage,
    topNavRef,
    titleRef,
    filterBarRef,
    paginationRef,
    tableRef,
  } = usePageInitialization({
    rowHeight: 24,
    minRows: 5,
    maxRows: 40,
    enableAutoCalculation: false,
    defaultRowsPerPage: 10,
  });

  const [item, setItem] = useState<InvItem | null>(null);
  const [movements, setMovements] = useState<InvStockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: null, endDate: null });

  const formatNumber = useCallback((value: string | number | null | undefined) => {
    const parsed = typeof value === 'string' ? Number(value) : (value ?? 0);
    if (!Number.isFinite(parsed)) return '0';
    return parsed.toLocaleString('en-LK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }, []);

  const fetchItem = useCallback(async () => {
    if (!isAuthenticated || !itemId) return;
    try {
      const response = await api.get(`/inventory/items/${itemId}/`);
      setItem(response.data as InvItem);
    } catch (err: any) {
      console.error('Error fetching item:', err);
    }
  }, [isAuthenticated, itemId]);

  const fetchMovements = useCallback(async () => {
    if (!pageReady || !isAuthenticated || !itemId) return;

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: currentPage.toString(),
        page_size: calculatedRowsPerPage.toString(),
        item: itemId,
      });

      const dateFrom = formatDateForAPI(dateRange.startDate);
      const dateTo = formatDateForAPI(dateRange.endDate);

      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);

      const response = await api.get(`/inventory/stock-movements/?${params.toString()}`);
      const data: InvStockMovementListResponse = response.data;

      setMovements(data.results || []);
      setTotalRecords(data.count || 0);
      setTotalPages(Math.max(1, Math.ceil((data.count || 0) / calculatedRowsPerPage)));
    } catch (err: any) {
      console.error('Error fetching stock movements:', err);
      const errorMessage = getErrorMessage(err, 'Failed to load stock movements.');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [pageReady, isAuthenticated, itemId, currentPage, calculatedRowsPerPage, dateRange]);

  useEffect(() => {
    if (pageReady && !authLoading) {
      fetchItem();
      fetchMovements();
    }
  }, [pageReady, authLoading, fetchItem, fetchMovements]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleRowsPerPageChange = (value: number | 'auto') => {
    setRowsPerPage(value);
    setCurrentPage(1);
  };

  const handleDateRangeChange = (range: DateRange) => {
    setDateRange(range);
    setCurrentPage(1);
  };

  const handleRetry = () => {
    setError(null);
    fetchMovements();
  };

  const statementRows = useMemo(() => {
    return movements.map((movement) => {
      const qty = Number(movement.quantity);
      const debit = qty < 0 ? formatNumber(Math.abs(qty)) : '';
      const credit = qty > 0 ? formatNumber(qty) : '';
      const referenceType = (movement.reference_type || movement.movement_type || '').toLowerCase();
      const reference = movementLabels[referenceType] || referenceType.toUpperCase() || '-';

      return {
        ...movement,
        date: formatDateSriLankan(movement.created_at),
        reference,
        description: movement.notes || '-',
        debit,
        credit,
        balance: formatNumber(movement.quantity_after),
      };
    });
  }, [movements, formatNumber]);

  if (authLoading || !pageReady) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <span className="ml-2 text-gray-600">
            {authLoading ? 'Checking authentication...' : 'Initializing page...'}
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const columns: DataTableColumn[] = [
    { key: 'date', label: 'Date', sortable: true },
    { key: 'reference', label: 'Ref', sortable: true },
    { key: 'description', label: 'Description', sortable: false },
    { key: 'debit', label: 'Debit', sortable: false, align: 'right' },
    { key: 'credit', label: 'Credit', sortable: false, align: 'right' },
    { key: 'balance', label: 'Balance', sortable: false, align: 'right' },
  ];

  return (
    <DashboardLayout>
      <div className="p-2">
        <div ref={topNavRef} />
        <div ref={titleRef} className="flex flex-wrap justify-between items-center gap-2 mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Stock History</h1>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {item ? `${item.sku} · ${item.name}` : 'Loading item...'}
            </div>
          </div>
          <Button color="gray" size="sm" onClick={() => router.back()}>
            Back
          </Button>
        </div>

        <div className="space-y-3">
          <div
            ref={filterBarRef}
            className="bg-white dark:bg-gray-800 shadow rounded-lg p-2 mb-1 flex flex-wrap items-center justify-between gap-2 sm:gap-4"
          >
            <div className="flex flex-wrap gap-2 sm:gap-4 items-center">
              <div className="relative mr-4">
                <DateRangePicker value={dateRange} onChange={handleDateRangeChange} size="sm" />
                {(dateRange.startDate || dateRange.endDate) && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary-500 rounded-full border-2 border-white"></div>
                )}
              </div>
            </div>
          </div>

          {error && (
            <ErrorBanner
              title="Unable to load stock history"
              error={error}
              onRetry={handleRetry}
              onDismiss={() => setError(null)}
            />
          )}

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div ref={tableRef} className="overflow-x-auto">
              <DataTable
                title="Stock History"
                data={statementRows}
                columns={columns}
                loading={loading}
                pagination={{
                  currentPage,
                  totalPages,
                  onPageChange: handlePageChange,
                  perPage: calculatedRowsPerPage,
                  onPerPageChange: handleRowsPerPageChange,
                  totalCount: totalRecords,
                  autoPerPage: isAutoCalculated ? calculatedRowsPerPage : undefined,
                  userRowsPerPage: rowsPerPage,
                }}
              />
            </div>
            <div ref={paginationRef} />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
