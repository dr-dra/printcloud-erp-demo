'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Table } from 'flowbite-react';
import { StandardTextInput } from '@/components/common/inputs';
import { HiTrash } from 'react-icons/hi';
import { TbPackageOff } from 'react-icons/tb';
import { IoIosAddCircleOutline } from 'react-icons/io';
import InventoryItemSelector from './InventoryItemSelector';
import type { InvItem } from '@/types/inventory';
import { api } from '@/lib/api';

export interface PurchaseOrderItem {
  id?: string;
  item_id?: number;
  item?: InvItem;
  item_name: string;
  quantity: number;
  unit_price: number;
  unit_of_measure: string;
  amount: number;
  is_non_stock?: boolean;
}

interface PurchaseOrderItemsTableV2Props {
  items: PurchaseOrderItem[];
  onItemsChange: (items: PurchaseOrderItem[]) => void;
  itemsLength?: number;
  supplierId?: number | null;
}

export default function PurchaseOrderItemsTableV2({
  items,
  onItemsChange,
  itemsLength,
  supplierId,
}: PurchaseOrderItemsTableV2Props) {
  const [unitPriceInputs, setUnitPriceInputs] = useState<{ [key: string]: string }>({});
  const priceRequestRef = useRef<{ [key: string]: number }>({});

  const generateItemId = () => {
    return `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const addNewItem = () => {
    const newItem: PurchaseOrderItem = {
      id: generateItemId(),
      item_id: undefined,
      item: undefined,
      item_name: '',
      quantity: 1,
      unit_price: 0,
      unit_of_measure: '',
      amount: 0,
      is_non_stock: false,
    };
    const newItems = [...items, newItem];
    onItemsChange(newItems);
  };

  const updateItem = (index: number, updates: Partial<PurchaseOrderItem>) => {
    const updatedItems = items.map((item, i) => {
      if (i === index) {
        const updatedItem = { ...item, ...updates };

        if ('quantity' in updates || 'unit_price' in updates) {
          updatedItem.amount = updatedItem.quantity * updatedItem.unit_price;
        }

        return updatedItem;
      }
      return item;
    });
    onItemsChange(updatedItems);
  };

  const removeItem = (index: number) => {
    const updatedItems = items.filter((_, i) => i !== index);
    onItemsChange(updatedItems);
    const itemId = items[index].id;
    if (itemId) {
      setUnitPriceInputs((prev) => {
        const newInputs = { ...prev };
        delete newInputs[itemId];
        return newInputs;
      });
    }
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
      console.warn('[PurchaseOrderItemsTableV2] Failed to fetch price history:', error);
      return null;
    }
  };

  const handleItemSelect = async (index: number, selectedItem: InvItem | null) => {
    if (selectedItem) {
      updateItem(index, {
        item_id: selectedItem.id,
        item: selectedItem,
        item_name: selectedItem.name,
        unit_of_measure: selectedItem.purchase_uom_code || selectedItem.stock_uom_code || 'units',
        is_non_stock: false,
      });
      const lineId = items[index]?.id;
      if (lineId) {
        const price = await fetchCurrentPrice(lineId, selectedItem);
        if (price !== null) {
          const quantity = items[index]?.quantity || 1;
          updateItem(index, {
            unit_price: price,
            amount: quantity * price,
          });
        }
      }
    } else {
      updateItem(index, {
        item_id: undefined,
        item: undefined,
        item_name: '',
        unit_of_measure: '',
        unit_price: 0,
        amount: 0,
        is_non_stock: false,
      });
    }
  };

  const toggleNonStock = (index: number) => {
    const item = items[index];
    if (item.is_non_stock) {
      // Switch back to stock item
      updateItem(index, {
        is_non_stock: false,
        item_id: undefined,
        item: undefined,
        item_name: '',
        unit_of_measure: '',
        unit_price: 0,
        amount: 0,
      });
    } else {
      // Switch to non-stock item
      updateItem(index, {
        is_non_stock: true,
        item_id: undefined,
        item: undefined,
        item_name: '',
        unit_of_measure: 'units',
        unit_price: 0,
        amount: 0,
      });
      // Focus the item name input after a short delay
      setTimeout(() => {
        const nameInput = document.querySelector(`[data-nsi-input="${index}"]`) as HTMLInputElement;
        if (nameInput) {
          nameInput.focus();
        }
      }, 100);
    }
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-LK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getUnitPriceDisplayValue = (item: PurchaseOrderItem) => {
    const itemId = item.id;
    if (itemId && unitPriceInputs[itemId] !== undefined) {
      return unitPriceInputs[itemId];
    }
    return item.unit_price === 0 ? '' : item.unit_price.toFixed(2);
  };

  const handleUnitPriceChange = (index: number, inputValue: string) => {
    const item = items[index];
    const itemId = item.id;

    if (inputValue === '' || /^\d*\.?\d*$/.test(inputValue)) {
      if (itemId) {
        setUnitPriceInputs((prev) => ({
          ...prev,
          [itemId]: inputValue,
        }));
      }

      const numValue = parseFloat(inputValue) || 0;
      updateItem(index, { unit_price: numValue });
    }
  };

  const handleUnitPriceBlur = (index: number, inputValue: string) => {
    const item = items[index];
    const itemId = item.id;

    const value = parseFloat(inputValue) || 0;
    updateItem(index, { unit_price: value });

    if (itemId) {
      setUnitPriceInputs((prev) => {
        const newInputs = { ...prev };
        delete newInputs[itemId];
        return newInputs;
      });
    }
  };

  useEffect(() => {
    if (items.length === 0) {
      addNewItem();
    }
  }, [items.length]);

  return (
    <div className="space-y-4">
      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-x-auto overflow-y-visible">
        <Table hoverable>
          <Table.Head>
            <Table.HeadCell className="w-[40%]">Item</Table.HeadCell>
            <Table.HeadCell className="w-24 text-center">Qty</Table.HeadCell>
            <Table.HeadCell className="w-24 text-center">UoM</Table.HeadCell>
            <Table.HeadCell className="w-32 text-right">Unit Price</Table.HeadCell>
            <Table.HeadCell className="w-32 text-right">Amount</Table.HeadCell>
            <Table.HeadCell className="w-20 text-center">Actions</Table.HeadCell>
          </Table.Head>
          <Table.Body>
            {items.map((item, index) => (
              <Table.Row
                key={item.id}
                className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
              >
                {/* Item Column */}
                <Table.Cell className="align-middle py-2 overflow-visible">
                  {item.is_non_stock ? (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded text-xs text-amber-700 dark:text-amber-400 shrink-0">
                        <TbPackageOff className="w-3.5 h-3.5" />
                        <span>NSI</span>
                      </div>
                      <StandardTextInput
                        data-nsi-input={index}
                        type="text"
                        value={item.item_name}
                        onChange={(e) => updateItem(index, { item_name: e.target.value })}
                        placeholder="Enter item name..."
                        sizing="sm"
                        className="flex-1"
                        tabIndex={index * 4 + 4}
                      />
                    </div>
                  ) : (
                    <InventoryItemSelector
                      value={item.item || null}
                      onChange={(selectedItem) => handleItemSelect(index, selectedItem)}
                      onNonStockItem={() => toggleNonStock(index)}
                      placeholder="Select or search item..."
                      tabIndex={index * 4 + 4}
                    />
                  )}
                </Table.Cell>

                {/* Quantity Column */}
                <Table.Cell className="align-middle py-2">
                  <StandardTextInput
                    type="number"
                    value={item.quantity}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || /^\d*\.?\d*$/.test(value)) {
                        updateItem(index, { quantity: parseFloat(value) || 0 });
                      }
                    }}
                    onBlur={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      updateItem(index, { quantity: value });
                    }}
                    sizing="sm"
                    className="text-center"
                    min="0"
                    step="any"
                    tabIndex={index * 4 + 5}
                  />
                </Table.Cell>

                {/* UoM Column */}
                <Table.Cell className="align-middle py-2">
                  <StandardTextInput
                    type="text"
                    value={item.unit_of_measure}
                    onChange={(e) => updateItem(index, { unit_of_measure: e.target.value })}
                    sizing="sm"
                    className="text-center"
                    placeholder="units"
                    tabIndex={index * 4 + 6}
                    readOnly={!item.is_non_stock && !!item.item_id}
                  />
                </Table.Cell>

                {/* Unit Price Column */}
                <Table.Cell className="align-middle py-2">
                  <StandardTextInput
                    type="text"
                    value={getUnitPriceDisplayValue(item)}
                    onChange={(e) => handleUnitPriceChange(index, e.target.value)}
                    onBlur={(e) => handleUnitPriceBlur(index, e.target.value)}
                    sizing="sm"
                    className="text-right"
                    tabIndex={index * 4 + 7}
                  />
                </Table.Cell>

                {/* Amount Column */}
                <Table.Cell className="text-right align-middle py-2">
                  <span className="font-medium text-gray-900 dark:text-white">
                    Rs {formatCurrency(item.amount)}
                  </span>
                </Table.Cell>

                {/* Actions Column */}
                <Table.Cell className="align-middle py-2">
                  <div className="flex items-center justify-center gap-1">
                    {/* NSI Toggle Button */}
                    <button
                      type="button"
                      onClick={() => toggleNonStock(index)}
                      className={`p-1.5 rounded transition-colors ${
                        item.is_non_stock
                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                      }`}
                      title={item.is_non_stock ? 'Switch to stock item' : 'Non-stock item'}
                    >
                      <TbPackageOff className="w-4 h-4" />
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors"
                      title="Remove item"
                    >
                      <HiTrash className="w-4 h-4" />
                    </button>
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}

            {/* Add Item Row */}
            <Table.Row
              className="bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 border-b border-gray-200 dark:border-gray-700 cursor-pointer transition-colors"
              onClick={addNewItem}
            >
              <Table.Cell colSpan={6} className="py-3">
                <button
                  type="button"
                  onClick={addNewItem}
                  className="flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  tabIndex={(itemsLength || items.length) * 4 + 8}
                >
                  <IoIosAddCircleOutline className="w-5 h-5 mr-2" />
                  <span className="font-medium">Add Item</span>
                </button>
              </Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-4">
        {items.map((item, index) => (
          <div key={item.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-gray-900 dark:text-white">Item #{index + 1}</h4>
                {item.is_non_stock && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded text-xs text-amber-700 dark:text-amber-400">
                    <TbPackageOff className="w-3 h-3" />
                    NSI
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="xs"
                  color={item.is_non_stock ? 'warning' : 'gray'}
                  onClick={() => toggleNonStock(index)}
                  title={item.is_non_stock ? 'Switch to stock item' : 'Non-stock item'}
                >
                  <TbPackageOff className="w-3 h-3" />
                </Button>
                <Button
                  size="xs"
                  color="failure"
                  onClick={() => removeItem(index)}
                  title="Remove item"
                >
                  <HiTrash className="w-3 h-3" />
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {/* Item Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Item
                </label>
                {item.is_non_stock ? (
                  <StandardTextInput
                    type="text"
                    value={item.item_name}
                    onChange={(e) => updateItem(index, { item_name: e.target.value })}
                    placeholder="Enter item name..."
                    sizing="sm"
                  />
                ) : (
                  <InventoryItemSelector
                    value={item.item || null}
                    onChange={(selectedItem) => handleItemSelect(index, selectedItem)}
                    onNonStockItem={() => toggleNonStock(index)}
                    placeholder="Select or search item..."
                  />
                )}
              </div>

              {/* Qty, UoM, Unit Price, Amount Row */}
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Qty
                  </label>
                  <StandardTextInput
                    type="number"
                    value={item.quantity}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || /^\d*\.?\d*$/.test(value)) {
                        updateItem(index, { quantity: parseFloat(value) || 0 });
                      }
                    }}
                    onBlur={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      updateItem(index, { quantity: value });
                    }}
                    min="0"
                    step="any"
                    sizing="sm"
                    className="text-center"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    UoM
                  </label>
                  <StandardTextInput
                    type="text"
                    value={item.unit_of_measure}
                    onChange={(e) => updateItem(index, { unit_of_measure: e.target.value })}
                    placeholder="units"
                    sizing="sm"
                    className="text-center"
                    readOnly={!item.is_non_stock && !!item.item_id}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Price
                  </label>
                  <StandardTextInput
                    type="text"
                    value={getUnitPriceDisplayValue(item)}
                    onChange={(e) => handleUnitPriceChange(index, e.target.value)}
                    onBlur={(e) => handleUnitPriceBlur(index, e.target.value)}
                    sizing="sm"
                    className="text-right"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Amount
                  </label>
                  <div className="px-2 py-1.5 bg-gray-50 dark:bg-gray-700 rounded text-sm font-medium text-right">
                    Rs {formatCurrency(item.amount)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Add Item Button for Mobile */}
        <div className="flex justify-start pt-2">
          <Button
            onClick={addNewItem}
            className="bg-transparent hover:bg-transparent text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 border-none shadow-none p-0"
          >
            <IoIosAddCircleOutline className="w-5 h-5 mr-2" />
            <span className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
              Add Item
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}
