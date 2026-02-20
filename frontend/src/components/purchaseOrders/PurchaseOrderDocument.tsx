import React from 'react';
import Image from 'next/image';
import { HiOutlinePrinter } from 'react-icons/hi';
import { formatDateSriLankan } from '@/utils/dateUtils';
import { formatIndianCurrency } from '@/utils/currencyUtils';
import type { PurchaseOrder } from '@/types/suppliers';

interface PurchaseOrderDocumentProps {
  purchaseOrder: PurchaseOrder;
  onPrint?: () => void;
}

export function PurchaseOrderDocument({ purchaseOrder, onPrint }: PurchaseOrderDocumentProps) {
  const formatCurrency = (amount: number) => formatIndianCurrency(amount);
  const formatDate = (dateString?: string) => formatDateSriLankan(dateString);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600 px-4 py-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Purchase Order Preview
          </span>
          {onPrint && (
            <button
              onClick={onPrint}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border border-gray-300 dark:border-gray-500 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 hover:border-gray-400 dark:hover:border-gray-400 transition-colors"
              title="Print Purchase Order"
            >
              <HiOutlinePrinter className="h-3.5 w-3.5" />
              Print
            </button>
          )}
        </div>
      </div>

      <div className="p-6 lg:p-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">PURCHASE ORDER</h2>
            <div className="text-base font-semibold text-gray-700 dark:text-gray-300">
              #{purchaseOrder.po_number}
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">Supplier:</h3>
            <div className="text-gray-700 dark:text-gray-300">
              <div className="font-semibold text-sm">
                {purchaseOrder.supplier_detail?.name ||
                  purchaseOrder.supplier_name ||
                  'No Supplier'}
              </div>
              {purchaseOrder.supplier_detail?.email && (
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                  {purchaseOrder.supplier_detail.email}
                </div>
              )}
              {purchaseOrder.supplier_detail?.phone && (
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {purchaseOrder.supplier_detail.phone}
                </div>
              )}
              {purchaseOrder.delivery_address && (
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                  {purchaseOrder.delivery_address}
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
                  {formatDate(purchaseOrder.order_date)}
                </div>
              </div>
              {purchaseOrder.expected_delivery_date && (
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white text-xs">
                    Expected Delivery
                  </div>
                  <div className="text-gray-700 dark:text-gray-300">
                    {formatDate(purchaseOrder.expected_delivery_date)}
                  </div>
                </div>
              )}
              {purchaseOrder.shipping_method && (
                <div className="col-span-2">
                  <div className="font-semibold text-gray-900 dark:text-white text-xs">
                    Shipping Method
                  </div>
                  <div className="text-gray-700 dark:text-gray-300">
                    {purchaseOrder.shipping_method}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mb-5 -mx-2">
          <table className="w-full border-collapse">
            <colgroup>
              <col className="w-[50%]" />
              <col className="w-[15%]" />
              <col className="w-[15%]" />
              <col className="w-[20%]" />
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
              </tr>
            </thead>
            <tbody>
              {purchaseOrder.items?.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="border-b border-gray-200 dark:border-gray-600 px-3 py-2.5 text-gray-700 dark:text-gray-300">
                    <div className="font-medium text-sm">{item.item_name}</div>
                    {item.description && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                        {item.description}
                      </div>
                    )}
                  </td>
                  <td className="border-b border-gray-200 dark:border-gray-600 px-3 py-2.5 text-center text-gray-700 dark:text-gray-300 text-sm">
                    {item.quantity ? Math.round(Number(item.quantity)).toLocaleString() : '0'}
                  </td>
                  <td className="border-b border-gray-200 dark:border-gray-600 px-3 py-2.5 text-right text-gray-700 dark:text-gray-300 text-sm">
                    {formatCurrency(parseFloat(item.unit_price as string))}
                  </td>
                  <td className="border-b border-gray-200 dark:border-gray-600 px-3 py-2.5 text-right text-gray-700 dark:text-gray-300 text-sm font-medium">
                    {formatCurrency(parseFloat(item.amount as string))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <div className="w-64">
            <div className="flex justify-between py-1.5 text-sm">
              <span className="text-gray-600 dark:text-gray-400">Sub Total:</span>
              <span className="text-gray-900 dark:text-white">
                {formatCurrency(parseFloat(purchaseOrder.subtotal as string))}
              </span>
            </div>
            {purchaseOrder.tax_amount && parseFloat(purchaseOrder.tax_amount as string) > 0 && (
              <div className="flex justify-between py-1.5 text-sm">
                <span className="text-gray-600 dark:text-gray-400">Tax:</span>
                <span className="text-gray-900 dark:text-white">
                  {formatCurrency(parseFloat(purchaseOrder.tax_amount as string))}
                </span>
              </div>
            )}
            {purchaseOrder.discount_amount &&
              parseFloat(purchaseOrder.discount_amount as string) > 0 && (
                <div className="flex justify-between py-1.5 text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Discount:</span>
                  <span className="text-gray-900 dark:text-white">
                    -{formatCurrency(parseFloat(purchaseOrder.discount_amount as string))}
                  </span>
                </div>
              )}
            <div className="border-t border-gray-300 dark:border-gray-600 pt-2 mt-1">
              <div className="flex justify-between">
                <span className="text-base font-bold text-gray-900 dark:text-white">Total:</span>
                <span className="text-base font-bold text-gray-900 dark:text-white">
                  {formatCurrency(parseFloat(purchaseOrder.total as string))}
                </span>
              </div>
            </div>
          </div>
        </div>

        {(purchaseOrder.notes || purchaseOrder.supplier_notes) && (
          <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
            {purchaseOrder.notes && (
              <div className="text-xs text-gray-600 dark:text-gray-400">
                <span className="font-semibold text-gray-900 dark:text-white">Internal Notes:</span>{' '}
                {purchaseOrder.notes}
              </div>
            )}
            {purchaseOrder.supplier_notes && (
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                <span className="font-semibold text-gray-900 dark:text-white">Supplier Notes:</span>{' '}
                {purchaseOrder.supplier_notes}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
