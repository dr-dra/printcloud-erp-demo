import React from 'react';
import { useRouter } from 'next/navigation';
import { Button, Dropdown } from 'flowbite-react';
import { HiArrowLeft, HiDotsVertical, HiPencil } from 'react-icons/hi';
import { formatDateSriLankan } from '@/utils/dateUtils';
import { formatIndianCurrency } from '@/utils/currencyUtils';
import { renderQuotationStatus } from '@/utils/quotationUtils';
import type { SalesQuotation } from '@/types/quotations';

interface QuotationViewHeaderProps {
  quotation: SalesQuotation;
  pdfLoading?: boolean;
  printing?: boolean;
  onDownloadPDF: () => void;
  onPrint: () => void;
  onEmail: () => void;
  onEdit?: () => void;
}

export function QuotationViewHeader({
  quotation,
  pdfLoading = false,
  printing = false,
  onDownloadPDF,
  onPrint,
  onEmail,
}: QuotationViewHeaderProps) {
  const router = useRouter();

  const formatCurrency = (amount: number) => formatIndianCurrency(amount);
  const formatDate = (dateString?: string) => formatDateSriLankan(dateString);

  const totalAmount =
    (quotation.items || []).reduce((sum, item) => sum + (item.price || 0), 0) +
    (quotation.delivery_charge || 0);

  const costingIds = quotation.items
    ? Array.from(
        new Set(
          quotation.items
            .filter((item) => item.costing_estimating_id)
            .map((item) => item.costing_estimating_id),
        ),
      )
    : [];

  return (
    <div className="mb-4">
      {/* Compact Single-Line Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="px-4 py-3">
          {/* Top Row: Back + Title + Actions */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => router.push('/dashboard/sales/quotations')}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors flex-shrink-0"
                title="Back to Quotations"
              >
                <HiArrowLeft className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-3 min-w-0">
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                  Quotation #{quotation.quot_number}
                </h1>
                <div className="hidden sm:block">{renderQuotationStatus(quotation)}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                size="xs"
                color="light"
                onClick={() => router.push(`/dashboard/sales/quotations/${quotation.id}/edit`)}
                className="hidden sm:flex"
              >
                <HiPencil className="h-3.5 w-3.5 mr-1.5" />
                Edit
              </Button>

              <Dropdown
                label=""
                renderTrigger={() => (
                  <Button color="gray" size="xs">
                    <HiDotsVertical className="h-4 w-4" />
                  </Button>
                )}
              >
                <Dropdown.Item
                  onClick={() => router.push(`/dashboard/sales/quotations/${quotation.id}/edit`)}
                  className="sm:hidden"
                >
                  Edit Quotation
                </Dropdown.Item>
                <Dropdown.Item onClick={onDownloadPDF} disabled={pdfLoading || printing}>
                  {pdfLoading ? 'Downloading...' : 'Download PDF'}
                </Dropdown.Item>
                <Dropdown.Divider />
                <Dropdown.Item onClick={onPrint}>Print Quotation</Dropdown.Item>
                <Dropdown.Item onClick={onEmail}>Email Quotation</Dropdown.Item>
                <Dropdown.Item>Duplicate Quotation</Dropdown.Item>
                <Dropdown.Divider />
                <Dropdown.Item>Archive Quotation</Dropdown.Item>
              </Dropdown>
            </div>
          </div>

          {/* Info Strip */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm">
            <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
              <span className="font-medium text-gray-900 dark:text-white">
                {quotation.customer?.name || 'No Customer'}
              </span>
            </div>

            <span className="text-gray-300 dark:text-gray-600">|</span>

            <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
              <span>Total:</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatCurrency(totalAmount)}
              </span>
            </div>

            <span className="text-gray-300 dark:text-gray-600 hidden md:inline">|</span>

            <div className="hidden md:flex items-center gap-1 text-gray-600 dark:text-gray-400">
              <span>Valid:</span>
              <span className="text-gray-900 dark:text-white">
                {formatDate(quotation.required_date)}
              </span>
            </div>

            {costingIds.length > 0 && (
              <>
                <span className="text-gray-300 dark:text-gray-600 hidden lg:inline">|</span>
                <div className="hidden lg:flex items-center gap-1 text-gray-600 dark:text-gray-400">
                  <span>Costing:</span>
                  {costingIds.map((estimatingId, index) => (
                    <span key={estimatingId}>
                      <a
                        href={`/dashboard/sales/costing/${estimatingId}`}
                        className="text-teal-600 dark:text-teal-400 hover:underline"
                      >
                        #{estimatingId}
                      </a>
                      {index < costingIds.length - 1 && ', '}
                    </span>
                  ))}
                </div>
              </>
            )}

            {/* Mobile status */}
            <div className="sm:hidden">{renderQuotationStatus(quotation)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
