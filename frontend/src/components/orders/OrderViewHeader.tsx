import React from 'react';
import { useRouter } from 'next/navigation';
import { Button, Dropdown, Badge } from 'flowbite-react';
import { HiArrowLeft, HiDotsVertical, HiPencil } from 'react-icons/hi';
import { formatDateSriLankan } from '@/utils/dateUtils';
import { formatIndianCurrency } from '@/utils/currencyUtils';
import type { SalesOrder, OrderStatus } from '@/types/orders';
import { OrderStatusLabels, OrderStatusColors } from '@/types/orders';

interface OrderViewHeaderProps {
  order: SalesOrder;
  pdfLoading?: boolean;
  printing?: boolean;
  onDownloadPDF: () => void;
  onPrint: () => void;
  onEmail: () => void;
  onWhatsApp: () => void;
  onClone: () => void;
  onConvertToInvoice?: () => void;
}

export function OrderViewHeader({
  order,
  pdfLoading = false,
  printing = false,
  onDownloadPDF,
  onPrint,
  onEmail,
  onWhatsApp,
  onClone,
  onConvertToInvoice,
}: OrderViewHeaderProps) {
  const router = useRouter();

  const formatCurrency = (amount: number) => formatIndianCurrency(amount);
  const formatDate = (dateString?: string) => formatDateSriLankan(dateString);

  const renderStatusBadge = (status: OrderStatus) => {
    const color = OrderStatusColors[status];
    const label = OrderStatusLabels[status];

    return (
      <Badge color={color} size="xs" className="justify-center">
        {label}
      </Badge>
    );
  };

  const canEdit = order.status === 'draft' || order.status === 'confirmed';

  return (
    <div className="mb-4">
      {/* Compact Single-Line Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="px-4 py-3">
          {/* Top Row: Back + Title + Actions */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => router.push('/dashboard/sales/orders')}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors flex-shrink-0"
                title="Back to Orders"
              >
                <HiArrowLeft className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-3 min-w-0">
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                  Order #{order.order_number}
                </h1>
                <div className="hidden sm:block">{renderStatusBadge(order.status)}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {canEdit && (
                <Button
                  size="xs"
                  color="light"
                  onClick={() => router.push(`/dashboard/sales/orders/${order.id}/edit`)}
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
                    onClick={() => router.push(`/dashboard/sales/orders/${order.id}/edit`)}
                    className="sm:hidden"
                  >
                    Edit Order
                  </Dropdown.Item>
                )}
                <Dropdown.Item onClick={onDownloadPDF} disabled={pdfLoading || printing}>
                  {pdfLoading ? 'Downloading...' : 'Download PDF'}
                </Dropdown.Item>
                <Dropdown.Divider />
                <Dropdown.Item onClick={onPrint}>Print Order</Dropdown.Item>
                <Dropdown.Item onClick={onEmail}>Email Order</Dropdown.Item>
                <Dropdown.Item onClick={onWhatsApp}>Send via WhatsApp</Dropdown.Item>
                <Dropdown.Item onClick={onClone}>Clone Order</Dropdown.Item>
                {onConvertToInvoice &&
                  order.status !== 'cancelled' &&
                  order.status !== 'invoiced' &&
                  order.status !== 'completed' && (
                    <>
                      <Dropdown.Divider />
                      <Dropdown.Item onClick={onConvertToInvoice}>Convert to Invoice</Dropdown.Item>
                    </>
                  )}
              </Dropdown>
            </div>
          </div>

          {/* Info Strip */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm">
            <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
              <span className="font-medium text-gray-900 dark:text-white">
                {order.customer?.name || 'No Customer'}
              </span>
            </div>

            <span className="text-gray-300 dark:text-gray-600">|</span>

            <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
              <span>Total:</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatCurrency(order.net_total)}
              </span>
            </div>

            <span className="text-gray-300 dark:text-gray-600 hidden md:inline">|</span>

            <div className="hidden md:flex items-center gap-1 text-gray-600 dark:text-gray-400">
              <span>Required:</span>
              <span className="text-gray-900 dark:text-white">
                {formatDate(order.required_date)}
              </span>
            </div>

            {order.quotation_number && (
              <>
                <span className="text-gray-300 dark:text-gray-600 hidden lg:inline">|</span>
                <div className="hidden lg:flex items-center gap-1 text-gray-600 dark:text-gray-400">
                  <span>Quotation:</span>
                  <a
                    href={`/dashboard/sales/quotations/${order.quotation}`}
                    className="text-teal-600 dark:text-teal-400 hover:underline"
                  >
                    #{order.quotation_number}
                  </a>
                </div>
              </>
            )}

            {order.costing_number && !order.quotation_number && (
              <>
                <span className="text-gray-300 dark:text-gray-600 hidden lg:inline">|</span>
                <div className="hidden lg:flex items-center gap-1 text-gray-600 dark:text-gray-400">
                  <span>Costing:</span>
                  <a
                    href={`/dashboard/sales/costing/${order.costing}`}
                    className="text-purple-600 dark:text-purple-400 hover:underline"
                  >
                    #{order.costing_number}
                  </a>
                </div>
              </>
            )}

            {/* Mobile status */}
            <div className="sm:hidden">{renderStatusBadge(order.status)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
