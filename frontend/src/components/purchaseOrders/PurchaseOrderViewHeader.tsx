import React from 'react';
import { useRouter } from 'next/navigation';
import { Button, Dropdown, Badge } from 'flowbite-react';
import { HiArrowLeft, HiDotsVertical, HiPencil } from 'react-icons/hi';
import { formatDateSriLankan } from '@/utils/dateUtils';
import { formatIndianCurrency } from '@/utils/currencyUtils';
import type { PurchaseOrder, PurchaseOrderStatus } from '@/types/suppliers';
import { PurchaseOrderStatusLabels, PurchaseOrderStatusColors } from '@/types/suppliers';

interface PurchaseOrderViewHeaderProps {
  purchaseOrder: PurchaseOrder;
  pdfLoading?: boolean;
  printing?: boolean;
  onDownloadPDF: () => void;
  onPrint: () => void;
  onEmail: () => void;
  onWhatsApp?: () => void;
  onSend?: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export function PurchaseOrderViewHeader({
  purchaseOrder,
  pdfLoading = false,
  printing = false,
  onDownloadPDF,
  onPrint,
  onEmail,
  onWhatsApp,
  onSend,
  onConfirm,
  onCancel,
}: PurchaseOrderViewHeaderProps) {
  const router = useRouter();

  const formatCurrency = (amount: number) => formatIndianCurrency(amount);
  const formatDate = (dateString?: string) => formatDateSriLankan(dateString);

  const renderStatusBadge = (status: PurchaseOrderStatus) => {
    const color = PurchaseOrderStatusColors[status];
    const label = PurchaseOrderStatusLabels[status];

    return (
      <Badge color={color} size="xs" className="justify-center">
        {label}
      </Badge>
    );
  };

  const canEdit = purchaseOrder.status === 'draft';
  const canSend = purchaseOrder.status === 'draft';
  const canConfirm = purchaseOrder.status === 'sent';
  const canCancel = !['cancelled', 'completed'].includes(purchaseOrder.status);

  return (
    <div className="mb-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => router.push('/dashboard/inventory/purchase-orders')}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors flex-shrink-0"
                title="Back to Purchase Orders"
              >
                <HiArrowLeft className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-3 min-w-0">
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                  Purchase Order #{purchaseOrder.po_number}
                </h1>
                <div className="hidden sm:block">{renderStatusBadge(purchaseOrder.status)}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {canEdit && (
                <Button
                  size="xs"
                  color="light"
                  onClick={() =>
                    router.push(`/dashboard/inventory/purchase-orders/${purchaseOrder.id}/edit`)
                  }
                  className="hidden sm:flex"
                >
                  <HiPencil className="h-3.5 w-3.5 mr-1.5" />
                  Edit
                </Button>
              )}

              <Dropdown
                label=""
                renderTrigger={() => (
                  <Button color="gray" size="xs">
                    <HiDotsVertical className="h-4 w-4" />
                  </Button>
                )}
              >
                {canEdit && (
                  <Dropdown.Item
                    onClick={() =>
                      router.push(`/dashboard/inventory/purchase-orders/${purchaseOrder.id}/edit`)
                    }
                    className="sm:hidden"
                  >
                    Edit Purchase Order
                  </Dropdown.Item>
                )}
                <Dropdown.Item onClick={onDownloadPDF} disabled={pdfLoading || printing}>
                  {pdfLoading ? 'Downloading...' : 'Download PDF'}
                </Dropdown.Item>
                <Dropdown.Divider />
                <Dropdown.Item onClick={onPrint}>Print Purchase Order</Dropdown.Item>
                <Dropdown.Item onClick={onEmail}>Email Purchase Order</Dropdown.Item>
                {onWhatsApp && (
                  <Dropdown.Item onClick={onWhatsApp}>Send via WhatsApp</Dropdown.Item>
                )}
                {(canSend || canConfirm || canCancel) && <Dropdown.Divider />}
                {canSend && onSend && <Dropdown.Item onClick={onSend}>Mark as Sent</Dropdown.Item>}
                {canConfirm && onConfirm && (
                  <Dropdown.Item onClick={onConfirm}>Confirm Purchase Order</Dropdown.Item>
                )}
                {canCancel && onCancel && (
                  <Dropdown.Item onClick={onCancel}>Cancel Purchase Order</Dropdown.Item>
                )}
              </Dropdown>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm">
            <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
              <span className="font-medium text-gray-900 dark:text-white">
                {purchaseOrder.supplier_detail?.name ||
                  purchaseOrder.supplier_name ||
                  'No Supplier'}
              </span>
            </div>

            <span className="text-gray-300 dark:text-gray-600">|</span>

            <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
              <span>Total:</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatCurrency(parseFloat(purchaseOrder.total as string))}
              </span>
            </div>

            <span className="text-gray-300 dark:text-gray-600 hidden md:inline">|</span>

            <div className="hidden md:flex items-center gap-1 text-gray-600 dark:text-gray-400">
              <span>Order Date:</span>
              <span className="text-gray-900 dark:text-white">
                {formatDate(purchaseOrder.order_date)}
              </span>
            </div>

            {purchaseOrder.expected_delivery_date && (
              <>
                <span className="text-gray-300 dark:text-gray-600 hidden lg:inline">|</span>
                <div className="hidden lg:flex items-center gap-1 text-gray-600 dark:text-gray-400">
                  <span>Expected:</span>
                  <span className="text-gray-900 dark:text-white">
                    {formatDate(purchaseOrder.expected_delivery_date)}
                  </span>
                </div>
              </>
            )}

            <div className="sm:hidden">{renderStatusBadge(purchaseOrder.status)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
