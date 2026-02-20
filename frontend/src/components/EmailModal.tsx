'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Checkbox } from 'flowbite-react';
import { StandardTextInput } from '@/components/common/inputs';
import { HiX, HiPaperClip, HiUser } from 'react-icons/hi';
import { BsSend } from 'react-icons/bs';
import { Bold, Italic, Underline, List, ListOrdered } from 'lucide-react';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/utils/errorHandling';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import EmailTypeahead from './EmailTypeahead';

interface EmailModalProps {
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
      id?: number;
      name: string;
      email?: string;
    };
    items?: Array<{
      item?: string;
      description?: string;
      costing_sheet_name?: string;
    }>;
  };
  // Backwards compatibility props
  quotationId?: string;
  quotation?: any;
  onSendComplete?: (result: {
    success: boolean;
    method: 'email';
    destination: string;
    error?: string;
  }) => void;
}

// For backwards compatibility, support old prop names
export const EmailModal: React.FC<EmailModalProps> = (props) => {
  const actualProps: EmailModalInnerProps = {
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
  return <EmailModalInner {...actualProps} />;
};

interface EmailModalInnerProps {
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
      id?: number;
      name: string;
      email?: string;
    };
    items?: Array<{
      item?: string;
      description?: string;
      costing_sheet_name?: string;
    }>;
  };
  onSendComplete?: (result: {
    success: boolean;
    method: 'email';
    destination: string;
    error?: string;
  }) => void;
}

interface EmailChip {
  id: string;
  email: string;
  isValid: boolean;
}

