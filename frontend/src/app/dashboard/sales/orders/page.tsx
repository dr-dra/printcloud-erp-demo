'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Dropdown, Badge, Select } from 'flowbite-react';
import { StandardTextInput } from '@/components/common/inputs';
import { HiPlus, HiDotsVertical, HiEye, HiPencil, HiDuplicate, HiPrinter } from 'react-icons/hi';
import DashboardLayout from '@/components/DashboardLayout';
import DataTable from '@/components/common/DataTable';
import type { DataTableColumn } from '@/types/datatable';
import { ordersAPI } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { usePageInitialization } from '@/hooks/usePageInitialization';
import { getErrorMessage } from '@/utils/errorHandling';
import ErrorBanner from '@/components/common/ErrorBanner';
import { useRowHeightCalibration } from '@/utils/rowHeightCalibration';
import { toast } from 'sonner';
import { useNavigationState } from '@/hooks/useNavigationState';
import { useRowHighlight } from '@/hooks/useRowHighlight';
import type {
  SalesOrderListItem,
  OrderListResponse,
  OrderFilters,
  OrderStatus,
} from '@/types/orders';
import { OrderStatusLabels, OrderStatusColors } from '@/types/orders';
import { DateRangePicker } from '@/components/DateRangePicker';
import { DateRange } from '@/types/dateRange';
import { formatDateSriLankan } from '@/utils/dateUtils';

