import React, { useState } from 'react';
import { Modal, Label, Textarea, Button } from 'flowbite-react';
import { StandardTextInput } from '@/components/common/inputs';
import { ordersAPI } from '@/lib/api';
import { getErrorMessage } from '@/utils/errorHandling';
import { toast } from 'sonner';
import type { SalesOrder } from '@/types/orders';

interface OrderWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: SalesOrder;
  onSendComplete?: () => void;
}

export function OrderWhatsAppModal({
  isOpen,
  onClose,
  order,
  onSendComplete,
}: OrderWhatsAppModalProps) {
  const [phoneNumber, setPhoneNumber] = useState(order.customer?.contact || '');
  const [message, setMessage] = useState(
    `Order Confirmation - ${order.order_number}\n\nDear ${order.customer?.name || 'Customer'},\n\nYour order has been confirmed. You can view the details using the link below.\n\nThank you for your business.`,
  );
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!phoneNumber.trim()) {
      toast.error('Please enter a phone number');
      return;
    }

    try {
      setSending(true);

      const whatsappData = {
        phone_number: phoneNumber,
        message,
      };

      await ordersAPI.sendOrderWhatsApp(order.id, whatsappData);

      toast.success('WhatsApp message queued successfully');
      onSendComplete?.();
      onClose();
    } catch (err) {
      console.error('[OrderWhatsAppModal] Error sending WhatsApp:', err);
      toast.error(`Failed to send WhatsApp message: ${getErrorMessage(err)}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal show={isOpen} onClose={onClose} size="xl">
      <Modal.Header>Send Order via WhatsApp</Modal.Header>
      <Modal.Body>
        <div className="space-y-4">
          <div>
            <Label htmlFor="phone-number" value="Phone Number" />
            <StandardTextInput
              id="phone-number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+94771234567"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Include country code (e.g., +94 for Sri Lanka)
            </p>
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
            <p>🔗 A secure share link will be automatically included</p>
            <p>📱 Message will be sent via WhatsApp Business API</p>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={handleSend} disabled={sending}>
          {sending ? 'Sending...' : 'Send WhatsApp'}
        </Button>
        <Button color="gray" onClick={onClose} disabled={sending}>
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
