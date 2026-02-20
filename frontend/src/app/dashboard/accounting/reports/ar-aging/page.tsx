'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Table, Spinner, Badge } from 'flowbite-react';
import { HiArrowLeft, HiDownload, HiPrinter } from 'react-icons/hi';
import DashboardLayout from '@/components/DashboardLayout';
import { useARAgingReport } from '@/hooks/useAccounting';

export default function ARAgingReportPage() {
  const router = useRouter();
  const today = new Date().toISOString().split('T')[0];
  const [asOfDate, setAsOfDate] = useState(today);
  const [activeTab, setActiveTab] = useState(0);

  // Fetch AR aging report
  const { data: report, isLoading, error } = useARAgingReport({ as_of_date: asOfDate });

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    // TODO: Implement CSV export
    alert('Export functionality coming soon');
  };

  // Safely access invoices array
  const invoicesArray = report?.invoices || [];

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
              Accounts Receivable Aging
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              View and analyze accounts receivable aging
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
                Loading AR aging report...
              </span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-red-800 dark:text-red-200">
                Error loading AR aging report: {error.message}
              </p>
            </div>
          )}

          {/* Report Content */}
          {report && (
            <>
              {/* Summary Card */}
              {report?.summary && (
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
                        }).format(parseFloat(report.summary.total || '0'))}
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
                        }).format(parseFloat(report.summary.current || '0'))}
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
                        }).format(parseFloat(report.summary.days_31_60 || '0'))}
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
                        }).format(parseFloat(report.summary.days_61_90 || '0'))}
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
                        }).format(parseFloat(report.summary.days_90_plus || '0'))}
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* Tabs for Invoices and Summary */}
              <Card>
                <div className="mb-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setActiveTab(0)}
                      className={`px-4 py-2 text-sm font-medium ${
                        activeTab === 0
                          ? 'border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                          : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                      }`}
                    >
                      Outstanding Invoices
                    </button>
                    {invoicesArray.length > 0 && (
                      <button
                        onClick={() => setActiveTab(1)}
                        className={`px-4 py-2 text-sm font-medium ${
                          activeTab === 1
                            ? 'border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                            : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                        }`}
                      >
                        Summary by Customer
                      </button>
                    )}
                  </div>
                </div>

                {activeTab === 0 && (
                  <div className="overflow-x-auto">
                    <Table hoverable>
                      <Table.Head>
                        <Table.HeadCell>Customer</Table.HeadCell>
                        <Table.HeadCell>Invoice #</Table.HeadCell>
                        <Table.HeadCell>Invoice Date</Table.HeadCell>
                        <Table.HeadCell>Due Date</Table.HeadCell>
                        <Table.HeadCell>Days Outstanding</Table.HeadCell>
                        <Table.HeadCell>Age Bucket</Table.HeadCell>
                        <Table.HeadCell className="text-right">Amount</Table.HeadCell>
                      </Table.Head>
                      <Table.Body className="divide-y">
                        {invoicesArray.map((invoice) => {
                          // Determine color based on age bucket
                          const bucketColor: 'success' | 'warning' | 'failure' =
                            invoice.age_bucket === 'Current'
                              ? 'success'
                              : invoice.age_bucket === '31-60 days' ||
                                  invoice.age_bucket === '61-90 days'
                                ? 'warning'
                                : 'failure';

                          return (
                            <Table.Row
                              key={invoice.invoice_number}
                              className="cursor-pointer bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
                              onClick={() =>
                                router.push(`/dashboard/sales/invoices/${invoice.invoice_number}`)
                              }
                            >
                              <Table.Cell className="font-medium text-gray-900 dark:text-white">
                                {invoice.customer}
                              </Table.Cell>
                              <Table.Cell className="font-mono text-sm">
                                {invoice.invoice_number}
                              </Table.Cell>
                              <Table.Cell>
                                {new Date(invoice.invoice_date).toLocaleDateString()}
                              </Table.Cell>
                              <Table.Cell>
                                {new Date(invoice.due_date).toLocaleDateString()}
                              </Table.Cell>
                              <Table.Cell className="font-semibold">
                                {invoice.days_outstanding}
                              </Table.Cell>
                              <Table.Cell>
                                <Badge color={bucketColor}>{invoice.age_bucket}</Badge>
                              </Table.Cell>
                              <Table.Cell className="text-right">
                                <span className="font-mono font-semibold text-gray-900 dark:text-white">
                                  {new Intl.NumberFormat('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  }).format(parseFloat(invoice.amount))}
                                </span>
                              </Table.Cell>
                            </Table.Row>
                          );
                        })}
                      </Table.Body>
                    </Table>

                    {invoicesArray.length === 0 && (
                      <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                        No outstanding invoices
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 1 && invoicesArray.length > 0 && (
                  <div className="overflow-x-auto">
                    <Table hoverable>
                      <Table.Head>
                        <Table.HeadCell>Customer</Table.HeadCell>
                        <Table.HeadCell className="text-right">Invoice Count</Table.HeadCell>
                        <Table.HeadCell className="text-right">Total Outstanding</Table.HeadCell>
                      </Table.Head>
                      <Table.Body className="divide-y">
                        {Array.from(
                          invoicesArray.reduce((map, invoice) => {
                            const key = invoice.customer;
                            if (!map.has(key)) {
                              map.set(key, []);
                            }
                            map.get(key)!.push(invoice);
                            return map;
                          }, new Map<string, typeof invoicesArray>()),
                        ).map(([customer, customerInvoices]) => {
                          const total = customerInvoices.reduce(
                            (sum, inv) => sum + parseFloat(inv.amount),
                            0,
                          );
                          return (
                            <Table.Row
                              key={customer}
                              className="bg-white dark:border-gray-700 dark:bg-gray-800"
                            >
                              <Table.Cell className="font-medium text-gray-900 dark:text-white">
                                {customer}
                              </Table.Cell>
                              <Table.Cell className="text-right">
                                {customerInvoices.length}
                              </Table.Cell>
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
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
