'use client';

import React from 'react';
import { Modal, Button } from 'flowbite-react';
import { HiX, HiMail, HiPrinter } from 'react-icons/hi';
import { FaWhatsapp } from 'react-icons/fa';
import ReceiptPrintPreview from './ReceiptPrintPreview';

interface Payment {
  id: number;
  amount: number | string;
  receipt_number?: string;
  payment_method: string;
  payment_date: string;
  cheque_number?: string;
  cheque_date?: string;
  reference_number?: string;
}

interface ReceiptOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: Payment | null;
  invoice: {
    id: number;
    invoice_number: string;
    customer_name?: string;
    customer_email?: string;
    customer_phone?: string;
    customer?: {
      name: string;
      address?: string;
      phone?: string;
    };
    customer_detail?: {
      name?: string;
      contact?: string;
      address?: string;
      addresses?: Array<{
        type?: string;
        line1?: string;
        line2?: string;
        city?: string;
        zip_code?: string;
        phone?: string;
      }>;
    };
    customer_address?: string;
    balance_due?: number;
    amount_paid?: number;
  };
  cashierName?: string;
  onEmailClick: () => void;
  onWhatsAppClick: () => void;
  onPrintClick: () => void;
}

export function ReceiptOptionsModal({
  isOpen,
  onClose,
  payment,
  invoice,
  cashierName = 'Staff',
  onEmailClick,
  onWhatsAppClick,
  onPrintClick,
}: ReceiptOptionsModalProps) {
  if (!payment) return null;

  const customerDetail = invoice.customer_detail;
  const addresses = customerDetail?.addresses || [];
  const primaryAddress = addresses.find((address) => address?.type === 'billing') || addresses[0];
  const addressParts = [
    primaryAddress?.line1,
    primaryAddress?.line2,
    primaryAddress?.city,
    primaryAddress?.zip_code,
  ].filter(Boolean);
  const customerAddress =
    addressParts.join(', ') ||
    invoice.customer?.address ||
    invoice.customer_address ||
    customerDetail?.address;
  const customerName =
    invoice.customer?.name || customerDetail?.name || invoice.customer_name || 'Valued Customer';
  const customerPhone =
    primaryAddress?.phone ||
    invoice.customer?.phone ||
    invoice.customer_phone ||
    customerDetail?.contact;

  return (
    <Modal show={isOpen} onClose={onClose} size="4xl">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Payment Recorded Successfully
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              <HiX className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white overflow-hidden mb-4">
            <div style={{ zoom: 0.6 }}>
              <ReceiptPrintPreview
                payment={{
                  id: payment.id,
                  amount: payment.amount,
                  receipt_number: payment.receipt_number,
                  payment_method: payment.payment_method,
                  payment_date: payment.payment_date,
                  cheque_number: payment.cheque_number,
                  cheque_date: payment.cheque_date,
                  reference_number: payment.reference_number,
                }}
                invoice={{
                  id: invoice.id,
                  invoice_number: invoice.invoice_number,
                  customer: {
                    name: customerName,
                    address: customerAddress,
                    phone: customerPhone,
                  },
                  balance_due: invoice.balance_due || 0,
                  amount_paid: invoice.amount_paid || 0,
                }}
                cashierName={cashierName}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Button onClick={onEmailClick} className="flex-1" color="blue">
              <HiMail className="mr-2 h-5 w-5" />
              Email Receipt
            </Button>
            <Button
              onClick={onWhatsAppClick}
              className="flex-1 bg-green-600 hover:bg-green-700 focus:ring-4 focus:ring-green-300 dark:bg-green-600 dark:hover:bg-green-700"
            >
              <FaWhatsapp className="mr-2 h-5 w-5" />
              WhatsApp
            </Button>
            <Button onClick={onPrintClick} className="flex-1" color="gray">
              <HiPrinter className="mr-2 h-5 w-5" />
              Print
            </Button>
          </div>

          {/* Skip Option */}
          <div className="mt-6 text-center">
            <button
              onClick={onClose}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
