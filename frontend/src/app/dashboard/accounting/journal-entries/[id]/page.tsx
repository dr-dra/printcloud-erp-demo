'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from 'flowbite-react';
import {
  HiArrowLeft,
  HiCheckCircle,
  HiXCircle,
  HiOutlineDocumentText,
  HiOutlineCalendar,
  HiOutlineUser,
  HiOutlineLink,
  HiArrowUp,
  HiArrowDown,
  HiOutlineExclamationCircle,
} from 'react-icons/hi';
import DashboardLayout from '@/components/DashboardLayout';
import {
  useJournalEntry,
  usePostJournalEntry,
  useReverseJournalEntry,
} from '@/hooks/useAccounting';
import ErrorBanner from '@/components/common/ErrorBanner';

// Source type colors
const sourceTypeColors: Record<string, { bg: string; text: string }> = {
  manual: {
    bg: 'bg-violet-100 dark:bg-violet-900/30',
    text: 'text-violet-700 dark:text-violet-300',
  },
  purchase_bill: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-700 dark:text-amber-300',
  },
  purchase_payment: {
    bg: 'bg-rose-100 dark:bg-rose-900/30',
    text: 'text-rose-700 dark:text-rose-300',
  },
  sales_invoice: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-700 dark:text-emerald-300',
  },
  sales_receipt: { bg: 'bg-sky-100 dark:bg-sky-900/30', text: 'text-sky-700 dark:text-sky-300' },
  opening_balance: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300' },
};

const getSourceColor = (sourceType: string) => {
  return (
    sourceTypeColors[sourceType] || {
      bg: 'bg-gray-100 dark:bg-gray-700',
      text: 'text-gray-600 dark:text-gray-400',
    }
  );
};

