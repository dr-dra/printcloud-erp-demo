'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Dropdown, Badge } from 'flowbite-react';
import { StandardTextInput } from '@/components/common/inputs';
import { HiPlus, HiDotsVertical, HiEye, HiPencil, HiTrash } from 'react-icons/hi';
import DashboardLayout from '@/components/DashboardLayout';
import DataTable from '@/components/common/DataTable';
import type { DataTableColumn } from '@/types/datatable';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { usePageInitialization } from '@/hooks/usePageInitialization';
import { getErrorMessage } from '@/utils/errorHandling';
import ErrorBanner from '@/components/common/ErrorBanner';
import { useRowHeightCalibration } from '@/utils/rowHeightCalibration';
import { toast } from 'sonner';
import { useNavigationState } from '@/hooks/useNavigationState';
import { useRowHighlight } from '@/hooks/useRowHighlight';
import type {
  SalesQuotationListItem,
  QuotationListResponse,
  QuotationFilters,
} from '@/types/quotations';
import { DateRangePicker } from '@/components/DateRangePicker';
import { DateRange } from '@/types/dateRange';
import { formatDateSriLankan } from '@/utils/dateUtils';

export default function QuotationsPage() {
  const router = useRouter();

  // Navigation state management
  const { saveListState, getListState, clearListState } = useNavigationState();

  // Use the page initialization hook
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
    rowHeight: 24, // Compact: py-1.5 (12px total) + text-sm + borders ≈ 24px
    minRows: 5,
    maxRows: 40,
    onInitializationComplete: () => console.log('[QuotationsPage] Page initialized successfully'),
    onError: (error) => console.warn('[QuotationsPage] Initialization error:', error),
  });

  // Component-specific states
  const [quotations, setQuotations] = useState<SalesQuotationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { loading: authLoading, isAuthenticated } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters] = useState<QuotationFilters>({});
  // Add date range state for filtering
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: null, endDate: null });

  // Row highlight state for newly created quotation
  const { highlightedRowId, setHighlight } = useRowHighlight({ duration: 2500 });

  // Row height calibration for development
  useRowHeightCalibration(tableRef as React.RefObject<HTMLElement>);

  // Restore navigation state on component mount
  useEffect(() => {
    const savedState = getListState('quotations');
    if (savedState) {
      console.log('[QuotationsPage] Restoring saved navigation state:', savedState);
      setCurrentPage(savedState.currentPage);
      setSearchQuery(savedState.searchQuery);
      if (savedState.dateRange) {
        setDateRange(savedState.dateRange);
      }
      // Clear the state after restoration so it's only used once
      clearListState('quotations');
    }
  }, [getListState, clearListState]);

  // Detect newly created or updated quotation and highlight it
  useEffect(() => {
    // Check for newly created quotation
    const newlyQuotationId = sessionStorage.getItem('newlyQuotationId');
    if (newlyQuotationId) {
      console.log('[QuotationsPage] Found newly created quotation ID:', newlyQuotationId);
      setHighlight(parseInt(newlyQuotationId, 10));
      sessionStorage.removeItem('newlyQuotationId');
    }

    // Check for updated quotation
    const updatedQuotationId = sessionStorage.getItem('updatedQuotationId');
    if (updatedQuotationId) {
      console.log('[QuotationsPage] Found updated quotation ID:', updatedQuotationId);
      setHighlight(parseInt(updatedQuotationId, 10));
      sessionStorage.removeItem('updatedQuotationId');
    }
  }, [setHighlight]);

  // Define columns for the DataTable
  const columns: DataTableColumn[] = [
    { key: 'quot_number', label: 'Quotation #', sortable: true },
    { key: 'date', label: 'Issued Date', sortable: true },
    { key: 'required_date', label: 'Expiry Date', sortable: true },
    { key: 'customer_name', label: 'Customer', sortable: true },
    // Right-align total column header and cell for currency
    { key: 'total', label: 'Total', sortable: true, align: 'right' },
    { key: 'status', label: 'Status', sortable: false, align: 'center' },
  ];

  // Fetch quotations data
  const fetchQuotations = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append('page', currentPage.toString());
      params.append('page_size', calculatedRowsPerPage.toString());

      // Add filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, value.toString());
        }
      });

      if (searchQuery) {
        params.append('search', searchQuery);
      }

      // Add date range filters (use correct keys for issued date)
      if (dateRange.startDate) {
        params.append('date__gte', dateRange.startDate.toISOString().split('T')[0]);
      }
      if (dateRange.endDate) {
        params.append('date__lte', dateRange.endDate.toISOString().split('T')[0]);
      }

      const response = await api.get<QuotationListResponse>(`/sales/quotations/?${params}`);

      setQuotations(response.data.results);
      setTotalRecords(response.data.count);
      setTotalPages(Math.ceil(response.data.count / calculatedRowsPerPage));
    } catch (err) {
      const errorMessage = getErrorMessage(err as any);
      setError(errorMessage);
      console.error('Error fetching quotations:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, currentPage, calculatedRowsPerPage, searchQuery, filters, dateRange]);

  // Effect to fetch quotations when dependencies change
  useEffect(() => {
    if (pageReady && isAuthenticated && !authLoading) {
      fetchQuotations();
    }
  }, [pageReady, isAuthenticated, authLoading, fetchQuotations]);

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Handle rows per page change
  const handleRowsPerPageChange = (value: number | 'auto') => {
    setRowsPerPage(value);
    setCurrentPage(1); // Reset to first page
  };

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1); // Reset to first page when searching
  };

  // Handle retry
  const handleRetry = () => {
    fetchQuotations();
  };

  // Action handlers
  const handleActionClick = (action: string, quotationId: number) => {
    switch (action) {
      case 'view':
        // Save current pagination state before navigation
        saveListState('quotations', {
          currentPage,
          searchQuery,
          dateRange,
          pageSize: calculatedRowsPerPage,
        });
        router.push(`/dashboard/sales/quotations/${quotationId}`);
        break;
      case 'edit':
        // Save current pagination state before navigation
        saveListState('quotations', {
          currentPage,
          searchQuery,
          dateRange,
          pageSize: calculatedRowsPerPage,
        });
        router.push(`/dashboard/sales/quotations/${quotationId}/edit`);
        break;
      case 'delete':
        // Implement delete functionality
        toast.error('Delete functionality not implemented yet');
        break;
      default:
        console.log(`${action} action for quotation ${quotationId}`);
    }
  };

  const handleRowClick = (quotation: SalesQuotationListItem) => {
    // Save current pagination state before navigation
    saveListState('quotations', {
      currentPage,
      searchQuery,
      dateRange,
      pageSize: calculatedRowsPerPage,
    });

    // Navigate to quotation view page when row is clicked
    router.push(`/dashboard/sales/quotations/${quotation.id}`);
  };

  // Format currency as Sri Lankan Rupees
  const formatCurrency = (amount: number) => {
    // Format with Rs. and thousand separators
    return `Rs. ${amount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Format date using Sri Lankan standard (DD/MM/YYYY)
  const formatDate = (dateString?: string) => {
    return formatDateSriLankan(dateString);
  };

  // Render status badge
  const renderStatus = (quotation: SalesQuotationListItem) => {
    if (!quotation.is_active) {
      return <Badge color="gray">Inactive</Badge>;
    }
    if (quotation.finalized) {
      return <Badge color="success">Finalized</Badge>;
    }
    // Use Flowbite Badge for Draft status
    return <Badge color="warning">Draft</Badge>;
  };

  // Actions dropdown for each row
  const renderActions = (row: SalesQuotationListItem) => (
    <Dropdown
      label=""
      dismissOnClick={false}
      renderTrigger={() => (
        <button
          type="button"
          className="inline-flex items-center p-2 text-sm font-medium text-center text-gray-900 bg-white rounded-lg hover:bg-gray-100 focus:ring-4 focus:outline-none dark:text-white focus:ring-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-600"
        >
          <HiDotsVertical className="w-4 h-4" />
        </button>
      )}
    >
      <Dropdown.Item onClick={() => handleActionClick('view', row.id)}>
        <HiEye className="w-4 h-4 mr-2" />
        View Quotation
      </Dropdown.Item>
      <Dropdown.Item onClick={() => handleActionClick('edit', row.id)}>
        <HiPencil className="w-4 h-4 mr-2" />
        Edit Quotation
      </Dropdown.Item>
      <Dropdown.Divider />
      <Dropdown.Item onClick={() => handleActionClick('delete', row.id)}>
        <HiTrash className="w-4 h-4 mr-2" />
        Delete Quotation
      </Dropdown.Item>
    </Dropdown>
  );

  // Process data for display
  const processedData = quotations.map((quotation) => ({
    ...quotation,
    customer_name: quotation.customer_name || 'No Customer',
    date: formatDate(quotation.date),
    required_date: formatDate(quotation.required_date),
    total: formatCurrency(quotation.total),
    // Center the badge and make the cell compact
    status: (
      <div className="flex justify-center items-center min-w-[80px]">{renderStatus(quotation)}</div>
    ),
  }));

  return (
    <DashboardLayout>
      <div className="p-2">
        <div ref={topNavRef} />
        <div ref={titleRef} className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Quotations</h1>
        </div>

        {/* List Interface */}
        <div className="space-y-3">
          {/* Filter/Search Bar Card - responsive layout with smaller components */}
          <div
            ref={filterBarRef}
            className="bg-white dark:bg-gray-800 shadow rounded-lg p-2 mb-1 flex flex-wrap items-center justify-between gap-2 sm:gap-4"
          >
            {/* New Quotation Button */}
            <Button onClick={() => router.push('/dashboard/sales/quotations/new')} size="sm">
              <HiPlus className="mr-2 h-4 w-4" />
              New Quotation
            </Button>
            {/* Filter controls: search, date range, context menu */}
            <div className="flex flex-wrap gap-2 sm:gap-4 items-center">
              {/* Search box */}
              <StandardTextInput
                type="text"
                placeholder="Search quotations..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full sm:w-48 md:w-64"
                sizing="sm"
              />
              {/* Date range picker for start/end date */}
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
                    className="inline-flex items-center p-1.5 text-sm font-medium text-center text-gray-900 bg-white rounded-lg hover:bg-gray-100 focus:ring-4 focus:outline-none dark:text-white focus:ring-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-600"
                  >
                    <HiDotsVertical className="w-4 h-4" />
                  </button>
                )}
              >
                <Dropdown.Item disabled>Export as CSV (coming soon)</Dropdown.Item>
                <Dropdown.Item disabled>Bulk Actions (coming soon)</Dropdown.Item>
              </Dropdown>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <ErrorBanner
              title="Unable to load quotations"
              error={error}
              onRetry={handleRetry}
              onDismiss={() => setError(null)}
            />
          )}

          {/* Table Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div ref={tableRef} className="overflow-x-auto">
              <DataTable
                title="Quotations"
                data={processedData || []}
                columns={columns}
                loading={loading}
                actions={renderActions}
                onRowClick={handleRowClick}
                highlightedRowId={highlightedRowId}
                idColumn="id"
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
