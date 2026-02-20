'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Spinner, Badge } from 'flowbite-react';
import {
  HiArrowLeft,
  HiPencil,
  HiOutlineArrowPath,
  HiOutlinePhone,
  HiOutlineMapPin,
  HiOutlineUser,
} from 'react-icons/hi2';
import DashboardLayout from '@/components/DashboardLayout';
import DataTable from '@/components/common/DataTable';
import { useSupplier, useSupplierBalance, useSupplierBills } from '@/hooks/useSuppliers';
import type { DataTableColumn } from '@/types/datatable';
import type { SupplierBillList } from '@/types/suppliers';
import ErrorBanner from '@/components/common/ErrorBanner';
import { getErrorMessage } from '@/utils/errorHandling';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function SupplierDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const supplierId = parseInt(id);

  // Fetch supplier data
  const { data: supplier, isLoading, error } = useSupplier(supplierId);
  const { data: balanceData, refetch: refetchBalance } = useSupplierBalance(supplierId);
  const { data: bills } = useSupplierBills({ supplier: supplierId });

  // Table columns for bills
  const billColumns: DataTableColumn<SupplierBillList>[] = [
    {
      key: 'bill_number',
      label: 'Bill #',
      sortable: true,
      render: (bill) => <span className="font-mono text-sm">{bill.bill_number}</span>,
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
        const statusColors = {
          draft: 'gray',
          approved: 'info',
          partially_paid: 'warning',
          paid: 'success',
          void: 'failure',
        };
        return (
          <Badge color={statusColors[bill.status as keyof typeof statusColors] as any}>
            {bill.status.replace('_', ' ').toUpperCase()}
          </Badge>
        );
      },
    },
    {
      key: 'total',
      label: 'Total',
      sortable: true,
      render: (bill) => (
        <span className="font-mono font-semibold text-gray-900 dark:text-white">
          {new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(parseFloat(bill.total))}
        </span>
      ),
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
  ];

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-64">
          <Spinner size="xl" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-4">
          <ErrorBanner
            title="Unable to load supplier"
            error={getErrorMessage(error as { message?: string; response?: { status?: number } })}
            onRetry={() => router.refresh()}
            showDismiss={false}
          />
        </div>
      </DashboardLayout>
    );
  }

  if (!supplier) {
    return (
      <DashboardLayout>
        <div className="p-4">
          <div className="text-center text-gray-500">Supplier not found</div>
        </div>
      </DashboardLayout>
    );
  }

  const balance = balanceData?.current_balance || supplier.current_balance;
  const balanceNum = parseFloat(balance);

  return (
    <DashboardLayout>
      <div className="p-3 lg:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <Button color="gray" size="sm" onClick={() => router.push('/dashboard/suppliers')}>
              <HiArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                {supplier.name}
              </h1>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <span>{supplier.supplier_code}</span>
                <span className="text-gray-300 dark:text-gray-600">•</span>
                <Badge color={supplier.is_active ? 'success' : 'gray'}>
                  {supplier.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              color="gray"
              size="sm"
              onClick={() => router.push(`/dashboard/purchases/orders?supplier=${supplier.id}`)}
            >
              View Purchase Orders
            </Button>
            <Button
              color="blue"
              size="sm"
              onClick={() => router.push(`/dashboard/suppliers/${supplier.id}/edit`)}
            >
              <HiPencil className="mr-2 h-4 w-4" />
              Edit Supplier
            </Button>
          </div>
        </div>

        <div className="flex flex-col xl:flex-row gap-4">
          <div className="flex-1 min-w-0 space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                  <HiOutlinePhone className="h-4 w-4 text-gray-400" />
                  Contact Information
                </div>
              </div>
              <div className="grid grid-cols-1 gap-6 px-4 py-4 md:grid-cols-2">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Email
                  </div>
                  <div className="mt-1 text-gray-900 dark:text-white">{supplier.email || '-'}</div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Phone
                  </div>
                  <div className="mt-1 text-gray-900 dark:text-white">{supplier.phone || '-'}</div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Mobile
                  </div>
                  <div className="mt-1 text-gray-900 dark:text-white">{supplier.mobile || '-'}</div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Payment Terms
                  </div>
                  <div className="mt-1 text-gray-900 dark:text-white">
                    Net {supplier.payment_terms_days} days
                  </div>
                </div>
              </div>
            </div>

            {(supplier.address_line1 || supplier.city || supplier.country) && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                    <HiOutlineMapPin className="h-4 w-4 text-gray-400" />
                    Address
                  </div>
                </div>
                <div className="px-4 py-4 text-gray-900 dark:text-white space-y-1">
                  {supplier.address_line1 && <div>{supplier.address_line1}</div>}
                  {supplier.address_line2 && <div>{supplier.address_line2}</div>}
                  {supplier.city && <div>{supplier.city}</div>}
                  {supplier.country && <div>{supplier.country}</div>}
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                    <HiOutlineUser className="h-4 w-4 text-gray-400" />
                    Contact Persons
                  </div>
                  <button
                    onClick={() => router.push(`/dashboard/suppliers/${supplier.id}/edit`)}
                    className="text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                  >
                    Add/Edit
                  </button>
                </div>
              </div>
              <div className="px-4 py-4">
                {supplier.contacts && supplier.contacts.length > 0 ? (
                  <div className="space-y-3">
                    {supplier.contacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="flex items-start justify-between border-b border-gray-100 pb-3 last:border-b-0 dark:border-gray-700"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900 dark:text-white">
                              {contact.name}
                            </p>
                            {contact.is_primary && (
                              <Badge color="success" size="xs">
                                Primary
                              </Badge>
                            )}
                          </div>
                          {contact.phone && (
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                              {contact.phone}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No contact persons added
                  </p>
                )}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                Recent Bills
              </h2>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="overflow-x-auto">
                  <DataTable
                    title="Recent Bills"
                    data={Array.isArray(bills) ? bills : []}
                    columns={billColumns}
                    searchFields={['bill_number', 'internal_reference']}
                    uniqueId={`supplier-${supplierId}-bills`}
                    onRowClick={(bill) => router.push(`/dashboard/purchases/bills/${bill.id}`)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="w-full xl:w-72 flex-shrink-0 space-y-3">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Supplier Code
              </div>
              <div className="mt-2 font-mono text-xl font-semibold text-gray-900 dark:text-white">
                {supplier.supplier_code}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Company Name
              </div>
              <div className="mt-2 text-base font-semibold text-gray-900 dark:text-white">
                {supplier.company_name || '-'}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Current Balance Due
                </div>
                <button
                  type="button"
                  onClick={() => refetchBalance()}
                  className="inline-flex items-center rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                  title="Refresh balance"
                >
                  <HiOutlineArrowPath className="h-3 w-3" />
                </button>
              </div>
              <div
                className={`mt-2 font-mono text-xl font-bold ${
                  balanceNum > 0
                    ? 'text-red-600 dark:text-red-400'
                    : balanceNum < 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {new Intl.NumberFormat('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }).format(Math.abs(balanceNum))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
