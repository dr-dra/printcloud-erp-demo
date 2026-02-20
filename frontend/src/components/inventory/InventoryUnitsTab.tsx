'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useCallback } from 'react';
import { Button, Dropdown } from 'flowbite-react';
import { HiPlus, HiDotsVertical } from 'react-icons/hi';
import { StandardTextInput } from '@/components/common/inputs';
import DataTable from '@/components/common/DataTable';
import type { DataTableColumn } from '@/types/datatable';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { usePageInitialization } from '@/hooks/usePageInitialization';
import { getErrorMessage } from '@/utils/errorHandling';
import ErrorBanner from '@/components/common/ErrorBanner';
import type { InvUnitMeasure, InvUnitMeasureListResponse } from '@/types/inventory';
import InventoryUnitModal from './InventoryUnitModal';

export default function InventoryUnitsTab() {
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

  const [units, setUnits] = useState<InvUnitMeasure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedUnit, setSelectedUnit] = useState<InvUnitMeasure | null>(null);

  const fetchUnits = useCallback(async () => {
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

      const response = await api.get(`/inventory/units/?${params.toString()}`);
      const data: InvUnitMeasureListResponse = response.data;

      setUnits(data.results);
      setTotalPages(Math.ceil(data.count / pageSize));
      setTotalRecords(data.count);
    } catch (err: any) {
      console.error('Error fetching units:', err);
      const errorMessage = getErrorMessage(err, 'Failed to load units. Please try again.');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [currentPage, calculatedRowsPerPage, searchQuery, pageReady]);

  useEffect(() => {
    if (pageReady && !authLoading) {
      fetchUnits();
    }
  }, [fetchUnits, pageReady, authLoading]);

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
    fetchUnits();
  };

  const handleCreate = () => {
    setSelectedUnit(null);
    setModalMode('create');
    setShowModal(true);
  };

  const handleRowClick = (unit: InvUnitMeasure) => {
    setSelectedUnit(unit);
    setModalMode('edit');
    setShowModal(true);
  };

  const handleActionClick = (action: string, unitId: number) => {
    const unit = units.find((entry) => entry.id === unitId);
    if (!unit) return;

    setSelectedUnit(unit);

    if (action === 'edit') {
      setModalMode('edit');
      setShowModal(true);
    } else if (action === 'view') {
      setModalMode('view');
      setShowModal(true);
    } else if (action === 'delete') {
      handleDelete(unitId);
    }
  };

  const handleDelete = async (unitId: number) => {
    if (!confirm('Are you sure you want to delete this unit?')) return;

    try {
      await api.delete(`/inventory/units/${unitId}/`);
      fetchUnits();
    } catch (err: any) {
      const errorMessage = getErrorMessage(err, 'Failed to delete unit.');
      setError(errorMessage);
    }
  };

  const handleModalSuccess = () => {
    setShowModal(false);
    fetchUnits();
  };

  const columns: DataTableColumn[] = [
    { key: 'code', label: 'Code', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'symbol', label: 'Symbol', sortable: false },
    { key: 'base_unit_code', label: 'Base', sortable: false },
    { key: 'conversion_factor', label: 'Factor', sortable: false },
    { key: 'is_active', label: 'Active', sortable: false },
  ];

  const renderActions = (row: InvUnitMeasure) => (
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
      <Dropdown.Item onClick={() => handleActionClick('view', row.id)}>View Details</Dropdown.Item>
      <Dropdown.Item onClick={() => handleActionClick('edit', row.id)}>Edit Unit</Dropdown.Item>
      <Dropdown.Item onClick={() => handleActionClick('delete', row.id)}>Delete Unit</Dropdown.Item>
    </Dropdown>
  );

  return (
    <div className="p-4">
      <div ref={topNavRef} />
      <div ref={titleRef} />

      <div
        ref={filterBarRef}
        className="bg-white dark:bg-gray-800 shadow rounded-lg p-2 mb-4 flex flex-wrap items-center justify-between gap-2 sm:gap-4"
      >
        <Button onClick={handleCreate} size="sm">
          <HiPlus className="mr-2 h-4 w-4" />
          New Unit
        </Button>
        <div className="flex flex-wrap gap-2 sm:gap-4 items-center">
          <StandardTextInput
            type="text"
            placeholder="Search units..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full sm:w-48 md:w-64"
            sizing="sm"
          />
        </div>
      </div>

      {error && (
        <ErrorBanner
          title="Unable to load units"
          error={error}
          onRetry={handleRetry}
          onDismiss={() => setError(null)}
        />
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div ref={tableRef} className="overflow-x-auto">
          <DataTable
            title="Units of Measure"
            data={units}
            columns={columns}
            loading={loading}
            actions={renderActions}
            onRowClick={handleRowClick}
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

      {showModal && (
        <InventoryUnitModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSuccess={handleModalSuccess}
          mode={modalMode}
          unit={selectedUnit}
        />
      )}
    </div>
  );
}
