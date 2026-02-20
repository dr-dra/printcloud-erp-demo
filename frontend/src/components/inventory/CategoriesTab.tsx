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
import { FinishedProductCategory, FinishedProductCategoryListResponse } from '@/types/inventory';

export default function CategoriesTab() {
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
    onInitializationComplete: () => console.log('[CategoriesTab] Page initialized successfully'),
    onError: (error) => console.warn('[CategoriesTab] Initialization error:', error),
  });

  // Component states
  const [categories, setCategories] = useState<FinishedProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch categories
  const fetchCategories = useCallback(async () => {
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

      const response = await api.get(`/sales/categories/?${params.toString()}`);
      const data: FinishedProductCategoryListResponse = response.data;

      setCategories(data.results);
      setTotalPages(Math.ceil(data.count / pageSize));
      setTotalRecords(data.count);
    } catch (err: any) {
      console.error('Error fetching categories:', err);
      const errorMessage = getErrorMessage(err, 'Failed to load categories. Please try again.');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [currentPage, calculatedRowsPerPage, searchQuery, pageReady]);

  // Fetch categories when dependencies change
  useEffect(() => {
    if (pageReady && !authLoading) {
      fetchCategories();
    }
  }, [fetchCategories, pageReady, authLoading]);

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
    fetchCategories();
  };

  // Handle create category
  const handleCreateCategory = () => {
    // TODO: Implement category creation modal
    alert('Category creation functionality coming soon!');
  };

  // Handle action click
  const handleActionClick = (action: string, _categoryId: number) => {
    if (action === 'edit') {
      // TODO: Implement category editing
      alert('Category editing functionality coming soon!');
    } else if (action === 'delete') {
      // TODO: Implement category deletion
      if (confirm('Are you sure you want to delete this category?')) {
        alert('Category deletion functionality coming soon!');
      }
    }
  };

  // Handle row click
  const handleRowClick = (category: FinishedProductCategory) => {
    // TODO: Implement category view modal
    alert(`View category: ${category.category_name}`);
  };

  // Define columns for the DataTable
  const columns: DataTableColumn[] = [
    { key: 'id', label: 'ID', sortable: true },
    { key: 'category_name', label: 'Category Name', sortable: true },
    { key: 'parent_category_name', label: 'Parent Category', sortable: false },
    { key: 'income_account_id', label: 'Income Account', sortable: false },
  ];

  // Actions dropdown for each row
  const renderActions = (row: FinishedProductCategory) => (
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
      <Dropdown.Item onClick={() => handleActionClick('edit', row.id)}>
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
        Edit Category
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
        Delete Category
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
        <Button onClick={handleCreateCategory} size="sm">
          <HiPlus className="mr-2 h-4 w-4" />
          New Category
        </Button>
        <div className="flex flex-wrap gap-2 sm:gap-4 items-center">
          <StandardTextInput
            type="text"
            placeholder="Search categories..."
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
          title="Unable to load categories"
          error={error}
          onRetry={handleRetry}
          onDismiss={() => setError(null)}
        />
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div ref={tableRef} className="overflow-x-auto">
          <DataTable
            title="Product Categories"
            data={categories}
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
    </div>
  );
}
