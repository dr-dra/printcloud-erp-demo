'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Dropdown } from 'flowbite-react';
import { StandardTextInput } from '@/components/common/inputs';
import { HiPlus, HiDotsVertical } from 'react-icons/hi';
import DashboardLayout from '@/components/DashboardLayout';
import DataTable from '@/components/common/DataTable';
import type { DataTableColumn } from '@/types/datatable';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { usePageInitialization } from '@/hooks/usePageInitialization';
import { getErrorMessage } from '@/utils/errorHandling';
import ErrorBanner from '@/components/common/ErrorBanner';
import ArchiveCustomerAlert from '@/components/common/ArchiveCustomerAlert';
import { useRowHeightCalibration } from '@/utils/rowHeightCalibration';
import { toast } from 'sonner';
import { useNavigationState } from '@/hooks/useNavigationState';

// Types for our customer data
interface Customer {
  id: number;
  name: string;
  contact: string;
  email: string;
  address: string;
}

interface CustomerResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Customer[];
}

export default function CustomersPage() {
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
    onInitializationComplete: () => console.log('[CustomersPage] Page initialized successfully'),
    onError: (error) => console.warn('[CustomersPage] Initialization error:', error),
  });

  // Component-specific states
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { loading: authLoading, isAuthenticated } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  // Archive confirmation state
  const [showArchiveAlert, setShowArchiveAlert] = useState(false);
  const [customerToArchive, setCustomerToArchive] = useState<Customer | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);

  // Row height calibration for development
  useRowHeightCalibration(tableRef as React.RefObject<HTMLElement>);

  // Restore navigation state on component mount
  useEffect(() => {
    const savedState = getListState('customers');
    if (savedState) {
      console.log('[CustomersPage] Restoring saved navigation state:', savedState);
      setCurrentPage(savedState.currentPage);
      setSearchQuery(savedState.searchQuery);
      // Clear the state after restoration so it's only used once
      clearListState('customers');
    }
  }, [getListState, clearListState]);

  // Define columns for the DataTable
  const columns: DataTableColumn[] = [
    { key: 'name', label: 'Customer', sortable: true },
    { key: 'contact', label: 'Contact', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'address', label: 'Address', sortable: false },
  ];

  // Fetch customers data
  const fetchCustomers = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: currentPage.toString(),
        page_size: calculatedRowsPerPage.toString(),
      });

      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const response = await api.get<CustomerResponse>(`/customers/?${params}`);

      setCustomers(response.data.results);
      setTotalRecords(response.data.count);
      setTotalPages(Math.ceil(response.data.count / calculatedRowsPerPage));
    } catch (err) {
      const errorMessage = getErrorMessage(err as any);
      setError(errorMessage);
      console.error('Error fetching customers:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, currentPage, calculatedRowsPerPage, searchQuery]);

  // Effect to fetch customers when dependencies change
  useEffect(() => {
    if (pageReady && isAuthenticated && !authLoading) {
      fetchCustomers();
    }
  }, [pageReady, isAuthenticated, authLoading, fetchCustomers]);

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
    fetchCustomers();
  };

  const handleActionClick = (action: string, customerId: number) => {
    switch (action) {
      case 'view':
        // Save current pagination state before navigation
        saveListState('customers', {
          currentPage,
          searchQuery,
          dateRange: { startDate: null, endDate: null }, // customers don't have date range filter
          pageSize: calculatedRowsPerPage,
        });
        router.push(`/dashboard/sales/customers/${customerId}`);
        break;
      case 'edit':
        // Save current pagination state before navigation
        saveListState('customers', {
          currentPage,
          searchQuery,
          dateRange: { startDate: null, endDate: null }, // customers don't have date range filter
          pageSize: calculatedRowsPerPage,
        });
        router.push(`/dashboard/sales/customers/${customerId}/edit`);
        break;
      case 'archive':
        const customer = customers.find((c) => c.id === customerId);
        if (customer) {
          setCustomerToArchive(customer);
          setShowArchiveAlert(true);
        }
        break;
      default:
        console.log(`${action} action for customer ${customerId}`);
    }
  };

  const handleRowClick = (customer: Customer) => {
    // Save current pagination state before navigation
    saveListState('customers', {
      currentPage,
      searchQuery,
      dateRange: { startDate: null, endDate: null }, // customers don't have date range filter
      pageSize: calculatedRowsPerPage,
    });

    // Navigate to customer view page when row is clicked
    router.push(`/dashboard/sales/customers/${customer.id}`);
  };

  // Handle archive confirmation
  const handleArchiveConfirm = async () => {
    if (!customerToArchive) return;

    try {
      setArchiveLoading(true);

      await api.post(`/customers/${customerToArchive.id}/archive/`, {
        reason: 'Archived via customer list',
      });

      toast.success('Customer archived successfully');
      setShowArchiveAlert(false);
      setCustomerToArchive(null);

      // Refresh the customer list
      fetchCustomers();
    } catch (err) {
      const errorMessage = getErrorMessage(err as any);

      if (errorMessage.includes('active orders') || errorMessage.includes('pending invoices')) {
        toast.error(`Cannot archive customer: ${errorMessage}`);
      } else {
        toast.error(`Failed to archive customer: ${errorMessage}`);
      }

      console.error('Error archiving customer:', err);
    } finally {
      setArchiveLoading(false);
    }
  };

  const handleArchiveCancel = () => {
    setShowArchiveAlert(false);
    setCustomerToArchive(null);
  };

  // Actions dropdown for each row
  const renderActions = (row: Customer) => (
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
        View Customer
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
        Edit Customer
      </Dropdown.Item>
      <Dropdown.Divider />
      <Dropdown.Item onClick={() => handleActionClick('archive', row.id)}>
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
        Archive Customer
      </Dropdown.Item>
    </Dropdown>
  );

  return (
    <DashboardLayout>
      <div className="p-4">
        <div ref={topNavRef} />
        <div ref={titleRef} className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Customers</h1>
        </div>

        {/* Filter/Search Bar Card */}
        <div
          ref={filterBarRef}
          className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 mb-4 flex flex-wrap items-center justify-between"
        >
          <Button onClick={() => router.push('/dashboard/sales/customers/new')} size="sm">
            <HiPlus className="mr-2 h-4 w-4" />
            New Customer
          </Button>
          <div className="flex flex-wrap gap-4 items-center">
            <StandardTextInput
              type="text"
              placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-64"
            />
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <ErrorBanner
            title="Unable to load customers"
            error={error}
            onRetry={handleRetry}
            onDismiss={() => setError(null)}
          />
        )}

        {/* Table Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div ref={tableRef} className="overflow-x-auto">
            <DataTable
              title="Customers"
              data={customers || []}
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

        {/* Archive Confirmation Alert */}
        <ArchiveCustomerAlert
          show={showArchiveAlert}
          customerName={customerToArchive?.name || ''}
          loading={archiveLoading}
          onConfirm={handleArchiveConfirm}
          onCancel={handleArchiveCancel}
        />
      </div>
    </DashboardLayout>
  );
}
