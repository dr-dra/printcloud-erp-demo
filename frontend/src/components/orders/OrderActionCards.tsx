import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from 'flowbite-react';
import { HiPencil, HiMail, HiPhone, HiCurrencyDollar } from 'react-icons/hi';
import { IoDocumentsOutline } from 'react-icons/io5';
import SendCard from '@/components/communications/SendCard';
import { formatDateSriLankan } from '@/utils/dateUtils';
import type { SalesOrder } from '@/types/orders';

interface OrderActionCardsProps {
  order: SalesOrder;
  onRecordPayment: () => void;
  onEmail: () => void;
  onWhatsApp: () => void;
  refreshCommunications: number;
}

export function OrderActionCards({
  order,
  onRecordPayment,
  onEmail,
  onWhatsApp,
  refreshCommunications,
}: OrderActionCardsProps) {
  const router = useRouter();
  const formatDate = (dateString?: string) => formatDateSriLankan(dateString);

  const daysAgo = Math.ceil(
    (new Date().getTime() - new Date(order.created_date || '').getTime()) / (1000 * 60 * 60 * 24),
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
            onClick={() => router.push(`/dashboard/sales/orders/${order.id}/edit`)}
          >
            <HiPencil className="h-4 w-4 mr-2" />
            Edit Order
          </Button>
          <Button
            size="sm"
            color="purple"
            className="w-full justify-start"
            disabled={order.status !== 'delivered'}
          >
            <IoDocumentsOutline className="h-4 w-4 mr-2" />
            Convert to Invoice
          </Button>
          <Button
            size="sm"
            color={Number(order.balance_due || 0) > 0 ? 'success' : 'gray'}
            className="w-full justify-start"
            onClick={onRecordPayment}
            disabled={Number(order.balance_due || 0) <= 0}
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
            docType="order"
            docId={order.id}
            onEmail={onEmail}
            onWhatsApp={onWhatsApp}
            refreshTrigger={refreshCommunications}
            compact
          />
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
                {formatDate(order.created_date)} ({daysAgo} days ago)
              </div>
            </div>
          </div>
          {order.required_date && (
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 mt-1.5 flex-shrink-0"></div>
              <div className="min-w-0">
                <div className="text-sm text-gray-900 dark:text-white">Required Date</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(order.required_date)}
                </div>
              </div>
            </div>
          )}
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
              Rs. {Number(order.net_total || 0).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-green-700 dark:text-green-300">Paid:</span>
            <span className="font-semibold text-green-700 dark:text-green-400">
              Rs. {Number(order.amount_paid || 0).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between border-t border-blue-200 dark:border-blue-700 pt-2">
            <span className="text-red-700 dark:text-red-400 font-semibold">Due:</span>
            <span className="font-bold text-red-700 dark:text-red-400">
              Rs. {Number(order.balance_due || 0).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Customer Info Card */}
      {order.customer && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-3">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            Customer
          </h3>
          <div className="space-y-1.5">
            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {order.customer.name}
            </div>
            {order.customer.email && (
              <a
                href={`mailto:${order.customer.email}`}
                className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400"
              >
                <HiMail className="h-3.5 w-3.5" />
                <span className="truncate">{order.customer.email}</span>
              </a>
            )}
            {order.customer.contact && (
              <a
                href={`tel:${order.customer.contact}`}
                className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400"
              >
                <HiPhone className="h-3.5 w-3.5" />
                <span>{order.customer.contact}</span>
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
