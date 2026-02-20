'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Dropdown, Badge } from 'flowbite-react';
import type { BadgeProps } from 'flowbite-react';
import { StandardTextInput } from '@/components/common/inputs';
import { HiPlus, HiDotsVertical, HiEye, HiTrash, HiDownload } from 'react-icons/hi';
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
import { DateRangePicker } from '@/components/DateRangePicker';
import { DateRange } from '@/types/dateRange';
import { formatDateSriLankan } from '@/utils/dateUtils';

type CreditNote = {
  id: number;
  credit_note_number: string;
  credit_note_type: string;
  customer_name: string;
  amount: string;
  status: string;
  credit_note_date: string;
  reason?: string;
  detail_note?: string;
  payout_method?: string | null;
  payout_voucher_number?: string | null;
  payout_cheque_number?: string | null;
  customer_bank_name?: string | null;
  customer_bank_account_name?: string | null;
  customer_bank_account_number?: string | null;
};

type CreditNoteListResponse = {
  count: number;
  results: CreditNote[];
};

export default function CreditNotesPage() {
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
    onInitializationComplete: () => console.log('[CreditNotesPage] Page initialized successfully'),
    onError: (error) => console.warn('[CreditNotesPage] Initialization error:', error),
  });

  // Component-specific states
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { loading: authLoading, isAuthenticated } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: null, endDate: null });
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  // Row highlight state for newly created credit note
  const { highlightedRowId, setHighlight } = useRowHighlight({ duration: 2500 });

  // Row height calibration for development
  useRowHeightCalibration(tableRef as React.RefObject<HTMLElement>);

  // Restore navigation state on component mount
  useEffect(() => {
    const savedState = getListState('credit-notes');
    if (savedState) {
      console.log('[CreditNotesPage] Restoring saved navigation state:', savedState);
      setCurrentPage(savedState.currentPage);
      setSearchQuery(savedState.searchQuery);
      if (savedState.dateRange) {
        setDateRange(savedState.dateRange);
      }
      clearListState('credit-notes');
    }
  }, [getListState, clearListState]);

  // Detect newly created or updated credit note and highlight it
  useEffect(() => {
    const newlyCreditNoteId = sessionStorage.getItem('newlyCreditNoteId');
    if (newlyCreditNoteId) {
      console.log('[CreditNotesPage] Found newly created credit note ID:', newlyCreditNoteId);
      setHighlight(parseInt(newlyCreditNoteId, 10));
      sessionStorage.removeItem('newlyCreditNoteId');
    }

    const updatedCreditNoteId = sessionStorage.getItem('updatedCreditNoteId');
    if (updatedCreditNoteId) {
      console.log('[CreditNotesPage] Found updated credit note ID:', updatedCreditNoteId);
      setHighlight(parseInt(updatedCreditNoteId, 10));
      sessionStorage.removeItem('updatedCreditNoteId');
    }
  }, [setHighlight]);

  // Define columns for the DataTable
  const columns: DataTableColumn[] = [
    { key: 'credit_note_number', label: 'Credit Note #', sortable: true },
    { key: 'customer_name', label: 'Customer', sortable: true },
    { key: 'credit_note_date', label: 'Date', sortable: true },
    { key: 'amount', label: 'Amount', sortable: true, align: 'right' },
    { key: 'credit_note_type', label: 'Type', sortable: true, align: 'center' },
    { key: 'status', label: 'Status', sortable: true, align: 'center' },
  ];

  // Fetch credit notes data
  const fetchCreditNotes = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append('page', currentPage.toString());
      params.append('page_size', calculatedRowsPerPage.toString());

      if (searchQuery) {
        params.append('search', searchQuery);
      }

      if (statusFilter) {
        params.append('status', statusFilter);
      }

      // Add date range filters
      if (dateRange.startDate) {
        params.append('credit_note_date__gte', dateRange.startDate.toISOString().split('T')[0]);
      }
      if (dateRange.endDate) {
        params.append('credit_note_date__lte', dateRange.endDate.toISOString().split('T')[0]);
      }

      const response = await api.get<CreditNoteListResponse>(
        `/sales/invoices/credit-notes/?${params}`,
      );

      const notes = Array.isArray(response.data) ? response.data : response.data?.results || [];
      const count = Array.isArray(response.data) ? response.data.length : response.data?.count || 0;

      setCreditNotes(notes);
      setTotalRecords(count);
      setTotalPages(Math.ceil(count / calculatedRowsPerPage));
    } catch (err) {
      const errorMessage = getErrorMessage(err as any);
      setError(errorMessage);
      console.error('Error fetching credit notes:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, currentPage, calculatedRowsPerPage, searchQuery, statusFilter, dateRange]);

  // Effect to fetch credit notes when dependencies change
  useEffect(() => {
    if (pageReady && isAuthenticated && !authLoading) {
      fetchCreditNotes();
    }
  }, [pageReady, isAuthenticated, authLoading, fetchCreditNotes]);

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Handle rows per page change
  const handleRowsPerPageChange = (value: number | 'auto') => {
    setRowsPerPage(value);
    setCurrentPage(1);
  };

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  // Handle retry
  const handleRetry = () => {
    fetchCreditNotes();
  };

  // Handle PDF download
  const handleDownloadPDF = async (note: CreditNote) => {
    try {
      const resp = await api.get(`/sales/invoices/credit-notes/${note.id}/pdf/`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(resp.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `CreditNote-${note.credit_note_number}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded successfully');
    } catch (err) {
      toast.error('Failed to download PDF');
      console.error('Error downloading PDF:', err);
    }
  };

  // Action handlers
  const handleActionClick = (action: string, creditNoteId: number) => {
    const note = creditNotes.find((n) => n.id === creditNoteId);
    if (!note) return;

    switch (action) {
      case 'view':
        saveListState('credit-notes', {
          currentPage,
          searchQuery,
          dateRange,
          pageSize: calculatedRowsPerPage,
        });
        router.push(`/dashboard/accounting/credit-notes/${creditNoteId}`);
        break;
      case 'download':
        handleDownloadPDF(note);
        break;
      case 'delete':
        toast.error('Delete functionality not implemented yet');
        break;
      default:
        console.log(`${action} action for credit note ${creditNoteId}`);
    }
  };

  const handleRowClick = (creditNote: CreditNote) => {
    saveListState('credit-notes', {
      currentPage,
      searchQuery,
      dateRange,
      pageSize: calculatedRowsPerPage,
    });
    router.push(`/dashboard/accounting/credit-notes/${creditNote.id}`);
  };

  // Format currency as Sri Lankan Rupees
  const formatCurrency = (amount: string) => {
    const numAmount = parseFloat(amount);
    return `Rs. ${numAmount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Format date using Sri Lankan standard (DD/MM/YYYY)
  const formatDate = (dateString?: string) => {
    return formatDateSriLankan(dateString);
  };

  // Render type badge
  const renderTypeBadge = (type: string) => {
    const typeColors: Record<string, BadgeProps['color']> = {
      refund: 'purple',
      product_return: 'info',
      adjustment: 'warning',
      discount: 'success',
    };
    const badgeColor = typeColors[type] ?? 'gray';
    return <Badge color={badgeColor}>{type.replace('_', ' ').toUpperCase()}</Badge>;
  };

  // Render status badge
  const renderStatusBadge = (status: string) => {
    const statusColors: Record<string, BadgeProps['color']> = {
      draft: 'gray',
      pending: 'warning',
      approved: 'success',
      paid: 'info',
      void: 'failure',
    };
    const badgeColor = statusColors[status.toLowerCase()] ?? 'gray';
    return <Badge color={badgeColor}>{status.toUpperCase()}</Badge>;
  };

  // Actions dropdown for each row
  const renderActions = (row: CreditNote) => (
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
        View Details
      </Dropdown.Item>
      <Dropdown.Item onClick={() => handleActionClick('download', row.id)}>
        <HiDownload className="w-4 h-4 mr-2" />
        Download PDF
      </Dropdown.Item>
      <Dropdown.Divider />
      <Dropdown.Item onClick={() => handleActionClick('delete', row.id)}>
        <HiTrash className="w-4 h-4 mr-2" />
        Delete Credit Note
      </Dropdown.Item>
    </Dropdown>
  );

  // Process data for display
  const processedData = creditNotes.map((note) => ({
    ...note,
    customer_name: note.customer_name || 'No Customer',
    credit_note_date: formatDate(note.credit_note_date),
    amount: formatCurrency(note.amount),
    credit_note_type: (
      <div className="flex justify-center items-center min-w-[100px]">
        {renderTypeBadge(note.credit_note_type)}
      </div>
    ),
    status: (
      <div className="flex justify-center items-center min-w-[80px]">
        {renderStatusBadge(note.status)}
      </div>
    ),
  }));

  return (
    <DashboardLayout>
      <div className="p-2">
        <div ref={topNavRef} />
        <div ref={titleRef} className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Credit Notes</h1>
        </div>

        {/* List Interface */}
        <div className="space-y-3">
          {/* Filter/Search Bar Card - responsive layout with smaller components */}
          <div
            ref={filterBarRef}
            className="bg-white dark:bg-gray-800 shadow rounded-lg p-2 mb-1 flex flex-wrap items-center justify-between gap-2 sm:gap-4"
          >
            {/* New Credit Note Button */}
            <Button onClick={() => router.push('/dashboard/accounting/credit-notes/new')} size="sm">
              <HiPlus className="mr-2 h-4 w-4" />
              New Credit Note
            </Button>

            {/* Filter controls: search, status filter, date range, context menu */}
            <div className="flex flex-wrap gap-2 sm:gap-4 items-center">
              {/* Search box */}
              <StandardTextInput
                type="text"
                placeholder="Search credit notes..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full sm:w-48 md:w-64"
                sizing="sm"
              />

              {/* Status filter buttons */}
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-800">
                {['All', 'Draft', 'Pending', 'Approved'].map((label) => {
                  const filterValue = label === 'All' ? undefined : label.toLowerCase();
                  const isActive = statusFilter === filterValue;
                  return (
                    <button
                      key={label}
                      onClick={() => setStatusFilter(filterValue)}
                      className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-primary-600 text-white'
                          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

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
              title="Unable to load credit notes"
              error={error}
              onRetry={handleRetry}
              onDismiss={() => setError(null)}
            />
          )}

          {/* Table Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div ref={tableRef} className="overflow-x-auto">
              <DataTable
                title="Credit Notes"
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
