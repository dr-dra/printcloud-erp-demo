'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Dropdown, Spinner } from 'flowbite-react';
import {
  HiPlus,
  HiDotsVertical,
  HiEye,
  HiPencil,
  HiDocumentText,
  HiChevronDown,
  HiChevronRight,
  HiSearch,
  HiOutlineRefresh,
  HiDownload,
  HiOutlineBookOpen,
} from 'react-icons/hi';
import DashboardLayout from '@/components/DashboardLayout';
import { useChartOfAccounts, useAccountCategories } from '@/hooks/useAccounting';
import type { ChartOfAccountList } from '@/types/accounting';
import { usePageInitialization } from '@/hooks/usePageInitialization';
import ErrorBanner from '@/components/common/ErrorBanner';
import { useRowHeightCalibration } from '@/utils/rowHeightCalibration';
import { useNavigationState } from '@/hooks/useNavigationState';
import { useRowHighlight } from '@/hooks/useRowHighlight';
import { isAxiosError } from 'axios';

// Category color schemes for visual distinction
const categoryColors: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  Assets: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
    icon: 'text-emerald-500',
  },
  Liabilities: {
    bg: 'bg-rose-50 dark:bg-rose-900/20',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-800',
    icon: 'text-rose-500',
  },
  Equity: {
    bg: 'bg-violet-50 dark:bg-violet-900/20',
    text: 'text-violet-700 dark:text-violet-300',
    border: 'border-violet-200 dark:border-violet-800',
    icon: 'text-violet-500',
  },
  Income: {
    bg: 'bg-sky-50 dark:bg-sky-900/20',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-200 dark:border-sky-800',
    icon: 'text-sky-500',
  },
  Expenses: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
    icon: 'text-amber-500',
  },
};

const getDefaultColor = () => ({
  bg: 'bg-gray-50 dark:bg-gray-800/50',
  text: 'text-gray-700 dark:text-gray-300',
  border: 'border-gray-200 dark:border-gray-700',
  icon: 'text-gray-500',
});

