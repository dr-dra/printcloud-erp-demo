'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useCallback } from 'react';
import { Button, Dropdown, Datepicker, Checkbox, Spinner } from 'flowbite-react';
import { StandardTextInput } from '@/components/common/inputs';
import { HiPlus, HiDotsVertical, HiX } from 'react-icons/hi';
import { BarChart3, Users } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import DataTable from '@/components/common/DataTable';
import type { DataTableColumn } from '@/types/datatable';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { DateRangePicker } from '@/components/DateRangePicker';
import { DateRange } from '@/types/dateRange';
import { usePageInitialization } from '@/hooks/usePageInitialization';
import { getErrorMessage } from '@/utils/errorHandling';
import { formatDateForAPI, formatDateSriLankan } from '@/utils/dateUtils';
import ErrorBanner from '@/components/common/ErrorBanner';
import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { useRowHeightCalibration } from '@/utils/rowHeightCalibration';
import { useNavigationState } from '@/hooks/useNavigationState';
import { useRowHighlight } from '@/hooks/useRowHighlight';
// apiCall will be implemented using the existing api instance

// Dynamically import ApexCharts to avoid SSR issues
const ReactApexChart = dynamic(() => import('react-apexcharts').then((mod) => mod.default), {
  ssr: false,
});

// Types for our costing data
interface Costing {
  id: number;
  date: string;
  customer_name: string;
  project_name: string;
  sales_person_name: string;
}

interface _CostingResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Costing[];
}

interface ChartData {
  labels: string[];
  current: number[];
  previous?: number[];
}

