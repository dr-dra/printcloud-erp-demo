'use client';

import { Card } from 'flowbite-react';
import {
  HiOutlineArrowCircleDown,
  HiOutlineArrowCircleUp,
  HiOutlineCash,
  HiOutlineScale,
} from 'react-icons/hi';
import type { CashBookReport } from '@/types/accounting';

interface CashBookSummaryCardsProps {
  report: CashBookReport;
}

const formatCurrency = (value: string) =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parseFloat(value));

const summaryCards = [
  {
    label: 'Opening Balance',
    valueKey: 'opening_balance' as const,
    accent: 'bg-sky-500/70 dark:bg-sky-400/30',
    valueClass: 'text-gray-900 dark:text-gray-100',
    icon: HiOutlineCash,
  },
  {
    label: 'Total Receipts',
    valueKey: 'total_receipts' as const,
    accent: 'bg-emerald-500/70 dark:bg-emerald-400/30',
    valueClass: 'text-emerald-600 dark:text-emerald-300',
    icon: HiOutlineArrowCircleDown,
  },
  {
    label: 'Total Payments',
    valueKey: 'total_payments' as const,
    accent: 'bg-rose-500/70 dark:bg-rose-400/30',
    valueClass: 'text-rose-600 dark:text-rose-300',
    icon: HiOutlineArrowCircleUp,
  },
  {
    label: 'Closing Balance',
    valueKey: 'closing_balance' as const,
    accent: 'bg-indigo-500/70 dark:bg-indigo-400/30',
    valueClass: 'text-indigo-600 dark:text-indigo-300',
    icon: HiOutlineScale,
  },
];

export default function CashBookSummaryCards({ report }: CashBookSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {summaryCards.map((card) => {
        const Icon = card.icon;
        return (
          <Card
            key={card.label}
            className="relative overflow-hidden border border-gray-200/80 dark:border-gray-700/60 shadow-sm"
          >
            <span className={`absolute inset-x-0 top-0 h-0.5 ${card.accent}`} />
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <Icon className="h-4 w-4" />
              {card.label}
            </div>
            <div className={`mt-2 font-mono text-2xl font-bold ${card.valueClass}`}>
              {formatCurrency(report[card.valueKey])}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
