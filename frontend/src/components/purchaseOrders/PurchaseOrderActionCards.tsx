import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from 'flowbite-react';
import { HiPencil, HiPaperAirplane, HiCheckCircle, HiXCircle } from 'react-icons/hi';
import SendCard from '@/components/communications/SendCard';
import { formatDateSriLankan } from '@/utils/dateUtils';
import type { PurchaseOrder } from '@/types/suppliers';

interface PurchaseOrderActionCardsProps {
  purchaseOrder: PurchaseOrder;
  onSend: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  onEmail: () => void;
  onWhatsApp: () => void;
  onPrint: () => void;
  refreshCommunications: number;
}

export function PurchaseOrderActionCards({
  purchaseOrder,
  onSend,
  onConfirm,
  onCancel,
  onEmail,
  onWhatsApp,
  onPrint,
  refreshCommunications,
}: PurchaseOrderActionCardsProps) {
  const router = useRouter();
  const formatDate = (dateString?: string) => formatDateSriLankan(dateString);

  const canEdit = purchaseOrder.status === 'draft';
  const canSend = purchaseOrder.status === 'draft';
  const canConfirm = purchaseOrder.status === 'sent';
  const canCancel = !['cancelled', 'completed'].includes(purchaseOrder.status);

  return (
    <div className="space-y-3">
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-3">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
          Quick Actions
        </h3>
        <div className="space-y-2">
          <Button
            size="sm"
            className="w-full justify-start"
            onClick={() =>
              router.push(`/dashboard/inventory/purchase-orders/${purchaseOrder.id}/edit`)
            }
            disabled={!canEdit}
            color={canEdit ? 'gray' : 'light'}
          >
            <HiPencil className="h-4 w-4 mr-2" />
            Edit Purchase Order
          </Button>
          <Button
            size="sm"
            className="w-full justify-start"
            onClick={onSend}
            disabled={!canSend}
            color={canSend ? 'primary' : 'light'}
          >
            <HiPaperAirplane className="h-4 w-4 mr-2" />
            Mark as Sent
          </Button>
          <Button
            size="sm"
            className="w-full justify-start"
            onClick={onConfirm}
            disabled={!canConfirm}
            color={canConfirm ? 'success' : 'light'}
          >
            <HiCheckCircle className="h-4 w-4 mr-2" />
            Confirm Purchase Order
          </Button>
          <Button
            size="sm"
            className="w-full justify-start"
            onClick={onCancel}
            disabled={!canCancel}
            color={canCancel ? 'failure' : 'light'}
          >
            <HiXCircle className="h-4 w-4 mr-2" />
            Cancel Purchase Order
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Send
          </h3>
        </div>
        <div className="p-3">
          <SendCard
            docType="purchase_order"
            docId={purchaseOrder.id}
            onEmail={onEmail}
            onWhatsApp={onWhatsApp}
            onPrint={onPrint}
            refreshTrigger={refreshCommunications}
            compact
          />
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 shadow-sm p-3">
        <h3 className="text-xs font-semibold text-blue-900 dark:text-blue-200 uppercase tracking-wider mb-2">
          Order Summary
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-blue-700 dark:text-blue-300">Order Date:</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {formatDate(purchaseOrder.order_date)}
            </span>
          </div>
          {purchaseOrder.expected_delivery_date && (
            <div className="flex justify-between">
              <span className="text-blue-700 dark:text-blue-300">Expected:</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatDate(purchaseOrder.expected_delivery_date)}
              </span>
            </div>
          )}
          <div className="flex justify-between border-t border-blue-200 dark:border-blue-700 pt-2">
            <span className="text-blue-700 dark:text-blue-300 font-semibold">Total:</span>
            <span className="font-bold text-gray-900 dark:text-white">
              Rs. {parseFloat(purchaseOrder.total as string).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