const EmailModalInner: React.FC<EmailModalInnerProps> = ({
  isOpen,
  onClose,
  documentId,
  documentType,
  document,
  onSendComplete,
}) => {
  const { user } = useAuth();
  const [toEmails, setToEmails] = useState<EmailChip[]>([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sendCopyToMe, setSendCopyToMe] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [messageCharCount, setMessageCharCount] = useState(0);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [_generatingLink, setGeneratingLink] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  // Get document identifiers based on type
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

  // Email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Generate project name for subject line
  const getProjectName = () => {
    // First priority: costing_name from document
    if (document.costing_name) {
      return document.costing_name;
    }

    // Second priority: costing_sheet_name from items
    if (document.items?.length) {
      const itemWithCosting = document.items.find((item) => item.costing_sheet_name);
      if (itemWithCosting?.costing_sheet_name) {
        return itemWithCosting.costing_sheet_name;
      }
    }

    // Third priority: concatenate item names
    if (document.items?.length) {
      const itemNames = document.items
        .filter((item) => item.item || item.description)
        .map((item) => item.item || item.description)
        .filter(Boolean)
        .slice(0, 2); // Take first 2 items to avoid too long subject

      if (itemNames.length > 0) {
        return itemNames.join(' & ');
      }
    }

    // Fallback
    return 'Your Project';
  };

  // Generate secure share link (quotations only)
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
      setToEmails([]);
      setSendCopyToMe(false);
      setIsSending(false);
      setShareLink(null);
      setGeneratingLink(false);

      // Set default subject with project name
      const projectName = getProjectName();
      const isInvoice = documentType === 'invoice';
      const isOrder = documentType === 'order';
      const isPurchaseOrder = documentType === 'purchase_order';
      const isReceipt = documentType === 'receipt' || documentType === 'order_receipt';
      const isOrderReceipt = documentType === 'order_receipt';
      setSubject(
        isInvoice
          ? `Invoice #${document.invoice_number} - Payment Due`
          : isOrder
            ? `Order #${document.order_number} Confirmation`
            : isPurchaseOrder
              ? `Purchase Order #${document.po_number}`
              : isReceipt
                ? isOrderReceipt
                  ? `Payment Receipt #${document.receipt_number} - Order #${document.order_number}`
                  : `Payment Receipt #${document.receipt_number}`
                : `Quotation #${document.quot_number} for ${projectName}`,
      );

      // Generate share link and set default message
      const initializeMessage = async () => {
        await generateShareLink(); // Generate link for template use (quotations only)

        const defaultMessage = isInvoice
          ? `Dear <strong>${document.customer?.name || 'Customer'}</strong>,<br><br>Please find attached the invoice for Invoice #${document.invoice_number}.<br><br>Thank you for your business.<br><br>Best regards,<br>${user?.display_name || user?.username || 'PrintCloud Team'}`
          : isOrder
            ? `Dear <strong>${document.customer?.name || 'Customer'}</strong>,<br><br>Please find attached the order confirmation for Order #${document.order_number}.<br><br>Thank you for your business.<br><br>Best regards,<br>${user?.display_name || user?.username || 'PrintCloud Team'}`
            : isPurchaseOrder
              ? `Dear <strong>${document.customer?.name || 'Supplier'}</strong>,<br><br>Please find attached Purchase Order #${document.po_number}.<br><br>Best regards,<br>${user?.display_name || user?.username || 'PrintCloud Team'}`
              : isReceipt
                ? isOrderReceipt
                  ? `Dear <strong>${document.customer?.name || 'Customer'}</strong>,<br><br>Please find attached your payment receipt #${document.receipt_number} for Order #${document.order_number}.<br><br>Thank you for your payment.<br><br>Best regards,<br>${user?.display_name || user?.username || 'PrintCloud Team'}`
                  : `Dear <strong>${document.customer?.name || 'Customer'}</strong>,<br><br>Please find attached your payment receipt #${document.receipt_number}.<br><br>Thank you for your payment.<br><br>Best regards,<br>${user?.display_name || user?.username || 'PrintCloud Team'}`
                : `Dear <strong>${document.customer?.name || 'Customer'}</strong>,<br><br>Please find attached the quotation for your requirements.<br><br>If you have any questions or need any modifications, please don't hesitate to contact us.<br><br>Thank you for your business.<br><br>Best regards,<br>${user?.display_name || user?.username || 'PrintCloud Team'}`;

        setMessage(defaultMessage);
        setMessageCharCount(defaultMessage.replace(/<[^>]*>/g, '').length);

        // Initialize editor content
        setTimeout(() => {
          if (editorRef.current) {
            editorRef.current.innerHTML = defaultMessage;
          }
        }, 100);
      };

      initializeMessage();

      // Add customer email if available
      if (document.customer?.email) {
        const customerEmail: EmailChip = {
          id: Date.now().toString(),
          email: document.customer.email,
          isValid: emailRegex.test(document.customer.email),
        };
        setToEmails([customerEmail]);
      }
    }
  }, [isOpen, document, documentType, user]);

  // Handle email changes from EmailTypeahead
  const handleEmailsChange = (emails: EmailChip[]) => {
    setToEmails(emails);
  };

  // Validate form
  const isFormValid = () => {
    if (toEmails.length === 0) {
      toast.error('At least one recipient is required');
      return false;
    }

    const allEmails = [...toEmails];
    const invalidEmails = allEmails.filter((chip) => !chip.isValid);

    if (invalidEmails.length > 0) {
      toast.error(`Invalid email addresses: ${invalidEmails.map((e) => e.email).join(', ')}`);
      return false;
    }

    if (!subject.trim()) {
      toast.error('Subject is required');
      return false;
    }

    return true;
  };

  // Handle send email
  const handleSendEmail = async () => {
    if (!isFormValid()) return;

    try {
      setIsSending(true);

      const isOrder = documentType === 'order';
      const recipients = toEmails.map((chip) => chip.email);

      const emailData = isOrder
        ? {
            to: recipients,
            cc: [],
            subject: subject.trim(),
            message: message.trim(),
          }
        : {
            to_emails: recipients,
            cc_emails: [],
            bcc_emails: [],
            subject: subject.trim(),
            message: message.replace(/<[^>]*>/g, '').trim(), // Strip HTML tags for backend
            message_html: message, // Keep HTML version
            send_copy_to_sender: sendCopyToMe,
          };

      // Dynamic endpoint based on document type
      const endpoint =
        documentType === 'invoice'
          ? `/sales/invoices/${documentId}/email/`
          : documentType === 'order'
            ? `/sales/orders/${documentId}/email/`
            : documentType === 'purchase_order'
              ? `/purchases/orders/${documentId}/email/`
              : documentType === 'receipt'
                ? `/sales/invoices/payments/${documentId}/receipt/email/`
                : documentType === 'order_receipt'
                  ? `/sales/orders/payments/${documentId}/receipt/email/`
                  : `/sales/quotations/${documentId}/email/`;

      // Send the email
      await api.post(endpoint, emailData);

      // Save new customer emails for future use (quotations only)
      if (documentType === 'quotation' && document.customer?.id && toEmails.length > 0) {
        try {
          await api.post(`/customers/${document.customer.id}/emails/save/`, {
            emails: toEmails.map((chip) => chip.email),
          });
        } catch (saveError) {
          console.warn('Failed to save customer emails for future use:', saveError);
          // Don't show error to user as email was sent successfully
        }
      }

      const docLabel = documentLabel;
      const docNumber = documentNumber;
      toast.success('Email sent successfully', {
        description: `${docLabel} #${docNumber} has been sent to ${toEmails.length} recipient(s)`,
        duration: 5000,
      });

      // Notify parent of successful send
      onSendComplete?.({
        success: true,
        method: 'email',
        destination: toEmails.map((chip) => chip.email).join(', '),
      });

      onClose();
    } catch (err) {
      console.error('Error sending email:', err);
      const errorMessage = getErrorMessage(err as any);
      toast.error('Failed to send email', {
        description: errorMessage,
        duration: 5000,
      });

      // Notify parent of failed send
      onSendComplete?.({
        success: false,
        method: 'email',
        destination: toEmails.map((chip) => chip.email).join(', '),
        error: errorMessage,
      });
    } finally {
      setIsSending(false);
    }
  };

  // Rich text editor functions
  const applyFormat = (command: string, value?: string) => {
    window.document.execCommand(command, false, value);
    if (editorRef.current) {
      const content = editorRef.current.innerHTML;
      setMessage(content);
      const textContent = content
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .trim();
      setMessageCharCount(textContent.length);
    }
  };

  const handleEditorInput = () => {
    if (editorRef.current) {
      const content = editorRef.current.innerHTML;
      setMessage(content);
      const textContent = content
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .trim();
      setMessageCharCount(textContent.length);
    }
  };

  return (
    <Modal show={isOpen} onClose={onClose} size="4xl" className="email-modal">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Email {documentLabel} #{documentNumber}
            </h3>
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
          <div className="space-y-3">
            {/* From Field - Compact */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500 dark:text-gray-400 w-12">From:</span>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                  <HiUser className="w-3 h-3 text-white" />
                </div>
                <span className="font-medium text-gray-900 dark:text-white">
                  {user?.display_name || user?.username || 'User'}
                </span>
                <span className="text-blue-600 dark:text-blue-400">{user?.email}</span>
              </div>
            </div>

            {/* To Field - Compact */}
            <div className="flex items-start gap-2">
              <span className="text-gray-500 dark:text-gray-400 w-12 text-sm pt-2">To:</span>
              <div className="flex-1">
                <EmailTypeahead
                  customerId={document.customer?.id || null}
                  selectedEmails={toEmails}
                  onEmailsChange={handleEmailsChange}
                  placeholder="Add recipients..."
                />
              </div>
            </div>

            {/* Subject Field - Compact */}
            <div className="border-t border-gray-200 dark:border-gray-600 pt-3">
              <StandardTextInput
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                className="border-none focus:ring-0 bg-transparent font-medium text-gray-900 dark:text-white placeholder-gray-500 text-sm"
                style={{ boxShadow: 'none', padding: '12px' }}
              />
            </div>

            {/* Message Field with Custom Rich Text Editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-end">
                <div className="text-xs text-gray-500 dark:text-gray-400">{messageCharCount}</div>
              </div>

              <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                {/* Toolbar */}
                <div className="flex items-center gap-1 p-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <button
                    type="button"
                    onClick={() => applyFormat('bold')}
                    className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300"
                  >
                    <Bold className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => applyFormat('italic')}
                    className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300"
                  >
                    <Italic className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => applyFormat('underline')}
                    className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300"
                  >
                    <Underline className="w-4 h-4" />
                  </button>
                  <div className="w-px h-4 bg-gray-300 dark:bg-gray-500 mx-1" />
                  <button
                    type="button"
                    onClick={() => applyFormat('insertUnorderedList')}
                    className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300"
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => applyFormat('insertOrderedList')}
                    className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300"
                  >
                    <ListOrdered className="w-4 h-4" />
                  </button>
                </div>

                {/* Editor */}
                <div
                  ref={editorRef}
                  contentEditable
                  onInput={handleEditorInput}
                  className="p-3 min-h-[120px] text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 outline-none"
                  style={{ lineHeight: '1.4' }}
                  suppressContentEditableWarning
                />
              </div>
            </div>

            {/* Attachment Info - Compact */}
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-md">
              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <HiPaperClip className="w-4 h-4" />
                <span>
                  {documentLabel}-{documentNumber}.pdf will be attached
                </span>
              </div>
            </div>

            {/* Send Copy to Me Checkbox */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="sendCopyToMe"
                checked={sendCopyToMe}
                onChange={(e) => setSendCopyToMe(e.target.checked)}
                className="text-blue-600 focus:ring-blue-500"
              />
              <label
                htmlFor="sendCopyToMe"
                className="text-xs text-gray-700 dark:text-gray-300 cursor-pointer"
              >
                Send a copy to me
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800">
          <div className="flex justify-end gap-2">
            <Button color="gray" onClick={onClose} disabled={isSending} size="md">
              Cancel
            </Button>
            <Button onClick={handleSendEmail} disabled={isSending} size="md">
              {isSending ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                  Sending...
                </>
              ) : (
                <>
                  <BsSend className="mr-2 h-3 w-3" />
                  Send
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