export default function ChartOfAccountsPage() {
  const router = useRouter();
  const { saveListState, getListState, clearListState } = useNavigationState();

  const { error: pageError, topNavRef, titleRef, filterBarRef, tableRef } = usePageInitialization({
    rowHeight: 24,
    minRows: 5,
    maxRows: 40,
    onInitializationComplete: () => console.log('[ChartOfAccountsPage] Page initialized'),
    onError: (error) => console.warn('[ChartOfAccountsPage] Initialization error:', error),
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | 'all'>('all');
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const { highlightedRowId, setHighlight } = useRowHighlight({ duration: 2500 });
  useRowHeightCalibration(tableRef as React.RefObject<HTMLElement>);

  useEffect(() => {
    const savedState = getListState('chart-of-accounts');
    if (savedState) {
      setSearchQuery(savedState.searchQuery || '');
      clearListState('chart-of-accounts');
    }
  }, [getListState, clearListState]);

  useEffect(() => {
    const newlyAccountId = sessionStorage.getItem('newlyAccountId');
    if (newlyAccountId) {
      setHighlight(parseInt(newlyAccountId, 10));
      sessionStorage.removeItem('newlyAccountId');
    }
    const updatedAccountId = sessionStorage.getItem('updatedAccountId');
    if (updatedAccountId) {
      setHighlight(parseInt(updatedAccountId, 10));
      sessionStorage.removeItem('updatedAccountId');
    }
  }, [setHighlight]);

  const { data: accounts, isLoading, error, refetch } = useChartOfAccounts({ active: true });
  const { data: categories } = useAccountCategories();

  // Extract unique categories from accounts data
  const derivedCategories = useMemo(() => {
    if (!Array.isArray(accounts)) return [];
    const categoryMap = new Map<number, { id: number; name: string; count: number }>();

    accounts.forEach((account) => {
      if (!categoryMap.has(account.category)) {
        categoryMap.set(account.category, {
          id: account.category,
          name: account.category_name,
          count: 0,
        });
      }
      const cat = categoryMap.get(account.category)!;
      cat.count++;
    });

    return Array.from(categoryMap.values()).sort((a, b) => a.id - b.id);
  }, [accounts]);

  // Use API categories if available, otherwise use derived categories
  const displayCategories = useMemo(() => {
    if (Array.isArray(categories) && categories.length > 0) {
      return categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        count: accounts?.filter((acc) => acc.category === cat.id).length || 0,
      }));
    }
    return derivedCategories;
  }, [categories, derivedCategories, accounts]);

  // Group accounts by category
  const groupedAccounts = useMemo(() => {
    if (!Array.isArray(accounts)) return {};
    const groups: Record<number, ChartOfAccountList[]> = {};

    let filtered = [...accounts];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (account) =>
          account.account_code.toLowerCase().includes(query) ||
          account.account_name.toLowerCase().includes(query),
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter((account) => account.category === selectedCategory);
    }

    filtered.forEach((account) => {
      if (!groups[account.category]) {
        groups[account.category] = [];
      }
      groups[account.category].push(account);
    });

    return groups;
  }, [accounts, searchQuery, selectedCategory]);

  // Auto-expand all categories on first load
  useEffect(() => {
    if (displayCategories.length > 0 && expandedCategories.size === 0) {
      setExpandedCategories(new Set(displayCategories.map((c) => c.id)));
    }
  }, [displayCategories, expandedCategories.size]);

  // Collapse all when category filter changes (except 'all')
  useEffect(() => {
    if (selectedCategory !== 'all') {
      setExpandedCategories(new Set([selectedCategory as number]));
    }
  }, [selectedCategory]);

  const handleViewAccount = (accountId: number) => {
    saveListState('chart-of-accounts', { searchQuery });
    router.push(`/dashboard/accounting/chart-of-accounts/${accountId}`);
  };

  const handleEditAccount = (accountId: number) => {
    saveListState('chart-of-accounts', { searchQuery });
    router.push(`/dashboard/accounting/chart-of-accounts/${accountId}/edit`);
  };

  const handleViewTransactions = (accountId: number) => {
    saveListState('chart-of-accounts', { searchQuery });
    router.push(`/dashboard/accounting/chart-of-accounts/${accountId}/transactions`);
  };

  const toggleCategory = (categoryId: number) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const getCategoryColor = (categoryName: string) => {
    return categoryColors[categoryName] || getDefaultColor();
  };

  const getErrorMessage = (error: unknown) => {
    if (isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 401) return 'Session expired. Please log in to view chart of accounts.';
      if (status === 403) return 'You do not have permission to view chart of accounts.';
      return error.response?.data?.detail || error.message;
    }
    if (error instanceof Error) return error.message;
    return 'Unable to load chart of accounts.';
  };

  const totalCount = Array.isArray(accounts) ? accounts.length : 0;
  const filteredCount = Object.values(groupedAccounts).flat().length;

  return (
    <DashboardLayout>
      <div className="min-h-screen">
        <div ref={topNavRef} />

        {/* Header Section */}
        <div ref={titleRef}>
          <div className="px-6 py-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                    Chart of Accounts
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    Manage your financial accounts and ledgers
                  </p>
                </div>
              </div>

              <button
                onClick={() => router.push('/dashboard/accounting/chart-of-accounts/new')}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98]"
              >
                <HiPlus className="h-5 w-5" />
                <span>New Account</span>
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Search & Filter Bar */}
          <div
            ref={filterBarRef}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <div className="p-4">
              {/* Category Pills + Search */}
              <div className="flex flex-col gap-3 mb-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                      selectedCategory === 'all'
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    All Accounts
                    <span
                      className={`ml-2 px-1.5 py-0.5 text-xs rounded-md ${
                        selectedCategory === 'all'
                          ? 'bg-primary-500 text-white'
                          : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {totalCount}
                    </span>
                  </button>
                  {displayCategories.map((category) => {
                    const colors = getCategoryColor(category.name);
                    const isSelected = selectedCategory === category.id;
                    return (
                      <button
                        key={category.id}
                        onClick={() => setSelectedCategory(category.id)}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 border ${
                          isSelected
                            ? `${colors.bg} ${colors.text} ${colors.border} shadow-sm`
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 border-transparent'
                        }`}
                      >
                        {category.name}
                        <span
                          className={`ml-2 px-1.5 py-0.5 text-xs rounded-md ${
                            isSelected
                              ? `${colors.bg} ${colors.text}`
                              : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          {category.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-end">
                  <div className="relative w-full lg:w-[22rem]">
                    <div
                      className={`absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors ${isSearchFocused ? 'text-primary-500' : 'text-gray-400'}`}
                    >
                      <HiSearch className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      placeholder="Search accounts..."
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
              </div>

              {/* Actions Bar */}
              <div className="flex flex-col gap-3 pt-3 border-t border-gray-100 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {searchQuery || selectedCategory !== 'all' ? (
                    <span>
                      Showing{' '}
                      <span className="font-medium text-gray-900 dark:text-white">
                        {filteredCount}
                      </span>{' '}
                      of {totalCount} accounts
                    </span>
                  ) : (
                    <span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {totalCount}
                      </span>{' '}
                      accounts total
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
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

          {/* Error Banner */}
          {(error || pageError) && (
            <ErrorBanner
              title="Unable to load chart of accounts"
              error={error ? getErrorMessage(error) : pageError || ''}
              onRetry={() => refetch()}
              onDismiss={() => {}}
            />
          )}

          {/* Accounts List */}
          <div ref={tableRef} className="space-y-4">
            {isLoading ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex flex-col items-center justify-center py-16">
                  <Spinner size="xl" />
                  <span className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                    Loading your accounts...
                  </span>
                </div>
              </div>
            ) : (
              displayCategories.map((category) => {
                const categoryAccounts = groupedAccounts[category.id] || [];
                if (
                  categoryAccounts.length === 0 &&
                  selectedCategory !== 'all' &&
                  selectedCategory !== category.id
                ) {
                  return null;
                }
                const isExpanded = expandedCategories.has(category.id);
                const colors = getCategoryColor(category.name);

                return (
                  <div
                    key={category.id}
                    className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border overflow-hidden transition-all duration-200 ${colors.border}`}
                  >
                    {/* Category Header */}
                    <button
                      onClick={() => toggleCategory(category.id)}
                      className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${isExpanded ? colors.bg : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-1 rounded-lg ${colors.bg}`}>
                          {isExpanded ? (
                            <HiChevronDown className={`h-4 w-4 ${colors.icon}`} />
                          ) : (
                            <HiChevronRight className={`h-4 w-4 ${colors.icon}`} />
                          )}
                        </div>
                        <div className="text-left">
                          <h3 className={`text-sm font-semibold ${colors.text}`}>
                            {category.name}
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {categoryAccounts.length}{' '}
                            {categoryAccounts.length === 1 ? 'account' : 'accounts'}
                          </p>
                        </div>
                      </div>
                      <div
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}
                      >
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'LKR',
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        }).format(
                          categoryAccounts.reduce(
                            (sum, acc) => sum + Math.abs(parseFloat(acc.current_balance)),
                            0,
                          ),
                        )}
                      </div>
                    </button>

                    {/* Accounts Table */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 dark:border-gray-700">
                        {categoryAccounts.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr className="bg-gray-50 dark:bg-gray-900/50">
                                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Code
                                  </th>
                                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Account Name
                                  </th>
                                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Balance
                                  </th>
                                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-16"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {categoryAccounts.map((account, idx) => {
                                  const balance = parseFloat(account.current_balance);
                                  const isNegative = balance < 0;
                                  const isHighlighted = highlightedRowId === account.id;

                                  return (
                                    <tr
                                      key={account.id}
                                      onClick={() => handleViewAccount(account.id)}
                                      className={`group cursor-pointer transition-all duration-150 ${
                                        isHighlighted
                                          ? 'bg-primary-50 dark:bg-primary-900/20 ring-1 ring-inset ring-primary-200 dark:ring-primary-800'
                                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                      }`}
                                      style={{ animationDelay: `${idx * 20}ms` }}
                                    >
                                      <td className="px-4 py-2.5">
                                        <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                                          {account.account_code}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2.5">
                                        <span className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                                          {account.account_name}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2.5 text-right">
                                        <span
                                          className={`font-mono text-sm font-semibold tabular-nums ${
                                            isNegative
                                              ? 'text-rose-600 dark:text-rose-400'
                                              : balance > 0
                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                : 'text-gray-400 dark:text-gray-500'
                                          }`}
                                        >
                                          {new Intl.NumberFormat('en-US', {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          }).format(Math.abs(balance))}
                                          {isNegative && (
                                            <span className="ml-1.5 text-xs px-1.5 py-0.5 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded">
                                              CR
                                            </span>
                                          )}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2.5 text-center">
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
                                          <Dropdown.Item
                                            onClick={() => handleViewAccount(account.id)}
                                          >
                                            <HiEye className="w-4 h-4 mr-2" />
                                            View Details
                                          </Dropdown.Item>
                                          <Dropdown.Item
                                            onClick={() => handleEditAccount(account.id)}
                                          >
                                            <HiPencil className="w-4 h-4 mr-2" />
                                            Edit Account
                                          </Dropdown.Item>
                                          <Dropdown.Divider />
                                          <Dropdown.Item
                                            onClick={() => handleViewTransactions(account.id)}
                                          >
                                            <HiDocumentText className="w-4 h-4 mr-2" />
                                            View Transactions
                                          </Dropdown.Item>
                                        </Dropdown>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-12 px-6">
                            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-full mb-3">
                              <HiOutlineBookOpen className="h-6 w-6 text-gray-400" />
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              No accounts in this category
                            </p>
                            <button
                              onClick={() =>
                                router.push('/dashboard/accounting/chart-of-accounts/new')
                              }
                              className="mt-3 text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium"
                            >
                              Create first account
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
