'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from 'flowbite-react';
import {
  HiArrowLeft,
  HiOutlinePlusCircle,
  HiOutlineBookOpen,
  HiCheck,
  HiOutlineTag,
  HiOutlineCollection,
  HiOutlineLink,
  HiOutlineCog,
} from 'react-icons/hi';
import DashboardLayout from '@/components/DashboardLayout';
import {
  useAccountCategories,
  useChartOfAccounts,
  useCreateChartOfAccount,
} from '@/hooks/useAccounting';
import { getErrorMessage } from '@/utils/errorHandling';
import { toast } from 'sonner';

// Category color schemes
const categoryColors: Record<string, { bg: string; border: string; text: string }> = {
  Assets: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-200 dark:border-emerald-700',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
  Liabilities: {
    bg: 'bg-rose-50 dark:bg-rose-900/20',
    border: 'border-rose-200 dark:border-rose-700',
    text: 'text-rose-600 dark:text-rose-400',
  },
  Equity: {
    bg: 'bg-violet-50 dark:bg-violet-900/20',
    border: 'border-violet-200 dark:border-violet-700',
    text: 'text-violet-600 dark:text-violet-400',
  },
  Income: {
    bg: 'bg-sky-50 dark:bg-sky-900/20',
    border: 'border-sky-200 dark:border-sky-700',
    text: 'text-sky-600 dark:text-sky-400',
  },
  Expenses: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-700',
    text: 'text-amber-600 dark:text-amber-400',
  },
};

