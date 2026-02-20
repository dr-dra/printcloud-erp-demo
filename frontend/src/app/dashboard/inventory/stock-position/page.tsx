'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Select } from 'flowbite-react';
import DashboardLayout from '@/components/DashboardLayout';
import { StandardTextInput } from '@/components/common/inputs';
import DataTable from '@/components/common/DataTable';
import type { DataTableColumn } from '@/types/datatable';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { usePageInitialization } from '@/hooks/usePageInitialization';
import ErrorBanner from '@/components/common/ErrorBanner';
import { getErrorMessage } from '@/utils/errorHandling';
import type { InvCategory, InvCategoryListResponse, InvStockPosition } from '@/types/inventory';

export default function StockPositionPage() {
  const router = useRouter();
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
  });

  const [rows, setRows] = useState<InvStockPosition[]>([]);
  const [categories, setCategories] = useState<InvCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const formatNumber = useCallback((value: string | number | null | undefined) => {
    const parsed = typeof value === 'string' ? Number(value) : (value ?? 0);
    if (!Number.isFinite(parsed)) return '0';
    return parsed.toLocaleString('en-LK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await api.get('/inventory/categories/', { params: { page_size: 500 } });
      const data: InvCategoryListResponse = response.data;
      setCategories(data.results || []);
    } catch (err) {
      console.warn('[StockPosition] Failed to load categories:', err);
    }
  }, []);

  const fetchStockPosition = useCallback(async () => {
    if (!pageReady) return;

    try {
      setLoading(true);
      setError(null);

      const params: Record<string, string> = {};
      if (searchQuery) params.search = searchQuery;
      if (categoryId) params.category = categoryId;
      if (lowStockOnly) params.low_stock = 'true';

      const response = await api.get('/inventory/stock-position/', { params });
      const data = response.data as InvStockPosition[];
      setRows(data || []);
    } catch (err: any) {
      console.error('Error fetching stock position:', err);
      setError(getErrorMessage(err, 'Failed to load stock position.'));
    } finally {
      setLoading(false);
    }
  }, [pageReady, searchQuery, categoryId, lowStockOnly]);

  useEffect(() => {
    if (pageReady && !authLoading) {
      fetchStockPosition();
      fetchCategories();
    }
  }, [fetchStockPosition, fetchCategories, pageReady, authLoading]);

  const mappedRows = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        id: row.item_id,
        on_hand: formatNumber(row.on_hand),
        allocated: formatNumber(row.allocated),
        available: formatNumber(row.available),
        on_order: formatNumber(row.on_order),
        reorder_level: formatNumber(row.reorder_level),
      })),
    [rows, formatNumber],
  );

  const handleRowClick = (row: InvStockPosition) => {
    router.push(`/dashboard/inventory/stock-history/${row.item_id}`);
  };

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
    { key: 'item_sku', label: 'SKU', sortable: true },
    { key: 'item_name', label: 'Item', sortable: true },
    { key: 'category_name', label: 'Category', sortable: true },
    { key: 'stock_uom_code', label: 'UoM', sortable: false },
    { key: 'on_hand', label: 'On Hand', sortable: false, align: 'right' },
    { key: 'allocated', label: 'Allocated', sortable: false, align: 'right' },
    { key: 'available', label: 'Available', sortable: false, align: 'right' },
    { key: 'on_order', label: 'On Order', sortable: false, align: 'right' },
    { key: 'reorder_level', label: 'Reorder', sortable: false, align: 'right' },
    { key: 'status', label: 'Status', sortable: true, align: 'center' },
  ];

  return (
    <DashboardLayout>
      <div className="p-2">
        <div ref={topNavRef} />
        <div ref={titleRef} className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Inventory - Stock Position
          </h1>
        </div>

        <div className="space-y-3">
          <div
            ref={filterBarRef}
            className="bg-white dark:bg-gray-800 shadow rounded-lg p-2 mb-1 flex flex-wrap items-center justify-between gap-2 sm:gap-4"
          >
            <Button size="sm" onClick={fetchStockPosition}>
              Refresh
            </Button>
            <div className="flex flex-wrap gap-2 sm:gap-4 items-center">
              <StandardTextInput
                type="text"
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-48 md:w-64"
                sizing="sm"
              />
              <Select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full sm:w-48"
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
              <Button
                size="sm"
                color={lowStockOnly ? 'failure' : 'gray'}
                onClick={() => setLowStockOnly((prev) => !prev)}
              >
                {lowStockOnly ? 'Low Stock Only' : 'All Stock'}
              </Button>
            </div>
          </div>

          {error && (
            <ErrorBanner
              title="Unable to load stock position"
              error={error}
              onRetry={fetchStockPosition}
              onDismiss={() => setError(null)}
            />
          )}

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div ref={tableRef} className="overflow-x-auto">
              <DataTable
                title="Stock Position"
                data={mappedRows}
                columns={columns}
                loading={loading}
                onRowClick={handleRowClick}
                pagination={{
                  currentPage,
                  totalPages: 1,
                  onPageChange: setCurrentPage,
                  perPage: calculatedRowsPerPage,
                  onPerPageChange: setRowsPerPage,
                  totalCount: rows.length,
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
