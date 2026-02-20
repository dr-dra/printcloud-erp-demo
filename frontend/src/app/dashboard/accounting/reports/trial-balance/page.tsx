'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Table, Spinner } from 'flowbite-react';
import { HiArrowLeft, HiDownload, HiPrinter, HiCheckCircle, HiXCircle } from 'react-icons/hi';
import DashboardLayout from '@/components/DashboardLayout';
import { useTrialBalanceReport } from '@/hooks/useAccounting';

export default function TrialBalanceReportPage() {
  const router = useRouter();
  const today = new Date().toISOString().split('T')[0];
  const [asOfDate, setAsOfDate] = useState(today);

  // Fetch trial balance report
  const {
    data: report,
    isLoading,
    error,
  } = useTrialBalanceReport({
    as_of_date: asOfDate,
  });

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    // TODO: Implement CSV export
    alert('Export functionality coming soon');
  };

  const isBalanced = report && parseFloat(report.total_debits) === parseFloat(report.total_credits);

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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Trial Balance</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              View and analyze trial balance
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
                Loading trial balance...
              </span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-red-800 dark:text-red-200">
                Error loading trial balance: {error.message}
              </p>
            </div>
          )}

          {/* Report Content */}
          {report && (
            <>
              {/* Balance Check */}
              <Card>
                <div className="flex items-center justify-center gap-2">
                  {isBalanced ? (
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                      <HiCheckCircle className="h-8 w-8" />
                      <span className="text-lg font-semibold">Trial Balance is in balance</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                      <HiXCircle className="h-8 w-8" />
                      <span className="text-lg font-semibold">
                        Trial Balance is OUT OF BALANCE - Difference:{' '}
                        {new Intl.NumberFormat('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }).format(
                          Math.abs(
                            parseFloat(report.total_debits) - parseFloat(report.total_credits),
                          ),
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </Card>

              {/* Accounts Table */}
              <Card>
                <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">
                  Account Balances as of {new Date(asOfDate).toLocaleDateString()}
                </h2>
                <div className="overflow-x-auto">
                  <Table hoverable>
                    <Table.Head>
                      <Table.HeadCell>Account Code</Table.HeadCell>
                      <Table.HeadCell>Account Name</Table.HeadCell>
                      <Table.HeadCell>Category</Table.HeadCell>
                      <Table.HeadCell className="text-right">Debit</Table.HeadCell>
                      <Table.HeadCell className="text-right">Credit</Table.HeadCell>
                    </Table.Head>
                    <Table.Body className="divide-y">
                      {report.accounts.map((account) => {
                        const debitBalance =
                          parseFloat(account.balance) >= 0 ? parseFloat(account.balance) : 0;
                        const creditBalance =
                          parseFloat(account.balance) < 0
                            ? Math.abs(parseFloat(account.balance))
                            : 0;

                        return (
                          <Table.Row
                            key={account.account_code}
                            className="cursor-pointer bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
                            onClick={() =>
                              router.push(`/dashboard/accounting/chart-of-accounts/${account.id}`)
                            }
                          >
                            <Table.Cell className="font-mono font-medium text-gray-900 dark:text-white">
                              {account.account_code}
                            </Table.Cell>
                            <Table.Cell className="text-gray-900 dark:text-white">
                              {account.account_name}
                            </Table.Cell>
                            <Table.Cell className="text-sm text-gray-600 dark:text-gray-400">
                              {account.category_name}
                            </Table.Cell>
                            <Table.Cell className="text-right">
                              {debitBalance > 0 ? (
                                <span className="font-mono font-semibold text-green-600 dark:text-green-400">
                                  {new Intl.NumberFormat('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  }).format(debitBalance)}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </Table.Cell>
                            <Table.Cell className="text-right">
                              {creditBalance > 0 ? (
                                <span className="font-mono font-semibold text-red-600 dark:text-red-400">
                                  {new Intl.NumberFormat('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  }).format(creditBalance)}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </Table.Cell>
                          </Table.Row>
                        );
                      })}

                      {/* Totals Row */}
                      <Table.Row className="bg-gray-50 font-bold dark:bg-gray-900">
                        <Table.Cell colSpan={3} className="text-right">
                          TOTALS:
                        </Table.Cell>
                        <Table.Cell className="text-right">
                          <span className="font-mono text-lg text-green-600 dark:text-green-400">
                            {new Intl.NumberFormat('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }).format(parseFloat(report.total_debits))}
                          </span>
                        </Table.Cell>
                        <Table.Cell className="text-right">
                          <span className="font-mono text-lg text-red-600 dark:text-red-400">
                            {new Intl.NumberFormat('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }).format(parseFloat(report.total_credits))}
                          </span>
                        </Table.Cell>
                      </Table.Row>
                    </Table.Body>
                  </Table>
                </div>
              </Card>

              {/* Summary by Category */}
              <Card>
                <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">
                  Summary by Category
                </h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                  {report.summary_by_category.map((category) => (
                    <div
                      key={category.category}
                      className="rounded-lg border border-gray-200 p-4 dark:border-gray-700"
                    >
                      <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        {category.category}
                      </div>
                      <div className="mt-2 font-mono text-xl font-bold text-gray-900 dark:text-white">
                        {new Intl.NumberFormat('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }).format(Math.abs(parseFloat(category.total)))}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
