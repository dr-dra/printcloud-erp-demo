'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from 'flowbite-react';
import {
  HiArrowLeft,
  HiPencil,
  HiOutlineRefresh,
  HiDocumentText,
  HiOutlineBookOpen,
  HiOutlineTag,
  HiOutlineCollection,
  HiOutlineLink,
  HiOutlineClock,
  HiArrowUp,
  HiArrowDown,
} from 'react-icons/hi';
import DashboardLayout from '@/components/DashboardLayout';
import {
  useChartOfAccount,
  useAccountBalance,
  useAccountTransactions,
} from '@/hooks/useAccounting';
import ErrorBanner from '@/components/common/ErrorBanner';
import { getErrorMessage } from '@/utils/errorHandling';
import { formatDateSriLankan } from '@/utils/dateUtils';

// Category color schemes
const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  Assets: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-700',
  },
  Liabilities: {
    bg: 'bg-rose-50 dark:bg-rose-900/20',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-700',
  },
  Equity: {
    bg: 'bg-violet-50 dark:bg-violet-900/20',
    text: 'text-violet-700 dark:text-violet-300',
    border: 'border-violet-200 dark:border-violet-700',
  },
  Income: {
    bg: 'bg-sky-50 dark:bg-sky-900/20',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-200 dark:border-sky-700',
  },
  Expenses: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-700',
  },
};

