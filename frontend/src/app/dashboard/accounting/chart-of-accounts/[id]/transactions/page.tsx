'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Label, Spinner, TextInput } from 'flowbite-react';
import { HiArrowLeft } from 'react-icons/hi';
import DashboardLayout from '@/components/DashboardLayout';
import DataTable from '@/components/common/DataTable';
import { useAccountTransactions, useChartOfAccount } from '@/hooks/useAccounting';
import type { DataTableColumn } from '@/types/datatable';

interface AccountTransactionRow {
  date: string;
  journal_number: string;
  description: string;
  debit: number;
  credit: number;
  journal_entry_id: number;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ChartOfAccountTransactionsPage({ params }: PageProps) {
  const { id } = use(params);
  const accountId = Number(id);
  const router = useRouter();
  const { data: account } = useChartOfAccount(accountId);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data: transactions, isLoading } = useAccountTransactions(accountId, {
    start_date: startDate || undefined,
    end_date: endDate || undefined,
  });

  const columns: DataTableColumn<AccountTransactionRow>[] = [
    {
      key: 'date',
      label: 'Date',
      sortable: true,
      render: (txn) => new Date(txn.date).toLocaleDateString(),
    },
    {
      key: 'journal_number',
      label: 'Journal #',
      sortable: true,
      render: (txn) => <span className="font-mono text-sm">{txn.journal_number}</span>,
    },
    {
      key: 'description',
      label: 'Description',
      render: (txn) => txn.description,
    },
    {
      key: 'debit',
      label: 'Debit',
      sortable: true,
      render: (txn) =>
        txn.debit > 0 ? (
          <span className="font-mono text-green-600 dark:text-green-400">
            {new Intl.NumberFormat('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }).format(txn.debit)}
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        ),
    },
    {
      key: 'credit',
      label: 'Credit',
      sortable: true,
      render: (txn) =>
        txn.credit > 0 ? (
          <span className="font-mono text-red-600 dark:text-red-400">
            {new Intl.NumberFormat('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }).format(txn.credit)}
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        ),
    },
  ];

  return (
    <DashboardLayout>
      <div className="p-4">
        <div className="mb-6 flex items-center gap-4">
          <Button
            color="gray"
            size="sm"
            onClick={() => router.push(`/dashboard/accounting/chart-of-accounts/${accountId}`)}
          >
            <HiArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Account Transactions
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {account
                ? `${account.account_code} - ${account.account_name}`
                : 'Transaction history'}
            </p>
          </div>
        </div>

        <Card className="mb-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="start_date" value="Start Date" />
              <TextInput
                id="start_date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="end_date" value="End Date" />
              <TextInput
                id="end_date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="xl" />
            <span className="ml-3 text-lg text-gray-600 dark:text-gray-400">
              Loading transactions...
            </span>
          </div>
        ) : (
          <DataTable
            title="Transactions"
            data={Array.isArray(transactions) ? transactions : []}
            columns={columns}
            searchFields={['journal_number', 'description']}
            uniqueId={`account-${accountId}-transactions-full`}
            onRowClick={(txn) =>
              router.push(`/dashboard/accounting/journal-entries/${txn.journal_entry_id}`)
            }
          />
        )}
      </div>
    </DashboardLayout>
  );
}
