import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from 'flowbite-react';
import { HiPencil, HiMail, HiPhone } from 'react-icons/hi';
import { IoDocumentsOutline } from 'react-icons/io5';
import Image from 'next/image';
import SendCard from '@/components/communications/SendCard';
import { formatDateSriLankan } from '@/utils/dateUtils';
import type { SalesQuotation } from '@/types/quotations';

interface QuotationActionCardsProps {
  quotation: SalesQuotation;
  onSetReminder: () => void;
  onEmail: () => void;
  onWhatsApp: () => void;
  refreshSendCard: number;
}

export function QuotationActionCards({
  quotation,
  onSetReminder,
  onEmail,
  onWhatsApp,
  refreshSendCard,
}: QuotationActionCardsProps) {
  const router = useRouter();
  const formatDate = (dateString?: string) => formatDateSriLankan(dateString);

  // Convert quotation to order
  const handleConvertToOrder = () => {
    // Package quotation data for order creation
    const orderDraft = {
      quotation_id: quotation.id,
      quotation_number: quotation.quot_number,
      customer_id: quotation.customer?.id,
      customer_name: quotation.customer?.name,
      notes: quotation.notes,
      private_notes: quotation.private_notes,
      delivery_charge: quotation.delivery_charge,
      discount: quotation.discount,
      line_items:
        quotation.items?.map((item) => ({
          item: item.item || item.finished_product_name,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.price,
          finished_product_id: item.finished_product,
          costing_sheet_id: item.costing_sheet,
        })) || [],
    };

    // Store in sessionStorage for the new order page
    sessionStorage.setItem('orderDraft', JSON.stringify(orderDraft));

    // Navigate to orders/new with quotation source
    router.push('/dashboard/sales/orders/new?from=quotation');
  };

  const daysAgo = Math.ceil(
    (new Date().getTime() - new Date(quotation.created_date || '').getTime()) /
      (1000 * 60 * 60 * 24),
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
            onClick={() => router.push(`/dashboard/sales/quotations/${quotation.id}/edit`)}
          >
            <HiPencil className="h-4 w-4 mr-2" />
            Edit Quotation
          </Button>
          <Button
            size="sm"
            color="purple"
            className="w-full justify-start"
            onClick={handleConvertToOrder}
          >
            <IoDocumentsOutline className="h-4 w-4 mr-2" />
            Convert to Order
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
            docType="quotation"
            docId={quotation.id}
            onEmail={onEmail}
            onWhatsApp={onWhatsApp}
            refreshTrigger={refreshSendCard}
            compact
          />
        </div>
      </div>

      {/* Follow Up Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Follow Up
          </h3>
        </div>
        <button
          onClick={onSetReminder}
          className="w-full flex items-center gap-2 p-2 rounded-md border border-dashed border-gray-300 dark:border-gray-600 hover:border-amber-400 dark:hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors text-left"
        >
          <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
            <Image
              src="/images/layout/reminder.svg"
              alt="Reminder"
              width={16}
              height={16}
              className="w-4 h-4"
            />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-900 dark:text-white">Set Reminder</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Schedule a follow-up</div>
          </div>
        </button>
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
                {formatDate(quotation.created_date)} ({daysAgo} days ago)
              </div>
            </div>
          </div>
          {quotation.required_date && (
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 mt-1.5 flex-shrink-0"></div>
              <div className="min-w-0">
                <div className="text-sm text-gray-900 dark:text-white">Valid Until</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(quotation.required_date)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Customer Info Card */}
      {quotation.customer && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-3">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            Customer
          </h3>
          <div className="space-y-1.5">
            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {quotation.customer.name}
            </div>
            {quotation.customer.email && (
              <a
                href={`mailto:${quotation.customer.email}`}
                className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400"
              >
                <HiMail className="h-3.5 w-3.5" />
                <span className="truncate">{quotation.customer.email}</span>
              </a>
            )}
            {quotation.customer.contact && (
              <a
                href={`tel:${quotation.customer.contact}`}
                className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400"
              >
                <HiPhone className="h-3.5 w-3.5" />
                <span>{quotation.customer.contact}</span>
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
