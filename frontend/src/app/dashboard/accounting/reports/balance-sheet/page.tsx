'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Table, Spinner } from 'flowbite-react';
import { HiArrowLeft, HiDownload, HiPrinter } from 'react-icons/hi';
import DashboardLayout from '@/components/DashboardLayout';
import { useBalanceSheetReport } from '@/hooks/useAccounting';

export default function BalanceSheetReportPage() {
  const router = useRouter();
  const today = new Date().toISOString().split('T')[0];
  const [asOfDate, setAsOfDate] = useState(today);

  // Fetch balance sheet report
  const {
    data: report,
    isLoading,
    error,
  } = useBalanceSheetReport({
    as_of_date: asOfDate,
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Balance Sheet</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              View and analyze balance sheet
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Date Filter */}
          <Card>
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                  As of Date
                </label>
                <input
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  className="block rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
                />
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
                Loading balance sheet...
              </span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-red-800 dark:text-red-200">
                Error loading balance sheet: {error.message}
              </p>
            </div>
          )}

          {/* Report Content */}
          {report && (
            <>
              {/* Report Header */}
              <Card>
                <div className="text-center">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    As of {new Date(asOfDate).toLocaleDateString()}
                  </h2>
                </div>
              </Card>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Assets Column */}
                <div className="space-y-6">
                  {/* Assets Card */}
                  <Card>
                    <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">Assets</h2>
                    <div className="overflow-x-auto">
                      <Table>
                        <Table.Body className="divide-y">
                          {report.assets.map((account) => (
                            <Table.Row
                              key={account.account_code}
                              className="cursor-pointer bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
                              onClick={() =>
                                router.push(`/dashboard/accounting/chart-of-accounts/${account.id}`)
                              }
                            >
                              <Table.Cell className="font-medium text-gray-900 dark:text-white">
                                {account.account_name}
                              </Table.Cell>
                              <Table.Cell className="text-right">
                                <span className="font-mono font-semibold text-gray-900 dark:text-white">
                                  {new Intl.NumberFormat('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  }).format(parseFloat(account.balance))}
                                </span>
                              </Table.Cell>
                            </Table.Row>
                          ))}
                          {/* Total Assets Row */}
                          <Table.Row className="bg-gray-50 font-bold dark:bg-gray-900">
                            <Table.Cell>Total Assets</Table.Cell>
                            <Table.Cell className="text-right">
                              <span className="font-mono text-lg text-blue-600 dark:text-blue-400">
                                {new Intl.NumberFormat('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                }).format(parseFloat(report.total_assets))}
                              </span>
                            </Table.Cell>
                          </Table.Row>
                        </Table.Body>
                      </Table>
                    </div>

                    {report.assets.length === 0 && (
                      <div className="py-4 text-center text-gray-500 dark:text-gray-400">
                        No assets
                      </div>
                    )}
                  </Card>
                </div>

                {/* Liabilities & Equity Column */}
                <div className="space-y-6">
                  {/* Liabilities Card */}
                  <Card>
                    <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">
                      Liabilities
                    </h2>
                    <div className="overflow-x-auto">
                      <Table>
                        <Table.Body className="divide-y">
                          {report.liabilities.map((account) => (
                            <Table.Row
                              key={account.account_code}
                              className="cursor-pointer bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
                              onClick={() =>
                                router.push(`/dashboard/accounting/chart-of-accounts/${account.id}`)
                              }
                            >
                              <Table.Cell className="font-medium text-gray-900 dark:text-white">
                                {account.account_name}
                              </Table.Cell>
                              <Table.Cell className="text-right">
                                <span className="font-mono font-semibold text-gray-900 dark:text-white">
                                  {new Intl.NumberFormat('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  }).format(parseFloat(account.balance))}
                                </span>
                              </Table.Cell>
                            </Table.Row>
                          ))}
                          {/* Total Liabilities Row */}
                          <Table.Row className="bg-gray-50 font-bold dark:bg-gray-900">
                            <Table.Cell>Total Liabilities</Table.Cell>
                            <Table.Cell className="text-right">
                              <span className="font-mono text-lg text-red-600 dark:text-red-400">
                                {new Intl.NumberFormat('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                }).format(parseFloat(report.total_liabilities))}
                              </span>
                            </Table.Cell>
                          </Table.Row>
                        </Table.Body>
                      </Table>
                    </div>

                    {report.liabilities.length === 0 && (
                      <div className="py-4 text-center text-gray-500 dark:text-gray-400">
                        No liabilities
                      </div>
                    )}
                  </Card>

                  {/* Equity Card */}
                  <Card>
                    <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">Equity</h2>
                    <div className="overflow-x-auto">
                      <Table>
                        <Table.Body className="divide-y">
                          {report.equity.map((account) => (
                            <Table.Row
                              key={account.account_code}
                              className="cursor-pointer bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
                              onClick={() =>
                                router.push(`/dashboard/accounting/chart-of-accounts/${account.id}`)
                              }
                            >
                              <Table.Cell className="font-medium text-gray-900 dark:text-white">
                                {account.account_name}
                              </Table.Cell>
                              <Table.Cell className="text-right">
                                <span className="font-mono font-semibold text-gray-900 dark:text-white">
                                  {new Intl.NumberFormat('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  }).format(parseFloat(account.balance))}
                                </span>
                              </Table.Cell>
                            </Table.Row>
                          ))}
                          {/* Total Equity Row */}
                          <Table.Row className="bg-gray-50 font-bold dark:bg-gray-900">
                            <Table.Cell>Total Equity</Table.Cell>
                            <Table.Cell className="text-right">
                              <span className="font-mono text-lg text-green-600 dark:text-green-400">
                                {new Intl.NumberFormat('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                }).format(parseFloat(report.total_equity))}
                              </span>
                            </Table.Cell>
                          </Table.Row>
                        </Table.Body>
                      </Table>
                    </div>

                    {report.equity.length === 0 && (
                      <div className="py-4 text-center text-gray-500 dark:text-gray-400">
                        No equity accounts
                      </div>
                    )}
                  </Card>

                  {/* Total Liabilities & Equity */}
                  <Card>
                    <div className="flex items-center justify-between bg-gray-50 p-4 dark:bg-gray-900">
                      <span className="text-lg font-bold text-gray-900 dark:text-white">
                        Total Liabilities & Equity
                      </span>
                      <span className="font-mono text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {new Intl.NumberFormat('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }).format(parseFloat(report.total_liabilities_and_equity))}
                      </span>
                    </div>
                  </Card>
                </div>
              </div>

              {/* Balance Check */}
              <Card>
                <div className="flex items-center justify-center gap-4">
                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Total Assets
                    </div>
                    <div className="mt-1 font-mono text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {new Intl.NumberFormat('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }).format(parseFloat(report.total_assets))}
                    </div>
                  </div>

                  <div className="text-4xl font-bold text-gray-400">=</div>

                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Total Liabilities & Equity
                    </div>
                    <div className="mt-1 font-mono text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {new Intl.NumberFormat('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }).format(parseFloat(report.total_liabilities_and_equity))}
                    </div>
                  </div>
                </div>

                {parseFloat(report.total_assets) !==
                  parseFloat(report.total_liabilities_and_equity) && (
                  <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-center dark:border-red-800 dark:bg-red-900/20">
                    <span className="font-semibold text-red-800 dark:text-red-200">
                      Warning: Balance sheet does not balance! Difference:{' '}
                      {new Intl.NumberFormat('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }).format(
                        Math.abs(
                          parseFloat(report.total_assets) -
                            parseFloat(report.total_liabilities_and_equity),
                        ),
                      )}
                    </span>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
