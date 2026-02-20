/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import Image from 'next/image';
import { HiOutlinePrinter } from 'react-icons/hi';
import { formatDateSriLankan } from '@/utils/dateUtils';
import { formatIndianCurrency } from '@/utils/currencyUtils';
import type { Invoice } from '@/types/invoices';

interface InvoiceDocumentProps {
  invoice: Invoice;
  onPrint?: () => void;
}

export function InvoiceDocument({ invoice, onPrint }: InvoiceDocumentProps) {
  const formatCurrency = (amount: number | string | null | undefined) =>
    formatIndianCurrency(amount);
  const formatDate = (dateString?: string | null) => formatDateSriLankan(dateString || undefined);

  const parseNumber = (value: unknown) => {
    const n = typeof value === 'number' ? value : parseFloat(String(value ?? '0'));
    return Number.isFinite(n) ? n : 0;
  };

  const subtotal = parseNumber(invoice.subtotal);
  const discount = parseNumber(invoice.discount);
  const netTotal = parseNumber(invoice.net_total);
  const vatRateDecimal = parseNumber(invoice.vat_rate);
  const vatRatePercent = vatRateDecimal * 100;
  const storedTaxAmount = parseNumber((invoice as any).tax_amount);
  const computedVatAmount = Math.max(0, netTotal - (subtotal - discount));
  const vatAmount = storedTaxAmount > 0 ? storedTaxAmount : computedVatAmount;
  const invoiceTypeLabel =
    invoice.invoice_type_display ||
    (invoice.invoice_type === 'tax_invoice' ? 'Tax Invoice' : 'Proforma Invoice');

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Document Header Bar */}
      <div className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600 px-4 py-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Invoice Preview
          </span>
          {onPrint && (
            <button
              onClick={onPrint}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border border-gray-300 dark:border-gray-500 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 hover:border-gray-400 dark:hover:border-gray-400 transition-colors"
              title="Print Invoice"
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
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
              {invoice.invoice_type === 'tax_invoice' ? 'TAX INVOICE' : 'PROFORMA INVOICE'}
            </h2>
            <div className="text-base font-semibold text-gray-700 dark:text-gray-300">
              #{invoice.invoice_number}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {invoiceTypeLabel}
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

        {/* Customer and Invoice Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">Bill To:</h3>
            <div className="text-gray-700 dark:text-gray-300">
              <div className="font-semibold text-sm">
                {invoice.customer_detail?.name || invoice.customer_name || 'No Customer'}
              </div>
              {invoice.customer_detail?.addresses &&
              invoice.customer_detail.addresses.length > 0 ? (
                (() => {
                  const billingAddress = invoice.customer_detail.addresses.find(
                    (addr: any) => addr.type === 'billing',
                  );
                  const primaryAddress = billingAddress || invoice.customer_detail.addresses[0];

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
              ) : invoice.customer_detail?.address &&
                invoice.customer_detail.address !== 'No address' ? (
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                  {invoice.customer_detail.address}
                </div>
              ) : null}
              {invoice.customer_detail?.contact && (
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {invoice.customer_detail.contact}
                </div>
              )}
              {invoice.customer_detail?.email && (
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {invoice.customer_detail.email}
                </div>
              )}
            </div>
          </div>
          <div className="md:text-right">
            <div className="inline-grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div>
                <div className="font-semibold text-gray-900 dark:text-white text-xs">
                  Invoice Date
                </div>
                <div className="text-gray-700 dark:text-gray-300">
                  {formatDate(invoice.invoice_date)}
                </div>
              </div>
              <div>
                <div className="font-semibold text-gray-900 dark:text-white text-xs">Due Date</div>
                <div className="text-gray-700 dark:text-gray-300">
                  {formatDate(invoice.due_date)}
                </div>
              </div>
              {invoice.po_so_number && (
                <div className="col-span-2">
                  <div className="font-semibold text-gray-900 dark:text-white text-xs">
                    PO/SO Number
                  </div>
                  <div className="text-gray-700 dark:text-gray-300">{invoice.po_so_number}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Items Table */}
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
              {invoice.items?.map((item, index) => (
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
                    {parseNumber(item.quantity)
                      ? Math.round(parseNumber(item.quantity)).toLocaleString()
                      : '0'}
                  </td>
                  <td className="border-b border-gray-200 dark:border-gray-600 px-3 py-2.5 text-right text-gray-700 dark:text-gray-300 text-sm">
                    {formatCurrency(parseNumber(item.unit_price))}
                  </td>
                  <td className="border-b border-gray-200 dark:border-gray-600 px-3 py-2.5 text-right text-gray-700 dark:text-gray-300 text-sm font-medium">
                    {formatCurrency(parseNumber(item.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Section */}
        <div className="flex justify-end">
          <div className="w-64">
            <div className="flex justify-between py-1.5 text-sm">
              <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
              <span className="text-gray-900 dark:text-white">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between py-1.5 text-sm">
              <span className="text-gray-600 dark:text-gray-400">Discount:</span>
              <span className="text-gray-900 dark:text-white">{formatCurrency(discount)}</span>
            </div>
            <div className="flex justify-between py-1.5 text-sm">
              <span className="text-gray-600 dark:text-gray-400">Delivery Charges:</span>
              <span className="text-gray-900 dark:text-white">{formatCurrency(0)}</span>
            </div>
            <div className="flex justify-between py-1.5 text-sm">
              <span className="text-gray-600 dark:text-gray-400">VAT %:</span>
              <span className="text-gray-900 dark:text-white">
                {vatRatePercent.toLocaleString('en-LK', { maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between py-1.5 text-sm">
              <span className="text-gray-600 dark:text-gray-400">VAT Amount:</span>
              <span className="text-gray-900 dark:text-white">{formatCurrency(vatAmount)}</span>
            </div>
            <div className="border-t border-gray-300 dark:border-gray-600 pt-2 mt-1">
              <div className="flex justify-between">
                <span className="text-base font-bold text-gray-900 dark:text-white">
                  Net Total:
                </span>
                <span className="text-base font-bold text-gray-900 dark:text-white">
                  {formatCurrency(netTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
