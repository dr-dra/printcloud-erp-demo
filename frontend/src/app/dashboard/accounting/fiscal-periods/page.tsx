'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner, Badge } from 'flowbite-react';
import {
  HiOutlineLockClosed,
  HiOutlineLockOpen,
  HiOutlinePlus,
  HiOutlineCalendar,
  HiOutlineInformationCircle,
} from 'react-icons/hi';
import DataTable from '@/components/common/DataTable';
import DashboardLayout from '@/components/DashboardLayout';
import { useFiscalPeriods, useCloseFiscalPeriod, useLockFiscalPeriod } from '@/hooks/useAccounting';
import type { FiscalPeriod } from '@/types/accounting';
import type { DataTableColumn } from '@/types/datatable';

export default function FiscalPeriodsPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<'open' | 'closed' | 'locked' | undefined>(
    undefined,
  );

  // Fetch fiscal periods
  const { data: periods, isLoading, error } = useFiscalPeriods({ status: statusFilter });

  // Mutations
  const closePeriodMutation = useCloseFiscalPeriod();
  const lockPeriodMutation = useLockFiscalPeriod();

  // Handle close period
  const handleClosePeriod = async (period: FiscalPeriod) => {
    if (
      !window.confirm(
        `Are you sure you want to close the period "${period.period_name}"? ` +
          'This will prevent new entries from being posted to this period.',
      )
    ) {
      return;
    }

    try {
      await closePeriodMutation.mutateAsync(period.id);
      alert('Period closed successfully');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      alert(`Error closing period: ${err.response?.data?.error || err.message}`);
    }
  };

  // Handle lock period
  const handleLockPeriod = async (period: FiscalPeriod) => {
    if (
      !window.confirm(
        `Are you sure you want to LOCK the period "${period.period_name}"? ` +
          'This action CANNOT be undone. A locked period cannot be reopened or edited.',
      )
    ) {
      return;
    }

    try {
      await lockPeriodMutation.mutateAsync(period.id);
      alert('Period locked successfully');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      alert(`Error locking period: ${err.response?.data?.error || err.message}`);
    }
  };

  // Table columns
  const columns: DataTableColumn<FiscalPeriod>[] = [
    {
      key: 'period_name',
      label: 'Period Name',
      sortable: true,
      render: (period) => (
        <span className="font-semibold text-gray-900 dark:text-white">{period.period_name}</span>
      ),
    },
    {
      key: 'start_date',
      label: 'Start Date',
      sortable: true,
      render: (period) => new Date(period.start_date).toLocaleDateString(),
    },
    {
      key: 'end_date',
      label: 'End Date',
      sortable: true,
      render: (period) => new Date(period.end_date).toLocaleDateString(),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (period) => {
        const statusColors: Record<FiscalPeriod['status'], 'success' | 'warning' | 'gray'> = {
          open: 'success',
          closed: 'warning',
          locked: 'gray',
        };
        return <Badge color={statusColors[period.status]}>{period.status.toUpperCase()}</Badge>;
      },
    },
    {
      key: 'closed_info',
      label: 'Closed By',
      render: (period) => {
        if (!period.closed_at) return <span className="text-gray-400">-</span>;
        return (
          <div>
            <div className="text-sm text-gray-900 dark:text-white">{period.closed_by_name}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {new Date(period.closed_at).toLocaleString()}
            </div>
          </div>
        );
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (period) => (
        <div className="flex gap-2">
          {period.status === 'open' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClosePeriod(period);
              }}
              disabled={closePeriodMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50"
            >
              <HiOutlineLockOpen className="h-3.5 w-3.5" />
              Close
            </button>
          )}
          {period.status === 'closed' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleLockPeriod(period);
              }}
              disabled={lockPeriodMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              <HiOutlineLockClosed className="h-3.5 w-3.5" />
              Lock
            </button>
          )}
          {period.status === 'locked' && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
              <HiOutlineLockClosed className="h-3.5 w-3.5" />
              Locked
            </div>
          )}
        </div>
      ),
    },
  ];

  // Table actions
  const actions = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-800">
        {['All Status', 'Open', 'Closed', 'Locked'].map((label) => {
          const filterValue =
            label === 'All Status' ? undefined : (label.toLowerCase() as FiscalPeriod['status']);
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

      <button
        onClick={() => router.push('/dashboard/accounting/fiscal-periods/new')}
        className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
      >
        <HiOutlinePlus className="h-4 w-4" />
        New Period
      </button>
    </div>
  );

  const header = (
    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Fiscal Periods</h1>
      {actions}
    </div>
  );

  // Error state
  if (error) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            {header}
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-red-800 dark:text-red-200">
                Error loading fiscal periods: {error.message}
              </p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            {header}
            <div className="flex items-center justify-center py-12">
              <Spinner size="xl" />
              <span className="ml-3 text-lg text-gray-600 dark:text-gray-400">
                Loading fiscal periods...
              </span>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-900/30">
                <HiOutlineCalendar className="h-6 w-6 text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fiscal Periods</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Manage accounting periods for your organization
                </p>
              </div>
            </div>
            {actions}
          </div>

          {/* Info Card */}
          <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-800/50 dark:bg-sky-900/20">
            <div className="flex gap-3">
              <HiOutlineInformationCircle className="h-5 w-5 flex-shrink-0 text-sky-600 dark:text-sky-400" />
              <div className="text-sm">
                <p className="font-semibold text-sky-800 dark:text-sky-200">Period Status Guide</p>
                <ul className="mt-2 space-y-1 text-sky-700 dark:text-sky-300">
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-sky-500" />
                    <span>
                      <strong>Open:</strong> Journal entries can be posted to this period
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-sky-500" />
                    <span>
                      <strong>Closed:</strong> No new entries allowed, but can still be locked
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-sky-500" />
                    <span>
                      <strong>Locked:</strong> Permanently locked, no changes possible
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <DataTable
            title="Fiscal Periods"
            data={Array.isArray(periods) ? periods : []}
            columns={columns}
            searchFields={['period_name']}
            uniqueId="fiscal-periods"
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