export default function CostingPage() {
  // Theme hook for dark/light mode
  const { theme: _theme, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const router = useRouter();

  // Navigation state management
  const { saveListState, getListState, clearListState } = useNavigationState();

  // Use the page initialization hook
  const {
    pageReady,
    loading: _pageLoading,
    error: _pageError,
    calculatedRowsPerPage,
    rowsPerPage,
    isAutoCalculated,
    setRowsPerPage,
    topNavRef,
    titleRef,
    filterBarRef,
    paginationRef,
    tableRef,
  } = usePageInitialization({
    rowHeight: 24, // Compact: py-1.5 (12px total) + text-sm + borders ≈ 24px
    minRows: 5,
    maxRows: 40,
    onInitializationComplete: () => console.log('[CostingPage] Page initialized successfully'),
    onError: (error) => console.warn('[CostingPage] Initialization error:', error),
  });

  // Component-specific states
  const [costings, setCostings] = useState<Costing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { loading: authLoading, isAuthenticated } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: null,
    endDate: null,
  });

  // Sorting state
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Row highlight state for newly created costing
  const { highlightedRowId, setHighlight } = useRowHighlight({ duration: 2500 });

  // Chart Panel State
  const [showChartPanel, setShowChartPanel] = useState(false);
  const [isChartClosing, setIsChartClosing] = useState(false);
  const [activityStartDate, setActivityStartDate] = useState<Date | null>(null);
  const [activityEndDate, setActivityEndDate] = useState<Date | null>(null);
  const [comparePrevYear, setComparePrevYear] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const chartPanelRef = React.useRef<HTMLDivElement>(null);

  // Row height calibration for development
  useRowHeightCalibration(tableRef as React.RefObject<HTMLElement>);

  // Restore navigation state on component mount
  useEffect(() => {
    const savedState = getListState('costing');
    if (savedState) {
      console.log('[CostingPage] Restoring saved navigation state:', savedState);
      setCurrentPage(savedState.currentPage);
      setSearchQuery(savedState.searchQuery);
      if (savedState.dateRange) {
        setDateRange(savedState.dateRange);
      }
      // Clear the state after restoration so it's only used once
      clearListState('costing');
    }
  }, [getListState, clearListState]);

  // Detect newly created or updated costing and highlight it
  useEffect(() => {
    // Check for newly created costing
    const newlyCostingId = sessionStorage.getItem('newlyCostingId');
    if (newlyCostingId) {
      console.log('[CostingPage] Found newly created costing ID:', newlyCostingId);
      setHighlight(parseInt(newlyCostingId, 10));
      sessionStorage.removeItem('newlyCostingId');
    }

    // Check for updated costing
    const updatedCostingId = sessionStorage.getItem('updatedCostingId');
    if (updatedCostingId) {
      console.log('[CostingPage] Found updated costing ID:', updatedCostingId);
      setHighlight(parseInt(updatedCostingId, 10));
      sessionStorage.removeItem('updatedCostingId');
    }
  }, [setHighlight]);

  // Auto-scroll to chart panel when it opens
  useEffect(() => {
    if (showChartPanel) {
      setTimeout(() => {
        document.getElementById('costing-chart')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [showChartPanel]);

  // Reset chart panel state
  const resetChartPanel = () => {
    setActivityStartDate(null);
    setActivityEndDate(null);
    setComparePrevYear(false);
    setChartLoading(false);
    setChartError(null);
    setChartData(null);
  };

  // Close chart panel with animation
  const handleCloseChartPanel = () => {
    if (chartPanelRef.current) {
      // Get the current height before starting animation
      const currentHeight = chartPanelRef.current.scrollHeight;
      chartPanelRef.current.style.height = `${currentHeight}px`;

      // Force a reflow to ensure the height is set
      void chartPanelRef.current.offsetHeight;

      // Start the closing animation
      setIsChartClosing(true);
    }

    setTimeout(() => {
      setShowChartPanel(false);
      setIsChartClosing(false);
      resetChartPanel();
    }, 1500); // 1.5 seconds to match the animation duration
  };

  // Toggle chart panel
  const handleToggleChartPanel = () => {
    if (showChartPanel) {
      handleCloseChartPanel();
    } else {
      // Set default date range: 6 months ago to today
      const today = new Date();
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(today.getMonth() - 6);

      setActivityStartDate(sixMonthsAgo);
      setActivityEndDate(today);
      setShowChartPanel(true);
    }
  };

  // Navigation handlers
  const handleCreateCosting = () => {
    router.push('/dashboard/sales/costing/new');
  };

  // Generate dynamic chart title
  const getChartTitle = () => {
    if (!activityStartDate || !activityEndDate) return 'Costing Activity';

    const startMonth = activityStartDate.toLocaleString('default', { month: 'short' });
    const endMonth = activityEndDate.toLocaleString('default', { month: 'short' });
    const startYear = activityStartDate.getFullYear();
    const endYear = activityEndDate.getFullYear();

    if (comparePrevYear) {
      return `Costing Activity: ${startMonth}–${endMonth} (${startYear - 1} vs ${startYear})`;
    }

    if (startYear === endYear) {
      return `Costing Activity: ${startMonth} – ${endMonth} ${startYear}`;
    }

    return `Costing Activity: ${startMonth} ${startYear} – ${endMonth} ${endYear}`;
  };

  // Generate theme-aware chart options
  const getChartOptions = () => {
    const textColor = isDark ? '#D1D5DB' : '#374151'; // gray-300 : gray-700
    const _backgroundColor = isDark ? '#1F2937' : '#FFFFFF'; // gray-800 : white
    const gridColor = isDark ? '#374151' : '#E5E7EB'; // gray-700 : gray-200
    const titleColor = isDark ? '#F9FAFB' : '#111827'; // gray-50 : gray-900

    return {
      chart: {
        type: 'bar' as const,
        height: 350,
        fontFamily:
          'Montserrat, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
        toolbar: { show: false },
        background: 'transparent',
        foreColor: textColor,
      },
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: '55%',
          borderRadius: 4,
        },
      },
      dataLabels: { enabled: false },
      stroke: { show: true, width: 2, colors: ['transparent'] },
      xaxis: {
        categories: chartData?.labels || [],
        title: { text: 'Months', style: { color: textColor } },
        labels: { style: { colors: textColor } },
      },
      yaxis: {
        title: { text: 'Number of Costing Sheets', style: { color: textColor } },
        labels: { style: { colors: textColor } },
      },
      fill: { opacity: 1 },
      tooltip: {
        theme: isDark ? 'dark' : 'light',
        y: { formatter: (val: number) => `${val} costing sheets` },
      },
      title: {
        text: getChartTitle(),
        align: 'center' as const,
        style: { fontSize: '16px', fontWeight: 'bold', color: titleColor },
      },
      colors: ['#236bb4', '#38bdf8'],
      grid: { borderColor: gridColor, strokeDashArray: 4 },
      legend: { labels: { colors: textColor } },
    };
  };

  // Generate chart report
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

      const response = await api.get(`/costings/costing-activity/?${params.toString()}`);
      setChartData(response.data);
    } catch (err: any) {
      setChartError(getErrorMessage(err, 'Failed to load activity report.'));
    } finally {
      setChartLoading(false);
    }
  };

  // Fetch costings with server-side pagination
  const fetchCostings = useCallback(async () => {
    if (!pageReady) return;

    try {
      setLoading(true);
      setError(null);

      const pageSize = calculatedRowsPerPage;

      console.log('Fetching costings with params:', {
        page: currentPage,
        pageSize,
        searchQuery,
        dateRange,
        rowsPerPage,
        calculatedRowsPerPage,
        startDate: formatDateForAPI(dateRange.startDate),
        endDate: formatDateForAPI(dateRange.endDate),
      });

      const params = new URLSearchParams({
        page: currentPage.toString(),
        page_size: pageSize.toString(),
      });

      if (searchQuery) {
        params.append('search', searchQuery);
      }

      if (dateRange.startDate) {
        const startDateStr = formatDateForAPI(dateRange.startDate);
        if (startDateStr) {
          params.append('start_date', startDateStr);
        }
      }

      if (dateRange.endDate) {
        const endDateStr = formatDateForAPI(dateRange.endDate);
        if (endDateStr) {
          params.append('end_date', endDateStr);
        }
      }

      // Map frontend column keys to backend field names and add ordering parameter
      if (sortField) {
        const fieldMapping: { [key: string]: string } = {
          id: 'id',
          date: 'createdDate',
          customer_name: 'customerName',
          project_name: 'projectName',
          sales_person_name: 'createdBy',
        };

        const backendField = fieldMapping[sortField] || sortField;
        const orderingValue = sortDirection === 'desc' ? `-${backendField}` : backendField;
        params.append('ordering', orderingValue);
      }

      const response = await api.get(`/costings/?${params.toString()}`);
      const data = response.data;

      console.log('Received costings data:', {
        count: data.count,
        results: data.results.length,
        pageSize,
        totalPages: Math.ceil(data.count / pageSize),
      });

      setCostings(data.results);
      setTotalPages(Math.ceil(data.count / pageSize));
      setTotalRecords(data.count);
    } catch (err: any) {
      console.error('Error fetching costings:', err);
      const errorMessage = getErrorMessage(err, 'Failed to load costings. Please try again.');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [
    currentPage,
    calculatedRowsPerPage,
    searchQuery,
    dateRange,
    pageReady,
    sortField,
    sortDirection,
  ]);

  // Fetch costings when dependencies change
  useEffect(() => {
    if (pageReady && !authLoading) {
      fetchCostings();
    }
  }, [fetchCostings, pageReady, authLoading]);

  // Show loading state while auth is being checked or page is initializing
  if (authLoading || !pageReady) {
    return (
      <DashboardLayout>
        <div className="p-4">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <span className="ml-2 text-gray-600">
              {authLoading ? 'Checking authentication...' : 'Initializing page...'}
            </span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Handle rows per page change
  const handleRowsPerPageChange = (value: number | 'auto') => {
    setRowsPerPage(value);
    setCurrentPage(1);
  };

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  // Handle date range change
  const handleDateRangeChange = (range: DateRange) => {
    setDateRange(range);
    setCurrentPage(1);
  };

  // Handle sort change
  const handleSort = (columnKey: string) => {
    // Determine new sort direction
    let newDirection: 'asc' | 'desc' = 'asc';
    if (sortField === columnKey && sortDirection === 'asc') {
      newDirection = 'desc';
    }

    setSortField(columnKey);
    setSortDirection(newDirection);
    setCurrentPage(1); // Reset to first page when sorting changes
  };

  // Handle retry
  const handleRetry = () => {
    setError(null);
    fetchCostings();
  };

  // Calculate displayed rows info
  const _getDisplayedRowsInfo = () => {
    if (!totalRecords) return 'No entries found';

    const pageSize = calculatedRowsPerPage;
    const start = totalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, totalRecords);

    return `Showing ${start} to ${end} of ${totalRecords} entries`;
  };

  // Define columns for the DataTable
  const columns: DataTableColumn[] = [
    { key: 'id', label: 'Cost-ID', sortable: true },
    { key: 'date', label: 'Date', sortable: true },
    { key: 'customer_name', label: 'Customer', sortable: true },
    { key: 'project_name', label: 'Project Name', sortable: true },
    { key: 'sales_person_name', label: 'Salesperson', sortable: true },
  ];

  const handleActionClick = (action: string, costingId: number) => {
    if (action === 'edit') {
      // Save current pagination state before navigation
      saveListState('costing', {
        currentPage,
        searchQuery,
        dateRange,
        pageSize: calculatedRowsPerPage,
      });

      router.push(`/dashboard/sales/costing/${costingId}`);
    } else {
      console.log(`${action} action for costing ${costingId}`);
    }
  };

  const handleRowClick = (costing: Costing) => {
    // Save current pagination state before navigation
    saveListState('costing', {
      currentPage,
      searchQuery,
      dateRange,
      pageSize: calculatedRowsPerPage,
    });

    router.push(`/dashboard/sales/costing/${costing.id}`);
  };

  // Actions dropdown for each row
  const renderActions = (row: Costing) => (
    <Dropdown
      label=""
      dismissOnClick={false}
      renderTrigger={() => (
        <button
          type="button"
          className="inline-flex items-center p-2 text-sm font-medium text-center text-gray-900 bg-white rounded-lg hover:bg-gray-100 focus:ring-4 focus:outline-none dark:text-white focus:ring-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-600"
        >
          <HiDotsVertical className="w-4 h-4" />
        </button>
      )}
    >
      <Dropdown.Item onClick={() => handleActionClick('edit', row.id)}>
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
        Edit Costing
      </Dropdown.Item>
      <Dropdown.Item onClick={() => handleActionClick('clone', row.id)}>
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
          />
        </svg>
        Clone this Costing
      </Dropdown.Item>
    </Dropdown>
  );

  return (
    <DashboardLayout>
      <div className="p-2">
        <div ref={topNavRef} />
        <div ref={titleRef} className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Costing Sheets</h1>
        </div>

        {/* List Interface */}
        <div className="space-y-3">
          {/* Filter/Search Bar Card - responsive layout with smaller components */}
          <div
            ref={filterBarRef}
            className="bg-white dark:bg-gray-800 shadow rounded-lg p-2 mb-1 flex flex-wrap items-center justify-between gap-2 sm:gap-4"
          >
            <Button onClick={handleCreateCosting} size="sm">
              <HiPlus className="mr-2 h-4 w-4" />
              New Cost Estimate
            </Button>
            <div className="flex flex-wrap gap-2 sm:gap-4 items-center">
              <StandardTextInput
                type="text"
                placeholder="Search a Cost Estimate..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full sm:w-48 md:w-64"
              />
              <div className="relative">
                <DateRangePicker value={dateRange} onChange={handleDateRangeChange} size="sm" />
                {(dateRange.startDate || dateRange.endDate) && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary-500 rounded-full border-2 border-white"></div>
                )}
              </div>
              <Dropdown
                label=""
                renderTrigger={() => (
                  <button
                    type="button"
                    className="inline-flex items-center p-1.5 text-sm font-medium text-center text-gray-900 bg-white rounded-lg hover:bg-gray-100 focus:ring-4 focus:outline-none dark:text-white focus:ring-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-600"
                  >
                    <HiDotsVertical className="w-4 h-4" />
                  </button>
                )}
              >
                <Dropdown.Item onClick={handleToggleChartPanel}>
                  <div className="flex items-center">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Monthly Costing Activity
                  </div>
                </Dropdown.Item>
                <Dropdown.Item disabled>
                  <div className="flex items-center">
                    <Users className="w-4 h-4 mr-2" />
                    Costing by Salesperson
                  </div>
                </Dropdown.Item>
              </Dropdown>
            </div>
          </div>

          {/* Inline Chart Panel */}
          {showChartPanel && (
            <div
              id="costing-chart"
              ref={chartPanelRef}
              className={`bg-white dark:bg-gray-800 rounded-lg shadow-md mb-3 transition-all duration-[1500ms] ease-in-out ${
                isChartClosing ? 'opacity-0 overflow-hidden' : 'opacity-100 overflow-visible'
              }`}
              style={
                isChartClosing
                  ? {
                      height: '0px',
                      paddingTop: '0px',
                      paddingBottom: '0px',
                      marginBottom: '0px',
                    }
                  : {}
              }
            >
              {/* Panel Content Wrapper */}
              <div className="p-4">
                {/* Panel Header */}
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Monthly Costing Activity
                  </h2>
                  <button
                    onClick={handleCloseChartPanel}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
                  >
                    <HiX className="w-6 h-6" />
                  </button>
                </div>

                {/* Panel Controls */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 items-end mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Start Date
                    </label>
                    <Datepicker
                      value={activityStartDate ? activityStartDate.toISOString().split('T')[0] : ''}
                      onSelectedDateChanged={setActivityStartDate}
                      maxDate={activityEndDate || undefined}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      End Date
                    </label>
                    <Datepicker
                      value={activityEndDate ? activityEndDate.toISOString().split('T')[0] : ''}
                      onSelectedDateChanged={setActivityEndDate}
                      minDate={activityStartDate || undefined}
                    />
                  </div>
                  <div className="flex items-center justify-center">
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
                      className="w-full bg-primary-500 hover:bg-primary-600 focus:ring-primary-300 text-white border-primary-500 hover:border-primary-600 focus:ring-4 disabled:bg-gray-400 disabled:border-gray-400"
                    >
                      {chartLoading ? <Spinner size="sm" className="mr-2" /> : null}
                      Generate Report
                    </Button>
                  </div>
                </div>

                {/* Error Display */}
                {chartError && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-600 text-sm">{chartError}</p>
                  </div>
                )}

                {/* Chart Display */}
                {chartData && !chartLoading && (
                  <div className="mt-4">
                    <ReactApexChart
                      options={getChartOptions()}
                      series={[
                        { name: 'Current', data: chartData.current },
                        ...(comparePrevYear && chartData.previous
                          ? [{ name: 'Previous', data: chartData.previous }]
                          : []),
                      ]}
                      type="bar"
                      height={350}
                    />
                  </div>
                )}

                {/* Loading State */}
                {chartLoading && (
                  <div className="flex justify-center items-center py-12">
                    <Spinner size="xl" />
                    <span className="ml-3 text-gray-600 dark:text-gray-400">
                      Generating chart...
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <ErrorBanner
              title="Unable to load costing sheets"
              error={error}
              onRetry={handleRetry}
              onDismiss={() => setError(null)}
            />
          )}

          {/* Table Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div ref={tableRef} className="overflow-x-auto">
              <DataTable
                title="Costing Sheets"
                data={costings.map((costing) => ({
                  ...costing,
                  date: formatDateSriLankan(costing.date),
                }))}
                columns={columns}
                loading={loading}
                actions={renderActions}
                onRowClick={handleRowClick}
                onSort={handleSort}
                sortField={sortField}
                sortDirection={sortDirection}
                isServerPaginated={true}
                highlightedRowId={highlightedRowId}
                idColumn="id"
                pagination={{
                  currentPage,
                  totalPages,
                  onPageChange: handlePageChange,
                  perPage: calculatedRowsPerPage,
                  onPerPageChange: handleRowsPerPageChange,
                  totalCount: totalRecords,
                  autoPerPage: isAutoCalculated ? calculatedRowsPerPage : undefined,
                  userRowsPerPage: rowsPerPage,
                }}
              />
            </div>
            <div ref={paginationRef} />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
