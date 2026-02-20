'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useCallback } from 'react';
import { Button, Dropdown } from 'flowbite-react';
import { StandardTextInput } from '@/components/common/inputs';
import { HiPlus, HiDotsVertical } from 'react-icons/hi';
import DataTable from '@/components/common/DataTable';
import type { DataTableColumn } from '@/types/datatable';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { usePageInitialization } from '@/hooks/usePageInitialization';
import { getErrorMessage } from '@/utils/errorHandling';
import ErrorBanner from '@/components/common/ErrorBanner';
import FinishGoodsModal from './FinishGoodsModal';
import { FinishedProduct, FinishedProductListResponse } from '@/types/inventory';

export default function FinishGoodsTab() {
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
    onInitializationComplete: () => console.log('[FinishGoodsTab] Page initialized successfully'),
    onError: (error) => console.warn('[FinishGoodsTab] Initialization error:', error),
  });

  // Component states
  const [products, setProducts] = useState<FinishedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedProduct, setSelectedProduct] = useState<FinishedProduct | null>(null);

  // Fetch finish goods
  const fetchProducts = useCallback(async () => {
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

      const response = await api.get(`/sales/finished-products/?${params.toString()}`);
      const data: FinishedProductListResponse = response.data;

      setProducts(data.results);
      setTotalPages(Math.ceil(data.count / pageSize));
      setTotalRecords(data.count);
    } catch (err: any) {
      console.error('Error fetching finish goods:', err);
      const errorMessage = getErrorMessage(err, 'Failed to load finish goods. Please try again.');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [currentPage, calculatedRowsPerPage, searchQuery, pageReady]);

  // Fetch products when dependencies change
  useEffect(() => {
    if (pageReady && !authLoading) {
      fetchProducts();
    }
  }, [fetchProducts, pageReady, authLoading]);

  // Show loading state while auth is being checked or page is initializing
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

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return null;
  }

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
    setError(null);
    fetchProducts();
  };

  // Handle create product
  const handleCreateProduct = () => {
    setSelectedProduct(null);
    setModalMode('create');
    setShowModal(true);
  };

  // Handle action click
  const handleActionClick = (action: string, productId: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    setSelectedProduct(product);

    if (action === 'edit') {
      setModalMode('edit');
      setShowModal(true);
    } else if (action === 'view') {
      setModalMode('view');
      setShowModal(true);
    } else if (action === 'delete') {
      handleDeleteProduct(productId);
    }
  };

  // Handle row click - open edit modal directly
  const handleRowClick = (product: FinishedProduct) => {
    setSelectedProduct(product);
    setModalMode('edit');
    setShowModal(true);
  };

  // Handle delete product
  const handleDeleteProduct = async (productId: number) => {
    if (!confirm('Are you sure you want to delete this finish good?')) return;

    try {
      await api.delete(`/sales/finished-products/${productId}/delete/`);
      fetchProducts(); // Refresh the list
    } catch (err: any) {
      const errorMessage = getErrorMessage(err, 'Failed to delete finish good.');
      setError(errorMessage);
    }
  };

  // Handle modal success
  const handleModalSuccess = () => {
    setShowModal(false);
    fetchProducts(); // Refresh the list
  };

  // Define columns for the DataTable
  const columns: DataTableColumn[] = [
    { key: 'id', label: 'ID', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'dimensions_display', label: 'Dimensions', sortable: false },
    { key: 'description', label: 'Description', sortable: false },
  ];

  // Actions dropdown for each row
  const renderActions = (row: FinishedProduct) => (
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
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </svg>
        View Details
      </Dropdown.Item>
      <Dropdown.Item onClick={() => handleActionClick('edit', row.id)}>
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
        Edit Product
      </Dropdown.Item>
      <Dropdown.Item onClick={() => handleActionClick('delete', row.id)}>
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
        Delete Product
      </Dropdown.Item>
    </Dropdown>
  );

  return (
    <div className="p-4">
      <div ref={topNavRef} />
      <div ref={titleRef} />

      {/* Filter/Search Bar */}
      <div
        ref={filterBarRef}
        className="bg-white dark:bg-gray-800 shadow rounded-lg p-2 mb-4 flex flex-wrap items-center justify-between gap-2 sm:gap-4"
      >
        <Button onClick={handleCreateProduct} size="sm">
          <HiPlus className="mr-2 h-4 w-4" />
          New Finish Good
        </Button>
        <div className="flex flex-wrap gap-2 sm:gap-4 items-center">
          <StandardTextInput
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full sm:w-48 md:w-64"
            sizing="sm"
          />
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <ErrorBanner
          title="Unable to load finish goods"
          error={error}
          onRetry={handleRetry}
          onDismiss={() => setError(null)}
        />
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div ref={tableRef} className="overflow-x-auto">
          <DataTable
            title="Finish Goods"
            data={products}
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

      {/* Modal */}
      {showModal && (
        <FinishGoodsModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSuccess={handleModalSuccess}
          mode={modalMode}
          product={selectedProduct}
        />
      )}
    </div>
  );
}
