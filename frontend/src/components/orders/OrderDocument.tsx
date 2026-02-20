import React from 'react';
import Image from 'next/image';
import { HiOutlinePrinter, HiCheckCircle } from 'react-icons/hi';
import { formatDateSriLankan } from '@/utils/dateUtils';
import { formatIndianCurrency } from '@/utils/currencyUtils';
import { convertBulletsToHtml, formatProjectDescription } from '@/utils/quotationUtils';
import type { SalesOrder } from '@/types/orders';

interface OrderDocumentProps {
  order: SalesOrder;
  onPrint?: () => void;
  onUploadAttachment?: () => void;
}

export function OrderDocument({ order, onPrint }: OrderDocumentProps) {
  const formatCurrency = (amount: number | string | null | undefined) =>
    formatIndianCurrency(amount);
  const formatDate = (dateString?: string) => formatDateSriLankan(dateString);
  const vatPercent = (() => {
    const r =
      typeof order.vat_rate === 'number'
        ? order.vat_rate
        : parseFloat(String(order.vat_rate ?? '0'));
    const safe = Number.isFinite(r) ? r : 0;
    return safe * 100;
  })();

  // Adapt order items to work with formatProjectDescription which expects 'item' property
  const projectDescription = formatProjectDescription(
    (order.items || []).map((item) => ({ item: item.item_name })),
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Document Header Bar */}
      <div className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600 px-4 py-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Order Preview
          </span>
          {onPrint && (
            <button
              onClick={onPrint}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border border-gray-300 dark:border-gray-500 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 hover:border-gray-400 dark:hover:border-gray-400 transition-colors"
              title="Print Order"
            >
              <HiOutlinePrinter className="h-3.5 w-3.5" />
              Print
            </button>
          )}
        </div>
      </div>

      {/* Document Content */}
      <div className="p-6 lg:p-8">
        {/* Header with Logo */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">SALES ORDER</h2>
            <div className="text-base font-semibold text-gray-700 dark:text-gray-300">
              #{order.order_number}
            </div>
          </div>
          <div className="text-right">
            <div className="mb-3 flex justify-end">
              <Image
                src="/images/layout/kandyoffset-logo-light.svg"
                alt="Kandy Offset"
                width={180}
                height={54}
                className="block dark:hidden"
              />
              <Image
                src="/images/layout/kandyoffset-logo-dark.svg"
                alt="Kandy Offset"
                width={180}
                height={54}
                className="hidden dark:block"
              />
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
              <div>No. 947 Peradeniya Road Kandy</div>
              <div>0814946426</div>
              <div>info@printsrilanka.com</div>
              <div>kandyoffset.com</div>
            </div>
          </div>
        </div>

        {/* Customer and Project Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">To:</h3>
            <div className="text-gray-700 dark:text-gray-300">
              <div className="font-semibold text-sm">{order.customer?.name}</div>
              {order.customer?.addresses && order.customer.addresses.length > 0 ? (
                (() => {
                  const billingAddress = order.customer.addresses.find(
                    (addr) => addr.type === 'billing',
                  );
                  const primaryAddress = billingAddress || order.customer.addresses[0];

                  return (
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                      <div>{primaryAddress.line1}</div>
                      {primaryAddress.line2 && <div>{primaryAddress.line2}</div>}
                      <div>
                        {primaryAddress.city}
                        {primaryAddress.zip_code ? `, ${primaryAddress.zip_code}` : ''}
                      </div>
                    </div>
                  );
                })()
              ) : order.customer?.address && order.customer.address !== 'No address' ? (
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                  {order.customer.address}
                </div>
              ) : null}
              {order.customer?.contact && (
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {order.customer.contact}
                </div>
              )}
              {order.customer?.email && (
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {order.customer.email}
                </div>
              )}
            </div>
          </div>
          <div className="md:text-right">
            <div className="inline-grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div>
                <div className="font-semibold text-gray-900 dark:text-white text-xs">
                  Order Date
                </div>
                <div className="text-gray-700 dark:text-gray-300">
                  {formatDate(order.order_date)}
                </div>
              </div>
              <div>
                <div className="font-semibold text-gray-900 dark:text-white text-xs">
                  Required Date
                </div>
                <div className="text-gray-700 dark:text-gray-300">
                  {formatDate(order.required_date)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Project Info */}
        <div className="mb-5">
          <div className="font-semibold text-gray-900 dark:text-white text-sm mb-1">Project</div>
          <div className="text-sm text-gray-700 dark:text-gray-300">{projectDescription}</div>
        </div>

        {/* Items Table */}
        <div className="mb-5 -mx-2">
          <table className="w-full border-collapse">
            <colgroup>
              <col className="w-[50%]" />
              <col className="w-[10%]" />
              <col className="w-[15%]" />
              <col className="w-[15%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700">
                <th className="border-y border-gray-200 dark:border-gray-600 px-3 py-2 text-left text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                  Item/Description
                </th>
                <th className="border-y border-gray-200 dark:border-gray-600 px-3 py-2 text-center text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                  Qty
                </th>
                <th className="border-y border-gray-200 dark:border-gray-600 px-3 py-2 text-right text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                  Unit Price
                </th>
                <th className="border-y border-gray-200 dark:border-gray-600 px-3 py-2 text-right text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                  Amount
                </th>
                <th className="border-y border-gray-200 dark:border-gray-600 px-3 py-2 text-center text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                  Ticket
                </th>
              </tr>
            </thead>
            <tbody>
              {order.items?.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="border-b border-gray-200 dark:border-gray-600 px-3 py-2.5 text-gray-700 dark:text-gray-300">
                    <div className="font-medium text-sm">{item.item_name}</div>
                    {item.description && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                        {convertBulletsToHtml(item.description)}
                      </div>
                    )}
                  </td>
                  <td className="border-b border-gray-200 dark:border-gray-600 px-3 py-2.5 text-center text-gray-700 dark:text-gray-300 text-sm">
                    {item.quantity ? Math.round(item.quantity).toLocaleString() : '0'}
                  </td>
                  <td className="border-b border-gray-200 dark:border-gray-600 px-3 py-2.5 text-right text-gray-700 dark:text-gray-300 text-sm">
                    {formatCurrency(item.unit_price)}
                  </td>
                  <td className="border-b border-gray-200 dark:border-gray-600 px-3 py-2.5 text-right text-gray-700 dark:text-gray-300 text-sm font-medium">
                    {formatCurrency(item.amount)}
                  </td>
                  <td className="border-b border-gray-200 dark:border-gray-600 px-3 py-2.5 text-center text-gray-700 dark:text-gray-300">
                    {item.job_ticket_generated ? (
                      <div className="flex flex-col items-center">
                        <HiCheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-[10px] font-medium text-gray-500">
                          #{item.job_ticket_number}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-400">Pending</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Section */}
        <div className="flex justify-between items-start">
          <div className="text-xs text-gray-500 dark:text-gray-400 max-w-md">
            {order.customer_notes && (
              <div className="mb-2">
                <span className="font-semibold">Customer Notes:</span> {order.customer_notes}
              </div>
            )}
            {order.delivery_instructions && (
              <div>
                <span className="font-semibold">Delivery:</span> {order.delivery_instructions}
              </div>
            )}
          </div>
          <div className="w-64">
            <div className="flex justify-between py-1.5 text-sm">
              <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
              <span className="text-gray-900 dark:text-white">
                {formatCurrency(order.subtotal)}
              </span>
            </div>
            <div className="flex justify-between py-1.5 text-sm">
              <span className="text-gray-600 dark:text-gray-400">Discount:</span>
              <span className="text-gray-900 dark:text-white">
                {formatCurrency(order.discount)}
              </span>
            </div>
            <div className="flex justify-between py-1.5 text-sm">
              <span className="text-gray-600 dark:text-gray-400">Delivery Charges:</span>
              <span className="text-gray-900 dark:text-white">
                {formatCurrency(order.delivery_charge)}
              </span>
            </div>
            <div className="flex justify-between py-1.5 text-sm">
              <span className="text-gray-600 dark:text-gray-400">VAT %:</span>
              <span className="text-gray-900 dark:text-white">
                {vatPercent.toLocaleString('en-LK', { maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between py-1.5 text-sm">
              <span className="text-gray-600 dark:text-gray-400">VAT Amount:</span>
              <span className="text-gray-900 dark:text-white">
                {formatCurrency(order.vat_amount)}
              </span>
            </div>
            <div className="border-t border-gray-300 dark:border-gray-600 pt-2 mt-1">
              <div className="flex justify-between">
                <span className="text-base font-bold text-gray-900 dark:text-white">
                  Net Total:
                </span>
                <span className="text-base font-bold text-gray-900 dark:text-white">
                  {formatCurrency(order.net_total)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
