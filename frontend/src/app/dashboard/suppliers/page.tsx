'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Dropdown, Badge, Select } from 'flowbite-react';
import { HiPlus, HiEye, HiPencil, HiDotsVertical } from 'react-icons/hi';
import { StandardTextInput } from '@/components/common/inputs';
import DataTable from '@/components/common/DataTable';
import DashboardLayout from '@/components/DashboardLayout';
import { useSuppliers } from '@/hooks/useSuppliers';
import type { SupplierList } from '@/types/suppliers';
import type { DataTableColumn } from '@/types/datatable';
import { getErrorMessage } from '@/utils/errorHandling';
import ErrorBanner from '@/components/common/ErrorBanner';

export default function SuppliersPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch suppliers
  const {
    data: suppliers,
    isLoading,
    error,
    refetch,
  } = useSuppliers({
    is_active: statusFilter === 'all' ? undefined : statusFilter === 'active',
    search: searchQuery || undefined,
  });

  const errorMessage = useMemo(() => {
    if (!error) return null;
    return getErrorMessage(error as { message?: string; response?: { status?: number } });
  }, [error]);

  // Table columns
  const columns: DataTableColumn<SupplierList>[] = [
    {
      key: 'supplier_code',
      label: 'Supplier Code',
      sortable: true,
      render: (supplier) => (
        <span className="font-mono font-semibold text-gray-900 dark:text-white">
          {supplier.supplier_code}
        </span>
      ),
    },
    {
      key: 'name',
      label: 'Supplier Name',
      sortable: true,
      render: (supplier) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-white">{supplier.name}</div>
          {supplier.email && (
            <div className="text-sm text-gray-500 dark:text-gray-400">{supplier.email}</div>
          )}
        </div>
      ),
    },
    {
      key: 'phone',
      label: 'Contact',
      render: (supplier) => (
        <span className="text-gray-900 dark:text-white">{supplier.phone || '-'}</span>
      ),
    },
    {
      key: 'current_balance',
      label: 'Balance Due',
      sortable: true,
      align: 'right',
      render: (supplier) => {
        const balance = parseFloat(supplier.current_balance);
        return (
          <span
            className={`font-mono font-semibold ${
              balance > 0
                ? 'text-red-600 dark:text-red-400'
                : balance < 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {new Intl.NumberFormat('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }).format(Math.abs(balance))}
          </span>
        );
      },
    },
    {
      key: 'is_active',
      label: 'Status',
      sortable: true,
      align: 'center',
      render: (supplier) => (
        <Badge color={supplier.is_active ? 'success' : 'gray'}>
          {supplier.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ];

  const renderActions = (supplier: SupplierList) => (
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
      <Dropdown.Item onClick={() => router.push(`/dashboard/suppliers/${supplier.id}`)}>
        <HiEye className="w-4 h-4 mr-2" />
        View Details
      </Dropdown.Item>
      <Dropdown.Item onClick={() => router.push(`/dashboard/suppliers/${supplier.id}/edit`)}>
        <HiPencil className="w-4 h-4 mr-2" />
        Edit Supplier
      </Dropdown.Item>
    </Dropdown>
  );

  return (
    <DashboardLayout>
      <div className="p-2">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Suppliers</h1>
        </div>

        <div className="space-y-3">
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-2 mb-1 flex flex-wrap items-center justify-between gap-2 sm:gap-4">
            <Button onClick={() => router.push('/dashboard/suppliers/new')} size="sm">
              <HiPlus className="mr-2 h-4 w-4" />
              New Supplier
            </Button>

            <div className="flex flex-wrap gap-2 sm:gap-4 items-center">
              <StandardTextInput
                type="text"
                placeholder="Search suppliers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-48 md:w-64"
                sizing="sm"
              />

              <Select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                sizing="sm"
                className="w-40"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>

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
                <Dropdown.Item onClick={() => refetch()}>Refresh</Dropdown.Item>
              </Dropdown>
            </div>
          </div>

          {errorMessage && (
            <ErrorBanner
              title="Unable to load suppliers"
              error={errorMessage}
              onRetry={() => refetch()}
              showDismiss={false}
            />
          )}

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="overflow-x-auto">
              <DataTable
                title="Suppliers"
                data={Array.isArray(suppliers) ? suppliers : []}
                columns={columns}
                loading={isLoading}
                actions={renderActions}
                onRowClick={(supplier) => router.push(`/dashboard/suppliers/${supplier.id}`)}
                uniqueId="suppliers"
              />
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
