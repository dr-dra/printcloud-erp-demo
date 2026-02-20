'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button, Card, Label, Datepicker, Spinner } from 'flowbite-react';
import { HiArrowLeft, HiSave } from 'react-icons/hi';
import DashboardLayout from '@/components/DashboardLayout';
import { StandardTextInput, StandardTextarea } from '@/components/common/inputs';
import TypeaheadInput from '@/components/common/TypeaheadInput';
import { purchaseOrdersAPI, api } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import {
  PurchaseOrderItemsTable,
  PurchaseOrderLineItem,
} from '@/components/purchaseOrders/PurchaseOrderItemsTable';
import PurchaseOrderPrnPull from '@/components/purchaseOrders/PurchaseOrderPrnPull';
import type { InvItem, InvItemListResponse } from '@/types/inventory';
import type { PurchaseOrder } from '@/types/suppliers';

export default function EditPurchaseOrderPage() {
  const router = useRouter();
  const params = useParams();
  const purchaseOrderId = params.id as string;
  const { isAuthenticated } = useAuth();

  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [poNumber, setPoNumber] = useState('');
  const [poStatus, setPoStatus] = useState<string>('draft');
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [inventoryItems, setInventoryItems] = useState<InvItem[]>([]);
  const createEmptyLine = (): PurchaseOrderLineItem => ({
    id: crypto.randomUUID(),
    itemId: '',
    itemName: '',
    description: '',
    quantity: '1',
    unitPrice: '0',
    unitOfMeasure: '',
    taxRate: '0',
  });

  const [items, setItems] = useState<PurchaseOrderLineItem[]>([createEmptyLine()]);
  const [orderDate, setOrderDate] = useState(new Date());
  const [expectedDate, setExpectedDate] = useState<Date | null>(null);
  const [notes, setNotes] = useState('');
  const [supplierNotes, setSupplierNotes] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const originalItemIdsRef = useRef<number[]>([]);

  const subtotal = items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unitPrice) || 0;
    return sum + qty * price;
  }, 0);
  const taxAmount = items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unitPrice) || 0;
    const taxRate = parseFloat(item.taxRate) || 0;
    return sum + qty * price * (taxRate / 100);
  }, 0);
  const total = subtotal + taxAmount - discountAmount;

  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const itemsResponse = await api.get('/inventory/items/', { params: { page_size: 500 } });
        const itemsData: InvItemListResponse = itemsResponse.data;
        setInventoryItems(itemsData.results || []);
      } catch (error) {
        console.error('[EditPurchaseOrderPage] Failed to load inventory items:', error);
      }
    };

    if (isAuthenticated) {
      fetchLookups();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const fetchPurchaseOrder = async () => {
      if (!isAuthenticated || !purchaseOrderId || purchaseOrderId === 'new') return;

      try {
        setPageLoading(true);
        const response = await purchaseOrdersAPI.getPurchaseOrder(parseInt(purchaseOrderId, 10));
        const purchaseOrder: PurchaseOrder = response.data;

        setPoNumber(purchaseOrder.po_number);
        setPoStatus(purchaseOrder.status || 'draft');
        setOrderDate(new Date(purchaseOrder.order_date));
        if (purchaseOrder.expected_delivery_date) {
          setExpectedDate(new Date(purchaseOrder.expected_delivery_date));
        }
        setNotes(purchaseOrder.notes || '');
        setSupplierNotes(purchaseOrder.supplier_notes || '');
        setDiscountAmount(parseFloat(purchaseOrder.discount_amount as string) || 0);

        if (purchaseOrder.supplier_detail) {
          setSelectedSupplier({
            id: purchaseOrder.supplier_detail.id,
            name: purchaseOrder.supplier_detail.name,
            secondary: purchaseOrder.supplier_detail.email || purchaseOrder.supplier_detail.phone,
          });
        } else {
          setSelectedSupplier({
            id: purchaseOrder.supplier,
            name: purchaseOrder.supplier_name,
          });
        }

        const mappedItems: PurchaseOrderLineItem[] = (purchaseOrder.items || []).map((item) => ({
          id: crypto.randomUUID(),
          existingId: item.id,
          itemId: item.item ? String(item.item) : '',
          itemName: item.item_name,
          description: item.description || '',
          quantity: String(item.quantity),
          unitPrice: String(item.unit_price),
          unitOfMeasure: item.unit_of_measure || '',
          taxRate: String(item.tax_rate || '0'),
        }));

        originalItemIdsRef.current = (purchaseOrder.items || []).map((item) => item.id);
        setItems(mappedItems.length > 0 ? mappedItems : [createEmptyLine()]);
      } catch (error) {
        console.error('[EditPurchaseOrderPage] Failed to load purchase order:', error);
      } finally {
        setPageLoading(false);
      }
    };

    fetchPurchaseOrder();
  }, [isAuthenticated, purchaseOrderId]);

  const searchSuppliers = async (query: string) => {
    const response = await api.get('/suppliers/', { params: { search: query } });
    return response.data.results.map((supplier: any) => ({
      id: supplier.id,
      name: supplier.name,
      secondary: supplier.email || supplier.phone,
    }));
  };

  const getTopSuppliers = async () => {
    const response = await api.get('/suppliers/', { params: { page_size: 5 } });
    return response.data.results.map((supplier: any) => ({
      id: supplier.id,
      name: supplier.name,
      secondary: supplier.email || supplier.phone,
    }));
  };

  const handleUpdate = async () => {
    if (!selectedSupplier) {
      toast.error('Please select a supplier');
      return;
    }
    const sanitizedLines = items.filter((line) => line.itemName?.trim());
    if (sanitizedLines.length === 0) {
      toast.error('Please add at least one line item');
      return;
    }

    setLoading(true);
    try {
      const orderPayload = {
        supplier: selectedSupplier.id,
        order_date: orderDate.toISOString().split('T')[0],
        expected_delivery_date: expectedDate ? expectedDate.toISOString().split('T')[0] : null,
        notes,
        supplier_notes: supplierNotes,
        tax_amount: taxAmount,
        discount_amount: discountAmount,
      };

      await purchaseOrdersAPI.updatePurchaseOrder(parseInt(purchaseOrderId, 10), orderPayload);

      const existingIds = originalItemIdsRef.current;
      const currentExistingIds = sanitizedLines
        .map((line) => line.existingId)
        .filter((id): id is number => typeof id === 'number');
      const removedIds = existingIds.filter((id) => !currentExistingIds.includes(id));

      await Promise.all(removedIds.map((id) => api.delete(`/purchases/order-items/${id}/`)));

      const createOrUpdatePromises = sanitizedLines.map((line, index) => {
        const payload = {
          purchase_order: Number(purchaseOrderId),
          line_number: index + 1,
          item: line.itemId ? Number(line.itemId) : null,
          item_name: line.itemName.trim(),
          description: line.description?.trim() || '',
          quantity: line.quantity || '0',
          unit_of_measure: line.unitOfMeasure || 'units',
          unit_price: line.unitPrice || '0',
          tax_rate: line.taxRate || '0',
        };

        if (line.existingId) {
          return api.put(`/purchases/order-items/${line.existingId}/`, payload);
        }
        return api.post('/purchases/order-items/', payload);
      });

      await Promise.all(createOrUpdatePromises);
      await purchaseOrdersAPI.recalculatePurchaseOrder(parseInt(purchaseOrderId, 10));

      sessionStorage.setItem('updatedPurchaseOrderId', String(purchaseOrderId));
      toast.success('Purchase order updated successfully');
      router.push(`/dashboard/inventory/purchase-orders/${purchaseOrderId}`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to update purchase order');
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading)
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-64">
          <Spinner size="xl" />
        </div>
      </DashboardLayout>
    );

  return (
    <DashboardLayout>
      <div className="p-4">
        <div className="flex items-center gap-4 mb-6">
          <Button color="gray" onClick={() => router.back()}>
            <HiArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Edit Purchase Order {poNumber}</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Supplier</Label>
                  <TypeaheadInput
                    value={selectedSupplier}
                    onChange={setSelectedSupplier}
                    searchFunction={searchSuppliers}
                    getInitialOptions={getTopSuppliers}
                    placeholder="Search supplier..."
                  />
                </div>
                <div>
                  <Label>PO Number</Label>
                  <StandardTextInput value={poNumber} readOnly disabled />
                </div>
                <div>
                  <Label>Order Date</Label>
                  <Datepicker
                    value={orderDate.toLocaleDateString()}
                    onSelectedDateChanged={setOrderDate}
                  />
                </div>
                <div>
                  <Label>Expected Delivery</Label>
                  <Datepicker
                    value={expectedDate ? expectedDate.toLocaleDateString() : ''}
                    onSelectedDateChanged={setExpectedDate}
                  />
                </div>
              </div>
            </Card>

            <Card>
              <PurchaseOrderItemsTable
                items={items}
                inventoryItems={inventoryItems}
                onItemsChange={setItems}
                supplierId={selectedSupplier?.id ? Number(selectedSupplier.id) : null}
              />
            </Card>

            <Card>
              <PurchaseOrderPrnPull
                purchaseOrderId={Number(purchaseOrderId)}
                purchaseOrderStatus={poStatus}
                onAdded={() => {
                  const poId = Number(purchaseOrderId);
                  if (!Number.isNaN(poId)) {
                    purchaseOrdersAPI.getPurchaseOrder(poId).then((response) => {
                      const purchaseOrder: PurchaseOrder = response.data;
                      const mappedItems: PurchaseOrderLineItem[] = (purchaseOrder.items || []).map(
                        (item) => ({
                          id: crypto.randomUUID(),
                          existingId: item.id,
                          itemId: item.item ? String(item.item) : '',
                          itemName: item.item_name,
                          description: item.description || '',
                          quantity: String(item.quantity),
                          unitPrice: String(item.unit_price),
                          unitOfMeasure: item.unit_of_measure || '',
                          taxRate: String(item.tax_rate || '0'),
                        }),
                      );
                      setItems(mappedItems.length ? mappedItems : [createEmptyLine()]);
                      setPoStatus(purchaseOrder.status || 'draft');
                    });
                  }
                }}
              />
            </Card>

            <Card>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Supplier Notes</Label>
                  <StandardTextarea
                    value={supplierNotes}
                    onChange={(e) => setSupplierNotes(e.target.value)}
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Internal Notes</Label>
                  <StandardTextarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <h5 className="text-lg font-bold mb-4">Summary</h5>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>
                    Rs. {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Tax:</span>
                  <span>
                    Rs. {taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Discount:</span>
                  <div className="w-32">
                    <StandardTextInput
                      type="number"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                      className="text-right"
                    />
                  </div>
                </div>
                <div className="flex justify-between text-xl font-bold border-t pt-4">
                  <span>Total:</span>
                  <span>Rs. {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              <div className="mt-6">
                <Button
                  color="primary"
                  className="w-full"
                  onClick={handleUpdate}
                  disabled={loading}
                >
                  {loading ? (
                    <Spinner size="sm" />
                  ) : (
                    <>
                      <HiSave className="mr-2 h-5 w-5" /> Update Purchase Order
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
