'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Dropdown, Spinner } from 'flowbite-react';
import {
  HiPlus,
  HiSearch,
  HiOutlineRefresh,
  HiDownload,
  HiOutlineDocumentText,
  HiDotsVertical,
  HiEye,
  HiArrowUp,
  HiArrowDown,
  HiOutlineCalendar,
} from 'react-icons/hi';
import DashboardLayout from '@/components/DashboardLayout';
import { useJournalEntries } from '@/hooks/useAccounting';
import type { JournalEntryList } from '@/types/accounting';
import ErrorBanner from '@/components/common/ErrorBanner';

// Source type colors for visual distinction
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

export default function JournalEntriesPage() {
  const router = useRouter();
  const [entryTypeFilter, setEntryTypeFilter] = useState<'system' | 'manual' | undefined>(
    undefined,
  );
  const [postedFilter, setPostedFilter] = useState<boolean | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Fetch journal entries
  const {
    data: entries,
    isLoading,
    error,
    refetch,
  } = useJournalEntries({
    entry_type: entryTypeFilter,
    is_posted: postedFilter,
  });

  // Filter entries based on search
  const filteredEntries = useMemo(() => {
    if (!Array.isArray(entries)) return [];
    if (!searchQuery) return entries;

    const query = searchQuery.toLowerCase();
    return entries.filter(
      (entry) =>
        entry.journal_number.toLowerCase().includes(query) ||
        entry.description.toLowerCase().includes(query) ||
        entry.source_type.toLowerCase().includes(query) ||
        entry.created_by_name.toLowerCase().includes(query),
    );
  }, [entries, searchQuery]);

  // Calculate totals
  const totals = useMemo(() => {
    if (!Array.isArray(filteredEntries)) return { debit: 0, credit: 0, count: 0 };
    return {
      debit: filteredEntries.reduce((sum, e) => sum + parseFloat(e.total_debit), 0),
      credit: filteredEntries.reduce((sum, e) => sum + parseFloat(e.total_credit), 0),
      count: filteredEntries.length,
    };
  }, [filteredEntries]);

  const handleViewEntry = (entry: JournalEntryList) => {
    router.push(`/dashboard/accounting/journal-entries/${entry.id}`);
  };

  if (error) {
    return (
      <DashboardLayout>
        <div className="min-h-screen">
          <div className="px-6 py-5">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Journal Entries</h1>
          </div>
          <div className="p-6">
            <ErrorBanner
              title="Unable to load journal entries"
              error={error.message}
              onRetry={() => refetch()}
              onDismiss={() => {}}
            />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen">
        {/* Header Section */}
        <div>
          <div className="px-6 py-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                    Journal Entries
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    View and manage all accounting transactions
                  </p>
                </div>
              </div>

              <button
                onClick={() => router.push('/dashboard/accounting/journal-entries/new')}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98]"
              >
                <HiPlus className="h-5 w-5" />
                <span>Manual Entry</span>
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Filter & Search Bar */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-4">
              {/* Filters Row */}
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                {/* Type & Status Filters */}
                <div className="flex flex-wrap gap-2">
                  {/* Entry Type Filter */}
                  <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <button
                      onClick={() => setEntryTypeFilter(undefined)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                        entryTypeFilter === undefined
                          ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      All Types
                    </button>
                    <button
                      onClick={() => setEntryTypeFilter('system')}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                        entryTypeFilter === 'system'
                          ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      System
                    </button>
                    <button
                      onClick={() => setEntryTypeFilter('manual')}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                        entryTypeFilter === 'manual'
                          ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      Manual
                    </button>
                  </div>

                  {/* Status Filter */}
                  <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <button
                      onClick={() => setPostedFilter(undefined)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                        postedFilter === undefined
                          ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      All Status
                    </button>
                    <button
                      onClick={() => setPostedFilter(true)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                        postedFilter === true
                          ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      Posted
                    </button>
                    <button
                      onClick={() => setPostedFilter(false)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                        postedFilter === false
                          ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      Draft
                    </button>
                  </div>
                </div>

                {/* Search */}
                <div className="relative w-full lg:w-80">
                  <div
                    className={`absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors ${isSearchFocused ? 'text-primary-500' : 'text-gray-400'}`}
                  >
                    <HiSearch className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search journal entries..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
                    className="w-full pl-9 pr-8 py-2 text-sm bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 dark:focus:border-primary-500 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500 text-gray-900 dark:text-white"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Stats & Actions Row */}
              <div className="flex flex-col gap-3 pt-4 mt-4 border-t border-gray-100 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {totals.count}
                    </span>{' '}
                    entries
                  </span>
                  <span className="text-gray-300 dark:text-gray-600">|</span>
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <HiArrowUp className="h-3.5 w-3.5" />
                    <span className="font-mono font-medium">
                      {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(
                        totals.debit,
                      )}
                    </span>
                    <span className="text-gray-400 dark:text-gray-500 ml-1">debit</span>
                  </span>
                  <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
                    <HiArrowDown className="h-3.5 w-3.5" />
                    <span className="font-mono font-medium">
                      {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(
                        totals.credit,
                      )}
                    </span>
                    <span className="text-gray-400 dark:text-gray-500 ml-1">credit</span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => refetch()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <HiOutlineRefresh className="h-4 w-4" />
                    Refresh
                  </button>
                  <Dropdown
                    label=""
                    renderTrigger={() => (
                      <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                        <HiDownload className="h-4 w-4" />
                        Export
                      </button>
                    )}
                  >
                    <Dropdown.Item>Export to CSV</Dropdown.Item>
                    <Dropdown.Item>Export to PDF</Dropdown.Item>
                    <Dropdown.Item>Export to Excel</Dropdown.Item>
                  </Dropdown>
                </div>
              </div>
            </div>
          </div>

          {/* Entries List */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Spinner size="xl" />
                <span className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                  Loading journal entries...
                </span>
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6">
                <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
                  <HiOutlineDocumentText className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                  {searchQuery ? 'No matching entries found' : 'No journal entries yet'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center max-w-sm">
                  {searchQuery
                    ? 'Try adjusting your search or filters'
                    : 'Journal entries will appear here when transactions are recorded'}
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => router.push('/dashboard/accounting/journal-entries/new')}
                    className="mt-4 text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium"
                  >
                    Create manual entry
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900/50">
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Journal #
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Source
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {filteredEntries.map((entry, idx) => {
                      const sourceColors = getSourceColor(entry.source_type);
                      return (
                        <tr
                          key={entry.id}
                          onClick={() => handleViewEntry(entry)}
                          className="group cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                          style={{ animationDelay: `${idx * 15}ms` }}
                        >
                          <td className="px-5 py-3.5">
                            <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                              {entry.journal_number}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                              <HiOutlineCalendar className="h-4 w-4 text-gray-400" />
                              {new Date(entry.entry_date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="max-w-xs">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                                {entry.description}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                by {entry.created_by_name}
                              </p>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-lg ${sourceColors.bg} ${sourceColors.text}`}
                            >
                              {formatSourceType(entry.source_type)}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                              {new Intl.NumberFormat('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }).format(parseFloat(entry.total_debit))}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full ${
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
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <Dropdown
                              label=""
                              dismissOnClick={true}
                              renderTrigger={() => (
                                <button
                                  type="button"
                                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <HiDotsVertical className="w-4 h-4" />
                                </button>
                              )}
                            >
                              <Dropdown.Item onClick={() => handleViewEntry(entry)}>
                                <HiEye className="w-4 h-4 mr-2" />
                                View Details
                              </Dropdown.Item>
                            </Dropdown>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