export default function NewChartOfAccountPage() {
  const router = useRouter();
  const { data: categories } = useAccountCategories();
  const { data: accounts } = useChartOfAccounts({ active: undefined });
  const createAccountMutation = useCreateChartOfAccount();

  const [form, setForm] = useState({
    account_code: '',
    account_name: '',
    category: '',
    parent_account: '',
    allow_transactions: true,
    is_active: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const parentOptions = useMemo(() => {
    if (!Array.isArray(accounts)) return [];
    // Filter to show only accounts in the selected category
    if (form.category) {
      return accounts.filter((acc) => acc.category === Number(form.category));
    }
    return accounts;
  }, [accounts, form.category]);

  const selectedCategoryName = useMemo(() => {
    if (!form.category || !Array.isArray(categories)) return null;
    const cat = categories.find((c) => c.id === Number(form.category));
    return cat?.name || null;
  }, [form.category, categories]);

  const updateForm = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!form.account_code.trim()) newErrors.account_code = 'Account code is required';
    if (!form.account_name.trim()) newErrors.account_name = 'Account name is required';
    if (!form.category) newErrors.category = 'Please select a category';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validateForm()) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const response = await createAccountMutation.mutateAsync({
        account_code: form.account_code.trim(),
        account_name: form.account_name.trim(),
        category: Number(form.category),
        parent_account: form.parent_account ? Number(form.parent_account) : null,
        allow_transactions: form.allow_transactions,
        is_active: form.is_active,
      });

      sessionStorage.setItem('newlyAccountId', response.id.toString());
      toast.success('Account created successfully');
      router.push('/dashboard/accounting/chart-of-accounts');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to create account'));
    }
  };

  const getCategoryColors = (name: string | null) => {
    if (!name)
      return {
        bg: 'bg-gray-50 dark:bg-gray-800',
        border: 'border-gray-200 dark:border-gray-700',
        text: 'text-gray-600 dark:text-gray-400',
      };
    return (
      categoryColors[name] || {
        bg: 'bg-gray-50 dark:bg-gray-800',
        border: 'border-gray-200 dark:border-gray-700',
        text: 'text-gray-600 dark:text-gray-400',
      }
    );
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen">
        {/* Header */}
        <div>
          <div className="px-6 py-5">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/dashboard/accounting/chart-of-accounts')}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <HiArrowLeft className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-2">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                    Create New Account
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    Add a new account to your chart of accounts
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={handleSubmit}>
              {/* Main Form Card */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Account Details Section */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-5">
                    <HiOutlineBookOpen className="h-5 w-5 text-gray-400" />
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                      Account Details
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Account Code */}
                    <div>
                      <label
                        htmlFor="account_code"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                      >
                        Account Code <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <div
                          className={`absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors ${focusedField === 'account_code' ? 'text-primary-500' : 'text-gray-400'}`}
                        >
                          <HiOutlineTag className="h-5 w-5" />
                        </div>
                        <input
                          id="account_code"
                          type="text"
                          value={form.account_code}
                          onChange={(e) => updateForm('account_code', e.target.value)}
                          onFocus={() => setFocusedField('account_code')}
                          onBlur={() => setFocusedField(null)}
                          placeholder="e.g. 1100"
                          className={`w-full pl-10 pr-4 py-2.5 text-sm font-mono bg-gray-50 dark:bg-gray-900/50 border rounded-lg transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500 text-gray-900 dark:text-white ${
                            errors.account_code
                              ? 'border-rose-300 dark:border-rose-600 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500'
                              : 'border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 dark:focus:border-primary-500'
                          }`}
                        />
                      </div>
                      {errors.account_code && (
                        <p className="mt-1.5 text-xs text-rose-500 flex items-center gap-1">
                          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                              clipRule="evenodd"
                            />
                          </svg>
                          {errors.account_code}
                        </p>
                      )}
                    </div>

                    {/* Account Name */}
                    <div>
                      <label
                        htmlFor="account_name"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                      >
                        Account Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="account_name"
                        type="text"
                        value={form.account_name}
                        onChange={(e) => updateForm('account_name', e.target.value)}
                        onFocus={() => setFocusedField('account_name')}
                        onBlur={() => setFocusedField(null)}
                        placeholder="e.g. Accounts Receivable"
                        className={`w-full px-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-900/50 border rounded-lg transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500 text-gray-900 dark:text-white ${
                          errors.account_name
                            ? 'border-rose-300 dark:border-rose-600 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500'
                            : 'border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 dark:focus:border-primary-500'
                        }`}
                      />
                      {errors.account_name && (
                        <p className="mt-1.5 text-xs text-rose-500 flex items-center gap-1">
                          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                              clipRule="evenodd"
                            />
                          </svg>
                          {errors.account_name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Classification Section */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-5">
                    <HiOutlineCollection className="h-5 w-5 text-gray-400" />
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                      Classification
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Category */}
                    <div>
                      <label
                        htmlFor="category"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                      >
                        Account Category <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <select
                          id="category"
                          value={form.category}
                          onChange={(e) => {
                            updateForm('category', e.target.value);
                            updateForm('parent_account', ''); // Reset parent when category changes
                          }}
                          className={`w-full px-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-900/50 border rounded-lg transition-all appearance-none cursor-pointer text-gray-900 dark:text-white ${
                            errors.category
                              ? 'border-rose-300 dark:border-rose-600 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500'
                              : 'border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 dark:focus:border-primary-500'
                          }`}
                        >
                          <option value="">Select a category...</option>
                          {Array.isArray(categories) &&
                            categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
                          <svg
                            className="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </div>
                      </div>
                      {errors.category && (
                        <p className="mt-1.5 text-xs text-rose-500 flex items-center gap-1">
                          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                              clipRule="evenodd"
                            />
                          </svg>
                          {errors.category}
                        </p>
                      )}
                      {selectedCategoryName && (
                        <div
                          className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${getCategoryColors(selectedCategoryName).bg} ${getCategoryColors(selectedCategoryName).border} ${getCategoryColors(selectedCategoryName).text} border`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${getCategoryColors(selectedCategoryName).text.replace('text-', 'bg-')}`}
                          />
                          {selectedCategoryName}
                        </div>
                      )}
                    </div>

                    {/* Parent Account */}
                    <div>
                      <label
                        htmlFor="parent_account"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                      >
                        Parent Account
                        <span className="ml-1 text-xs text-gray-400 font-normal">(optional)</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                          <HiOutlineLink className="h-5 w-5" />
                        </div>
                        <select
                          id="parent_account"
                          value={form.parent_account}
                          onChange={(e) => updateForm('parent_account', e.target.value)}
                          disabled={!form.category}
                          className="w-full pl-10 pr-10 py-2.5 text-sm bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg transition-all appearance-none cursor-pointer focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 dark:focus:border-primary-500 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="">No parent (top-level account)</option>
                          {parentOptions.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.account_code} - {account.account_name}
                            </option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
                          <svg
                            className="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </div>
                      </div>
                      <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                        {form.category
                          ? 'Link to a parent account for hierarchical organization'
                          : 'Select a category first'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Settings Section */}
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <HiOutlineCog className="h-5 w-5 text-gray-400" />
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                      Account Settings
                    </h2>
                  </div>

                  <div className="space-y-4">
                    {/* Allow Transactions Toggle */}
                    <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          Allow Transactions
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          Enable posting of journal entries to this account
                        </div>
                      </div>
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={form.allow_transactions}
                          onChange={(e) => updateForm('allow_transactions', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div
                          className={`w-11 h-6 rounded-full peer transition-colors ${form.allow_transactions ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                        >
                          <div
                            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${form.allow_transactions ? 'translate-x-5' : 'translate-x-0'}`}
                          >
                            {form.allow_transactions && (
                              <HiCheck className="h-5 w-5 text-primary-600 p-0.5" />
                            )}
                          </div>
                        </div>
                      </div>
                    </label>

                    {/* Active Toggle */}
                    <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          Active Account
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          Inactive accounts won&apos;t appear in transaction forms
                        </div>
                      </div>
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={form.is_active}
                          onChange={(e) => updateForm('is_active', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div
                          className={`w-11 h-6 rounded-full peer transition-colors ${form.is_active ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                        >
                          <div
                            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0'}`}
                          >
                            {form.is_active && (
                              <HiCheck className="h-5 w-5 text-emerald-500 p-0.5" />
                            )}
                          </div>
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => router.push('/dashboard/accounting/chart-of-accounts')}
                  disabled={createAccountMutation.isPending}
                  className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createAccountMutation.isPending}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-all shadow-sm hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createAccountMutation.isPending ? (
                    <>
                      <Spinner size="sm" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <HiOutlinePlusCircle className="h-5 w-5" />
                      <span>Create Account</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
