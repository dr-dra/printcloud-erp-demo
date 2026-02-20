'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { Spinner } from 'flowbite-react';
import {
  HiOutlineArrowLeft,
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle,
  HiOutlineInformationCircle,
  HiOutlineCalendar,
  HiOutlineDocumentText,
  HiArrowUp,
  HiArrowDown,
} from 'react-icons/hi';
import DashboardLayout from '@/components/DashboardLayout';
import { useChartOfAccounts, useCreateJournalEntry } from '@/hooks/useAccounting';

interface JournalLineForm {
  account_code: string;
  description: string;
  debit: string;
  credit: string;
}

interface ManualJournalForm {
  entry_date: string;
  description: string;
  lines: JournalLineForm[];
}

export default function NewManualJournalPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch chart of accounts for dropdown
  const { data: accounts, isLoading: accountsLoading } = useChartOfAccounts({ active: true });

  // Create journal mutation
  const createJournalMutation = useCreateJournalEntry();

  // Form setup
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ManualJournalForm>({
    defaultValues: {
      entry_date: new Date().toISOString().split('T')[0],
      description: '',
      lines: [
        { account_code: '', description: '', debit: '', credit: '' },
        { account_code: '', description: '', debit: '', credit: '' },
      ],
    },
  });

  // Field array for dynamic lines
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'lines',
  });

  // Watch all lines to calculate totals
  const watchedLines = watch('lines');

  // Calculate totals
  const totalDebit = watchedLines.reduce((sum, line) => sum + parseFloat(line.debit || '0'), 0);
  const totalCredit = watchedLines.reduce((sum, line) => sum + parseFloat(line.credit || '0'), 0);
  const isBalanced = totalDebit === totalCredit && totalDebit > 0;
  const difference = Math.abs(totalDebit - totalCredit);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Add new line
  const addLine = () => {
    append({ account_code: '', description: '', debit: '', credit: '' });
  };

  // Submit handler
  const onSubmit = async (data: ManualJournalForm) => {
    if (!isBalanced) {
      alert('Journal entry must balance! Debits must equal credits.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createJournalMutation.mutateAsync(data);
      alert('Manual journal entry created successfully!');
      router.push('/dashboard/accounting/journal-entries');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      alert(`Error creating journal entry: ${err.response?.data?.error || err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-6">
            <button
              onClick={() => router.push('/dashboard/accounting/journal-entries')}
              className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <HiOutlineArrowLeft className="h-4 w-4" />
              Back to Journal Entries
            </button>

            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/30">
                <HiOutlineDocumentText className="h-6 w-6 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  New Manual Journal Entry
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Create a manual adjustment or correction entry
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Important Notice */}
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-900/20">
              <div className="flex gap-3">
                <HiOutlineExclamationCircle className="h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="text-sm">
                  <p className="font-semibold text-amber-800 dark:text-amber-200">
                    Important Notice
                  </p>
                  <ul className="mt-2 space-y-1 text-amber-700 dark:text-amber-300">
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-amber-500" />
                      Manual journal entries are for administrative use only
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-amber-500" />
                      Use this for opening balances, period-end adjustments, or corrections
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-amber-500" />
                      Once posted, entries cannot be edited — only reversed
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-amber-500" />
                      Debits must equal credits for the entry to be valid
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Entry Details Card */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Entry Details
                </h2>
              </div>
              <div className="p-6">
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Entry Date */}
                  <div>
                    <label
                      htmlFor="entry_date"
                      className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      <span className="flex items-center gap-2">
                        <HiOutlineCalendar className="h-4 w-4 text-gray-400" />
                        Entry Date
                      </span>
                    </label>
                    <input
                      id="entry_date"
                      type="date"
                      {...register('entry_date', { required: 'Entry date is required' })}
                      className={`w-full rounded-lg border px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white ${
                        errors.entry_date
                          ? 'border-red-300 bg-red-50 dark:border-red-600 dark:bg-red-900/20'
                          : 'border-gray-300 bg-white dark:border-gray-600'
                      }`}
                    />
                    {errors.entry_date && (
                      <p className="mt-1 text-sm text-red-500">{errors.entry_date.message}</p>
                    )}
                  </div>

                  {/* Status Info */}
                  <div className="flex items-end">
                    <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2.5 dark:bg-gray-700">
                      <HiOutlineInformationCircle className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        Entry will be posted immediately upon creation
                      </span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="mt-6">
                  <label
                    htmlFor="description"
                    className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    <span className="flex items-center gap-2">
                      <HiOutlineDocumentText className="h-4 w-4 text-gray-400" />
                      Description
                    </span>
                  </label>
                  <textarea
                    id="description"
                    rows={3}
                    {...register('description', {
                      required: 'Description is required',
                      minLength: {
                        value: 10,
                        message: 'Description must be at least 10 characters',
                      },
                    })}
                    className={`w-full rounded-lg border px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white ${
                      errors.description
                        ? 'border-red-300 bg-red-50 dark:border-red-600 dark:bg-red-900/20'
                        : 'border-gray-300 bg-white dark:border-gray-600'
                    }`}
                    placeholder="Describe the purpose of this journal entry (e.g., Opening balance adjustment, Month-end accrual...)"
                  />
                  {errors.description && (
                    <p className="mt-1 text-sm text-red-500">{errors.description.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Journal Lines Card */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Journal Lines
                </h2>
                <button
                  type="button"
                  onClick={addLine}
                  className="inline-flex items-center gap-2 rounded-lg border border-primary-300 bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-100 dark:border-primary-700 dark:bg-primary-900/30 dark:text-primary-300 dark:hover:bg-primary-900/50"
                >
                  <HiOutlinePlus className="h-4 w-4" />
                  Add Line
                </button>
              </div>

              <div className="overflow-x-auto">
                {accountsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Spinner size="lg" />
                    <span className="ml-3 text-gray-500">Loading accounts...</span>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-900/50">
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                          Account
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                          Description
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                          <span className="flex items-center justify-end gap-1">
                            <HiArrowUp className="h-3 w-3 text-emerald-500" />
                            Debit
                          </span>
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                          <span className="flex items-center justify-end gap-1">
                            <HiArrowDown className="h-3 w-3 text-rose-500" />
                            Credit
                          </span>
                        </th>
                        <th className="w-16 px-6 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {fields.map((field, index) => {
                        const lineDebit = parseFloat(watchedLines[index]?.debit || '0');
                        const lineCredit = parseFloat(watchedLines[index]?.credit || '0');
                        const hasError = lineDebit > 0 && lineCredit > 0;

                        return (
                          <tr
                            key={field.id}
                            className={`bg-white dark:bg-gray-800 ${hasError ? 'bg-red-50 dark:bg-red-900/10' : ''}`}
                          >
                            {/* Account Dropdown */}
                            <td className="px-6 py-3">
                              <select
                                {...register(`lines.${index}.account_code`, {
                                  required: 'Required',
                                })}
                                className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white ${
                                  errors.lines?.[index]?.account_code
                                    ? 'border-red-300 bg-red-50 dark:border-red-600'
                                    : 'border-gray-300 bg-white dark:border-gray-600'
                                }`}
                              >
                                <option value="">Select account...</option>
                                {accounts?.map((account) => (
                                  <option key={account.id} value={account.account_code}>
                                    {account.account_code} - {account.account_name}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Description */}
                            <td className="px-6 py-3">
                              <input
                                {...register(`lines.${index}.description`)}
                                placeholder="Optional line description"
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                              />
                            </td>

                            {/* Debit */}
                            <td className="px-6 py-3">
                              <input
                                {...register(`lines.${index}.debit`, {
                                  pattern: {
                                    value: /^\d*\.?\d{0,2}$/,
                                    message: 'Invalid',
                                  },
                                })}
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                className={`w-full rounded-lg border px-3 py-2 text-right font-mono text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white ${
                                  hasError
                                    ? 'border-red-300 bg-red-50 dark:border-red-600'
                                    : 'border-gray-300 bg-white dark:border-gray-600'
                                }`}
                              />
                            </td>

                            {/* Credit */}
                            <td className="px-6 py-3">
                              <input
                                {...register(`lines.${index}.credit`, {
                                  pattern: {
                                    value: /^\d*\.?\d{0,2}$/,
                                    message: 'Invalid',
                                  },
                                })}
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                className={`w-full rounded-lg border px-3 py-2 text-right font-mono text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white ${
                                  hasError
                                    ? 'border-red-300 bg-red-50 dark:border-red-600'
                                    : 'border-gray-300 bg-white dark:border-gray-600'
                                }`}
                              />
                            </td>

                            {/* Remove Button */}
                            <td className="px-6 py-3">
                              {fields.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => remove(index)}
                                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30"
                                >
                                  <HiOutlineTrash className="h-4 w-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {/* Totals Row */}
                      <tr className="border-t-2 border-gray-300 bg-gray-100 font-semibold dark:border-gray-600 dark:bg-gray-900">
                        <td
                          colSpan={2}
                          className="px-6 py-4 text-right text-sm uppercase tracking-wide text-gray-600 dark:text-gray-300"
                        >
                          Totals
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="inline-flex items-center gap-1.5 font-mono text-lg tabular-nums text-emerald-600 dark:text-emerald-400">
                            <HiArrowUp className="h-4 w-4" />
                            {formatCurrency(totalDebit)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="inline-flex items-center gap-1.5 font-mono text-lg tabular-nums text-rose-600 dark:text-rose-400">
                            <HiArrowDown className="h-4 w-4" />
                            {formatCurrency(totalCredit)}
                          </span>
                        </td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>

              {/* Balance Status */}
              <div className="border-t border-gray-200 px-6 py-4 dark:border-gray-700">
                <div className="flex items-center justify-center">
                  {isBalanced ? (
                    <div className="flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 dark:bg-emerald-900/30">
                      <HiOutlineCheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                        Entry is balanced and ready to post
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-full bg-red-100 px-4 py-2 dark:bg-red-900/30">
                      <HiOutlineExclamationCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                      <span className="text-sm font-medium text-red-700 dark:text-red-300">
                        {totalDebit === 0 && totalCredit === 0
                          ? 'Enter debit and credit amounts'
                          : `Difference: ${formatCurrency(difference)} — entry must balance`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Submit Section */}
            <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <HiOutlineInformationCircle className="h-4 w-4" />
                Entry will be posted immediately and cannot be edited
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => router.push('/dashboard/accounting/journal-entries')}
                  disabled={isSubmitting}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isBalanced || isSubmitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Spinner size="sm" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <HiOutlineCheckCircle className="h-5 w-5" />
                      Create & Post Entry
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
