import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from 'flowbite-react';
import { HiPencil, HiMail, HiPhone, HiCurrencyDollar } from 'react-icons/hi';
import SendCard from '@/components/communications/SendCard';
import { formatDateSriLankan } from '@/utils/dateUtils';
import type { Invoice } from '@/types/invoices';

interface InvoiceActionCardsProps {
  invoice: Invoice;
  onRecordPayment: () => void;
  onEmail: () => void;
  onWhatsApp: () => void;
  refreshCommunications: number;
}

export function InvoiceActionCards({
  invoice,
  onRecordPayment,
  onEmail,
  onWhatsApp,
  refreshCommunications,
}: InvoiceActionCardsProps) {
  const router = useRouter();
  const formatDate = (dateString?: string) => formatDateSriLankan(dateString);

  const daysAgo = Math.ceil(
    (new Date().getTime() - new Date(invoice.created_date || '').getTime()) / (1000 * 60 * 60 * 24),
  );

  return (
    <div className="space-y-3">
      {/* Quick Actions Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-3">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
          Quick Actions
        </h3>
        <div className="space-y-2">
          <Button
            size="sm"
            className="w-full justify-start"
            onClick={() => router.push(`/dashboard/sales/invoices/${invoice.id}/edit`)}
          >
            <HiPencil className="h-4 w-4 mr-2" />
            Edit Invoice
          </Button>
          <Button
            size="sm"
            color={parseFloat(invoice.balance_due as string) > 0 ? 'success' : 'gray'}
            className="w-full justify-start"
            onClick={onRecordPayment}
            disabled={parseFloat(invoice.balance_due as string) <= 0}
          >
            <HiCurrencyDollar className="h-4 w-4 mr-2" />
            Record Payment
          </Button>
        </div>
      </div>

      {/* Send Card - Compact Version */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Send
          </h3>
        </div>
        <div className="p-3">
          <SendCard
            docType="invoice"
            docId={invoice.id}
            onEmail={onEmail}
            onWhatsApp={onWhatsApp}
            refreshTrigger={refreshCommunications}
            compact
          />
        </div>
      </div>

      {/* Payment Summary Card */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 shadow-sm p-3">
        <h3 className="text-xs font-semibold text-blue-900 dark:text-blue-200 uppercase tracking-wider mb-2">
          Payment Status
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-blue-700 dark:text-blue-300">Total:</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              Rs. {parseFloat(invoice.net_total as string).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-green-700 dark:text-green-300">Paid:</span>
            <span className="font-semibold text-green-700 dark:text-green-400">
              Rs. {parseFloat(invoice.amount_paid as string).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between border-t border-blue-200 dark:border-blue-700 pt-2">
            <span className="text-red-700 dark:text-red-400 font-semibold">Due:</span>
            <span className="font-bold text-red-700 dark:text-red-400">
              Rs. {parseFloat(invoice.balance_due as string).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Timeline Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-3">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
          Timeline
        </h3>
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0"></div>
            <div className="min-w-0">
              <div className="text-sm text-gray-900 dark:text-white">Created</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {formatDate(invoice.created_date)} ({daysAgo} days ago)
              </div>
            </div>
          </div>
          {invoice.due_date && (
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 mt-1.5 flex-shrink-0"></div>
              <div className="min-w-0">
                <div className="text-sm text-gray-900 dark:text-white">Due Date</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(invoice.due_date)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Customer Info Card */}
      {invoice.customer_detail && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-3">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            Customer
          </h3>
          <div className="space-y-1.5">
            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {invoice.customer_detail.name}
            </div>
            {invoice.customer_detail.email && (
              <a
                href={`mailto:${invoice.customer_detail.email}`}
                className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400"
              >
                <HiMail className="h-3.5 w-3.5" />
                <span className="truncate">{invoice.customer_detail.email}</span>
              </a>
            )}
            {invoice.customer_detail.contact && (
              <a
                href={`tel:${invoice.customer_detail.contact}`}
                className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400"
              >
                <HiPhone className="h-3.5 w-3.5" />
                <span>{invoice.customer_detail.contact}</span>
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
