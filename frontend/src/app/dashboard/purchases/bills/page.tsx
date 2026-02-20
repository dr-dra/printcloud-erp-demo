'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Badge } from 'flowbite-react';
import type { BadgeProps } from 'flowbite-react';
import { HiOutlinePlus, HiOutlineEye, HiOutlinePaperClip } from 'react-icons/hi';
import DashboardLayout from '@/components/DashboardLayout';
import DataTable from '@/components/common/DataTable';
import { StandardTextInput } from '@/components/common/inputs';
import { DateRangePicker } from '@/components/DateRangePicker';
import type { DateRange } from '@/types/dateRange';
import ErrorBanner from '@/components/common/ErrorBanner';
import { useSupplierBills } from '@/hooks/useSuppliers';
import type { SupplierBillList } from '@/types/suppliers';
import type { DataTableColumn } from '@/types/datatable';

export default function SupplierBillsPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: null, endDate: null });

  const {
    data: bills,
    isLoading,
    error,
    refetch,
  } = useSupplierBills({
    status: statusFilter,
    search: searchQuery.trim() || undefined,
    start_date: dateRange.startDate ? dateRange.startDate.toISOString().split('T')[0] : undefined,
    end_date: dateRange.endDate ? dateRange.endDate.toISOString().split('T')[0] : undefined,
  });

  const columns: DataTableColumn<SupplierBillList>[] = [
    {
      key: 'bill_number',
      label: 'Bill #',
      sortable: true,
      render: (bill) => (
        <div className="flex items-center gap-2">
          {bill.has_scan && (
            <HiOutlinePaperClip className="h-4 w-4 text-gray-400" title="Has scanned document" />
          )}
          <span className="font-mono text-sm">{bill.bill_number}</span>
        </div>
      ),
    },
    {
      key: 'supplier_name',
      label: 'Supplier',
      sortable: true,
    },
    {
      key: 'bill_date',
      label: 'Bill Date',
      sortable: true,
      render: (bill) => new Date(bill.bill_date).toLocaleDateString(),
    },
    {
      key: 'due_date',
      label: 'Due Date',
      sortable: true,
      render: (bill) => new Date(bill.due_date).toLocaleDateString(),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (bill) => {
        const statusColors: Record<string, BadgeProps['color']> = {
          draft: 'gray',
          approved: 'info',
          partially_paid: 'warning',
          paid: 'success',
          void: 'failure',
        };
        const badgeColor = statusColors[bill.status] ?? 'gray';
        return <Badge color={badgeColor}>{bill.status.replace('_', ' ').toUpperCase()}</Badge>;
      },
    },
    {
      key: 'balance_due',
      label: 'Balance Due',
      sortable: true,
      render: (bill) => (
        <span className="font-mono font-semibold text-red-600 dark:text-red-400">
          {new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(parseFloat(bill.balance_due))}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (bill) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/dashboard/purchases/bills/${bill.id}`);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          <HiOutlineEye className="h-3.5 w-3.5" />
          View
        </button>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <div className="p-2">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Supplier Bills</h1>
        </div>

        <div className="space-y-3">
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-2 mb-1 flex flex-wrap items-center justify-between gap-2 sm:gap-4">
            <Button onClick={() => router.push('/dashboard/purchases/bills/new')} size="sm">
              <HiOutlinePlus className="mr-2 h-4 w-4" />
              New Bill
            </Button>

            <div className="flex flex-wrap gap-2 sm:gap-4 items-center">
              <StandardTextInput
                type="text"
                placeholder="Search bills..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-48 md:w-64"
                sizing="sm"
              />

              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-800">
                {['All', 'Draft', 'Approved', 'Pending'].map((label) => {
                  const filterValue =
                    label === 'All'
                      ? undefined
                      : label === 'Pending'
                        ? 'partially_paid'
                        : label.toLowerCase().replace(' ', '_');
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

              <div className="relative mr-4">
                <DateRangePicker value={dateRange} onChange={setDateRange} size="sm" />
                {(dateRange.startDate || dateRange.endDate) && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary-500 rounded-full border-2 border-white"></div>
                )}
              </div>
            </div>
          </div>

          {error && (
            <ErrorBanner
              title="Unable to load supplier bills"
              error={error.message}
              onRetry={() => refetch()}
            />
          )}

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <DataTable
              title="Supplier Bills"
              data={Array.isArray(bills) ? bills : []}
              columns={columns}
              loading={isLoading}
              searchFields={['bill_number', 'internal_reference', 'supplier_name']}
              onRowClick={(bill) => router.push(`/dashboard/purchases/bills/${bill.id}`)}
              uniqueId="supplier-bills"
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
