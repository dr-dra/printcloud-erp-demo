'use client';

import { useState, type FormEvent } from 'react';
import { Modal, Button, Label, TextInput } from 'flowbite-react';
import { toast } from 'sonner';

interface OrderItem {
  product_id: number;
  name: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  taxRate: number;
  discount_amount?: number;
}

interface POSAddCustomItemModalProps {
  show: boolean;
  onClose: () => void;
  onSuccess: (item: OrderItem) => void;
  miscProductId: number;
}

export default function POSAddCustomItemModal({
  show,
  onClose,
  onSuccess,
  miscProductId,
}: POSAddCustomItemModalProps) {
  const [itemName, setItemName] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    // Validation
    if (!itemName.trim()) {
      toast.error('Item name is required');
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error('Price must be 0 or greater');
      return;
    }

    const quantityNum = parseInt(quantity);
    if (isNaN(quantityNum) || quantityNum < 1) {
      toast.error('Quantity must be at least 1');
      return;
    }

    // Create OrderItem
    const item: OrderItem = {
      product_id: miscProductId,
      name: itemName.trim(),
      sku: 'MISC-CUSTOM',
      unitPrice: priceNum,
      quantity: quantityNum,
      taxRate: 0,
    };

    onSuccess(item);
    handleClose();
  };

  const handleClose = () => {
    // Reset form
    setItemName('');
    setPrice('');
    setQuantity('1');
    onClose();
  };

  return (
    <Modal show={show} size="md" onClose={handleClose} popup>
      <Modal.Header />
      <Modal.Body>
        <div className="space-y-6">
          <h3 className="text-xl font-medium text-gray-900 dark:text-white">Add Custom Item</h3>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Item Name */}
            <div>
              <div className="mb-2 block">
                <Label htmlFor="custom-item-name" value="Item Name *" />
              </div>
              <TextInput
                id="custom-item-name"
                placeholder="Enter item name"
                value={itemName}
                onChange={(event) => setItemName(event.target.value)}
                required
                autoFocus
              />
            </div>

            {/* Price */}
            <div>
              <div className="mb-2 block">
                <Label htmlFor="custom-item-price" value="Price (Rs., VAT inclusive) *" />
              </div>
              <TextInput
                id="custom-item-price"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                required
              />
            </div>

            {/* Quantity */}
            <div>
              <div className="mb-2 block">
                <Label htmlFor="custom-item-quantity" value="Quantity *" />
              </div>
              <TextInput
                id="custom-item-quantity"
                type="number"
                step="1"
                min="1"
                placeholder="1"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                required
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-2 justify-end">
              <Button color="gray" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit">Add Item</Button>
            </div>
          </form>
        </div>
      </Modal.Body>
    </Modal>
  );
}
