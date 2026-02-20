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
import type { InvItem, InvItemListResponse } from '@/types/inventory';
import InventoryItemModal from './InventoryItemModal';

export default function InventoryItemsTab() {
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

  const [items, setItems] = useState<InvItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedItem, setSelectedItem] = useState<InvItem | null>(null);

  const fetchItems = useCallback(async () => {
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

      const response = await api.get(`/inventory/items/?${params.toString()}`);
      const data: InvItemListResponse = response.data;

      setItems(data.results);
      setTotalPages(Math.ceil(data.count / pageSize));
      setTotalRecords(data.count);
    } catch (err: any) {
      console.error('Error fetching inventory items:', err);
      const errorMessage = getErrorMessage(
        err,
        'Failed to load inventory items. Please try again.',
      );
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [currentPage, calculatedRowsPerPage, searchQuery, pageReady]);

  useEffect(() => {
    if (pageReady && !authLoading) {
      fetchItems();
    }
  }, [fetchItems, pageReady, authLoading]);

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
    fetchItems();
  };

  const handleCreate = () => {
    setSelectedItem(null);
    setModalMode('create');
    setShowModal(true);
  };

  const handleRowClick = (item: InvItem) => {
    setSelectedItem(item);
    setModalMode('edit');
    setShowModal(true);
  };

  const handleActionClick = (action: string, itemId: number) => {
    const item = items.find((entry) => entry.id === itemId);
    if (!item) return;

    setSelectedItem(item);

    if (action === 'edit') {
      setModalMode('edit');
      setShowModal(true);
    } else if (action === 'view') {
      setModalMode('view');
      setShowModal(true);
    } else if (action === 'clone') {
      setModalMode('create');
      setShowModal(true);
    } else if (action === 'delete') {
      handleDelete(itemId);
    }
  };

  const handleDelete = async (itemId: number) => {
    if (!confirm('Are you sure you want to delete this inventory item?')) return;

    try {
      await api.delete(`/inventory/items/${itemId}/`);
      fetchItems();
    } catch (err: any) {
      const errorMessage = getErrorMessage(err, 'Failed to delete inventory item.');
      setError(errorMessage);
    }
  };

  const handleModalSuccess = () => {
    setShowModal(false);
    fetchItems();
  };

  const columns: DataTableColumn[] = [
    { key: 'sku', label: 'SKU', sortable: true },
    { key: 'name', label: 'Item Name', sortable: true },
    { key: 'category_name', label: 'Category', sortable: true },
    { key: 'stock_uom_code', label: 'Stock Unit', sortable: false },
    { key: 'reorder_level', label: 'Reorder Level', sortable: false },
    { key: 'is_active', label: 'Active', sortable: false },
  ];

  const renderActions = (row: InvItem) => (
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
      <Dropdown.Item onClick={() => handleActionClick('edit', row.id)}>Edit Item</Dropdown.Item>
      <Dropdown.Item onClick={() => handleActionClick('clone', row.id)}>
        Clone This Item
      </Dropdown.Item>
      <Dropdown.Item onClick={() => handleActionClick('delete', row.id)}>Delete Item</Dropdown.Item>
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
          New Item
        </Button>
        <div className="flex flex-wrap gap-2 sm:gap-4 items-center">
          <StandardTextInput
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full sm:w-48 md:w-64"
            sizing="sm"
          />
        </div>
      </div>

      {error && (
        <ErrorBanner
          title="Unable to load inventory items"
          error={error}
          onRetry={handleRetry}
          onDismiss={() => setError(null)}
        />
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div ref={tableRef} className="overflow-x-auto">
          <DataTable
            title="Inventory Items"
            data={items}
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
        <InventoryItemModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSuccess={handleModalSuccess}
          mode={modalMode}
          item={selectedItem}
        />
      )}
    </div>
  );
}
