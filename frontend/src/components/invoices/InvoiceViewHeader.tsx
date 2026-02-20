import React from 'react';
import { useRouter } from 'next/navigation';
import { Button, Dropdown, Badge } from 'flowbite-react';
import { HiArrowLeft, HiDotsVertical, HiPencil } from 'react-icons/hi';
import { formatDateSriLankan } from '@/utils/dateUtils';
import { formatIndianCurrency } from '@/utils/currencyUtils';
import type { Invoice, InvoiceStatus } from '@/types/invoices';
import { InvoiceStatusLabels, InvoiceStatusColors } from '@/types/invoices';

interface InvoiceViewHeaderProps {
  invoice: Invoice;
  pdfLoading?: boolean;
  printing?: boolean;
  onDownloadPDF: () => void;
  onPrint: () => void;
  onEmail: () => void;
  onWhatsApp?: () => void;
  onVoid?: () => void;
}

export function InvoiceViewHeader({
  invoice,
  pdfLoading = false,
  printing = false,
  onDownloadPDF,
  onPrint,
  onEmail,
  onWhatsApp,
  onVoid,
}: InvoiceViewHeaderProps) {
  const router = useRouter();

  const formatCurrency = (amount: number) => formatIndianCurrency(amount);
  const formatDate = (dateString?: string | null) => formatDateSriLankan(dateString || undefined);
  const invoiceTypeLabel =
    invoice.invoice_type_display ||
    (invoice.invoice_type === 'tax_invoice' ? 'Tax Invoice' : 'Proforma Invoice');

  const renderStatusBadge = (status: InvoiceStatus) => {
    const color = InvoiceStatusColors[status];
    const label = InvoiceStatusLabels[status];

    return (
      <Badge color={color} size="xs" className="justify-center">
        {label}
      </Badge>
    );
  };

  const canEdit = invoice.status === 'draft';

  return (
    <div className="mb-4">
      {/* Compact Single-Line Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="px-4 py-3">
          {/* Top Row: Back + Title + Actions */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => router.push('/dashboard/sales/invoices')}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors flex-shrink-0"
                title="Back to Invoices"
              >
                <HiArrowLeft className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-3 min-w-0">
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                  Invoice #{invoice.invoice_number}
                </h1>
                <span className="hidden md:inline text-xs text-gray-500 dark:text-gray-400">
                  {invoiceTypeLabel}
                </span>
                <div className="hidden sm:block">{renderStatusBadge(invoice.status)}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {canEdit && (
                <Button
                  size="xs"
                  color="light"
                  onClick={() => router.push(`/dashboard/sales/invoices/${invoice.id}/edit`)}
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
                    onClick={() => router.push(`/dashboard/sales/invoices/${invoice.id}/edit`)}
                    className="sm:hidden"
                  >
                    Edit Invoice
                  </Dropdown.Item>
                )}
                <Dropdown.Item onClick={onDownloadPDF} disabled={pdfLoading || printing}>
                  {pdfLoading ? 'Downloading...' : 'Download PDF'}
                </Dropdown.Item>
                <Dropdown.Divider />
                <Dropdown.Item onClick={onPrint}>Print Invoice</Dropdown.Item>
                <Dropdown.Item onClick={onEmail}>Email Invoice</Dropdown.Item>
                {onWhatsApp && (
                  <Dropdown.Item onClick={onWhatsApp}>Send via WhatsApp</Dropdown.Item>
                )}
                {onVoid && invoice.status !== 'void' && invoice.status !== 'paid' && (
                  <>
                    <Dropdown.Divider />
                    <Dropdown.Item onClick={onVoid}>Void Invoice</Dropdown.Item>
                  </>
                )}
              </Dropdown>
            </div>
          </div>

          {/* Info Strip */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm">
            <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
              <span className="font-medium text-gray-900 dark:text-white">
                {invoice.customer_detail?.name || invoice.customer_name || 'No Customer'}
              </span>
            </div>

            <span className="text-gray-300 dark:text-gray-600">|</span>

            <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
              <span>Total:</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatCurrency(parseFloat(invoice.net_total as string))}
              </span>
            </div>

            <span className="text-gray-300 dark:text-gray-600 hidden md:inline">|</span>

            <div className="hidden md:flex items-center gap-1 text-gray-600 dark:text-gray-400">
              <span>Due:</span>
              <span className="text-gray-900 dark:text-white">{formatDate(invoice.due_date)}</span>
            </div>

            {invoice.order_detail && (
              <>
                <span className="text-gray-300 dark:text-gray-600 hidden lg:inline">|</span>
                <div className="hidden lg:flex items-center gap-1 text-gray-600 dark:text-gray-400">
                  <span>Order:</span>
                  <a
                    href={`/dashboard/sales/orders/${invoice.order_detail.id}`}
                    className="text-teal-600 dark:text-teal-400 hover:underline"
                  >
                    #{invoice.order_detail.order_number}
                  </a>
                </div>
              </>
            )}

            {/* Mobile status */}
            <div className="sm:hidden">{renderStatusBadge(invoice.status)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
