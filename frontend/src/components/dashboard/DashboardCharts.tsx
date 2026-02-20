'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { Card } from 'flowbite-react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/context/AuthContext';
import { formatIndianCurrency } from '@/utils/currencyUtils';
import { formatDateForAPI } from '@/utils/dateUtils';
import {
  useInventoryReorderItems,
  useMonthlyProfitTrend,
  usePosOpenSessionReport,
  useSalesPipelineCounts,
  useStockMovementTrend,
  useTopCustomersByInvoice,
} from '@/hooks/useDashboard';
import { useAPAgingReport, useARAgingReport, useCashBookReport } from '@/hooks/useAccounting';

const ReactApexChart = dynamic(() => import('react-apexcharts').then((mod) => mod.default), {
  ssr: false,
});

const CHART_HEIGHT = 280;

export default function DashboardCharts() {
  const { theme } = useTheme();
  const { isAuthenticated } = useAuth();
  const isDark = theme === 'dark';

  const asOfDateParams = useMemo(() => {
    const today = new Date();
    return { as_of_date: formatDateForAPI(today) || undefined };
  }, []);

  const cashBookParams = useMemo(() => {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 29);
    return {
      start_date: formatDateForAPI(startDate) || '',
      end_date: formatDateForAPI(today) || '',
    };
  }, []);

  const pipeline = useSalesPipelineCounts(isAuthenticated);
  const arAging = useARAgingReport(asOfDateParams, { enabled: isAuthenticated });
  const apAging = useAPAgingReport(asOfDateParams, { enabled: isAuthenticated });
  const profitTrend = useMonthlyProfitTrend(isAuthenticated);
  const cashBook = useCashBookReport(cashBookParams, { enabled: isAuthenticated });
  const posSession = usePosOpenSessionReport(isAuthenticated);
  const reorderItems = useInventoryReorderItems({ page_size: 40 }, isAuthenticated);
  const stockTrend = useStockMovementTrend(isAuthenticated);
  const topCustomers = useTopCustomersByInvoice({ page_size: 200 }, isAuthenticated);

  const palette = useMemo(
    () => ({
      primary: isDark ? '#60a5fa' : '#2563eb',
      success: isDark ? '#34d399' : '#16a34a',
      warning: isDark ? '#fbbf24' : '#d97706',
      danger: isDark ? '#f87171' : '#dc2626',
      neutral: isDark ? '#a1a1aa' : '#6b7280',
    }),
    [isDark],
  );

  const pipelineSeries = useMemo(() => {
    const data = pipeline.data;
    if (!data) {
      return [{ name: 'Count', data: [0, 0, 0, 0] }];
    }
    return [
      {
        name: 'Count',
        data: [data.costings, data.quotations, data.orders, data.invoices],
      },
    ];
  }, [pipeline.data]);

  const pipelineOptions = useMemo(
    () => ({
      chart: { type: 'bar', toolbar: { show: false } },
      plotOptions: { bar: { horizontal: true, borderRadius: 6 } },
      dataLabels: { enabled: true },
      xaxis: {
        categories: ['Costings', 'Quotations', 'Orders', 'Invoices'],
        labels: { style: { colors: isDark ? '#e5e7eb' : '#374151' } },
      },
      yaxis: { labels: { style: { colors: isDark ? '#e5e7eb' : '#374151' } } },
      colors: [palette.primary],
    }),
    [isDark, palette.primary],
  );

  const agingOptions = useMemo(
    () => ({
      chart: { type: 'bar', toolbar: { show: false } },
      plotOptions: { bar: { borderRadius: 6 } },
      dataLabels: { enabled: false },
      xaxis: {
        categories: ['Current', '1-30', '31-60', '61-90', '90+'],
        labels: { style: { colors: isDark ? '#e5e7eb' : '#374151' } },
      },
      yaxis: { labels: { style: { colors: isDark ? '#e5e7eb' : '#374151' } } },
      colors: [palette.warning],
    }),
    [isDark, palette.warning],
  );

  const apAgingOptions = useMemo(
    () => ({
      chart: { type: 'bar', toolbar: { show: false } },
      plotOptions: { bar: { borderRadius: 6 } },
      dataLabels: { enabled: false },
      xaxis: {
        categories: ['Current', '31-60', '61-90', '90+'],
        labels: { style: { colors: isDark ? '#e5e7eb' : '#374151' } },
      },
      yaxis: { labels: { style: { colors: isDark ? '#e5e7eb' : '#374151' } } },
      colors: [palette.warning],
    }),
    [isDark, palette.warning],
  );

  const arSeries = useMemo(() => {
    const summary = arAging.data?.summary;
    return [
      {
        name: 'AR',
        data: summary
          ? [
              parseFloat(summary.current) || 0,
              parseFloat(summary.days_1_30) || 0,
              parseFloat(summary.days_31_60) || 0,
              parseFloat(summary.days_61_90) || 0,
              parseFloat(summary.days_90_plus) || 0,
            ]
          : [0, 0, 0, 0, 0],
      },
    ];
  }, [arAging.data?.summary]);

  const apSeries = useMemo(() => {
    const summary = apAging.data?.summary;
    return [
      {
        name: 'AP',
        data: summary
          ? [
              parseFloat(summary.current) || 0,
              parseFloat(summary['31_60_days']) || 0,
              parseFloat(summary['61_90_days']) || 0,
              parseFloat(summary['90_plus_days']) || 0,
            ]
          : [0, 0, 0, 0],
      },
    ];
  }, [apAging.data?.summary]);

  const profitSeries = useMemo(() => {
    if (!profitTrend.data) {
      return [{ name: 'Net Profit', data: [] }];
    }
    return [{ name: 'Net Profit', data: profitTrend.data.values }];
  }, [profitTrend.data]);

  const profitOptions = useMemo(
    () => ({
      chart: { type: 'line', toolbar: { show: false } },
      stroke: { curve: 'smooth', width: 3 },
      dataLabels: { enabled: false },
      xaxis: {
        categories: profitTrend.data?.labels || [],
        labels: { style: { colors: isDark ? '#e5e7eb' : '#374151' } },
      },
      yaxis: { labels: { style: { colors: isDark ? '#e5e7eb' : '#374151' } } },
      colors: [palette.success],
    }),
    [isDark, palette.success, profitTrend.data?.labels],
  );

  const cashBookSeries = useMemo(() => {
    if (!cashBook.data) {
      return [{ name: 'Amount', data: [0, 0] }];
    }
    return [
      {
        name: 'Amount',
        data: [
          parseFloat(cashBook.data.total_receipts) || 0,
          parseFloat(cashBook.data.total_payments) || 0,
        ],
      },
    ];
  }, [cashBook.data]);

  const cashBookOptions = useMemo(
    () => ({
      chart: { type: 'bar', toolbar: { show: false } },
      plotOptions: { bar: { borderRadius: 6, columnWidth: '45%' } },
      dataLabels: { enabled: false },
      xaxis: {
        categories: ['Receipts', 'Payments'],
        labels: { style: { colors: isDark ? '#e5e7eb' : '#374151' } },
      },
      yaxis: { labels: { style: { colors: isDark ? '#e5e7eb' : '#374151' } } },
      colors: [palette.success],
    }),
    [isDark, palette.success],
  );

  const posSeries = useMemo(() => {
    if (!posSession.data) {
      return [0, 0, 0, 0, 0];
    }
    const breakdown = posSession.data.payment_breakdown;
    return [breakdown.cash, breakdown.card, breakdown.lanka_qr, breakdown.account, breakdown.other];
  }, [posSession.data]);

  const posOptions = useMemo(
    () => ({
      chart: { type: 'donut' },
      labels: ['Cash', 'Card', 'QR', 'Account', 'Other'],
      legend: { position: 'bottom', labels: { colors: isDark ? '#e5e7eb' : '#374151' } },
      colors: [palette.primary, palette.success, palette.warning, palette.neutral, palette.danger],
    }),
    [isDark, palette],
  );

  const stockTrendOptions = useMemo(
    () => ({
      chart: { type: 'line', toolbar: { show: false } },
      stroke: { curve: 'smooth', width: 2 },
      dataLabels: { enabled: false },
      xaxis: {
        categories: stockTrend.data?.labels || [],
        labels: { style: { colors: isDark ? '#e5e7eb' : '#374151' } },
      },
      yaxis: { labels: { style: { colors: isDark ? '#e5e7eb' : '#374151' } } },
      colors: [palette.primary, palette.warning, palette.neutral],
    }),
    [isDark, palette, stockTrend.data?.labels],
  );

  const stockTrendSeries = useMemo(() => {
    if (!stockTrend.data) {
      return [
        { name: 'Purchase', data: [] },
        { name: 'Sale', data: [] },
        { name: 'Adjustment', data: [] },
      ];
    }
    return [
      { name: 'Purchase', data: stockTrend.data.purchase },
      { name: 'Sale', data: stockTrend.data.sale },
      { name: 'Adjustment', data: stockTrend.data.adjustment },
    ];
  }, [stockTrend.data]);

  const reorderHeatmapSeries = useMemo(() => {
    const items = reorderItems.data?.results || [];
    if (items.length === 0) {
      return [
        {
          name: 'Low Stock',
          data: [{ x: 'No data', y: 0 }],
        },
      ];
    }

    const grouped = new Map<string, { x: string; y: number }[]>();
    items.forEach((item) => {
      const category = item.category ? String(item.category) : 'Uncategorized';
      const entry = grouped.get(category) || [];
      entry.push({
        x: item.product_name || item.sku,
        y: item.total_stock,
      });
      grouped.set(category, entry);
    });

    return Array.from(grouped.entries()).map(([name, data]) => ({ name, data }));
  }, [reorderItems.data?.results]);

  const heatmapOptions = useMemo(
    () => ({
      chart: { type: 'heatmap', toolbar: { show: false } },
      dataLabels: { enabled: false },
      legend: { position: 'bottom', labels: { colors: isDark ? '#e5e7eb' : '#374151' } },
      colors: [palette.danger, palette.warning, palette.success],
      xaxis: { labels: { style: { colors: isDark ? '#e5e7eb' : '#374151' } } },
      yaxis: { labels: { style: { colors: isDark ? '#e5e7eb' : '#374151' } } },
    }),
    [isDark, palette],
  );

  const topCustomerSeries = useMemo(() => {
    const data = topCustomers.data || [];
    return [
      {
        name: 'Spend',
        data: data.map((customer) => customer.total),
      },
    ];
  }, [topCustomers.data]);

  const topCustomerOptions = useMemo(
    () => ({
      chart: { type: 'bar', toolbar: { show: false } },
      plotOptions: { bar: { horizontal: true, borderRadius: 6 } },
      dataLabels: { enabled: false },
      xaxis: {
        categories: (topCustomers.data || []).map((customer) => customer.name),
        labels: { style: { colors: isDark ? '#e5e7eb' : '#374151' } },
      },
      yaxis: { labels: { style: { colors: isDark ? '#e5e7eb' : '#374151' } } },
      colors: [palette.primary],
    }),
    [isDark, palette.primary, topCustomers.data],
  );

  const productionSeries = useMemo(() => [{ name: 'Jobs', data: [0, 0, 0, 0] }], []);

  const productionOptions = useMemo(
    () => ({
      chart: { type: 'bar', toolbar: { show: false } },
      plotOptions: { bar: { borderRadius: 6 } },
      dataLabels: { enabled: false },
      xaxis: {
        categories: ['Queued', 'In Progress', 'Completed', 'On Hold'],
        labels: { style: { colors: isDark ? '#e5e7eb' : '#374151' } },
      },
      yaxis: { labels: { style: { colors: isDark ? '#e5e7eb' : '#374151' } } },
      colors: [palette.neutral],
    }),
    [isDark, palette.neutral],
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Sales Pipeline Funnel
          </h3>
          <ReactApexChart
            options={pipelineOptions}
            series={pipelineSeries}
            type="bar"
            height={CHART_HEIGHT}
          />
        </Card>
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Top Customers</h3>
          <ReactApexChart
            options={topCustomerOptions}
            series={topCustomerSeries}
            type="bar"
            height={CHART_HEIGHT}
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">AR Aging</h3>
          <ReactApexChart
            options={agingOptions}
            series={arSeries}
            type="bar"
            height={CHART_HEIGHT}
          />
        </Card>
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">AP Aging</h3>
          <ReactApexChart
            options={apAgingOptions}
            series={apSeries}
            type="bar"
            height={CHART_HEIGHT}
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Net Profit Trend (6 months)
          </h3>
          <ReactApexChart
            options={profitOptions}
            series={profitSeries}
            type="line"
            height={CHART_HEIGHT}
          />
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Latest: {profitTrend.data ? formatIndianCurrency(profitTrend.data.values.at(-1)) : '—'}
          </p>
        </Card>
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Cash Book Inflow vs Outflow
          </h3>
          <ReactApexChart
            options={cashBookOptions}
            series={cashBookSeries}
            type="bar"
            height={CHART_HEIGHT}
          />
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Last 30 days · Receipts {formatIndianCurrency(cashBook.data?.total_receipts)} · Payments{' '}
            {formatIndianCurrency(cashBook.data?.total_payments)}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">POS Payment Mix</h3>
          <ReactApexChart
            options={posOptions}
            series={posSeries}
            type="donut"
            height={CHART_HEIGHT}
          />
          {!posSession.data && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              No open session data available.
            </p>
          )}
        </Card>
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Inventory Low-Stock Heatmap
          </h3>
          <ReactApexChart
            options={heatmapOptions}
            series={reorderHeatmapSeries}
            type="heatmap"
            height={CHART_HEIGHT}
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Stock Movement Trend
          </h3>
          <ReactApexChart
            options={stockTrendOptions}
            series={stockTrendSeries}
            type="line"
            height={CHART_HEIGHT}
          />
        </Card>
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Production Status Distribution
          </h3>
          <ReactApexChart
            options={productionOptions}
            series={productionSeries}
            type="bar"
            height={CHART_HEIGHT}
          />
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Production analytics will populate once job tracking APIs are connected.
          </p>
        </Card>
      </div>
    </div>
  );
}
