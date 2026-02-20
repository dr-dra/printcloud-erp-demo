'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Avatar, Card } from 'flowbite-react';
import { useAuth } from '@/context/AuthContext';
import { useProfilePicture } from '@/hooks/useProfilePicture';
import DashboardLayout from '@/components/DashboardLayout';
import DashboardCharts from '@/components/dashboard/DashboardCharts';
import {
  useInventoryReorderItems,
  useOverdueBills,
  usePosOpenSessionReport,
  useReminderSummary,
  useSalesDashboard,
} from '@/hooks/useDashboard';
import { useAPAgingReport, useARAgingReport, useProfitLossReport } from '@/hooks/useAccounting';
import { formatIndianCurrency } from '@/utils/currencyUtils';
import { formatDateForAPI, formatDateSriLankan } from '@/utils/dateUtils';

export default function DashboardPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const { getProfilePictureUrlWithFallback, handleImageError } = useProfilePicture();
  const router = useRouter();
  const avatarUrl = getProfilePictureUrlWithFallback();
  const posHref = useMemo(() => {
    if (!user?.role) return '/dashboard/sales/pos';
    return ['admin', 'accounting', 'cashier'].includes(user.role)
      ? '/dashboard/sales/pos/accounting'
      : '/dashboard/sales/pos';
  }, [user?.role]);

  const profitLossParams = useMemo(() => {
    if (!isAuthenticated) {
      return { start_date: '', end_date: '' };
    }

    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    return {
      start_date: formatDateForAPI(startOfMonth) || '',
      end_date: formatDateForAPI(today) || '',
    };
  }, [isAuthenticated]);

  const asOfDateParams = useMemo(() => {
    if (!isAuthenticated) {
      return undefined;
    }

    const today = new Date();
    return { as_of_date: formatDateForAPI(today) || undefined };
  }, [isAuthenticated]);

  const listParams = useMemo(() => ({ page_size: 5 }), []);

  const salesDashboard = useSalesDashboard(isAuthenticated);
  const remindersSummary = useReminderSummary(isAuthenticated);
  const inventoryReorder = useInventoryReorderItems(listParams, isAuthenticated);
  const overdueBills = useOverdueBills(listParams, isAuthenticated);
  const posSessionReport = usePosOpenSessionReport(isAuthenticated);
  const arAging = useARAgingReport(asOfDateParams, { enabled: isAuthenticated });
  const apAging = useAPAgingReport(asOfDateParams, { enabled: isAuthenticated });
  const profitLoss = useProfitLossReport(profitLossParams, { enabled: isAuthenticated });

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect to login
  }

  const formatNumber = (value: number | undefined) =>
    typeof value === 'number' ? value.toLocaleString() : '—';

  const formatCurrency = (value: string | number | undefined) => {
    if (value === undefined || value === null || value === '') {
      return '—';
    }
    return formatIndianCurrency(value);
  };

  const activeReminders =
    remindersSummary.data?.overdue !== undefined && remindersSummary.data?.due_today !== undefined
      ? remindersSummary.data.overdue + remindersSummary.data.due_today
      : undefined;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* User Personalization Greeting */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-4">
            <Avatar
              img={({ alt, className, 'data-testid': dataTestId }) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={alt}
                  className={className}
                  data-testid={dataTestId}
                  src={avatarUrl}
                  onError={handleImageError}
                />
              )}
              rounded
              size="lg"
            />
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                Welcome back
                {user?.username
                  ? `, ${user.username}`
                  : user?.email
                    ? `, ${user.email.split('@')[0]}`
                    : ''}
                !
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Track sales, production, and finance at a glance.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 lg:ml-auto">
            <Link
              href="/dashboard/sales/quotations/new"
              className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-primary-700"
            >
              New Quotation
            </Link>
            <Link
              href="/dashboard/sales/orders/new"
              className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              New Order
            </Link>
            <Link
              href={posHref}
              className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Open POS
            </Link>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <Card>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Customers</p>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
              {formatNumber(salesDashboard.data?.statistics.total_customers)}
            </p>
            <Link
              href="/dashboard/sales/customers"
              className="mt-3 inline-flex text-sm font-semibold text-primary-600 hover:underline"
            >
              View customers
            </Link>
          </Card>
          <Card>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Costing Sheets</p>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
              {formatNumber(salesDashboard.data?.statistics.total_costing_sheets)}
            </p>
            <Link
              href="/dashboard/sales/costing"
              className="mt-3 inline-flex text-sm font-semibold text-primary-600 hover:underline"
            >
              Review costings
            </Link>
          </Card>
          <Card>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Reminders</p>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
              {formatNumber(activeReminders)}
            </p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {remindersSummary.data
                ? `${remindersSummary.data.overdue} overdue · ${remindersSummary.data.due_today} due today`
                : 'Tracking upcoming tasks'}
            </p>
          </Card>
          <Card>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Low Stock Items</p>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
              {formatNumber(inventoryReorder.data?.count)}
            </p>
            <Link
              href="/dashboard/inventory/stock-items"
              className="mt-3 inline-flex text-sm font-semibold text-primary-600 hover:underline"
            >
              Reorder stock
            </Link>
          </Card>
        </div>

        {/* Financial Snapshot */}
        <Card>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Financial Snapshot
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Month-to-date totals from accounting reports.
              </p>
            </div>
            <Link
              href="/dashboard/accounting/reports"
              className="inline-flex items-center text-sm font-semibold text-primary-600 hover:underline"
            >
              Open reports
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                AR Outstanding
              </p>
              <p className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">
                {formatCurrency(arAging.data?.summary.total)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                AP Outstanding
              </p>
              <p className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">
                {formatCurrency(apAging.data?.summary.total)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Net Profit (MTD)
              </p>
              <p className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">
                {formatCurrency(profitLoss.data?.net_profit)}
              </p>
            </div>
          </div>
        </Card>

        {/* Alerts & Worklist */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Reminders Overview
            </h3>
            <div className="mt-4 space-y-3 text-sm text-gray-700 dark:text-gray-300">
              <div className="flex items-center justify-between">
                <span>Overdue</span>
                <span className="font-semibold">
                  {formatNumber(remindersSummary.data?.overdue)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Due today</span>
                <span className="font-semibold">
                  {formatNumber(remindersSummary.data?.due_today)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Next 7 days</span>
                <span className="font-semibold">
                  {formatNumber(remindersSummary.data?.upcoming_7_days)}
                </span>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Low Stock Items
              </h3>
              <Link
                href="/dashboard/inventory/stock-items"
                className="text-sm font-semibold text-primary-600 hover:underline"
              >
                View all
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {inventoryReorder.data?.results?.length ? (
                inventoryReorder.data.results.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {item.product_name || item.sku}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">SKU {item.sku}</p>
                    </div>
                    <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-600 dark:bg-red-900/30 dark:text-red-200">
                      {item.total_stock} left
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No low stock alerts right now.
                </p>
              )}
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Overdue Supplier Bills
              </h3>
              <Link
                href="/dashboard/purchases/bills"
                className="text-sm font-semibold text-primary-600 hover:underline"
              >
                View bills
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {overdueBills.data?.results?.length ? (
                overdueBills.data.results.map((bill) => (
                  <div key={bill.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {bill.bill_number}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {bill.supplier_name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(bill.balance_due)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Due {formatDateSriLankan(bill.due_date)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No overdue supplier bills.
                </p>
              )}
            </div>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Recent Costing Sheets
              </h3>
              <Link
                href="/dashboard/sales/costing"
                className="text-sm font-semibold text-primary-600 hover:underline"
              >
                View all
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {salesDashboard.data?.recent_activity.costing_sheets?.length ? (
                salesDashboard.data.recent_activity.costing_sheets.map((sheet) => (
                  <div key={sheet.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {sheet.project_name || 'Untitled costing'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {sheet.customer_name || 'No customer'} ·{' '}
                        {formatDateSriLankan(sheet.created_at)}
                      </p>
                    </div>
                    <Link
                      href={`/dashboard/sales/costing/${sheet.id}`}
                      className="text-sm font-semibold text-primary-600 hover:underline"
                    >
                      Open
                    </Link>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No recent costing activity.
                </p>
              )}
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">New Customers</h3>
              <Link
                href="/dashboard/sales/customers"
                className="text-sm font-semibold text-primary-600 hover:underline"
              >
                View all
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {salesDashboard.data?.recent_activity.customers?.length ? (
                salesDashboard.data.recent_activity.customers.map((customer) => (
                  <div key={customer.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{customer.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {customer.customer_type} · {formatDateSriLankan(customer.created_at)}
                      </p>
                    </div>
                    <Link
                      href={`/dashboard/sales/customers/${customer.id}`}
                      className="text-sm font-semibold text-primary-600 hover:underline"
                    >
                      Open
                    </Link>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No new customers yet.</p>
              )}
            </div>
          </Card>
        </div>

        {/* POS Snapshot */}
        <Card>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">POS Snapshot</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {posSessionReport.data
                  ? `Session ${posSessionReport.data.session_number} is ${posSessionReport.data.status}.`
                  : 'No open session right now.'}
              </p>
            </div>
            <Link
              href={posHref}
              className="inline-flex items-center text-sm font-semibold text-primary-600 hover:underline"
            >
              Go to POS
            </Link>
          </div>
          {posSessionReport.data ? (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="rounded-lg border border-gray-100 p-4 dark:border-gray-700">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Completed Orders
                </p>
                <p className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">
                  {formatNumber(posSessionReport.data.stats.completed_orders)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Pending {formatNumber(posSessionReport.data.stats.pending_orders)}
                </p>
              </div>
              <div className="rounded-lg border border-gray-100 p-4 dark:border-gray-700">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Expected Balance
                </p>
                <p className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(posSessionReport.data.expected_balance)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Opened {formatDateSriLankan(posSessionReport.data.opened_at)}
                </p>
              </div>
              <div className="rounded-lg border border-gray-100 p-4 dark:border-gray-700">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Payment Mix
                </p>
                <div className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                  <div className="flex items-center justify-between">
                    <span>Cash</span>
                    <span>{formatNumber(posSessionReport.data.payment_breakdown.cash)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Card</span>
                    <span>{formatNumber(posSessionReport.data.payment_breakdown.card)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>QR</span>
                    <span>{formatNumber(posSessionReport.data.payment_breakdown.lanka_qr)}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </Card>

        <DashboardCharts />

        {/* Quick Links */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Quick Links</h3>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <Link
              href="/dashboard/sales/quotations"
              className="rounded-full border border-gray-200 px-3 py-1 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Quotations
            </Link>
            <Link
              href="/dashboard/sales/orders"
              className="rounded-full border border-gray-200 px-3 py-1 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Orders
            </Link>
            <Link
              href="/dashboard/sales/invoices"
              className="rounded-full border border-gray-200 px-3 py-1 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Invoices
            </Link>
            <Link
              href="/dashboard/production/job-cards"
              className="rounded-full border border-gray-200 px-3 py-1 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Job Cards
            </Link>
            <Link
              href="/dashboard/accounting/reports"
              className="rounded-full border border-gray-200 px-3 py-1 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Accounting Reports
            </Link>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
