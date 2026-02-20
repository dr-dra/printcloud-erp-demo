'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Dropdown, Badge, Select } from 'flowbite-react';
import { StandardTextInput } from '@/components/common/inputs';
import {
  HiPlus,
  HiDotsVertical,
  HiEye,
  HiPencil,
  HiMail,
  HiPrinter,
  HiCurrencyDollar,
} from 'react-icons/hi';
import DashboardLayout from '@/components/DashboardLayout';
import DataTable from '@/components/common/DataTable';
import type { DataTableColumn } from '@/types/datatable';
import { invoicesAPI } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { usePageInitialization } from '@/hooks/usePageInitialization';
import { getErrorMessage } from '@/utils/errorHandling';
import ErrorBanner from '@/components/common/ErrorBanner';
import { useRowHeightCalibration } from '@/utils/rowHeightCalibration';
import { toast } from 'sonner';
import { useNavigationState } from '@/hooks/useNavigationState';
import { useRowHighlight } from '@/hooks/useRowHighlight';
import type {
  SalesInvoiceListItem,
  InvoiceListResponse,
  InvoiceFilters,
  InvoiceStatus,
} from '@/types/invoices';
import { InvoiceStatusLabels, InvoiceStatusColors } from '@/types/invoices';
import { DateRangePicker } from '@/components/DateRangePicker';
import { DateRange } from '@/types/dateRange';
import { formatDateSriLankan } from '@/utils/dateUtils';