const formatSourceType = (sourceType: string) => {
  return sourceType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function JournalEntryDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const entryId = parseInt(id);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch journal entry
  const { data: entry, isLoading, error } = useJournalEntry(entryId);

  // Mutations
  const postMutation = usePostJournalEntry();
  const reverseMutation = useReverseJournalEntry();

  const handlePost = async () => {
    if (
      !window.confirm(
        'Are you sure you want to post this journal entry? This action cannot be undone.',
      )
    ) {
      return;
    }

    setActionLoading(true);
    try {
      await postMutation.mutateAsync(entryId);
      alert('Journal entry posted successfully');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      alert(`Error posting journal entry: ${err.response?.data?.error || err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReverse = async () => {
    if (
      !window.confirm(
        'Are you sure you want to reverse this journal entry? This will create a new reversing entry.',
      )
    ) {
      return;
    }

    setActionLoading(true);
    try {
      await reverseMutation.mutateAsync({ id: entryId });
      alert('Reversal entry created successfully');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      alert(`Error creating reversal: ${err.response?.data?.error || err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Error state
  if (error) {
    return (
      <DashboardLayout>
        <div className="min-h-screen">
          <div className="px-6 py-5">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard/accounting/journal-entries')}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <HiArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Journal Entry</h1>
            </div>
          </div>
          <div className="p-6">
            <ErrorBanner
              title="Unable to load journal entry"
              error={error.message}
              onRetry={() => window.location.reload()}
              onDismiss={() => router.push('/dashboard/accounting/journal-entries')}
            />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Spinner size="xl" />
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Loading journal entry...
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!entry) {
    return (
      <DashboardLayout>
        <div className="min-h-screen">
          <div className="px-6 py-5">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard/accounting/journal-entries')}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <HiArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Journal Entry</h1>
            </div>
          </div>
          <div className="p-6">
            <ErrorBanner
              title="Journal entry not found"
              error="The journal entry you're looking for doesn't exist or has been deleted."
              onRetry={() => window.location.reload()}
              onDismiss={() => router.push('/dashboard/accounting/journal-entries')}
            />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const totalDebit = parseFloat(entry.total_debit);
  const totalCredit = parseFloat(entry.total_credit);
  const isBalanced = totalDebit === totalCredit;
  const sourceColors = getSourceColor(entry.source_type);

  return (
    <DashboardLayout>
      <div className="min-h-screen">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="px-6 py-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.push('/dashboard/accounting/journal-entries')}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <HiArrowLeft className="h-5 w-5" />
                </button>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
                    <HiOutlineDocumentText className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                        {entry.journal_number}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full ${
                          entry.is_posted
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                            : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${entry.is_posted ? 'bg-emerald-500' : 'bg-amber-500'}`}
                        />
                        {entry.is_posted ? 'Posted' : 'Draft'}
                      </span>
                      {entry.is_reversed && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                          Reversed
                        </span>
                      )}
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight mt-1">
                      {entry.description}
                    </h1>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!entry.is_posted && entry.entry_type === 'manual' && (
                  <button
                    onClick={handlePost}
                    disabled={actionLoading || !isBalanced}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-all shadow-sm hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <HiCheckCircle className="h-5 w-5" />
                    Post Entry
                  </button>
                )}
                {entry.is_posted && !entry.is_reversed && (
                  <button
                    onClick={handleReverse}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-all shadow-sm hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <HiXCircle className="h-5 w-5" />
                    Reverse Entry
                  </button>
                )}
                {entry.reverses_journal_number && (
                  <button
                    onClick={() =>
                      router.push(`/dashboard/accounting/journal-entries/${entry.reverses}`)
                    }
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <HiOutlineLink className="h-4 w-4" />
                    View Original
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Entry Info Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Amount Card */}
            <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-5">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                  Entry Amount
                </h3>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-3xl font-bold text-gray-900 dark:text-white tabular-nums">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'LKR',
                      minimumFractionDigits: 2,
                    }).format(totalDebit)}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-3">
                  <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                    <HiArrowUp className="h-4 w-4" />
                    <span className="font-mono font-medium">
                      {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(
                        totalDebit,
                      )}
                    </span>
                    <span className="text-gray-400">DR</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-sm text-rose-600 dark:text-rose-400">
                    <HiArrowDown className="h-4 w-4" />
                    <span className="font-mono font-medium">
                      {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(
                        totalCredit,
                      )}
                    </span>
                    <span className="text-gray-400">CR</span>
                  </span>
                </div>
              </div>
              <div className={`h-1.5 ${isBalanced ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            </div>

            {/* Info Cards */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <HiOutlineCalendar className="h-4 w-4 text-gray-500" />
                </div>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Entry Date
                </span>
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {new Date(entry.entry_date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <HiOutlineUser className="h-4 w-4 text-gray-500" />
                </div>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Created By
                </span>
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                {entry.created_by_name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {new Date(entry.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Entry Details */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                Entry Details
              </h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Source Type
                  </div>
                  <span
                    className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-lg ${sourceColors.bg} ${sourceColors.text}`}
                  >
                    {formatSourceType(entry.source_type)}
                  </span>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Entry Type
                  </div>
                  <span
                    className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-lg ${
                      entry.entry_type === 'system'
                        ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400'
                        : 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400'
                    }`}
                  >
                    {entry.entry_type === 'system' ? 'System Generated' : 'Manual Entry'}
                  </span>
                </div>
                {entry.source_reference && (
                  <div>
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                      Reference
                    </div>
                    <span className="font-mono text-sm text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                      {entry.source_reference}
                    </span>
                  </div>
                )}
                {entry.posted_at && (
                  <div>
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                      Posted At
                    </div>
                    <span className="text-sm text-gray-900 dark:text-white">
                      {new Date(entry.posted_at).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Journal Lines */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  Journal Lines
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {entry.lines.length} {entry.lines.length === 1 ? 'line' : 'lines'}
                </p>
              </div>
              {/* Balance Indicator */}
              {isBalanced ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-lg">
                  <HiCheckCircle className="h-5 w-5" />
                  <span className="text-sm font-medium">Balanced</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 rounded-lg">
                  <HiOutlineExclamationCircle className="h-5 w-5" />
                  <span className="text-sm font-medium">
                    Unbalanced (
                    {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(
                      Math.abs(totalDebit - totalCredit),
                    )}
                    )
                  </span>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/50">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Account Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Account Name
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
                  {entry.lines.map((line) => (
                    <tr
                      key={line.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                          {line.account_code}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                        {line.account_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {line.description || (
                          <span className="text-gray-400 italic">No description</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {parseFloat(line.debit) > 0 ? (
                          <span className="inline-flex items-center gap-1 font-mono text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                            <HiArrowUp className="h-3 w-3" />
                            {new Intl.NumberFormat('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }).format(parseFloat(line.debit))}
                          </span>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {parseFloat(line.credit) > 0 ? (
                          <span className="inline-flex items-center gap-1 font-mono text-sm font-semibold text-rose-600 dark:text-rose-400">
                            <HiArrowDown className="h-3 w-3" />
                            {new Intl.NumberFormat('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }).format(parseFloat(line.credit))}
                          </span>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Totals Row */}
                <tfoot>
                  <tr className="bg-gray-50 dark:bg-gray-900/50 border-t-2 border-gray-200 dark:border-gray-600">
                    <td
                      colSpan={3}
                      className="px-6 py-4 text-right text-sm font-semibold text-gray-900 dark:text-white"
                    >
                      TOTALS
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-mono text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {new Intl.NumberFormat('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }).format(totalDebit)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-mono text-lg font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                        {new Intl.NumberFormat('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }).format(totalCredit)}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
