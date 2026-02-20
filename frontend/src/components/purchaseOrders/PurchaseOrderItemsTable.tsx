import React, { useRef } from 'react';
import { Button, Label } from 'flowbite-react';
import { StandardSelect, StandardTextInput, StandardTextarea } from '@/components/common/inputs';
import type { InvItem } from '@/types/inventory';
import { api } from '@/lib/api';

export interface PurchaseOrderLineItem {
  id: string;
  existingId?: number;
  itemId: string;
  itemName: string;
  description: string;
  quantity: string;
  unitPrice: string;
  unitOfMeasure: string;
  taxRate: string;
}

interface PurchaseOrderItemsTableProps {
  items: PurchaseOrderLineItem[];
  inventoryItems: InvItem[];
  onItemsChange: (items: PurchaseOrderLineItem[]) => void;
  supplierId?: number | null;
}

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

export function PurchaseOrderItemsTable({
  items,
  inventoryItems,
  onItemsChange,
  supplierId,
}: PurchaseOrderItemsTableProps) {
  const priceRequestRef = useRef<{ [key: string]: number }>({});
  const addLine = () => {
    onItemsChange([...items, createEmptyLine()]);
  };

  const removeLine = (lineId: string) => {
    if (items.length <= 1) return;
    onItemsChange(items.filter((line) => line.id !== lineId));
  };

  const updateLine = (lineId: string, field: keyof PurchaseOrderLineItem, value: string) => {
    const updated = items.map((line) => {
      if (line.id !== lineId) return line;
      const nextLine = { ...line, [field]: value };
      return nextLine;
    });
    onItemsChange(updated);
  };

  const fetchCurrentPrice = async (lineId: string, item: InvItem) => {
    if (!supplierId) return null;
    try {
      const requestId = Date.now();
      priceRequestRef.current[lineId] = requestId;

      const response = await api.get('/inventory/prices/current/', {
        params: {
          item_id: item.id,
          supplier_id: supplierId,
        },
      });

      if (priceRequestRef.current[lineId] !== requestId) return null;

      const stockUnitPrice = parseFloat(response.data?.unit_price);
      if (!stockUnitPrice) return null;

      const factorRaw = parseFloat(String(item.purchase_to_stock_factor || 1));
      const factor = Number.isFinite(factorRaw) && factorRaw > 0 ? factorRaw : 1;
      return stockUnitPrice * factor;
    } catch (error) {
      console.warn('[PurchaseOrderItemsTable] Failed to fetch price history:', error);
      return null;
    }
  };

  const handleItemChange = async (lineId: string, itemId: string) => {
    updateLine(lineId, 'itemId', itemId);

    const selected = inventoryItems.find((entry) => String(entry.id) === itemId);
    if (!selected) return;

    const updated = items.map((line) => {
      if (line.id !== lineId) return line;
      return {
        ...line,
        itemName: selected.name,
        unitOfMeasure: selected.purchase_uom_code || selected.stock_uom_code || 'units',
      };
    });
    onItemsChange(updated);

    const price = await fetchCurrentPrice(lineId, selected);
    if (price !== null) {
      const formattedPrice = price.toFixed(2);
      const final = items.map((line) => {
        if (line.id !== lineId) return line;
        return {
          ...line,
          unitPrice: formattedPrice,
        };
      });
      onItemsChange(final);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h5 className="text-lg font-bold">Line Items</h5>
        <Button size="sm" onClick={addLine}>
          Add Line
        </Button>
      </div>

      <div className="space-y-4">
        {items.map((line, index) => {
          const quantityValue = Number(line.quantity) || 0;
          const unitPriceValue = Number(line.unitPrice) || 0;
          const lineTotal = quantityValue * unitPriceValue;

          return (
            <div key={line.id} className="rounded-lg border border-gray-200 p-4">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                <div className="lg:col-span-3">
                  <Label value="Item" />
                  <StandardSelect
                    value={line.itemId}
                    onChange={(e) => handleItemChange(line.id, e.target.value)}
                  >
                    <option value="">Select item</option>
                    {inventoryItems.map((entry) => (
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
                    placeholder="Item name"
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
                    placeholder="units"
                  />
                </div>
                <div className="lg:col-span-3">
                  <Label value="Tax Rate (%)" />
                  <StandardTextInput
                    type="number"
                    value={line.taxRate}
                    onChange={(e) => updateLine(line.id, 'taxRate', e.target.value)}
                  />
                </div>
                <div className="lg:col-span-9">
                  <Label value="Description" />
                  <StandardTextarea
                    rows={2}
                    value={line.description}
                    onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                    placeholder="Optional description"
                  />
                </div>
                <div className="lg:col-span-3 flex items-end justify-between">
                  <div className="text-sm text-gray-700">
                    <span className="font-semibold">Line Total:</span>{' '}
                    <span>
                      Rs. {lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <Button color="gray" size="xs" onClick={() => removeLine(line.id)}>
                    Remove
                  </Button>
                </div>
              </div>

              <div className="mt-2 text-xs text-gray-500">Line {index + 1}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
