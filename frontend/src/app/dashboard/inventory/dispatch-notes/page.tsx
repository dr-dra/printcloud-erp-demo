'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useState } from 'react';
import { Button } from 'flowbite-react';
import { HiPlus } from 'react-icons/hi';
import DashboardLayout from '@/components/DashboardLayout';
import { StandardTextInput } from '@/components/common/inputs';
import DataTable from '@/components/common/DataTable';
import type { DataTableColumn } from '@/types/datatable';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { usePageInitialization } from '@/hooks/usePageInitialization';
import ErrorBanner from '@/components/common/ErrorBanner';
import { getErrorMessage } from '@/utils/errorHandling';
import InventoryDispatchModal from '@/components/inventory/InventoryDispatchModal';
import type { InvDispatchNote, InvDispatchNoteListResponse } from '@/types/inventory';

export default function InventoryDispatchNotesPage() {
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

  const [dispatchNotes, setDispatchNotes] = useState<InvDispatchNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);

  const fetchDispatchNotes = useCallback(async () => {
    if (!pageReady) return;

    try {
      setLoading(true);
      setError(null);

      const pageSize = calculatedRowsPerPage;
      const params = new URLSearchParams({
        page: currentPage.toString(),
        page_size: pageSize.toString(),
      });

      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const response = await api.get(`/inventory/dispatch-notes/?${params.toString()}`);
      const data: InvDispatchNoteListResponse = response.data;

      setDispatchNotes(data.results);
      setTotalPages(Math.ceil(data.count / pageSize));
      setTotalRecords(data.count);
    } catch (err: any) {
      console.error('Error fetching dispatch notes:', err);
      const errorMessage = getErrorMessage(err, 'Failed to load dispatch notes.');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [currentPage, calculatedRowsPerPage, searchQuery, pageReady]);

  useEffect(() => {
    if (pageReady && !authLoading) {
      fetchDispatchNotes();
    }
  }, [fetchDispatchNotes, pageReady, authLoading]);

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

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleRowsPerPageChange = (value: number | 'auto') => {
    setRowsPerPage(value);
    setCurrentPage(1);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const handleRetry = () => {
    setError(null);
    fetchDispatchNotes();
  };

  const columns: DataTableColumn[] = [
    { key: 'dispatch_number', label: 'Dispatch', sortable: true },
    { key: 'invoice_reference', label: 'Invoice', sortable: true },
    { key: 'job_reference', label: 'Job', sortable: true },
    { key: 'dispatch_date', label: 'Date', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
  ];

  return (
    <DashboardLayout>
      <div className="p-2">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Inventory - Dispatch Notes
          </h1>
        </div>

        <div ref={topNavRef} />
        <div ref={titleRef} />

        <div
          ref={filterBarRef}
          className="bg-white dark:bg-gray-800 shadow rounded-lg p-2 mb-4 flex flex-wrap items-center justify-between gap-2 sm:gap-4"
        >
          <Button size="sm" onClick={() => setShowModal(true)}>
            <HiPlus className="mr-2 h-4 w-4" />
            New Dispatch
          </Button>
          <div className="flex flex-wrap gap-2 sm:gap-4 items-center">
            <StandardTextInput
              type="text"
              placeholder="Search dispatch notes..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full sm:w-48 md:w-64"
              sizing="sm"
            />
          </div>
        </div>

        {error && (
          <ErrorBanner
            title="Unable to load dispatch notes"
            error={error}
            onRetry={handleRetry}
            onDismiss={() => setError(null)}
          />
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div ref={tableRef} className="overflow-x-auto">
            <DataTable
              title="Dispatch Notes"
              data={dispatchNotes}
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

      {showModal && (
        <InventoryDispatchModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            fetchDispatchNotes();
          }}
        />
      )}
    </DashboardLayout>
  );
}