export default function OrdersPage() {
  const router = useRouter();

  // Navigation state management
  const { saveListState, getListState, clearListState } = useNavigationState();

  // Use the page initialization hook
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
    rowHeight: 24, // Compact: py-1.5 (12px total) + text-sm + borders ≈ 24px
    minRows: 5,
    maxRows: 40,
    onInitializationComplete: () => console.log('[OrdersPage] Page initialized successfully'),
    onError: (error) => console.warn('[OrdersPage] Initialization error:', error),
  });

  // Component-specific states
  const [orders, setOrders] = useState<SalesOrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters] = useState<OrderFilters>({});
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: null, endDate: null });
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('');

  // Sorting state
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Row highlight state for newly created order
  const { highlightedRowId, setHighlight } = useRowHighlight({ duration: 2500 });

  // Row height calibration for development
  useRowHeightCalibration(tableRef as React.RefObject<HTMLElement>);

  // Restore navigation state on component mount
  useEffect(() => {
    const savedState = getListState('orders');
    if (savedState) {
      console.log('[OrdersPage] Restoring saved navigation state:', savedState);
      setCurrentPage(savedState.currentPage);
      setSearchQuery(savedState.searchQuery);
      if (savedState.dateRange) {
        setDateRange(savedState.dateRange);
      }
      clearListState('orders');
    }
  }, [getListState, clearListState]);

  // Detect newly created or updated order and highlight it
  useEffect(() => {
    const newlyOrderId = sessionStorage.getItem('newlyOrderId');
    if (newlyOrderId) {
      console.log('[OrdersPage] Found newly created order ID:', newlyOrderId);
      setHighlight(parseInt(newlyOrderId, 10));
      sessionStorage.removeItem('newlyOrderId');
    }

    const updatedOrderId = sessionStorage.getItem('updatedOrderId');
    if (updatedOrderId) {
      console.log('[OrdersPage] Found updated order ID:', updatedOrderId);
      setHighlight(parseInt(updatedOrderId, 10));
      sessionStorage.removeItem('updatedOrderId');
    }
  }, [setHighlight]);

  // Define columns for the DataTable
  const columns: DataTableColumn[] = [
    { key: 'order_number', label: 'Order #', sortable: true },
    { key: 'order_date', label: 'Date', sortable: true },
    { key: 'customer_name', label: 'Customer', sortable: true },
    { key: 'created_by_name', label: 'Prepared By', sortable: true },
    { key: 'status', label: 'Status', sortable: false, align: 'center' },
    { key: 'net_total', label: 'Total', sortable: true, align: 'right' },
  ];

  // Fetch orders data
  const fetchOrders = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      setLoading(true);
      setError(null);

      const params: Record<string, string> = {
        page: currentPage.toString(),
        page_size: calculatedRowsPerPage.toString(),
      };

      // Add sorting
      if (sortField) {
        // Map frontend column keys to backend field names if different
        const fieldMapping: { [key: string]: string } = {
          order_number: 'order_number',
          order_date: 'order_date',
          customer_name: 'customer__name',
          created_by_name: 'created_date', // Sort by date for prepared by fallback
          net_total: 'net_total',
        };

        const backendField = fieldMapping[sortField] || sortField;
        params.ordering = sortDirection === 'desc' ? `-${backendField}` : backendField;
      }

      // Add filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params[key] = value.toString();
        }
      });

      if (searchQuery) {
        params.search = searchQuery;
      }

      // Add status filter
      if (statusFilter) {
        params.status = statusFilter;
      }

      // Add date range filters
      if (dateRange.startDate) {
        params.order_date__gte = dateRange.startDate.toISOString().split('T')[0];
      }
      if (dateRange.endDate) {
        params.order_date__lte = dateRange.endDate.toISOString().split('T')[0];
      }

      console.log('[OrdersPage] Fetching orders with params:', params);

      const response = await ordersAPI.getOrders(params);
      const data: OrderListResponse = response.data;

      console.log('[OrdersPage] Fetched orders:', data);

      setOrders(data.results);
      setTotalRecords(data.count);
      setTotalPages(Math.ceil(data.count / calculatedRowsPerPage));
    } catch (err) {
      console.error('[OrdersPage] Error fetching orders:', err);
      const errorMsg = getErrorMessage(err);
      setError(errorMsg);
      toast.error(`Failed to load orders: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  }, [
    isAuthenticated,
    currentPage,
    calculatedRowsPerPage,
    filters,
    searchQuery,
    statusFilter,
    dateRange,
    sortField,
    sortDirection,
  ]);

  // Fetch orders when dependencies change
  useEffect(() => {
    if (pageReady && isAuthenticated) {
      fetchOrders();
    }
  }, [pageReady, isAuthenticated, fetchOrders]);

  // Handle row click - navigate to order detail
  const handleRowClick = (order: SalesOrderListItem) => {
    // Save current list state before navigation
    saveListState('orders', {
      currentPage,
      searchQuery,
      dateRange,
    });

    console.log('[OrdersPage] Navigating to order detail:', order.id);
    router.push(`/dashboard/sales/orders/${order.id}`);
  };

  // Handle create new order
  const handleCreateOrder = () => {
    router.push('/dashboard/sales/orders/new');
  };

  // Handle view order
  const handleViewOrder = (orderId: number) => {
    saveListState('orders', {
      currentPage,
      searchQuery,
      dateRange,
    });
    router.push(`/dashboard/sales/orders/${orderId}`);
  };

  // Handle edit order
  const handleEditOrder = (orderId: number) => {
    saveListState('orders', {
      currentPage,
      searchQuery,
      dateRange,
    });
    router.push(`/dashboard/sales/orders/${orderId}/edit`);
  };

  // Handle clone order
  const handleCloneOrder = async (orderId: number) => {
    try {
      const response = await ordersAPI.cloneOrder(orderId);
      const newOrder = response.data.order;
      toast.success(`Order cloned successfully: ${newOrder.order_number}`);

      // Store newly created order ID for highlighting
      sessionStorage.setItem('newlyOrderId', newOrder.id.toString());

      // Refresh the list
      await fetchOrders();
    } catch (err) {
      console.error('[OrdersPage] Error cloning order:', err);
      const errorMsg = getErrorMessage(err);
      toast.error(`Failed to clone order: ${errorMsg}`);
    }
  };

  // Handle PDF download
  const handleDownloadPDF = async (orderId: number, orderNumber: string) => {
    try {
      const response = await ordersAPI.getOrderPDF(orderId);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Order-${orderNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded successfully');
    } catch (err) {
      console.error('[OrdersPage] Error downloading PDF:', err);
      const errorMsg = getErrorMessage(err);
      toast.error(`Failed to download PDF: ${errorMsg}`);
    }
  };

  // Handle print order
  const handlePrintOrder = async (orderId: number) => {
    try {
      await ordersAPI.printOrder(orderId);
      toast.success('Print job created successfully');
    } catch (err) {
      console.error('[OrdersPage] Error printing order:', err);
      const errorMsg = getErrorMessage(err);
      toast.error(`Failed to create print job: ${errorMsg}`);
    }
  };

  // Render status badge
  const renderStatusBadge = (status: OrderStatus) => {
    const color = OrderStatusColors[status];
    const label = OrderStatusLabels[status];

    return (
      <Badge color={color} className="justify-center">
        {label}
      </Badge>
    );
  };

  // Actions dropdown for each row
  const renderActions = (row: SalesOrderListItem) => (
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
      <Dropdown.Item onClick={() => handleViewOrder(row.id)}>
        <HiEye className="w-4 h-4 mr-2" />
        View Details
      </Dropdown.Item>
      <Dropdown.Item onClick={() => handleEditOrder(row.id)}>
        <HiPencil className="w-4 h-4 mr-2" />
        Edit Order
      </Dropdown.Item>
      <Dropdown.Item onClick={() => handleCloneOrder(row.id)}>
        <HiDuplicate className="w-4 h-4 mr-2" />
        Clone Order
      </Dropdown.Item>
      <Dropdown.Divider />
      <Dropdown.Item onClick={() => handleDownloadPDF(row.id, row.order_number)}>
        Download PDF
      </Dropdown.Item>
      <Dropdown.Item onClick={() => handlePrintOrder(row.id)}>
        <HiPrinter className="w-4 h-4 mr-2" />
        Print Order
      </Dropdown.Item>
    </Dropdown>
  );

  // Handle rows per page change
  const handleRowsPerPageChange = (value: number | 'auto') => {
    setRowsPerPage(value);
    setCurrentPage(1); // Reset to first page
  };

  // Handle sort change
  const handleSort = (columnKey: string) => {
    let newDirection: 'asc' | 'desc' = 'asc';
    if (sortField === columnKey && sortDirection === 'asc') {
      newDirection = 'desc';
    }

    setSortField(columnKey);
    setSortDirection(newDirection);
    setCurrentPage(1);
  };

  // Process data for display
  const processedData = useMemo(() => {
    return orders.map((order) => ({
      ...order,
      order_number: (
        <div className="flex items-center gap-2">
          <span>{order.order_number}</span>
          {order.quotation_number && (
            <Badge color="info" size="xs" className="text-[9px] py-0.5 px-2 leading-none">
              Q:{order.quotation_number}
            </Badge>
          )}
          {order.costing_number && !order.quotation_number && (
            <Badge color="purple" size="xs" className="text-[9px] py-0.5 px-2 leading-none">
              C:{order.costing_number}
            </Badge>
          )}
        </div>
      ),
      order_date: order.order_date ? formatDateSriLankan(order.order_date) : '-',
      customer_name: order.customer_name || '-',
      created_by_name: order.created_by_name || '-',
      net_total: new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'LKR',
        minimumFractionDigits: 2,
      })
        .format(order.net_total)
        .replace('LKR', 'Rs. '),
      status: (
        <div className="flex justify-center items-center min-w-[80px]">
          {renderStatusBadge(order.status)}
        </div>
      ),
    }));
  }, [orders]);

  return (
    <DashboardLayout>
      <div className="p-2">
        <div ref={topNavRef} />
        <div ref={titleRef} className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Sales Orders</h1>
        </div>

        {/* List Interface */}
        <div className="space-y-3">
          {/* Filter/Search Bar Card - responsive layout with smaller components */}
          <div
            ref={filterBarRef}
            className="bg-white dark:bg-gray-800 shadow rounded-lg p-2 mb-1 flex flex-wrap items-center justify-between gap-2 sm:gap-4"
          >
            {/* New Order Button */}
            <Button onClick={handleCreateOrder} size="sm">
              <HiPlus className="mr-2 h-4 w-4" />
              Create Order
            </Button>

            {/* Filter controls: search, status, date range, context menu */}
            <div className="flex flex-wrap gap-2 sm:gap-4 items-center">
              {/* Search box */}
              <StandardTextInput
                type="text"
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-48 md:w-64"
                sizing="sm"
              />

              {/* Status Filter */}
              <Select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as OrderStatus | '')}
                sizing="sm"
                className="w-40"
              >
                <option value="">All Status</option>
                <option value="draft">Draft</option>
                <option value="confirmed">Confirmed</option>
                <option value="production">In Production</option>
                <option value="ready">Ready</option>
                <option value="delivered">Delivered</option>
                <option value="invoiced">Invoiced</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </Select>

              {/* Date range picker */}
              <div className="relative mr-4">
                <DateRangePicker value={dateRange} onChange={setDateRange} size="sm" />
                {(dateRange.startDate || dateRange.endDate) && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary-500 rounded-full border-2 border-white"></div>
                )}
              </div>

              {/* Context menu (three dots) */}
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
                <Dropdown.Item onClick={() => fetchOrders()}>Refresh</Dropdown.Item>
              </Dropdown>
            </div>
          </div>

          {/* Error Banner */}
          {(error || pageError) && (
            <ErrorBanner
              title="Unable to load orders"
              error={error || pageError || ''}
              onRetry={() => fetchOrders()}
              onDismiss={() => {
                setError(null);
              }}
            />
          )}

          {/* Table Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div ref={tableRef} className="overflow-x-auto">
              <DataTable
                title="Sales Orders"
                data={processedData || []}
                columns={columns}
                loading={loading}
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
