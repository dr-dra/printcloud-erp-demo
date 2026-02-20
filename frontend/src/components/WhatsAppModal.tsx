'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect } from 'react';
import { Modal, Button } from 'flowbite-react';
import { StandardTextInput, StandardTextarea } from '@/components/common/inputs';
import { HiX } from 'react-icons/hi';
import { BsSend } from 'react-icons/bs';
import { FaWhatsapp } from 'react-icons/fa';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/utils/errorHandling';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId?: string;
  documentType?: 'quotation' | 'invoice' | 'order' | 'purchase_order' | 'receipt' | 'order_receipt'; // Default: 'quotation'
  document?: {
    id: number;
    quot_number?: string; // For quotations
    invoice_number?: string; // For invoices
    order_number?: string; // For orders
    po_number?: string; // For purchase orders
    receipt_number?: string; // For receipts
    costing_name?: string;
    customer?: {
      name: string;
      phone?: string;
    };
    items?: Array<{
      item?: string;
      description?: string;
      costing_sheet_name?: string;
    }>;
  };
  onSendComplete?: (result: {
    success: boolean;
    method: 'whatsapp';
    destination: string;
    error?: string;
  }) => void;
  // For backwards compatibility, support old prop names
  quotationId?: string;
  quotation?: any;
}

// For backwards compatibility, support old prop names
export const WhatsAppModal: React.FC<WhatsAppModalProps> = (props) => {
  const actualProps: WhatsAppModalInnerProps = {
    isOpen: props.isOpen,
    onClose: props.onClose,
    documentId: props.documentId || props.quotationId || '',
    documentType: (props.documentType || 'quotation') as
      | 'quotation'
      | 'invoice'
      | 'order'
      | 'purchase_order'
      | 'receipt'
      | 'order_receipt',
    document: props.document || props.quotation || { id: 0 },
    onSendComplete: props.onSendComplete,
  };
  return <WhatsAppModalInner {...actualProps} />;
};

interface WhatsAppModalInnerProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentType: 'quotation' | 'invoice' | 'order' | 'purchase_order' | 'receipt' | 'order_receipt';
  document: {
    id: number;
    quot_number?: string;
    invoice_number?: string;
    order_number?: string;
    po_number?: string;
    receipt_number?: string;
    costing_name?: string;
    customer?: {
      name: string;
      phone?: string;
    };
    items?: Array<{
      item?: string;
      description?: string;
      costing_sheet_name?: string;
    }>;
  };
  onSendComplete?: (result: {
    success: boolean;
    method: 'whatsapp';
    destination: string;
    error?: string;
  }) => void;
}

