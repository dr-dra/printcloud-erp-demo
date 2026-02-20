'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from 'flowbite-react';
import {
  HiOutlineArrowLeft,
  HiOutlineCalendar,
  HiOutlineCheckCircle,
  HiOutlineInformationCircle,
} from 'react-icons/hi';
import DashboardLayout from '@/components/DashboardLayout';
import { useCreateFiscalPeriod } from '@/hooks/useAccounting';
import { getErrorMessage } from '@/utils/errorHandling';

export default function NewFiscalPeriodPage() {
  const router = useRouter();
  const createFiscalPeriod = useCreateFiscalPeriod();
  const [form, setForm] = useState({
    period_name: '',
    start_date: '',
    end_date: '',
  });

  const updateForm = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.period_name || !form.start_date || !form.end_date) {
      alert('All fields are required.');
      return;
    }
    if (new Date(form.start_date) >= new Date(form.end_date)) {
      alert('Start date must be before end date.');
      return;
    }

    try {
      await createFiscalPeriod.mutateAsync({
        period_name: form.period_name.trim(),
        start_date: form.start_date,
        end_date: form.end_date,
        status: 'open',
      });
      alert('Fiscal period created successfully.');
      router.push('/dashboard/accounting/fiscal-periods');
    } catch (error: unknown) {
      alert(getErrorMessage(error, 'Failed to create fiscal period.'));
    }
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-6">
            <button
              onClick={() => router.push('/dashboard/accounting/fiscal-periods')}
              className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <HiOutlineArrowLeft className="h-4 w-4" />
              Back to Fiscal Periods
            </button>

            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-900/30">
                <HiOutlineCalendar className="h-6 w-6 text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  New Fiscal Period
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Create a new accounting period for journal entries
                </p>
              </div>
            </div>
          </div>

          {/* Info Note */}
          <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-800/50 dark:bg-sky-900/20">
            <div className="flex gap-3">
              <HiOutlineInformationCircle className="h-5 w-5 flex-shrink-0 text-sky-600 dark:text-sky-400" />
              <div className="text-sm">
                <p className="font-semibold text-sky-800 dark:text-sky-200">
                  New periods start as Open
                </p>
                <p className="mt-1 text-sky-700 dark:text-sky-300">
                  You can close and lock periods later when accounting for that period is complete.
                </p>
              </div>
            </div>
          </div>

          {/* Form Card */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Period Details
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 p-6">
              {/* Period Name */}
              <div>
                <label
                  htmlFor="period_name"
                  className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Period Name
                </label>
                <input
                  id="period_name"
                  type="text"
                  value={form.period_name}
                  onChange={(e) => updateForm('period_name', e.target.value)}
                  placeholder="e.g., FY 2026/27 or Q1 2026"
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>

              {/* Date Range */}
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="start_date"
                    className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    <span className="flex items-center gap-2">
                      <HiOutlineCalendar className="h-4 w-4 text-gray-400" />
                      Start Date
                    </span>
                  </label>
                  <input
                    id="start_date"
                    type="date"
                    value={form.start_date}
                    onChange={(e) => updateForm('start_date', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="end_date"
                    className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    <span className="flex items-center gap-2">
                      <HiOutlineCalendar className="h-4 w-4 text-gray-400" />
                      End Date
                    </span>
                  </label>
                  <input
                    id="end_date"
                    type="date"
                    value={form.end_date}
                    onChange={(e) => updateForm('end_date', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between border-t border-gray-200 pt-6 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Start date must be before end date
                </p>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => router.push('/dashboard/accounting/fiscal-periods')}
                    disabled={createFiscalPeriod.isPending}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createFiscalPeriod.isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {createFiscalPeriod.isPending ? (
                      <>
                        <Spinner size="sm" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <HiOutlineCheckCircle className="h-5 w-5" />
                        Create Period
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
