'use client';

import dynamic from 'next/dynamic';
import { Card } from 'flowbite-react';
import { useMemo } from 'react';
import { useTheme } from 'next-themes';
import { HiOutlineChartBar, HiOutlineChartPie } from 'react-icons/hi';
import type { CashBookReport } from '@/types/accounting';

const ReactApexChart = dynamic(() => import('react-apexcharts').then((mod) => mod.default), {
  ssr: false,
});

interface CashBookChartsProps {
  report: CashBookReport;
  startDate: string;
  endDate: string;
}

const buildDateRange = (startDate: string, endDate: string) => {
  if (!startDate || !endDate) {
    return [] as string[];
  }

  const dates: string[] = [];
  const cursor = new Date(startDate);
  const end = new Date(endDate);

  while (cursor <= end) {
    dates.push(cursor.toISOString().split('T')[0]);
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
};

const normalizeDate = (value: string) => value.split('T')[0];

export default function CashBookCharts({ report, startDate, endDate }: CashBookChartsProps) {
  const { resolvedTheme } = useTheme();

  const chartData = useMemo(() => {
    const rangeDates = buildDateRange(startDate, endDate);
    const receiptsByDate: Record<string, number> = {};
    const paymentsByDate: Record<string, number> = {};

    report.transactions.forEach((txn) => {
      const dateKey = normalizeDate(txn.date);
      const debit = parseFloat(txn.debit || '0');
      const credit = parseFloat(txn.credit || '0');
      receiptsByDate[dateKey] = (receiptsByDate[dateKey] || 0) + debit;
      paymentsByDate[dateKey] = (paymentsByDate[dateKey] || 0) + credit;
    });

    const categories = rangeDates.length ? rangeDates : Object.keys(receiptsByDate).sort();
    const receiptsSeries = categories.map((date) => receiptsByDate[date] || 0);
    const paymentsSeries = categories.map((date) => paymentsByDate[date] || 0);

    return {
      categories,
      receiptsSeries,
      paymentsSeries,
    };
  }, [report.transactions, startDate, endDate]);

  const donutSeries = [
    parseFloat(report.total_receipts || '0'),
    parseFloat(report.total_payments || '0'),
  ];

  const isDark = resolvedTheme === 'dark';

  const chartColors = isDark ? ['#6ee7b7', '#fca5a5'] : ['#22c55e', '#ef4444'];

  const donutOptions = {
    chart: { type: 'donut' as const },
    labels: ['Receipts', 'Payments'],
    colors: chartColors,
    legend: { position: 'bottom' as const, labels: { colors: isDark ? '#e5e7eb' : '#374151' } },
    dataLabels: { enabled: true },
  };

  const lineOptions = {
    chart: { type: 'area' as const, toolbar: { show: false } },
    stroke: { curve: 'smooth' as const, width: 2 },
    xaxis: {
      categories: chartData.categories,
      labels: { style: { colors: isDark ? '#e5e7eb' : '#6b7280' } },
    },
    yaxis: {
      labels: { style: { colors: isDark ? '#e5e7eb' : '#6b7280' } },
    },
    colors: chartColors,
    legend: { position: 'top' as const, labels: { colors: isDark ? '#e5e7eb' : '#374151' } },
    dataLabels: { enabled: false },
    grid: { borderColor: isDark ? '#374151' : '#e5e7eb' },
  };

  return (
    <div className="grid grid-cols-1 gap-4">
      <Card className="border border-gray-200/80 dark:border-gray-700/60 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              <HiOutlineChartPie className="h-4 w-4" />
              Breakdown
            </div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Receipts vs Payments
            </div>
          </div>
        </div>
        <ReactApexChart options={donutOptions} series={donutSeries} type="donut" height={260} />
      </Card>

      <Card className="border border-gray-200/80 dark:border-gray-700/60 shadow-sm">
        <div className="mb-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            <HiOutlineChartBar className="h-4 w-4" />
            Trend
          </div>
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Daily Cash Movement
          </div>
        </div>
        <ReactApexChart
          options={lineOptions}
          series={[
            { name: 'Receipts', data: chartData.receiptsSeries },
            { name: 'Payments', data: chartData.paymentsSeries },
          ]}
          type="area"
          height={260}
        />
      </Card>
    </div>
  );
}
