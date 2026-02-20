/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { Button, Checkbox, Datepicker, Spinner } from 'flowbite-react';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/utils/errorHandling';
import { formatDateForAPI } from '@/utils/dateUtils';
import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';

// Dynamically import ApexCharts to avoid SSR issues
const ReactApexChart = dynamic(() => import('react-apexcharts').then((mod) => mod.default), {
  ssr: false,
});

interface ChartData {
  labels: string[];
  current: number[];
  previous?: number[];
}

export function TrendReportsTab() {
  const { theme: _theme, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [activityStartDate, setActivityStartDate] = useState<Date | null>(null);
  const [activityEndDate, setActivityEndDate] = useState<Date | null>(null);
  const [comparePrevYear, setComparePrevYear] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<ChartData | null>(null);

  // Initialize with last 6 months
  useEffect(() => {
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(today.getMonth() - 6);

    setActivityStartDate(sixMonthsAgo);
    setActivityEndDate(today);
  }, []);

  // Fetch initial data once dates are set
  useEffect(() => {
    // Only fetch automatically if we have default dates and no data yet
    if (activityStartDate && activityEndDate && !chartData && !chartLoading) {
      handleGenerateReport();
    }
  }, [activityStartDate, activityEndDate]);

  const getChartTitle = () => {
    if (!activityStartDate || !activityEndDate) return 'Sales Trend';

    const startMonth = activityStartDate.toLocaleString('default', { month: 'short' });
    const endMonth = activityEndDate.toLocaleString('default', { month: 'short' });
    const startYear = activityStartDate.getFullYear();
    const endYear = activityEndDate.getFullYear();

    if (comparePrevYear) {
      return `Sales Trend: ${startMonth}–${endMonth} (${startYear - 1} vs ${startYear})`;
    }

    if (startYear === endYear) {
      return `Sales Trend: ${startMonth} – ${endMonth} ${startYear}`;
    }

    return `Sales Trend: ${startMonth} ${startYear} – ${endMonth} ${endYear}`;
  };

  const getChartOptions = () => {
    const textColor = isDark ? '#D1D5DB' : '#374151';
    const gridColor = isDark ? '#374151' : '#E5E7EB';
    const titleColor = isDark ? '#F9FAFB' : '#111827';

    return {
      chart: {
        type: 'area' as const,
        height: 350,
        fontFamily:
          'Montserrat, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
        toolbar: { show: false },
        background: 'transparent',
        foreColor: textColor,
      },
      dataLabels: { enabled: false },
      stroke: { curve: 'smooth' as const, width: 3 },
      xaxis: {
        categories: chartData?.labels || [],
        title: { text: 'Months', style: { color: textColor } },
        labels: { style: { colors: textColor } },
      },
      yaxis: {
        title: { text: 'Sales Amount (Rs.)', style: { color: textColor } },
        labels: { style: { colors: textColor } },
      },
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.7,
          opacityTo: 0.3,
          stops: [0, 90, 100],
        },
      },
      tooltip: {
        theme: isDark ? 'dark' : 'light',
        y: { formatter: (val: number) => `Rs. ${val.toLocaleString()}` },
      },
      title: {
        text: getChartTitle(),
        align: 'center' as const,
        style: { fontSize: '16px', fontWeight: 'bold', color: titleColor },
      },
      colors: ['#0e9f6e', '#3f83f8'], // Green and Blue
      grid: { borderColor: gridColor, strokeDashArray: 4 },
      legend: { labels: { colors: textColor } },
    };
  };

  const handleGenerateReport = async () => {
    if (!activityStartDate || !activityEndDate) {
      setChartError('Please select both start and end dates.');
      return;
    }

    setChartLoading(true);
    setChartError(null);

    try {
      const params = new URLSearchParams({
        start_date: formatDateForAPI(activityStartDate) ?? '',
        end_date: formatDateForAPI(activityEndDate) ?? '',
        compare: comparePrevYear ? 'true' : 'false',
      });

      const response = await api.get(`/pos/orders/monthly_sales_report/?${params.toString()}`);
      setChartData(response.data);
    } catch (err: any) {
      setChartError(getErrorMessage(err, 'Failed to load sales report.'));
    } finally {
      setChartLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Monthly Sales Trend
        </h2>

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 items-end mb-6">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Start Date
            </label>
            <Datepicker
              value={activityStartDate ? activityStartDate.toISOString().split('T')[0] : ''}
              onSelectedDateChanged={(date) => setActivityStartDate(date)}
              maxDate={activityEndDate || undefined}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              End Date
            </label>
            <Datepicker
              value={activityEndDate ? activityEndDate.toISOString().split('T')[0] : ''}
              onSelectedDateChanged={(date) => setActivityEndDate(date)}
              minDate={activityStartDate || undefined}
            />
          </div>
          <div className="flex items-center justify-center pb-2">
            <Checkbox
              id="compare-prev-year"
              checked={comparePrevYear}
              onChange={(e) => setComparePrevYear(e.target.checked)}
            />
            <label
              htmlFor="compare-prev-year"
              className="ml-2 text-sm text-gray-700 dark:text-gray-300"
            >
              Compare previous year
            </label>
          </div>
          <div>
            <Button
              onClick={handleGenerateReport}
              disabled={chartLoading || !activityStartDate || !activityEndDate}
              className="w-full bg-primary-600 hover:bg-primary-700"
            >
              {chartLoading ? <Spinner size="sm" className="mr-2" /> : null}
              Generate Report
            </Button>
          </div>
        </div>

        {/* Error */}
        {chartError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            {chartError}
          </div>
        )}

        {/* Chart */}
        <div className="min-h-[400px]">
          {chartLoading ? (
            <div className="flex justify-center items-center h-[350px]">
              <Spinner size="xl" />
            </div>
          ) : chartData ? (
            <ReactApexChart
              options={getChartOptions()}
              series={[
                { name: 'Current', data: chartData.current },
                ...(comparePrevYear && chartData.previous
                  ? [{ name: 'Previous', data: chartData.previous }]
                  : []),
              ]}
              type="area"
              height={350}
            />
          ) : (
            <div className="flex justify-center items-center h-[350px] text-gray-500">
              Select date range and click Generate Report
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
