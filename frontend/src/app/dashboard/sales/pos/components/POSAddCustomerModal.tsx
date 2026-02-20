'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, type FormEvent } from 'react';
import { Modal, Button, Label, TextInput } from 'flowbite-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { getErrorMessage } from '@/utils/errorHandling';

interface POSAddCustomerModalProps {
  show: boolean;
  onClose: () => void;
  onSuccess: (customer: any) => void;
}

export default function POSAddCustomerModal({
  show,
  onClose,
  onSuccess,
}: POSAddCustomerModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Customer name is required');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        name: name.trim(),
        contact: phone.trim() || null,
        email: email.trim() || null,
        pos_customer: true,
        customer_type: 'individual', // Default for POS
        is_active: true,
      };

      const response = await api.post('/customers/create/', payload);
      toast.success('Customer added successfully');
      onSuccess(response.data);
      handleClose();
    } catch (error) {
      console.error('Failed to create customer:', error);
      toast.error(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setName('');
    setPhone('');
    setEmail('');
    setIsSubmitting(false);
    onClose();
  };

  return (
    <Modal show={show} size="sm" onClose={handleClose} popup>
      <Modal.Header />
      <Modal.Body>
        <div className="space-y-6">
          <h3 className="text-xl font-medium text-gray-900 dark:text-white">Add New Customer</h3>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <div className="mb-2 block">
                <Label htmlFor="pos-customer-name" value="Name *" />
              </div>
              <TextInput
                id="pos-customer-name"
                placeholder="Customer Name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                autoFocus
              />
            </div>
            <div>
              <div className="mb-2 block">
                <Label htmlFor="pos-customer-phone" value="Phone (Optional)" />
              </div>
              <TextInput
                id="pos-customer-phone"
                placeholder="Phone Number"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>
            <div>
              <div className="mb-2 block">
                <Label htmlFor="pos-customer-email" value="Email (Optional)" />
              </div>
              <TextInput
                id="pos-customer-email"
                placeholder="name@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
              />
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <Button color="gray" onClick={handleClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" isProcessing={isSubmitting}>
                Save Customer
              </Button>
            </div>
          </form>
        </div>
      </Modal.Body>
    </Modal>
  );
}
