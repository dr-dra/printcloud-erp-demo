'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Table, Spinner } from 'flowbite-react';
import { HiArrowLeft, HiDownload, HiPrinter } from 'react-icons/hi';
import DashboardLayout from '@/components/DashboardLayout';
import { useProfitLossReport } from '@/hooks/useAccounting';

export default function ProfitLossReportPage() {
  const router = useRouter();
  const today = new Date().toISOString().split('T')[0];
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .split('T')[0];

  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(today);

  // Fetch P&L report
  const {
    data: report,
    isLoading,
    error,
  } = useProfitLossReport({
    start_date: startDate,
    end_date: endDate,
  });

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    // TODO: Implement CSV export
    alert('Export functionality coming soon');
  };

  return (
    <DashboardLayout>
      <div className="p-4">
        <div className="flex items-center gap-4 mb-6">
          <Button
            color="gray"
            size="sm"
            onClick={() => router.push('/dashboard/accounting/reports')}
          >
            <HiArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Profit & Loss Statement
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              View and analyze profit & loss statement
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Date Range Filter */}
          <Card>
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="flex flex-col gap-4 md:flex-row md:items-end">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="block rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="block rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button color="gray" onClick={handlePrint}>
                  <HiPrinter className="mr-2 h-5 w-5" />
                  Print
                </Button>
                <Button color="gray" onClick={handleExport}>
                  <HiDownload className="mr-2 h-5 w-5" />
                  Export
                </Button>
              </div>
            </div>
          </Card>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Spinner size="xl" />
              <span className="ml-3 text-lg text-gray-600 dark:text-gray-400">
                Loading profit & loss report...
              </span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-red-800 dark:text-red-200">
                Error loading profit & loss report: {error.message}
              </p>
            </div>
          )}

          {/* Report Content */}
          {report && (
            <>
              {/* Period Header */}
              <Card>
                <div className="text-center">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    Period: {new Date(report.period.start_date).toLocaleDateString()} to{' '}
                    {new Date(report.period.end_date).toLocaleDateString()}
                  </h2>
                </div>
              </Card>

              {/* Income Section */}
              <Card>
                <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">Income</h2>
                <div className="overflow-x-auto">
                  <Table>
                    <Table.Body className="divide-y">
                      {report.income.map((account) => (
                        <Table.Row
                          key={account.account_code}
                          className="bg-white dark:border-gray-700 dark:bg-gray-800"
                        >
                          <Table.Cell className="font-medium text-gray-900 dark:text-white">
                            {account.account_name}
                          </Table.Cell>
                          <Table.Cell className="text-right">
                            <span className="font-mono font-semibold text-green-600 dark:text-green-400">
                              {new Intl.NumberFormat('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }).format(parseFloat(account.amount))}
                            </span>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                      {/* Total Income Row */}
                      <Table.Row className="bg-gray-50 font-bold dark:bg-gray-900">
                        <Table.Cell>Total Income</Table.Cell>
                        <Table.Cell className="text-right">
                          <span className="font-mono text-lg text-green-600 dark:text-green-400">
                            {new Intl.NumberFormat('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }).format(parseFloat(report.total_income))}
                          </span>
                        </Table.Cell>
                      </Table.Row>
                    </Table.Body>
                  </Table>
                </div>

                {report.income.length === 0 && (
                  <div className="py-4 text-center text-gray-500 dark:text-gray-400">
                    No income for the selected period
                  </div>
                )}
              </Card>

              {/* Expenses Section */}
              <Card>
                <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">Expenses</h2>
                <div className="overflow-x-auto">
                  <Table>
                    <Table.Body className="divide-y">
                      {report.expenses.map((account) => (
                        <Table.Row
                          key={account.account_code}
                          className="bg-white dark:border-gray-700 dark:bg-gray-800"
                        >
                          <Table.Cell className="font-medium text-gray-900 dark:text-white">
                            {account.account_name}
                          </Table.Cell>
                          <Table.Cell className="text-right">
                            <span className="font-mono font-semibold text-red-600 dark:text-red-400">
                              {new Intl.NumberFormat('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }).format(parseFloat(account.amount))}
                            </span>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                      {/* Total Expenses Row */}
                      <Table.Row className="bg-gray-50 font-bold dark:bg-gray-900">
                        <Table.Cell>Total Expenses</Table.Cell>
                        <Table.Cell className="text-right">
                          <span className="font-mono text-lg text-red-600 dark:text-red-400">
                            {new Intl.NumberFormat('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }).format(parseFloat(report.total_expenses))}
                          </span>
                        </Table.Cell>
                      </Table.Row>
                    </Table.Body>
                  </Table>
                </div>

                {report.expenses.length === 0 && (
                  <div className="py-4 text-center text-gray-500 dark:text-gray-400">
                    No expenses for the selected period
                  </div>
                )}
              </Card>

              {/* Net Profit/Loss Summary */}
              <Card>
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-200 pb-4 dark:border-gray-700">
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">
                      Total Income
                    </span>
                    <span className="font-mono text-xl font-bold text-green-600 dark:text-green-400">
                      {new Intl.NumberFormat('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }).format(parseFloat(report.total_income))}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-b border-gray-200 pb-4 dark:border-gray-700">
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">
                      Total Expenses
                    </span>
                    <span className="font-mono text-xl font-bold text-red-600 dark:text-red-400">
                      {new Intl.NumberFormat('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }).format(parseFloat(report.total_expenses))}
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-gray-50 p-4 dark:bg-gray-900">
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">
                      {parseFloat(report.net_profit) >= 0 ? 'Net Profit' : 'Net Loss'}
                    </span>
                    <span
                      className={`font-mono text-3xl font-bold ${
                        parseFloat(report.net_profit) >= 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {new Intl.NumberFormat('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }).format(Math.abs(parseFloat(report.net_profit)))}
                    </span>
                  </div>

                  {/* Profit Margin */}
                  {parseFloat(report.total_income) > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Profit Margin
                      </span>
                      <span
                        className={`text-lg font-semibold ${
                          parseFloat(report.net_profit) >= 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {(
                          (parseFloat(report.net_profit) / parseFloat(report.total_income)) *
                          100
                        ).toFixed(2)}
                        %
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
