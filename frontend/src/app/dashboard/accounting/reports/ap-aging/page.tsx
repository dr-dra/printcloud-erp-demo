'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Table, Spinner, Badge } from 'flowbite-react';
import { HiArrowLeft, HiDownload, HiPrinter } from 'react-icons/hi';
import DashboardLayout from '@/components/DashboardLayout';
import { useAPAgingReport } from '@/hooks/useAccounting';

export default function APAgingReportPage() {
  const router = useRouter();
  const today = new Date().toISOString().split('T')[0];
  const [asOfDate, setAsOfDate] = useState(today);

  // Fetch AP aging report
  const { data: report, isLoading, error } = useAPAgingReport({ as_of_date: asOfDate });

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    // TODO: Implement CSV export
    alert('Export functionality coming soon');
  };

  // Group bills by supplier
  const groupedBySupplier = report?.bills.reduce(
    (acc, bill) => {
      if (!acc[bill.supplier]) {
        acc[bill.supplier] = [];
      }
      acc[bill.supplier].push(bill);
      return acc;
    },
    {} as Record<string, typeof report.bills>,
  );

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
              Accounts Payable Aging
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              View and analyze accounts payable aging
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
                Loading AP aging report...
              </span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-red-800 dark:text-red-200">
                Error loading AP aging report: {error.message}
              </p>
            </div>
          )}

          {/* Report Content */}
          {report && (
            <>
              {/* Summary Card */}
              <Card>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
                  <div>
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Total Outstanding
                    </div>
                    <div className="mt-1 font-mono text-2xl font-bold text-gray-900 dark:text-white">
                      {new Intl.NumberFormat('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }).format(parseFloat(report.summary.total))}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Current
                    </div>
                    <div className="mt-1 font-mono text-xl font-semibold text-green-600 dark:text-green-400">
                      {new Intl.NumberFormat('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }).format(parseFloat(report.summary.current))}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      31-60 Days
                    </div>
                    <div className="mt-1 font-mono text-xl font-semibold text-yellow-600 dark:text-yellow-400">
                      {new Intl.NumberFormat('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }).format(parseFloat(report.summary.days_31_60))}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      61-90 Days
                    </div>
                    <div className="mt-1 font-mono text-xl font-semibold text-orange-600 dark:text-orange-400">
                      {new Intl.NumberFormat('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }).format(parseFloat(report.summary.days_61_90))}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      90+ Days
                    </div>
                    <div className="mt-1 font-mono text-xl font-semibold text-red-600 dark:text-red-400">
                      {new Intl.NumberFormat('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }).format(parseFloat(report.summary.days_over_90))}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Bills Table */}
              <Card>
                <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">
                  Outstanding Bills
                </h2>
                <div className="overflow-x-auto">
                  <Table hoverable>
                    <Table.Head>
                      <Table.HeadCell>Supplier</Table.HeadCell>
                      <Table.HeadCell>Bill #</Table.HeadCell>
                      <Table.HeadCell>Bill Date</Table.HeadCell>
                      <Table.HeadCell>Due Date</Table.HeadCell>
                      <Table.HeadCell>Days Outstanding</Table.HeadCell>
                      <Table.HeadCell>Age Bucket</Table.HeadCell>
                      <Table.HeadCell className="text-right">Amount</Table.HeadCell>
                    </Table.Head>
                    <Table.Body className="divide-y">
                      {report.bills.map((bill) => {
                        // Determine color based on age bucket
                        const bucketLabel = bill.age_bucket || '';
                        const bucketColor: 'success' | 'warning' | 'failure' =
                          bucketLabel.startsWith('Current')
                            ? 'success'
                            : bucketLabel === '31-60 days' || bucketLabel === '61-90 days'
                              ? 'warning'
                              : 'failure';

                        const billLink = bill.bill_id
                          ? `/dashboard/purchases/bills/${bill.bill_id}`
                          : `/dashboard/purchases/bills/${bill.bill_number}`;

                        return (
                          <Table.Row
                            key={bill.bill_number}
                            className="cursor-pointer bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
                            onClick={() => router.push(billLink)}
                          >
                            <Table.Cell className="font-medium text-gray-900 dark:text-white">
                              {bill.supplier_name}
                            </Table.Cell>
                            <Table.Cell className="font-mono text-sm">
                              {bill.bill_number}
                            </Table.Cell>
                            <Table.Cell>{new Date(bill.bill_date).toLocaleDateString()}</Table.Cell>
                            <Table.Cell>{new Date(bill.due_date).toLocaleDateString()}</Table.Cell>
                            <Table.Cell className="font-semibold">
                              {bill.days_outstanding}
                            </Table.Cell>
                            <Table.Cell>
                              <Badge color={bucketColor}>{bucketLabel}</Badge>
                            </Table.Cell>
                            <Table.Cell className="text-right">
                              <span className="font-mono font-semibold text-gray-900 dark:text-white">
                                {new Intl.NumberFormat('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                }).format(parseFloat(bill.balance_due))}
                              </span>
                            </Table.Cell>
                          </Table.Row>
                        );
                      })}
                    </Table.Body>
                  </Table>
                </div>

                {report.bills.length === 0 && (
                  <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                    No outstanding bills
                  </div>
                )}
              </Card>

              {/* Supplier Summary */}
              {groupedBySupplier && Object.keys(groupedBySupplier).length > 0 && (
                <Card>
                  <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">
                    Summary by Supplier
                  </h2>
                  <div className="overflow-x-auto">
                    <Table hoverable>
                      <Table.Head>
                        <Table.HeadCell>Supplier</Table.HeadCell>
                        <Table.HeadCell className="text-right">Bill Count</Table.HeadCell>
                        <Table.HeadCell className="text-right">Total Outstanding</Table.HeadCell>
                      </Table.Head>
                      <Table.Body className="divide-y">
                        {Object.entries(groupedBySupplier).map(([supplier, bills]) => {
                          const total = bills.reduce(
                            (sum, bill) => sum + parseFloat(bill.amount),
                            0,
                          );
                          return (
                            <Table.Row
                              key={supplier}
                              className="bg-white dark:border-gray-700 dark:bg-gray-800"
                            >
                              <Table.Cell className="font-medium text-gray-900 dark:text-white">
                                {supplier}
                              </Table.Cell>
                              <Table.Cell className="text-right">{bills.length}</Table.Cell>
                              <Table.Cell className="text-right">
                                <span className="font-mono font-semibold text-gray-900 dark:text-white">
                                  {new Intl.NumberFormat('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  }).format(total)}
                                </span>
                              </Table.Cell>
                            </Table.Row>
                          );
                        })}
                      </Table.Body>
                    </Table>
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