const getDefaultColors = () => ({
  bg: 'bg-gray-50 dark:bg-gray-800/50',
  text: 'text-gray-700 dark:text-gray-300',
  border: 'border-gray-200 dark:border-gray-700',
});

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ChartOfAccountDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const accountId = parseInt(id);

  const {
    data: account,
    isLoading: accountLoading,
    error: accountError,
  } = useChartOfAccount(accountId);
  const {
    data: balanceData,
    refetch: refetchBalance,
    isFetching: balanceRefetching,
  } = useAccountBalance(accountId);
  const {
    data: transactions,
    isLoading: transactionsLoading,
    error: transactionsError,
  } = useAccountTransactions(accountId);

  const getCategoryColors = (categoryName: string) => {
    return categoryColors[categoryName] || getDefaultColors();
  };

  if (accountError) {
    return (
      <DashboardLayout>
        <div className="min-h-screen">
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <div className="px-6 py-5">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.push('/dashboard/accounting/chart-of-accounts')}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <HiArrowLeft className="h-5 w-5" />
                </button>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Account Details
                </h1>
              </div>
            </div>
          </div>
          <div className="p-6">
            <ErrorBanner
              title="Unable to load account"
              error={getErrorMessage(accountError)}
              onRetry={() => window.location.reload()}
              onDismiss={() => router.push('/dashboard/accounting/chart-of-accounts')}
            />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (accountLoading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Spinner size="xl" />
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Loading account details...
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!account) {
    return (
      <DashboardLayout>
        <div className="min-h-screen">
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <div className="px-6 py-5">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.push('/dashboard/accounting/chart-of-accounts')}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <HiArrowLeft className="h-5 w-5" />
                </button>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Account Details
                </h1>
              </div>
            </div>
          </div>
          <div className="p-6">
            <ErrorBanner
              title="Account not found"
              error="The account you're looking for doesn't exist or has been deleted."
              onRetry={() => window.location.reload()}
              onDismiss={() => router.push('/dashboard/accounting/chart-of-accounts')}
            />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const balance = balanceData?.current_balance || account.current_balance;
  const balanceNum = parseFloat(balance);
  const isNegative = balanceNum < 0;
  const colors = getCategoryColors(account.category_name);

  return (
    <DashboardLayout>
      <div className="min-h-screen">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="px-6 py-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.push('/dashboard/accounting/chart-of-accounts')}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <HiArrowLeft className="h-5 w-5" />
                </button>
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${colors.bg} ${colors.border} border`}>
                    <HiOutlineBookOpen className={`h-6 w-6 ${colors.text}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                        {account.account_code}
                      </span>
                      <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                        {account.account_name}
                      </h1>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text} ${colors.border} border`}
                      >
                        {account.category_name}
                      </span>
                      {account.is_system_account && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
                          System Account
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!account.is_system_account && (
                  <button
                    onClick={() =>
                      router.push(`/dashboard/accounting/chart-of-accounts/${account.id}/edit`)
                    }
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
                  >
                    <HiPencil className="h-4 w-4" />
                    Edit Account
                  </button>
                )}
                <button
                  onClick={() =>
                    router.push(
                      `/dashboard/accounting/chart-of-accounts/${account.id}/transactions`,
                    )
                  }
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <HiDocumentText className="h-4 w-4" />
                  All Transactions
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Balance & Status Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Current Balance - Large Card */}
            <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Current Balance
                  </h3>
                  <button
                    onClick={() => refetchBalance()}
                    disabled={balanceRefetching}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <HiOutlineRefresh
                      className={`h-4 w-4 ${balanceRefetching ? 'animate-spin' : ''}`}
                    />
                    Refresh
                  </button>
                </div>
                <div className="flex items-baseline gap-3">
                  <span
                    className={`font-mono text-4xl font-bold tabular-nums tracking-tight ${
                      isNegative
                        ? 'text-rose-600 dark:text-rose-400'
                        : balanceNum > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'LKR',
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(Math.abs(balanceNum))}
                  </span>
                  {isNegative && (
                    <span className="px-2 py-1 text-xs font-semibold bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-md">
                      CREDIT
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {account.allow_transactions
                    ? 'Account accepts transactions'
                    : 'Summary account - no direct transactions'}
                </p>
              </div>
              {/* Balance indicator bar */}
              <div
                className={`h-1.5 ${isNegative ? 'bg-rose-500' : balanceNum > 0 ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}
              />
            </div>

            {/* Status Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                Account Status
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${
                      account.is_active
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${account.is_active ? 'bg-emerald-500' : 'bg-gray-400'}`}
                    />
                    {account.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Transactions</span>
                  <span
                    className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      account.allow_transactions
                        ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400'
                        : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    {account.allow_transactions ? 'Allowed' : 'Summary Only'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Type</span>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                    {account.is_system_account ? 'System' : 'User-defined'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Account Details Grid */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                Account Information
              </h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <HiOutlineTag className="h-5 w-5 text-gray-500" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                      Account Code
                    </div>
                    <div className="font-mono text-sm font-semibold text-gray-900 dark:text-white">
                      {account.account_code}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <HiOutlineBookOpen className="h-5 w-5 text-gray-500" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                      Account Name
                    </div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                      {account.account_name}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <HiOutlineCollection className="h-5 w-5 text-gray-500" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                      Category
                    </div>
                    <div
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-sm font-medium ${colors.bg} ${colors.text}`}
                    >
                      {account.category_name}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <HiOutlineLink className="h-5 w-5 text-gray-500" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                      Parent Account
                    </div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                      {account.parent_account_name || (
                        <span className="text-gray-400 font-normal">None (Top-level)</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HiOutlineClock className="h-5 w-5 text-gray-400" />
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                    Recent Transactions
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Last 10 journal entries
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  router.push(`/dashboard/accounting/chart-of-accounts/${account.id}/transactions`)
                }
                className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
              >
                View All
              </button>
            </div>

            {transactionsLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Spinner size="lg" />
                <span className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                  Loading transactions...
                </span>
              </div>
            ) : transactionsError ? (
              <div className="p-6">
                <div className="rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    Unable to load transactions. This feature may not be available yet.
                  </p>
                </div>
              </div>
            ) : Array.isArray(transactions) && transactions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900/50">
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Journal #
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Debit
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Credit
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {transactions.map((txn, idx) => (
                      <tr
                        key={txn.id || idx}
                        onClick={() =>
                          router.push(
                            `/dashboard/accounting/journal-entries/${txn.journal_entry_id}`,
                          )
                        }
                        className="group cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                          {formatDateSriLankan(txn.date)}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-mono text-sm font-medium text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                            {txn.journal_number}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                          {txn.description || (
                            <span className="text-gray-400 italic">No description</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {txn.debit > 0 ? (
                            <span className="inline-flex items-center gap-1 font-mono text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                              <HiArrowUp className="h-3 w-3" />
                              {new Intl.NumberFormat('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }).format(txn.debit)}
                            </span>
                          ) : (
                            <span className="text-gray-300 dark:text-gray-600">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {txn.credit > 0 ? (
                            <span className="inline-flex items-center gap-1 font-mono text-sm font-semibold text-rose-600 dark:text-rose-400">
                              <HiArrowDown className="h-3 w-3" />
                              {new Intl.NumberFormat('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }).format(txn.credit)}
                            </span>
                          ) : (
                            <span className="text-gray-300 dark:text-gray-600">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 px-6">
                <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
                  <HiDocumentText className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                  No transactions yet
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center max-w-sm">
                  This account doesn&apos;t have any transactions recorded. Transactions will appear
                  here once journal entries are posted.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
