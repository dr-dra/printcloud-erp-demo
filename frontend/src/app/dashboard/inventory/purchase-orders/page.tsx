'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Dropdown, Badge, Select } from 'flowbite-react';
import { StandardTextInput } from '@/components/common/inputs';
import { HiPlus, HiDotsVertical, HiEye, HiPencil, HiMail, HiPrinter } from 'react-icons/hi';
import DashboardLayout from '@/components/DashboardLayout';
import DataTable from '@/components/common/DataTable';
import type { DataTableColumn } from '@/types/datatable';
import { purchaseOrdersAPI } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { usePageInitialization } from '@/hooks/usePageInitialization';
import { getErrorMessage } from '@/utils/errorHandling';
import ErrorBanner from '@/components/common/ErrorBanner';
import { useRowHeightCalibration } from '@/utils/rowHeightCalibration';
import { toast } from 'sonner';
import { useNavigationState } from '@/hooks/useNavigationState';
import { useRowHighlight } from '@/hooks/useRowHighlight';
import type { PurchaseOrderList, PurchaseOrderStatus } from '@/types/suppliers';
import { PurchaseOrderStatusLabels, PurchaseOrderStatusColors } from '@/types/suppliers';
import { DateRangePicker } from '@/components/DateRangePicker';
import { DateRange } from '@/types/dateRange';
import { formatDateSriLankan } from '@/utils/dateUtils';

