'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from 'react';
import { Modal, Button, Label, Alert } from 'flowbite-react';
import { StandardTextInput, StandardSelect, StandardTextarea } from '@/components/common/inputs';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/utils/errorHandling';
import type { PurchaseOrder, PurchaseOrderItem } from '@/types/suppliers';

interface InventoryGrnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface GrnLineState {
  id: number;
  itemId: number | null;
  itemName: string;
  quantityPending: string;
  quantityReceived: string;
  quantityAccepted: string;
  quantityRejected: string;
  unitCost: string;
}

export default function InventoryGrnModal({ isOpen, onClose, onSuccess }: InventoryGrnModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [selectedPoId, setSelectedPoId] = useState('');
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [receivedDate, setReceivedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [deliveryNote, setDeliveryNote] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<GrnLineState[]>([]);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await api.get('/purchases/orders/?page_size=200');
        const allOrders = response.data.results || [];
        const openOrders = allOrders.filter(
          (po: PurchaseOrder) => !['received', 'completed', 'cancelled'].includes(po.status),
        );
        setPurchaseOrders(openOrders);
      } catch (err) {
        console.error('Failed to load purchase orders:', err);
      }
    };

    if (isOpen) {
      fetchOrders();
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const fetchOrderDetail = async () => {
      if (!selectedPoId) {
        setPurchaseOrder(null);
        setLines([]);
        return;
      }
      try {
        const response = await api.get(`/purchases/orders/${selectedPoId}/`);
        const po: PurchaseOrder = response.data;
        setPurchaseOrder(po);
        setLines(
          (po.items || []).map((item: PurchaseOrderItem) => ({
            id: item.id,
            itemId: item.item ?? null,
            itemName: item.item_display_name || item.item_name,
            quantityPending: item.quantity_pending || item.quantity,
            quantityReceived: '',
            quantityAccepted: '',
            quantityRejected: '0',
            unitCost: item.unit_price || '0',
          })),
        );
      } catch (err) {
        console.error('Failed to load purchase order:', err);
      }
    };

    fetchOrderDetail();
  }, [selectedPoId]);

  const invalidItems = useMemo(() => {
    return lines.filter((line) => line.itemId === null || line.itemId === undefined);
  }, [lines]);

  const updateLine = (lineId: number, field: keyof GrnLineState, value: string) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== lineId) return line;
        const updated = { ...line, [field]: value } as GrnLineState;
        if (field === 'quantityReceived') {
          if (!updated.quantityAccepted) {
            updated.quantityAccepted = value;
          }
        }
        return updated;
      }),
    );
  };

  const handleSubmit = async () => {
    if (!selectedPoId || !purchaseOrder) {
      setError('Please select a purchase order.');
      return;
    }
    if (invalidItems.length > 0) {
      setError('Some PO items are missing inventory links. Please edit the PO items first.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const grnResponse = await api.post('/inventory/grns/', {
        purchase_order: purchaseOrder.id,
        supplier: purchaseOrder.supplier,
        received_date: receivedDate,
        delivery_note_number: deliveryNote,
        notes,
        status: 'received',
      });

      const grnId = grnResponse.data.id;

      const payloadLines = lines
        .filter((line) => Number(line.quantityReceived) > 0)
        .map((line) => ({
          grn: grnId,
          purchase_order_item: line.id,
          item: line.itemId,
          quantity_received: line.quantityReceived,
          quantity_accepted: line.quantityAccepted || line.quantityReceived,
          quantity_rejected: line.quantityRejected || '0',
          unit_cost: line.unitCost || '0',
        }));

      if (payloadLines.length > 0) {
        await Promise.all(
          payloadLines.map((payload) => api.post('/inventory/grn-items/', payload)),
        );
      }

      const allAccepted =
        payloadLines.length > 0 && payloadLines.every((line) => Number(line.quantity_accepted) > 0);

      if (allAccepted) {
        await api.post(`/inventory/grns/${grnId}/inspect/`, {
          quality_passed: true,
          inspection_notes: 'Auto-inspected on creation.',
        });
        await api.post(`/inventory/grns/${grnId}/accept/`);
      }

      onSuccess();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to create GRN.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={isOpen} onClose={onClose} size="5xl" className="bg-gray-900/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-h-[85vh] flex flex-col">
        <div className="border-b border-gray-200 dark:border-gray-800 px-6 py-4">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Create GRN</h3>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && <Alert color="failure">{error}</Alert>}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="po" value="Purchase Order" />
              <StandardSelect
                id="po"
                value={selectedPoId}
                onChange={(e) => setSelectedPoId(e.target.value)}
              >
                <option value="">Select PO</option>
                {purchaseOrders.map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.po_number} - {po.supplier_name}
                  </option>
                ))}
              </StandardSelect>
            </div>
            <div>
              <Label htmlFor="received_date" value="Received Date" />
              <StandardTextInput
                id="received_date"
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="delivery_note" value="Delivery Note" />
              <StandardTextInput
                id="delivery_note"
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
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

          {purchaseOrder && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Received Items
              </h4>
              <div className="space-y-3">
                {lines.map((line) => (
                  <div key={line.id} className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-end">
                    <div className="lg:col-span-3">
                      <Label value="Item" />
                      <StandardTextInput value={line.itemName} disabled />
                    </div>
                    <div className="lg:col-span-2">
                      <Label value="Pending" />
                      <StandardTextInput value={line.quantityPending} disabled />
                    </div>
                    <div className="lg:col-span-2">
                      <Label value="Received" />
                      <StandardTextInput
                        type="number"
                        value={line.quantityReceived}
                        onChange={(e) => updateLine(line.id, 'quantityReceived', e.target.value)}
                      />
                    </div>
                    <div className="lg:col-span-2">
                      <Label value="Accepted" />
                      <StandardTextInput
                        type="number"
                        value={line.quantityAccepted}
                        onChange={(e) => updateLine(line.id, 'quantityAccepted', e.target.value)}
                      />
                    </div>
                    <div className="lg:col-span-1">
                      <Label value="Rejected" />
                      <StandardTextInput
                        type="number"
                        value={line.quantityRejected}
                        onChange={(e) => updateLine(line.id, 'quantityRejected', e.target.value)}
                      />
                    </div>
                    <div className="lg:col-span-2">
                      <Label value="Unit Cost" />
                      <StandardTextInput
                        type="number"
                        value={line.unitCost}
                        onChange={(e) => updateLine(line.id, 'unitCost', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end gap-2">
          <Button color="gray" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} isProcessing={loading}>
            Create GRN
          </Button>
        </div>
      </div>
    </Modal>
  );
}
