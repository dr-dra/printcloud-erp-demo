'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useState } from 'react';
import { Button, Dropdown } from 'flowbite-react';
import { HiPlus, HiDotsVertical } from 'react-icons/hi';
import DashboardLayout from '@/components/DashboardLayout';
import { StandardTextInput } from '@/components/common/inputs';
import DataTable from '@/components/common/DataTable';
import type { DataTableColumn } from '@/types/datatable';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { usePageInitialization } from '@/hooks/usePageInitialization';
import ErrorBanner from '@/components/common/ErrorBanner';
import { getErrorMessage } from '@/utils/errorHandling';
import InventoryGinModal from '@/components/inventory/InventoryGinModal';
import type { InvGin, InvGinListResponse } from '@/types/inventory';

export default function InventoryGinsPage() {
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

  const [gins, setGins] = useState<InvGin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);

  const fetchGins = useCallback(async () => {
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

      const response = await api.get(`/inventory/gins/?${params.toString()}`);
      const data: InvGinListResponse = response.data;

      setGins(data.results);
      setTotalPages(Math.ceil(data.count / pageSize));
      setTotalRecords(data.count);
    } catch (err: any) {
      console.error('Error fetching GINs:', err);
      const errorMessage = getErrorMessage(err, 'Failed to load GINs.');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [currentPage, calculatedRowsPerPage, searchQuery, pageReady]);

  useEffect(() => {
    if (pageReady && !authLoading) {
      fetchGins();
    }
  }, [fetchGins, pageReady, authLoading]);

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
    fetchGins();
  };

  const handleIssue = async (ginId: number) => {
    if (!confirm('Issue stock for this GIN?')) return;
    try {
      await api.post(`/inventory/gins/${ginId}/issue/`);
      fetchGins();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to issue GIN.'));
    }
  };

  const columns: DataTableColumn[] = [
    { key: 'gin_number', label: 'GIN', sortable: true },
    { key: 'prn_number', label: 'PRN', sortable: true },
    { key: 'cost_center', label: 'Cost Center', sortable: true },
    { key: 'issue_date', label: 'Issue Date', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
  ];

  const renderActions = (row: InvGin) => (
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
      {row.status === 'draft' && (
        <Dropdown.Item onClick={() => handleIssue(row.id)}>Issue Stock</Dropdown.Item>
      )}
    </Dropdown>
  );

  return (
    <DashboardLayout>
      <div className="p-2">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Inventory - Goods Issue Notes
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
            New GIN
          </Button>
          <div className="flex flex-wrap gap-2 sm:gap-4 items-center">
            <StandardTextInput
              type="text"
              placeholder="Search GINs..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full sm:w-48 md:w-64"
              sizing="sm"
            />
          </div>
        </div>

        {error && (
          <ErrorBanner
            title="Unable to load GINs"
            error={error}
            onRetry={handleRetry}
            onDismiss={() => setError(null)}
          />
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div ref={tableRef} className="overflow-x-auto">
            <DataTable
              title="Goods Issue Notes"
              data={gins}
              columns={columns}
              loading={loading}
              actions={renderActions}
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
        <InventoryGinModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            fetchGins();
          }}
        />
      )}
    </DashboardLayout>
  );
}