export default function InvoicesPage() {
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
    onInitializationComplete: () => console.log('[InvoicesPage] Page initialized successfully'),
    onError: (error) => console.warn('[InvoicesPage] Initialization error:', error),
  });

  // Component-specific states
  const [invoices, setInvoices] = useState<SalesInvoiceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [filters] = useState<InvoiceFilters>({});
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: null, endDate: null });
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | ''>('');

  // Sorting state
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const invoiceListCacheRef = useRef<Map<string, InvoiceListResponse>>(new Map());

  // Row highlight state for newly created invoice
  const { highlightedRowId, setHighlight } = useRowHighlight({ duration: 2500 });

  // Row height calibration for development
  useRowHeightCalibration(tableRef as React.RefObject<HTMLElement>);

  // Debounce search input to avoid fetching on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const cacheInvoiceList = useCallback((cacheKey: string, data: InvoiceListResponse) => {
    const cache = invoiceListCacheRef.current;

    if (!cache.has(cacheKey) && cache.size >= 10) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey) {
        cache.delete(oldestKey);
      }
    }

    cache.set(cacheKey, data);
  }, []);

  const buildInvoiceParams = useCallback(
    (pageOverride?: number) => {
      const params: Record<string, string> = {
        page: (pageOverride ?? currentPage).toString(),
        page_size: calculatedRowsPerPage.toString(),
      };

      // Add sorting
      if (sortField) {
        // Map frontend column keys to backend field names if different
        const fieldMapping: { [key: string]: string } = {
          invoice_number: 'invoice_number',
          invoice_date: 'invoice_date',
          customer_name: 'customer__name',
          created_by_name: 'created_date', // Sort by date for prepared by fallback
          net_total: 'net_total',
          balance_due: 'balance_due',
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

      if (debouncedSearchQuery) {
        params.search = debouncedSearchQuery;
      }

      // Add status filter
      if (statusFilter) {
        params.status = statusFilter;
      }

      // Add date range filters
      if (dateRange.startDate) {
        params.invoice_date__gte = dateRange.startDate.toISOString().split('T')[0];
      }
      if (dateRange.endDate) {
        params.invoice_date__lte = dateRange.endDate.toISOString().split('T')[0];
      }

      return params;
    },
    [
      currentPage,
      calculatedRowsPerPage,
      sortField,
      sortDirection,
      filters,
      debouncedSearchQuery,
      statusFilter,
      dateRange,
    ],
  );

  // Restore navigation state on component mount
  useEffect(() => {
    const savedState = getListState('invoices');
    if (savedState) {
      console.log('[InvoicesPage] Restoring saved navigation state:', savedState);
      setCurrentPage(savedState.currentPage);
      setSearchQuery(savedState.searchQuery);
      setDebouncedSearchQuery(savedState.searchQuery);
      if (savedState.dateRange) {
        setDateRange(savedState.dateRange);
      }
      clearListState('invoices');
    }
  }, [getListState, clearListState]);

  // Detect newly created or updated invoice and highlight it
  useEffect(() => {
    const newlyInvoiceId = sessionStorage.getItem('newlyInvoiceId');
    if (newlyInvoiceId) {
      console.log('[InvoicesPage] Found newly created invoice ID:', newlyInvoiceId);
      setHighlight(parseInt(newlyInvoiceId, 10));
      sessionStorage.removeItem('newlyInvoiceId');
    }

    const updatedInvoiceId = sessionStorage.getItem('updatedInvoiceId');
    if (updatedInvoiceId) {
      console.log('[InvoicesPage] Found updated invoice ID:', updatedInvoiceId);
      setHighlight(parseInt(updatedInvoiceId, 10));
      sessionStorage.removeItem('updatedInvoiceId');
    }
  }, [setHighlight]);

  // Define columns for the DataTable
  const columns: DataTableColumn[] = [
    { key: 'invoice_number', label: 'Invoice #', sortable: true },
    { key: 'invoice_date', label: 'Date', sortable: true },
    { key: 'customer_name', label: 'Customer', sortable: true },
    { key: 'created_by_name', label: 'Prepared By', sortable: true },
    { key: 'status', label: 'Status', sortable: false, align: 'center' },
    { key: 'net_total', label: 'Total', sortable: true, align: 'right' },
    { key: 'balance_due', label: 'Balance', sortable: true, align: 'right' },
  ];

  // Fetch invoices data
  const fetchInvoices = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      setLoading(true);
      setError(null);

      const params = buildInvoiceParams();
      const cacheKey = JSON.stringify(params);
      const cached = invoiceListCacheRef.current.get(cacheKey);

      if (cached) {
        setInvoices(cached.results);
        setTotalRecords(cached.count);
        setTotalPages(Math.ceil(cached.count / calculatedRowsPerPage));
        return;
      }

      console.log('[InvoicesPage] Fetching invoices with params:', params);

      const response = await invoicesAPI.getInvoices(params);
      const data: InvoiceListResponse = response.data;

      console.log('[InvoicesPage] Fetched invoices:', data);

      cacheInvoiceList(cacheKey, data);
      setInvoices(data.results);
      setTotalRecords(data.count);
      setTotalPages(Math.ceil(data.count / calculatedRowsPerPage));
    } catch (err) {
      console.error('[InvoicesPage] Error fetching invoices:', err);
      const errorMsg = getErrorMessage(err as any);
      setError(errorMsg);
      toast.error(`Failed to load invoices: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, calculatedRowsPerPage, buildInvoiceParams, cacheInvoiceList]);

  // Fetch invoices when dependencies change
  useEffect(() => {
    if (pageReady && isAuthenticated) {
      fetchInvoices();
    }
  }, [pageReady, isAuthenticated, fetchInvoices]);

  const prefetchInvoices = useCallback(
    async (pageNumber: number) => {
      if (!isAuthenticated || !pageReady) return;

      const params = buildInvoiceParams(pageNumber);
      const cacheKey = JSON.stringify(params);
      if (invoiceListCacheRef.current.has(cacheKey)) return;

      try {
        const response = await invoicesAPI.getInvoices(params);
        cacheInvoiceList(cacheKey, response.data);
      } catch (err) {
        console.warn('[InvoicesPage] Prefetch failed:', err);
      }
    },
    [isAuthenticated, pageReady, buildInvoiceParams, cacheInvoiceList],
  );

  // Prefetch adjacent pages to reduce latency on pagination
  useEffect(() => {
    if (!pageReady || !isAuthenticated) return;

    const nextPage = currentPage + 1;
    const prevPage = currentPage - 1;

    if (nextPage <= totalPages) {
      prefetchInvoices(nextPage);
    }
    if (prevPage >= 1) {
      prefetchInvoices(prevPage);
    }
  }, [pageReady, isAuthenticated, currentPage, totalPages, prefetchInvoices]);

  // Handle row click - navigate to invoice detail
  const handleRowClick = (invoice: SalesInvoiceListItem) => {
    // Save current list state before navigation
    saveListState('invoices', {
      currentPage,
      searchQuery,
      dateRange,
    });

    console.log('[InvoicesPage] Navigating to invoice detail:', invoice.id);
    router.push(`/dashboard/sales/invoices/${invoice.id}`);
  };

  // Handle create new invoice
  const handleCreateInvoice = () => {
    router.push('/dashboard/sales/invoices/new');
  };

  // Handle view invoice
  const handleViewInvoice = (invoiceId: number) => {
    saveListState('invoices', {
      currentPage,
      searchQuery,
      dateRange,
    });
    router.push(`/dashboard/sales/invoices/${invoiceId}`);
  };

  // Handle edit invoice
  const handleEditInvoice = (invoiceId: number) => {
    saveListState('invoices', {
      currentPage,
      searchQuery,
      dateRange,
    });
    router.push(`/dashboard/sales/invoices/${invoiceId}/edit`);
  };

  // Handle record payment
  const handleRecordPayment = (invoiceId: number) => {
    saveListState('invoices', {
      currentPage,
      searchQuery,
      dateRange,
    });
    router.push(`/dashboard/sales/invoices/${invoiceId}?recordPayment=true`);
  };

  // Handle email invoice
  const handleEmailInvoice = async (invoiceId: number) => {
    try {
      await invoicesAPI.sendInvoiceEmail(invoiceId);
      toast.success('Invoice email sent successfully');
      await fetchInvoices();
    } catch (err) {
      console.error('[InvoicesPage] Error sending email:', err);
      const errorMsg = getErrorMessage(err as any);
      toast.error(`Failed to send invoice email: ${errorMsg}`);
    }
  };

  // Handle PDF download
  const handleDownloadPDF = async (invoiceId: number, invoiceNumber: string) => {
    try {
      const response = await invoicesAPI.getInvoicePDF(invoiceId);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice-${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded successfully');
    } catch (err) {
      console.error('[InvoicesPage] Error downloading PDF:', err);
      const errorMsg = getErrorMessage(err as any);
      toast.error(`Failed to download PDF: ${errorMsg}`);
    }
  };

  // Handle print invoice
  const handlePrintInvoice = async (invoiceId: number) => {
    try {
      await invoicesAPI.printInvoice(invoiceId);
      toast.success('Print job created successfully');
    } catch (err) {
      console.error('[InvoicesPage] Error printing invoice:', err);
      const errorMsg = getErrorMessage(err as any);
      toast.error(`Failed to create print job: ${errorMsg}`);
    }
  };

  // Render status badge
  const renderStatusBadge = (status: InvoiceStatus) => {
    const color = InvoiceStatusColors[status];
    const label = InvoiceStatusLabels[status];

    return (
      <Badge color={color} className="justify-center">
        {label}
      </Badge>
    );
  };

  // Actions dropdown for each row
  const renderActions = (row: SalesInvoiceListItem) => (
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
      <Dropdown.Item onClick={() => handleViewInvoice(row.id)}>
        <HiEye className="w-4 h-4 mr-2" />
        View Details
      </Dropdown.Item>
      <Dropdown.Item onClick={() => handleEditInvoice(row.id)}>
        <HiPencil className="w-4 h-4 mr-2" />
        Edit Invoice
      </Dropdown.Item>
      <Dropdown.Item onClick={() => handleRecordPayment(row.id)}>
        <HiCurrencyDollar className="w-4 h-4 mr-2" />
        Record Payment
      </Dropdown.Item>
      <Dropdown.Divider />
      <Dropdown.Item onClick={() => handleDownloadPDF(row.id, row.invoice_number)}>
        Download PDF
      </Dropdown.Item>
      <Dropdown.Item onClick={() => handleEmailInvoice(row.id)}>
        <HiMail className="w-4 h-4 mr-2" />
        Email Invoice
      </Dropdown.Item>
      <Dropdown.Item onClick={() => handlePrintInvoice(row.id)}>
        <HiPrinter className="w-4 h-4 mr-2" />
        Print Invoice
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
    return invoices.map((invoice) => ({
      ...invoice,
      invoice_date: invoice.invoice_date ? formatDateSriLankan(invoice.invoice_date) : '-',
      customer_name: invoice.customer_name || '-',
      created_by_name: invoice.created_by_name || '-',
      net_total: new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'LKR',
        minimumFractionDigits: 2,
      })
        .format(parseFloat(invoice.net_total as unknown as string))
        .replace('LKR', 'Rs. '),
      balance_due: (
        <span
          className={
            parseFloat(invoice.balance_due as unknown as string) > 0
              ? 'text-red-600 font-medium'
              : 'text-green-600'
          }
        >
          {new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'LKR',
            minimumFractionDigits: 2,
          })
            .format(parseFloat(invoice.balance_due as unknown as string))
            .replace('LKR', 'Rs. ')}
        </span>
      ),
      status: (
        <div className="flex justify-center items-center min-w-[80px]">
          {renderStatusBadge(invoice.status)}
        </div>
      ),
    }));
  }, [invoices]);

  return (
    <DashboardLayout>
      <div className="p-2">
        <div ref={topNavRef} />
        <div ref={titleRef} className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Sales Invoices</h1>
        </div>

        {/* List Interface */}
        <div className="space-y-3">
          {/* Filter/Search Bar Card - responsive layout with smaller components */}
          <div
            ref={filterBarRef}
            className="bg-white dark:bg-gray-800 shadow rounded-lg p-2 mb-1 flex flex-wrap items-center justify-between gap-2 sm:gap-4"
          >
            {/* New Invoice Button */}
            <Button onClick={handleCreateInvoice} size="sm">
              <HiPlus className="mr-2 h-4 w-4" />
              Create Invoice
            </Button>

            {/* Filter controls: search, status, date range, context menu */}
            <div className="flex flex-wrap gap-2 sm:gap-4 items-center">
              {/* Search box */}
              <StandardTextInput
                type="text"
                placeholder="Search invoices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-48 md:w-64"
                sizing="sm"
              />

              {/* Status Filter */}
              <Select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | '')}
                sizing="sm"
                className="w-40"
              >
                <option value="">All Status</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="void">Void</option>
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
                <Dropdown.Item onClick={() => fetchInvoices()}>Refresh</Dropdown.Item>
              </Dropdown>
            </div>
          </div>

          {/* Error Banner */}
          {(error || pageError) && (
            <ErrorBanner
              title="Unable to load invoices"
              error={error || pageError || ''}
              onRetry={() => fetchInvoices()}
              onDismiss={() => {
                setError(null);
              }}
            />
          )}

          {/* Table Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div ref={tableRef} className="overflow-x-auto">
              <DataTable
                title="Sales Invoices"
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
