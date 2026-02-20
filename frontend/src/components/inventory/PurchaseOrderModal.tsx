'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from 'react';
import { Modal, Button, Label, Alert } from 'flowbite-react';
import { StandardTextInput, StandardTextarea, StandardSelect } from '@/components/common/inputs';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/utils/errorHandling';
import type { Supplier } from '@/types/suppliers';
import type { InvItem, InvItemListResponse } from '@/types/inventory';

interface PurchaseOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface PurchaseOrderLine {
  id: string;
  itemId: string;
  itemName: string;
  description: string;
  quantity: string;
  unitPrice: string;
  unitOfMeasure: string;
  taxRate: string;
}

const createEmptyLine = (): PurchaseOrderLine => ({
  id: crypto.randomUUID(),
  itemId: '',
  itemName: '',
  description: '',
  quantity: '1',
  unitPrice: '0',
  unitOfMeasure: '',
  taxRate: '0',
});

export default function PurchaseOrderModal({
  isOpen,
  onClose,
  onSuccess,
}: PurchaseOrderModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<InvItem[]>([]);

  const [supplierId, setSupplierId] = useState('');
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<PurchaseOrderLine[]>([createEmptyLine()]);

  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const [suppliersResponse, itemsResponse] = await Promise.all([
          api.get('/suppliers/?page_size=200'),
          api.get('/inventory/items/?page_size=500'),
        ]);
        setSuppliers(suppliersResponse.data.results || []);
        const itemsData: InvItemListResponse = itemsResponse.data;
        setItems(itemsData.results || []);
      } catch (err) {
        console.error('Failed to load purchase order lookups:', err);
      }
    };

    if (isOpen) {
      fetchLookups();
      setError(null);
    }
  }, [isOpen]);

  const addLine = () => {
    setLines((prev) => [...prev, createEmptyLine()]);
  };

  const removeLine = (lineId: string) => {
    setLines((prev) => (prev.length > 1 ? prev.filter((line) => line.id !== lineId) : prev));
  };

  const updateLine = (lineId: string, field: keyof PurchaseOrderLine, value: string) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== lineId) return line;
        const updated: PurchaseOrderLine = { ...line, [field]: value };
        if (field === 'itemId') {
          const selected = items.find((entry) => String(entry.id) === value);
          if (selected) {
            updated.itemName = selected.name;
            updated.unitOfMeasure = selected.purchase_uom_code || selected.stock_uom_code;
          }
        }
        return updated;
      }),
    );
  };

  const totalValue = useMemo(() => {
    return lines.reduce((sum, line) => {
      const qty = Number(line.quantity) || 0;
      const price = Number(line.unitPrice) || 0;
      return sum + qty * price;
    }, 0);
  }, [lines]);

  const handleSubmit = async () => {
    if (!supplierId) {
      setError('Please select a supplier.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const poResponse = await api.post('/purchases/orders/', {
        supplier: Number(supplierId),
        order_date: orderDate,
        expected_delivery_date: expectedDate || null,
        notes,
      });
      const poId = poResponse.data.id;

      const payloadLines = lines
        .filter((line) => line.itemName.trim())
        .map((line, index) => ({
          purchase_order: poId,
          line_number: index + 1,
          item: line.itemId ? Number(line.itemId) : null,
          item_name: line.itemName.trim(),
          description: line.description.trim(),
          quantity: line.quantity,
          unit_of_measure: line.unitOfMeasure || 'units',
          unit_price: line.unitPrice,
          tax_rate: line.taxRate || '0',
        }));

      if (payloadLines.length > 0) {
        await Promise.all(
          payloadLines.map((payload) => api.post('/purchases/order-items/', payload)),
        );
      }

      await api.post(`/purchases/orders/${poId}/recalculate/`);
      onSuccess();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to create purchase order.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={isOpen} onClose={onClose} size="5xl" className="bg-gray-900/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-h-[85vh] flex flex-col">
        <div className="border-b border-gray-200 dark:border-gray-800 px-6 py-4">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            Create Purchase Order
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && <Alert color="failure">{error}</Alert>}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="supplier" value="Supplier" />
              <StandardSelect
                id="supplier"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                <option value="">Select supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </StandardSelect>
            </div>
            <div>
              <Label htmlFor="order_date" value="Order Date" />
              <StandardTextInput
                id="order_date"
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="expected_date" value="Expected Delivery" />
              <StandardTextInput
                id="expected_date"
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes" value="Notes" />
            <StandardTextarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Line Items</h4>
              <Button size="sm" onClick={addLine}>
                Add Line
              </Button>
            </div>

            <div className="space-y-3">
              {lines.map((line) => (
                <div key={line.id} className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-end">
                  <div className="lg:col-span-3">
                    <Label value="Item" />
                    <StandardSelect
                      value={line.itemId}
                      onChange={(e) => updateLine(line.id, 'itemId', e.target.value)}
                    >
                      <option value="">Select item</option>
                      {items.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.name} ({entry.sku})
                        </option>
                      ))}
                    </StandardSelect>
                  </div>
                  <div className="lg:col-span-3">
                    <Label value="Item Name" />
                    <StandardTextInput
                      value={line.itemName}
                      onChange={(e) => updateLine(line.id, 'itemName', e.target.value)}
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <Label value="Qty" />
                    <StandardTextInput
                      type="number"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.id, 'quantity', e.target.value)}
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <Label value="Unit Price" />
                    <StandardTextInput
                      type="number"
                      value={line.unitPrice}
                      onChange={(e) => updateLine(line.id, 'unitPrice', e.target.value)}
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <Label value="UoM" />
                    <StandardTextInput
                      value={line.unitOfMeasure}
                      onChange={(e) => updateLine(line.id, 'unitOfMeasure', e.target.value)}
                    />
                  </div>
                  <div className="lg:col-span-12">
                    <Label value="Description" />
                    <StandardTextInput
                      value={line.description}
                      onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                    />
                  </div>
                  <div className="lg:col-span-12 flex justify-end">
                    <Button color="gray" size="xs" onClick={() => removeLine(line.id)}>
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-300">
            Estimated Total: <span className="font-semibold">{totalValue.toFixed(2)}</span>
          </div>
          <div className="flex gap-2">
            <Button color="gray" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} isProcessing={loading}>
              Create Purchase Order
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
