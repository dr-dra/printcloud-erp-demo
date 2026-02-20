'use client';

import { useMemo, useState } from 'react';
import { Button, Spinner } from 'flowbite-react';
import {
  HiOutlineCash,
  HiOutlineDownload,
  HiOutlineOfficeBuilding,
  HiOutlinePrinter,
} from 'react-icons/hi';
import DashboardLayout from '@/components/DashboardLayout';
import CashDepositModal from '@/components/accounting/CashDepositModal';
import CashBookFilters, { CashBookPreset } from '@/components/accounting/cashbook/CashBookFilters';
import CashBookSummaryCards from '@/components/accounting/cashbook/CashBookSummaryCards';
import CashBookCharts from '@/components/accounting/cashbook/CashBookCharts';
import CashBookTable from '@/components/accounting/cashbook/CashBookTable';
import { useCashBookReport } from '@/hooks/useAccounting';

const toDateString = (value: Date) => value.toISOString().split('T')[0];

const getRangeForPreset = (preset: CashBookPreset, today: Date) => {
  const end = new Date(today);
  const start = new Date(today);

  if (preset === 'yesterday') {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
  } else if (preset === 'this_week') {
    const day = start.getDay();
    const diff = (day + 6) % 7;
    start.setDate(start.getDate() - diff);
  } else if (preset === 'this_month') {
    start.setDate(1);
  }

  return { start: toDateString(start), end: toDateString(end) };
};

export default function CashPage() {
  const today = new Date();
  const defaultRange = getRangeForPreset('today', today);

  const [preset, setPreset] = useState<CashBookPreset>('today');
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [search, setSearch] = useState('');
  const [showDepositModal, setShowDepositModal] = useState(false);

  const {
    data: report,
    isLoading,
    error,
  } = useCashBookReport({
    start_date: startDate,
    end_date: endDate,
  });

  const handlePresetChange = (value: CashBookPreset) => {
    setPreset(value);
    if (value !== 'custom') {
      const range = getRangeForPreset(value, new Date());
      setStartDate(range.start);
      setEndDate(range.end);
    }
  };

  const handleDepositSuccess = () => {
    const range = getRangeForPreset('today', new Date());
    setPreset('today');
    setStartDate(range.start);
    setEndDate(range.end);
    setSearch('');
  };

  const filteredTransactions = useMemo(() => {
    if (!report) {
      return [];
    }

    const term = search.trim().toLowerCase();
    if (!term) {
      return report.transactions;
    }

    return report.transactions.filter((txn) => {
      const searchText = [txn.journal_number, txn.description, txn.source_reference, txn.date]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchText.includes(term);
    });
  }, [report, search]);

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    alert('Export functionality coming soon');
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 p-3 lg:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-sky-100 text-sky-600 dark:bg-sky-900/20 dark:text-sky-200 flex items-center justify-center">
                <HiOutlineCash className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cash Book</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  All cash transactions with running balance
                </p>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span className="rounded-full bg-gray-100 px-2 py-0.5 dark:bg-gray-800">
                {startDate} → {endDate}
              </span>
              {report && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                  {report.transactions.length} entries
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setShowDepositModal(true)}>
              <span className="flex items-center gap-2">
                <HiOutlineOfficeBuilding className="h-4 w-4" />
                Deposit Cash to Bank
              </span>
            </Button>
            <Button color="gray" outline onClick={handleExport}>
              <span className="flex items-center gap-2">
                <HiOutlineDownload className="h-4 w-4" />
                Export
              </span>
            </Button>
            <Button color="gray" outline onClick={handlePrint}>
              <span className="flex items-center gap-2">
                <HiOutlinePrinter className="h-4 w-4" />
                Print
              </span>
            </Button>
          </div>
        </div>

        <CashBookFilters
          preset={preset}
          onPresetChange={handlePresetChange}
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          search={search}
          onSearchChange={setSearch}
        />

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Spinner size="xl" />
            <span className="ml-3 text-lg text-gray-600 dark:text-gray-400">
              Loading cash book...
            </span>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
            <p className="text-red-800 dark:text-red-200">
              Error loading cash book: {error.message}
            </p>
          </div>
        )}

        {report && !isLoading && (
          <div className="flex flex-col gap-4 xl:flex-row">
            <div className="flex-1 min-w-0 space-y-4">
              <CashBookSummaryCards report={report} />
              <CashBookTable report={report} transactions={filteredTransactions} search={search} />
            </div>
            <div className="w-full xl:w-80 flex-shrink-0">
              <CashBookCharts report={report} startDate={startDate} endDate={endDate} />
            </div>
          </div>
        )}
      </div>

      <CashDepositModal
        isOpen={showDepositModal}
        onClose={() => setShowDepositModal(false)}
        onSuccess={handleDepositSuccess}
      />
    </DashboardLayout>
  );
}
