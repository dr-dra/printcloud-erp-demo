'use client';

import { useRouter } from 'next/navigation';
import { Card } from 'flowbite-react';
import { HiDocumentReport, HiChartBar, HiScale, HiViewGrid } from 'react-icons/hi';
import DashboardLayout from '@/components/DashboardLayout';

export default function ReportsPage() {
  const router = useRouter();

  const reports = [
    {
      title: 'Accounts Receivable Aging',
      description: 'Outstanding customer invoices grouped by age',
      icon: HiDocumentReport,
      color: 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300',
      href: '/dashboard/accounting/reports/ar-aging',
    },
    {
      title: 'Accounts Payable Aging',
      description: 'Outstanding supplier bills grouped by age',
      icon: HiDocumentReport,
      color: 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300',
      href: '/dashboard/accounting/reports/ap-aging',
    },
    {
      title: 'Profit & Loss',
      description: 'Income and expenses for a period',
      icon: HiChartBar,
      color: 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300',
      href: '/dashboard/accounting/reports/profit-loss',
    },
    {
      title: 'Trial Balance',
      description: 'All account balances with debit/credit totals',
      icon: HiScale,
      color: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-300',
      href: '/dashboard/accounting/reports/trial-balance',
    },
    {
      title: 'Balance Sheet',
      description: 'Assets, liabilities, and equity as of a date',
      icon: HiViewGrid,
      color: 'bg-teal-100 text-teal-600 dark:bg-teal-900 dark:text-teal-300',
      href: '/dashboard/accounting/reports/balance-sheet',
    },
  ];

  return (
    <DashboardLayout>
      <div className="p-4">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
          Financial Reports
        </h1>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {reports.map((report) => (
            <Card
              key={report.title}
              className="cursor-pointer transition-transform hover:scale-105"
              onClick={() => router.push(report.href)}
            >
              <div className="flex items-start gap-4">
                <div className={`rounded-lg p-3 ${report.color}`}>
                  <report.icon className="h-8 w-8" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {report.title}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {report.description}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Quick Summary Cards */}
        <div className="mt-8">
          <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">Quick Links</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                Chart of Accounts
              </h3>
              <button
                onClick={() => router.push('/dashboard/accounting/chart-of-accounts')}
                className="mt-2 text-left text-lg font-bold text-blue-600 hover:underline dark:text-blue-400"
              >
                View All Accounts →
              </button>
            </Card>

            <Card>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                Journal Entries
              </h3>
              <button
                onClick={() => router.push('/dashboard/accounting/journal-entries')}
                className="mt-2 text-left text-lg font-bold text-blue-600 hover:underline dark:text-blue-400"
              >
                View All Entries →
              </button>
            </Card>

            <Card>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                Fiscal Periods
              </h3>
              <button
                onClick={() => router.push('/dashboard/accounting/fiscal-periods')}
                className="mt-2 text-left text-lg font-bold text-blue-600 hover:underline dark:text-blue-400"
              >
                Manage Periods →
              </button>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