const WhatsAppModalInner: React.FC<WhatsAppModalInnerProps> = ({
  isOpen,
  onClose,
  documentId,
  documentType,
  document,
  onSendComplete,
}) => {
  const { user } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);

  // Phone number validation regex (international format)
  const phoneRegex = /^\+[1-9]\d{1,14}$/;

  // Get document identifiers
  const documentNumber =
    documentType === 'invoice'
      ? document.invoice_number
      : documentType === 'order'
        ? document.order_number
        : documentType === 'purchase_order'
          ? document.po_number
          : documentType === 'receipt' || documentType === 'order_receipt'
            ? document.receipt_number
            : document.quot_number;
  const documentLabel =
    documentType === 'invoice'
      ? 'Invoice'
      : documentType === 'order'
        ? 'Order'
        : documentType === 'purchase_order'
          ? 'Purchase Order'
          : documentType === 'receipt' || documentType === 'order_receipt'
            ? 'Receipt'
            : 'Quotation';

  // Generate secure share link (only for quotations)
  const generateShareLink = async () => {
    if (documentType !== 'quotation') return null; // No share link for invoices or orders
    if (shareLink) return shareLink; // Return existing link if already generated

    setGeneratingLink(true);
    try {
      const response = await api.post(`/sales/quotations/${documentId}/generate-share-link/`);
      const link = response.data.share_url; // Use the URL returned by backend (environment-aware)
      setShareLink(link);
      return link;
    } catch (error) {
      console.error('Error generating share link:', error);
      toast.error('Failed to generate share link');
      return null;
    } finally {
      setGeneratingLink(false);
    }
  };

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen) {
      // Reset form
      setPhoneNumber('');
      setIsSending(false);
      setShareLink(null);
      setGeneratingLink(false);

      // Generate share link and set default message
      const initializeMessage = async () => {
        const link = await generateShareLink();

        const customerName = document.customer?.name || 'Customer';
        const userName = user?.display_name || user?.username || 'PrintCloud Team';

        if (documentType === 'invoice') {
          // For invoices, use simpler message
          const defaultMessage = `Dear ${customerName},\n\nPlease find attached the invoice for Invoice #${document.invoice_number}.\n\nThank you for your business.\n\nBest regards,\n${userName}`;
          setMessage(defaultMessage);
        } else if (documentType === 'order') {
          const defaultMessage = `Dear ${customerName},\n\nPlease find attached the order confirmation for Order #${document.order_number}.\n\nThank you for your business.\n\nBest regards,\n${userName}`;
          setMessage(defaultMessage);
        } else if (documentType === 'purchase_order') {
          const defaultMessage = `Dear ${customerName || 'Supplier'},\n\nPlease find attached Purchase Order #${document.po_number}.\n\nBest regards,\n${userName}`;
          setMessage(defaultMessage);
        } else if (documentType === 'receipt' || documentType === 'order_receipt') {
          const orderSuffix =
            documentType === 'order_receipt' && document.order_number
              ? ` for Order #${document.order_number}`
              : '';
          // For receipts, include link to view/download
          const defaultMessage = `Dear ${customerName},\n\nThank you for your payment${orderSuffix}.\n\nView your receipt #${document.receipt_number} online:\n${link || '[Link will be generated]'}\n\nBest regards,\n${userName}`;
          setMessage(defaultMessage);
        } else {
          // For quotations, show the actual template body (read-only)
          const defaultMessage = `Hello ${customerName},\n\nPlease find your requested quotation below:\n\n${link || '[Generated Link]'}\n\nIf you have any questions, feel free to reach out.\n\nBest regards,\n${userName}\nKandy Offset Printers Ltd`;
          setMessage(defaultMessage);
        }
      };

      initializeMessage();

      // Set default phone number if customer has one
      if (document.customer?.phone) {
        // Ensure phone starts with + (add +94 for Sri Lanka if no country code)
        let phone = document.customer.phone.trim();
        if (!phone.startsWith('+')) {
          phone = '+94' + phone.replace(/^0/, ''); // Remove leading 0 and add +94
        }
        setPhoneNumber(phone);
      } else {
        setPhoneNumber('+94'); // Default Sri Lankan country code
      }
    }
  }, [isOpen, document, documentType, user]);

  // Validate phone number
  const isValidPhoneNumber = (phone: string) => {
    return phoneRegex.test(phone.trim());
  };

  // Handle message change
  // Validate form
  const isFormValid = () => {
    if (!phoneNumber.trim()) {
      toast.error('Phone number is required');
      return false;
    }

    if (!isValidPhoneNumber(phoneNumber)) {
      toast.error('Please enter a valid phone number with country code (e.g., +94771234567)');
      return false;
    }

    // No need to validate message since we're using templates

    return true;
  };

  // Handle send WhatsApp message
  const handleSendWhatsApp = async () => {
    if (!isFormValid()) return;

    try {
      setIsSending(true);

      const whatsappData = {
        phone_number: phoneNumber.trim(),
        message: message.trim(),
      };

      // Dynamic endpoint based on document type
      const endpoint =
        documentType === 'invoice'
          ? `/sales/invoices/${documentId}/whatsapp/`
          : documentType === 'order'
            ? `/sales/orders/${documentId}/whatsapp/`
            : documentType === 'purchase_order'
              ? `/purchases/orders/${documentId}/whatsapp/`
              : documentType === 'receipt'
                ? `/sales/invoices/payments/${documentId}/receipt/whatsapp/`
                : documentType === 'order_receipt'
                  ? `/sales/orders/payments/${documentId}/receipt/whatsapp/`
                  : `/sales/quotations/${documentId}/whatsapp/`;

      await api.post(endpoint, whatsappData);

      const docLabel = documentLabel;
      toast.success('WhatsApp message sent successfully', {
        description: `${docLabel} #${documentNumber} has been sent to ${phoneNumber}`,
        duration: 5000,
      });

      // Notify parent of successful send
      onSendComplete?.({
        success: true,
        method: 'whatsapp',
        destination: phoneNumber.trim(),
      });

      onClose();
    } catch (err) {
      console.error('Error sending WhatsApp message:', err);
      const errorMessage = getErrorMessage(err as any);
      toast.error('Failed to send WhatsApp message', {
        description: errorMessage,
        duration: 5000,
      });

      // Notify parent of failed send
      onSendComplete?.({
        success: false,
        method: 'whatsapp',
        destination: phoneNumber.trim(),
        error: errorMessage,
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Modal show={isOpen} onClose={onClose} size="2xl" className="whatsapp-modal">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FaWhatsapp className="w-5 h-5 text-green-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Send via WhatsApp - {documentLabel} #{documentNumber}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <HiX className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4">
          <div className="space-y-4">
            {/* WhatsApp Number Field */}
            <div>
              <label
                htmlFor="whatsappNumber"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                WhatsApp Number <span className="text-red-500">*</span>
              </label>
              <StandardTextInput
                id="whatsappNumber"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+94771234567"
                className="w-full"
                helperText="Include country code (e.g., +94 for Sri Lanka)"
              />
            </div>

            {/* Message Field */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label
                  htmlFor="message"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Template Preview (Read-only)
                </label>
              </div>

              <StandardTextarea
                id="message"
                rows={8}
                value={message}
                readOnly={true}
                className="w-full resize-none bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                placeholder="Template information will appear here..."
              />
            </div>

            {/* Template Message Info */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
                <FaWhatsapp className="w-4 h-4" />
                <span>
                  {documentType === 'quotation'
                    ? generatingLink
                      ? 'Preparing professional WhatsApp template message...'
                      : 'Ready to send professional template message with secure quotation link'
                    : 'Ready to send WhatsApp message'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800">
          <div className="flex justify-end gap-2">
            <Button
              color="gray"
              onClick={onClose}
              disabled={isSending}
              className="px-4 py-2 text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendWhatsApp}
              disabled={isSending}
              className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 focus:ring-4 focus:ring-green-300 dark:bg-green-600 dark:hover:bg-green-700 dark:focus:ring-green-800 text-white"
            >
              {isSending ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                  Sending...
                </>
              ) : (
                <>
                  <BsSend className="mr-2 h-3 w-3" />
                  Send via WhatsApp
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
