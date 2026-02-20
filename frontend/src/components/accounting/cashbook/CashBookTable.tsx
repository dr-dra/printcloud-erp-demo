'use client';

import { Card, Table } from 'flowbite-react';
import { HiOutlineClipboardList } from 'react-icons/hi';
import { useRouter } from 'next/navigation';
import type { CashBookReport, CashBookTransaction } from '@/types/accounting';

interface CashBookTableProps {
  report: CashBookReport;
  transactions: CashBookTransaction[];
  search: string;
}

const formatCurrency = (value: string) =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parseFloat(value));

export default function CashBookTable({ report, transactions, search }: CashBookTableProps) {
  const router = useRouter();

  return (
    <Card className="border border-gray-200/80 dark:border-gray-700/60 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            <HiOutlineClipboardList className="h-4 w-4" />
            Activity
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Transactions</h2>
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {transactions.length} entries
        </span>
      </div>
      <div className="overflow-x-auto">
        <Table hoverable>
          <Table.Head className="bg-gray-50/80 dark:bg-gray-900/40">
            <Table.HeadCell>Date</Table.HeadCell>
            <Table.HeadCell>Journal #</Table.HeadCell>
            <Table.HeadCell>Description</Table.HeadCell>
            <Table.HeadCell className="text-right">Receipts</Table.HeadCell>
            <Table.HeadCell className="text-right">Payments</Table.HeadCell>
            <Table.HeadCell className="text-right">Balance</Table.HeadCell>
          </Table.Head>
          <Table.Body className="divide-y">
            <Table.Row className="bg-gray-50 dark:bg-gray-900">
              <Table.Cell colSpan={3} className="font-semibold">
                Opening Balance
              </Table.Cell>
              <Table.Cell className="text-right">-</Table.Cell>
              <Table.Cell className="text-right">-</Table.Cell>
              <Table.Cell className="text-right">
                <span className="font-mono font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(report.opening_balance)}
                </span>
              </Table.Cell>
            </Table.Row>

            {transactions.map((txn, index) => (
              <Table.Row
                key={`${txn.journal_number}-${index}`}
                className="cursor-pointer bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
                onClick={() =>
                  router.push(`/dashboard/accounting/journal-entries/${txn.journal_entry_id}`)
                }
              >
                <Table.Cell>{new Date(txn.date).toLocaleDateString()}</Table.Cell>
                <Table.Cell className="font-mono text-sm">{txn.journal_number}</Table.Cell>
                <Table.Cell className="text-gray-900 dark:text-white">{txn.description}</Table.Cell>
                <Table.Cell className="text-right">
                  {parseFloat(txn.debit) > 0 ? (
                    <span className="font-mono font-semibold text-green-600 dark:text-green-400">
                      {formatCurrency(txn.debit)}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </Table.Cell>
                <Table.Cell className="text-right">
                  {parseFloat(txn.credit) > 0 ? (
                    <span className="font-mono font-semibold text-red-600 dark:text-red-400">
                      {formatCurrency(txn.credit)}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </Table.Cell>
                <Table.Cell className="text-right">
                  <span className="font-mono font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(txn.balance)}
                  </span>
                </Table.Cell>
              </Table.Row>
            ))}

            <Table.Row className="bg-gray-50 dark:bg-gray-900">
              <Table.Cell colSpan={3} className="font-bold">
                Closing Balance
              </Table.Cell>
              <Table.Cell className="text-right">
                <span className="font-mono font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(report.total_receipts)}
                </span>
              </Table.Cell>
              <Table.Cell className="text-right">
                <span className="font-mono font-bold text-red-600 dark:text-red-400">
                  {formatCurrency(report.total_payments)}
                </span>
              </Table.Cell>
              <Table.Cell className="text-right">
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrency(report.closing_balance)}
                </span>
              </Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table>
      </div>

      {transactions.length === 0 && (
        <div className="py-8 text-center text-gray-500 dark:text-gray-400">
          {search
            ? 'No transactions match your search'
            : 'No transactions found for the selected period'}
        </div>
      )}
    </Card>
  );
}
