import React, { useState } from 'react';
import { Modal, Label, Textarea, Button } from 'flowbite-react';
import { StandardTextInput } from '@/components/common/inputs';
import { ordersAPI } from '@/lib/api';
import { getErrorMessage } from '@/utils/errorHandling';
import { toast } from 'sonner';
import type { SalesOrder } from '@/types/orders';

interface OrderEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: SalesOrder;
  onSendComplete?: () => void;
}

export function OrderEmailModal({ isOpen, onClose, order, onSendComplete }: OrderEmailModalProps) {
  const [toEmails, setToEmails] = useState(order.customer?.email || '');
  const [ccEmails, setCcEmails] = useState('');
  const [subject, setSubject] = useState(`Order Confirmation - ${order.order_number}`);
  const [message, setMessage] = useState(
    `Dear ${order.customer?.name || 'Customer'},\n\nPlease find attached the order confirmation for Order #${order.order_number}.\n\nThank you for your business.\n\nBest regards`,
  );
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!toEmails.trim()) {
      toast.error('Please enter at least one recipient email');
      return;
    }

    try {
      setSending(true);

      const emailData = {
        to: toEmails.split(',').map((email) => email.trim()),
        cc: ccEmails ? ccEmails.split(',').map((email) => email.trim()) : [],
        subject,
        message,
      };

      await ordersAPI.sendOrderEmail(order.id, emailData);

      toast.success('Email queued successfully');
      onSendComplete?.();
      onClose();
    } catch (err) {
      console.error('[OrderEmailModal] Error sending email:', err);
      toast.error(`Failed to send email: ${getErrorMessage(err)}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal show={isOpen} onClose={onClose} size="xl">
      <Modal.Header>Email Order Confirmation</Modal.Header>
      <Modal.Body>
        <div className="space-y-4">
          <div>
            <Label htmlFor="to-emails" value="To (comma-separated)" />
            <StandardTextInput
              id="to-emails"
              value={toEmails}
              onChange={(e) => setToEmails(e.target.value)}
              placeholder="customer@example.com, contact@example.com"
            />
          </div>

          <div>
            <Label htmlFor="cc-emails" value="CC (comma-separated, optional)" />
            <StandardTextInput
              id="cc-emails"
              value={ccEmails}
              onChange={(e) => setCcEmails(e.target.value)}
              placeholder="manager@example.com"
            />
          </div>

          <div>
            <Label htmlFor="subject" value="Subject" />
            <StandardTextInput
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="message" value="Message" />
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
            />
          </div>

          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p>📎 Order PDF will be automatically attached</p>
            <p>🔗 A secure share link will be included in the email</p>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={handleSend} disabled={sending}>
          {sending ? 'Sending...' : 'Send Email'}
        </Button>
        <Button color="gray" onClick={onClose} disabled={sending}>
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
