'use client';

/* eslint-disable @next/next/no-img-element */
import React, { useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface ReceiptPayment {
  id: number;
  amount: number | string;
  receipt_number?: string;
  payment_method: string;
  payment_date: string;
  cheque_number?: string;
  cheque_date?: string;
  reference_number?: string;
}

interface ReceiptInvoice {
  id: number;
  invoice_number: string;
  customer?: {
    name: string;
    address?: string;
    phone?: string;
  };
  balance_due: number;
  amount_paid?: number;
}

interface ReceiptPrintPreviewProps {
  payment: ReceiptPayment;
  invoice: ReceiptInvoice;
  cashierName: string;
}

// Convert number to words
function numberToWords(amount: number): string {
  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  const teens = [
    'ten',
    'eleven',
    'twelve',
    'thirteen',
    'fourteen',
    'fifteen',
    'sixteen',
    'seventeen',
    'eighteen',
    'nineteen',
  ];
  const tens = [
    '',
    '',
    'twenty',
    'thirty',
    'forty',
    'fifty',
    'sixty',
    'seventy',
    'eighty',
    'ninety',
  ];

  const convertBelowThousand = (num: number): string => {
    if (num === 0) return '';
    if (num < 10) return ones[num];
    if (num < 20) return teens[num - 10];
    if (num < 100) {
      return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + ones[num % 10] : '');
    }
    return (
      ones[Math.floor(num / 100)] +
      ' hundred' +
      (num % 100 !== 0 ? ' ' + convertBelowThousand(num % 100) : '')
    );
  };

  const convertToWords = (num: number): string => {
    if (num === 0) return 'zero';
    if (num >= 1000000) {
      const millions = Math.floor(num / 1000000);
      const remainder = num % 1000000;
      let result = convertBelowThousand(millions) + ' million';
      if (remainder > 0) result += ' ' + convertToWords(remainder);
      return result;
    }
    if (num >= 1000) {
      const thousands = Math.floor(num / 1000);
      const remainder = num % 1000;
      let result = convertBelowThousand(thousands) + ' thousand';
      if (remainder > 0) result += ', ' + convertBelowThousand(remainder);
      return result;
    }
    return convertBelowThousand(num);
  };

  const rupees = Math.floor(amount);
  const cents = Math.round((amount - rupees) * 100);
  let words = convertToWords(rupees);
  if (cents > 0) {
    words += ` and ${convertToWords(cents)} cents`;
  }
  return words.trim();
}