interface PurchaseOrderListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: PurchaseOrderList[];
}

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { saveListState, getListState, clearListState } = useNavigationState();

  const {
    pageReady,
    loading: pageLoading,
    error: pageError,
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
    onInitializationComplete: () =>
      console.log('[PurchaseOrdersPage] Page initialized successfully'),
    onError: (error) => console.warn('[PurchaseOrdersPage] Initialization error:', error),
  });

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: null, endDate: null });
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | ''>('');

  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const purchaseOrderListCacheRef = useRef<Map<string, PurchaseOrderListResponse>>(new Map());
  const { highlightedRowId, setHighlight } = useRowHighlight({ duration: 2500 });

  useRowHeightCalibration(tableRef as React.RefObject<HTMLElement>);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const cachePurchaseOrderList = useCallback(
    (cacheKey: string, data: PurchaseOrderListResponse) => {
      const cache = purchaseOrderListCacheRef.current;

      if (!cache.has(cacheKey) && cache.size >= 10) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey) {
          cache.delete(oldestKey);
        }
      }

      cache.set(cacheKey, data);
    },
    [],
  );

  const buildPurchaseOrderParams = useCallback(
    (pageOverride?: number) => {
      const params: Record<string, string> = {
        page: (pageOverride ?? currentPage).toString(),
        page_size: calculatedRowsPerPage.toString(),
      };

      if (sortField) {
        const fieldMapping: { [key: string]: string } = {
          po_number: 'po_number',
          order_date: 'order_date',
          supplier_name: 'supplier__name',
          created_by_name: 'created_at',
          total: 'total',
        };

        const backendField = fieldMapping[sortField] || sortField;
        params.ordering = sortDirection === 'desc' ? `-${backendField}` : backendField;
      }

      if (debouncedSearchQuery) {
        params.search = debouncedSearchQuery;
      }

      if (statusFilter) {
        params.status = statusFilter;
      }

      if (dateRange.startDate) {
        params.start_date = dateRange.startDate.toISOString().split('T')[0];
      }
      if (dateRange.endDate) {
        params.end_date = dateRange.endDate.toISOString().split('T')[0];
      }

      return params;
    },
    [
      currentPage,
      calculatedRowsPerPage,
      sortField,
      sortDirection,
      debouncedSearchQuery,
      statusFilter,
      dateRange,
    ],
  );

  useEffect(() => {
    const savedState = getListState('purchase-orders');
    if (savedState) {
      setCurrentPage(savedState.currentPage);
      setSearchQuery(savedState.searchQuery);
      setDebouncedSearchQuery(savedState.searchQuery);
      if (savedState.dateRange) {
        setDateRange(savedState.dateRange);
      }
      if (savedState.statusFilter) {
        setStatusFilter(savedState.statusFilter);
      }
      clearListState('purchase-orders');
    }
  }, [getListState, clearListState]);

  useEffect(() => {
    const newlyPurchaseOrderId = sessionStorage.getItem('newlyPurchaseOrderId');
    if (newlyPurchaseOrderId) {
      setHighlight(parseInt(newlyPurchaseOrderId, 10));
      sessionStorage.removeItem('newlyPurchaseOrderId');
    }

    const updatedPurchaseOrderId = sessionStorage.getItem('updatedPurchaseOrderId');
    if (updatedPurchaseOrderId) {
      setHighlight(parseInt(updatedPurchaseOrderId, 10));
      sessionStorage.removeItem('updatedPurchaseOrderId');
    }
  }, [setHighlight]);

  const columns: DataTableColumn[] = [
    { key: 'po_number', label: 'PO #', sortable: true },
    { key: 'order_date', label: 'Order Date', sortable: true },
    { key: 'supplier_name', label: 'Supplier', sortable: true },
    { key: 'created_by_name', label: 'Prepared By', sortable: true },
    { key: 'status', label: 'Status', sortable: false, align: 'center' },
    { key: 'total', label: 'Total', sortable: true, align: 'right' },
  ];

  const fetchPurchaseOrders = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      setLoading(true);
      setError(null);

      const params = buildPurchaseOrderParams();
      const cacheKey = JSON.stringify(params);
      const cached = purchaseOrderListCacheRef.current.get(cacheKey);

      if (cached) {
        setPurchaseOrders(cached.results);
        setTotalRecords(cached.count);
        setTotalPages(Math.ceil(cached.count / calculatedRowsPerPage));
        return;
      }

      const response = await purchaseOrdersAPI.getPurchaseOrders(params);
      const data: PurchaseOrderListResponse = response.data;

      cachePurchaseOrderList(cacheKey, data);
      setPurchaseOrders(data.results);
      setTotalRecords(data.count);
      setTotalPages(Math.ceil(data.count / calculatedRowsPerPage));
    } catch (err) {
      const errorMsg = getErrorMessage(err as any);
      setError(errorMsg);
      toast.error(`Failed to load purchase orders: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, calculatedRowsPerPage, buildPurchaseOrderParams, cachePurchaseOrderList]);

  useEffect(() => {
    if (pageReady && isAuthenticated) {
      fetchPurchaseOrders();
    }
  }, [pageReady, isAuthenticated, fetchPurchaseOrders]);

  const prefetchPurchaseOrders = useCallback(
    async (pageNumber: number) => {
      if (!isAuthenticated || !pageReady) return;

      const params = buildPurchaseOrderParams(pageNumber);
      const cacheKey = JSON.stringify(params);
      if (purchaseOrderListCacheRef.current.has(cacheKey)) return;

      try {
        const response = await purchaseOrdersAPI.getPurchaseOrders(params);
        cachePurchaseOrderList(cacheKey, response.data);
      } catch (err) {
        console.warn('[PurchaseOrdersPage] Prefetch failed:', err);
      }
    },
    [isAuthenticated, pageReady, buildPurchaseOrderParams, cachePurchaseOrderList],
  );

  useEffect(() => {
    if (!pageReady || !isAuthenticated) return;

    const nextPage = currentPage + 1;
    const prevPage = currentPage - 1;

    if (nextPage <= totalPages) {
      prefetchPurchaseOrders(nextPage);
    }
    if (prevPage >= 1) {
      prefetchPurchaseOrders(prevPage);
    }
  }, [pageReady, isAuthenticated, currentPage, totalPages, prefetchPurchaseOrders]);

  const handleRowClick = (purchaseOrder: PurchaseOrderList) => {
    saveListState('purchase-orders', {
      currentPage,
      searchQuery,
      dateRange,
      statusFilter,
    });
    router.push(`/dashboard/inventory/purchase-orders/${purchaseOrder.id}`);
  };

  const handleCreatePurchaseOrder = () => {
    router.push('/dashboard/inventory/purchase-orders/new');
  };

  const handleViewPurchaseOrder = (purchaseOrderId: number) => {
    saveListState('purchase-orders', {
      currentPage,
      searchQuery,
      dateRange,
      statusFilter,
    });
    router.push(`/dashboard/inventory/purchase-orders/${purchaseOrderId}`);
  };

  const handleEditPurchaseOrder = (purchaseOrderId: number) => {
    saveListState('purchase-orders', {
      currentPage,
      searchQuery,
      dateRange,
      statusFilter,
    });
    router.push(`/dashboard/inventory/purchase-orders/${purchaseOrderId}/edit`);
  };

  const handleEmailPurchaseOrder = async (purchaseOrderId: number) => {
    try {
      await purchaseOrdersAPI.sendPurchaseOrderEmail(purchaseOrderId);
      toast.success('Purchase order email sent successfully');
      await fetchPurchaseOrders();
    } catch (err) {
      const errorMsg = getErrorMessage(err as any);
      toast.error(`Failed to send purchase order email: ${errorMsg}`);
    }
  };

  const handleDownloadPDF = async (purchaseOrderId: number, poNumber: string) => {
    try {
      const response = await purchaseOrdersAPI.getPurchaseOrderPDF(purchaseOrderId);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Purchase-Order-${poNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded successfully');
    } catch (err) {
      const errorMsg = getErrorMessage(err as any);
      toast.error(`Failed to download PDF: ${errorMsg}`);
    }
  };

  const handlePrintPurchaseOrder = async (purchaseOrderId: number) => {
    try {
      await purchaseOrdersAPI.printPurchaseOrder(purchaseOrderId);
      toast.success('Print job created successfully');
    } catch (err) {
      const errorMsg = getErrorMessage(err as any);
      toast.error(`Failed to create print job: ${errorMsg}`);
    }
  };

  const renderStatusBadge = (status: PurchaseOrderStatus) => {
    const color = PurchaseOrderStatusColors[status];
    const label = PurchaseOrderStatusLabels[status];

    return (
      <Badge color={color} className="justify-center">
        {label}
      </Badge>
    );
  };

  const renderActions = (row: PurchaseOrderList) => (
    <Dropdown
      label=""
      dismissOnClick={true}
      renderTrigger={() => (
        <button
          type="button"
          className="inline-flex items-center p-2 text-sm font-medium text-center text-gray-900 bg-white rounded-lg hover:bg-gray-100 focus:ring-4 focus:outline-none dark:text-white focus:ring-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-600"
          onClick={(e) => e.stopPropagation()}
        >
          <HiDotsVertical className="w-4 h-4" />
        </button>
      )}
    >
      <Dropdown.Item onClick={() => handleViewPurchaseOrder(row.id)}>
        <HiEye className="w-4 h-4 mr-2" />
        View Details
      </Dropdown.Item>
      <Dropdown.Item onClick={() => handleEditPurchaseOrder(row.id)}>
        <HiPencil className="w-4 h-4 mr-2" />
        Edit Purchase Order
      </Dropdown.Item>
      <Dropdown.Divider />
      <Dropdown.Item onClick={() => handleDownloadPDF(row.id, row.po_number)}>
        Download PDF
      </Dropdown.Item>
      <Dropdown.Item onClick={() => handleEmailPurchaseOrder(row.id)}>
        <HiMail className="w-4 h-4 mr-2" />
        Email Purchase Order
      </Dropdown.Item>
      <Dropdown.Item onClick={() => handlePrintPurchaseOrder(row.id)}>
        <HiPrinter className="w-4 h-4 mr-2" />
        Print Purchase Order
      </Dropdown.Item>
    </Dropdown>
  );

  const handleRowsPerPageChange = (value: number | 'auto') => {
    setRowsPerPage(value);
    setCurrentPage(1);
  };

  const handleSort = (columnKey: string) => {
    let newDirection: 'asc' | 'desc' = 'asc';
    if (sortField === columnKey && sortDirection === 'asc') {
      newDirection = 'desc';
    }

    setSortField(columnKey);
    setSortDirection(newDirection);
    setCurrentPage(1);
  };

  const processedData = useMemo(() => {
    return purchaseOrders.map((purchaseOrder) => ({
      ...purchaseOrder,
      order_date: purchaseOrder.order_date ? formatDateSriLankan(purchaseOrder.order_date) : '-',
      supplier_name: purchaseOrder.supplier_name || '-',
      created_by_name: purchaseOrder.created_by_name || '-',
      total: new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'LKR',
        minimumFractionDigits: 2,
      })
        .format(parseFloat(purchaseOrder.total as unknown as string))
        .replace('LKR', 'Rs. '),
      status: (
        <div className="flex justify-center items-center min-w-[80px]">
          {renderStatusBadge(purchaseOrder.status as PurchaseOrderStatus)}
        </div>
      ),
    }));
  }, [purchaseOrders]);

  return (
    <DashboardLayout>
      <div className="p-2">
        <div ref={topNavRef} />
        <div ref={titleRef} className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Purchase Orders</h1>
        </div>

        <div className="space-y-3">
          <div
            ref={filterBarRef}
            className="bg-white dark:bg-gray-800 shadow rounded-lg p-2 mb-1 flex flex-wrap items-center justify-between gap-2 sm:gap-4"
          >
            <Button onClick={handleCreatePurchaseOrder} size="sm">
              <HiPlus className="mr-2 h-4 w-4" />
              Create Purchase Order
            </Button>

            <div className="flex flex-wrap gap-2 sm:gap-4 items-center">
              <StandardTextInput
                type="text"
                placeholder="Search purchase orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-48 md:w-64"
                sizing="sm"
              />

              <Select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as PurchaseOrderStatus | '')}
                sizing="sm"
                className="w-40"
              >
                <option value="">All Status</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="confirmed">Confirmed</option>
                <option value="partially_received">Partially Received</option>
                <option value="received">Received</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </Select>

              <div className="relative mr-4">
                <DateRangePicker value={dateRange} onChange={setDateRange} size="sm" />
                {(dateRange.startDate || dateRange.endDate) && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary-500 rounded-full border-2 border-white"></div>
                )}
              </div>

              <Dropdown
                label=""
                renderTrigger={() => (
                  <button
                    type="button"
                    className="inline-flex items-center p-2 text-sm font-medium text-center text-gray-900 bg-white rounded-lg hover:bg-gray-100 focus:ring-4 focus:outline-none dark:text-white focus:ring-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-600"
                  >
                    <HiDotsVertical className="w-4 h-4" />
                  </button>
                )}
              >
                <Dropdown.Item>Export to CSV</Dropdown.Item>
                <Dropdown.Item>Export to PDF</Dropdown.Item>
                <Dropdown.Divider />
                <Dropdown.Item onClick={() => fetchPurchaseOrders()}>Refresh</Dropdown.Item>
              </Dropdown>
            </div>
          </div>

          {(error || pageError) && (
            <ErrorBanner
              title="Unable to load purchase orders"
              error={error || pageError || ''}
              onRetry={() => fetchPurchaseOrders()}
              onDismiss={() => {
                setError(null);
              }}
            />
          )}

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div ref={tableRef} className="overflow-x-auto">
              <DataTable
                title="Purchase Orders"
                data={processedData || []}
                columns={columns}
                loading={loading || pageLoading}
                actions={renderActions}
                onRowClick={handleRowClick}
                onSort={handleSort}
                sortField={sortField}
                sortDirection={sortDirection}
                isServerPaginated={true}
                highlightedRowId={highlightedRowId}
                idColumn="id"
                pagination={{
                  currentPage,
                  totalPages,
                  onPageChange: setCurrentPage,
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