// Format payment method for display
function formatPaymentMethod(method: string): string {
  if (!method) return '';
  return method
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Safe number parsing helper
function safeParseFloat(value: string | number | undefined | null): number {
  if (value === undefined || value === null) return 0;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? 0 : num;
}

export default function ReceiptPrintPreview({
  payment,
  invoice,
  cashierName,
}: ReceiptPrintPreviewProps) {
  const parsedAmount = useMemo(() => safeParseFloat(payment.amount), [payment.amount]);
  const balanceDue = useMemo(() => safeParseFloat(invoice.balance_due), [invoice.balance_due]);
  const amountInWords = useMemo(() => numberToWords(parsedAmount), [parsedAmount]);
  const paymentDate = useMemo(() => {
    const date = new Date(payment.payment_date);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }, [payment.payment_date]);

  const qrUrl = `https://printcloud.cc/r/${payment.receipt_number || ''}`;
  const previousBalance = useMemo(() => parsedAmount + balanceDue, [parsedAmount, balanceDue]);

  return (
    <div className="w-full bg-white p-0">
      <div
        className="w-full p-6 pb-[30px] text-black"
        style={{ fontFamily: "'Source Sans 3', sans-serif" }}
      >
        <div className="flex items-start justify-between mb-3">
          <img src="/images/Logo.svg" alt="Kandy Offset" className="w-[280px] h-auto" />
          <div className="text-[19pt] font-extrabold text-right">PAYMENT RECEIPT</div>
        </div>

        <div className="grid grid-cols-[18%_54%_11%_17%] text-[11pt]">
          <div className="py-1 pr-2 font-light">Received From</div>
          <div className="row-span-3 py-1 pr-2 font-light leading-tight">
            <div className="font-semibold">{invoice.customer?.name || 'Valued Customer'}</div>
            {invoice.customer?.address && (
              <>
                {invoice.customer.address}
                <br />
              </>
            )}
            {invoice.customer?.phone && invoice.customer.phone}
          </div>
          <div className="py-1 pr-2 pl-[10px] font-light">Receipt No.</div>
          <div className="py-1 pl-[10px] font-semibold">
            {payment.receipt_number || 'Generating...'}
          </div>

          <div className="py-1 pr-2"></div>
          <div className="py-1 pr-2 pl-[10px] font-light">Date</div>
          <div className="py-1 pl-[10px] font-semibold">{paymentDate}</div>

          <div className="py-1 pr-2"></div>
          <div className="py-1 pr-2 pl-[10px] font-light">Cashier</div>
          <div className="py-1 pl-[10px] font-semibold">{cashierName}</div>
        </div>

        <div className="mt-2 text-[12pt] font-extrabold uppercase">PAYMENT</div>

        <div className="grid grid-cols-[18%_54%_11%_17%] text-[11pt]">
          <div className="py-1 pr-2 font-light">Amount</div>
          <div className="py-1 pr-2">
            <div className="text-[17pt] font-semibold">Rs. {parsedAmount.toFixed(2)}</div>
            <div className="text-[10pt] font-light">{amountInWords} only</div>
          </div>
          <div className="row-span-3 col-span-2 py-1 pl-[10px] flex justify-end">
            <QRCodeSVG value={qrUrl} size={60} level="L" />
          </div>

          <div className="py-1 pr-2 font-light">Method</div>
          <div className="py-1 font-semibold">{formatPaymentMethod(payment.payment_method)}</div>

          <div className="py-1 pr-2 font-light">
            {payment.payment_method === 'cheque'
              ? 'Cheque Details'
              : payment.payment_method === 'bank_transfer'
                ? 'Reference'
                : payment.payment_method === 'card'
                  ? 'Reference'
                  : 'Reference'}
          </div>
          <div className="py-1 font-semibold">
            {payment.payment_method === 'cheque' && payment.cheque_number ? (
              <>
                {payment.cheque_number} Dated:{' '}
                {payment.cheque_date
                  ? new Date(payment.cheque_date).toLocaleDateString('en-GB')
                  : 'N/A'}{' '}
                <span className="italic">[Subject to realization]</span>
              </>
            ) : payment.payment_method === 'bank_transfer' && payment.reference_number ? (
              payment.reference_number
            ) : payment.payment_method === 'card' && payment.reference_number ? (
              payment.reference_number
            ) : (
              '-'
            )}
          </div>
        </div>

        <div className="mt-2 text-[12pt] font-extrabold uppercase">ALLOCATION</div>
        <div className="grid grid-cols-[40%_20%_20%_20%] text-[12pt]">
          <div className="border border-black bg-gray-100 px-2 py-1 font-semibold">Document</div>
          <div className="border border-black bg-gray-100 px-2 py-1 text-right font-light">
            Prev Balance
          </div>
          <div className="border border-black bg-gray-100 px-2 py-1 text-right font-light">
            Paid
          </div>
          <div className="border border-black bg-gray-100 px-2 py-1 text-right font-light">
            Balance After
          </div>

          <div className="border border-black px-2 py-1 font-semibold">
            Invoice #{invoice.invoice_number}
          </div>
          <div className="border border-black px-2 py-1 text-right font-semibold">
            Rs. {previousBalance.toFixed(2)}
          </div>
          <div className="border border-black px-2 py-1 text-right font-semibold">
            Rs. {parsedAmount.toFixed(2)}
          </div>
          <div className="border border-black px-2 py-1 text-right font-semibold">
            Rs. {balanceDue.toFixed(2)}
          </div>
        </div>

        <div className="mt-2 flex items-end justify-between">
          <div className="text-[10pt] font-light">
            This is a computer-generated receipt and is valid without signature.
          </div>
          <div className="text-[12pt] font-semibold">Thank you for your payment!</div>
        </div>

        <div className="mt-2 text-center text-[13pt] font-semibold">
          Kandy Offset Printers (Pvt) Ltd
        </div>
        <div className="text-center text-[13pt] font-light">
          No. 947 Peradeniya Road Kandy&nbsp;&nbsp;&nbsp;&nbsp;P: 0814 946 426 / 0814 946
          646&nbsp;&nbsp;&nbsp;&nbsp;E: info@printsrilanka.com&nbsp;&nbsp;&nbsp;&nbsp;W:
          kandyoffset.com
        </div>
      </div>
    </div>
  );
}
