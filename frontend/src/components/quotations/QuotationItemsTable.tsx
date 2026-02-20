'use client';

import { useEffect, useState } from 'react';
import { Button, Table } from 'flowbite-react';
import { StandardTextInput } from '@/components/common/inputs';
import { HiTrash, HiDuplicate } from 'react-icons/hi';
import { RxDragHandleDots2 } from 'react-icons/rx';
import { IoIosAddCircleOutline } from 'react-icons/io';
import { api } from '@/lib/api';
import TypeaheadInput from '@/components/common/TypeaheadInput';
import AutoExpandingTextarea from '@/components/common/AutoExpandingTextarea';

interface FinishedProduct {
  id: number;
  name: string;
  category_name: string;
  dimensions_display: string;
  description: string;
  is_vat_exempt?: boolean;
}

interface AutocompleteOption {
  id: number | string;
  name: string;
  secondary?: string;
}

interface QuotationItem {
  id?: string;
  finished_product_id?: number;
  finished_product?: FinishedProduct;
  item_id?: number; // Legacy field for backward compatibility
  item?: string; // Legacy field for backward compatibility
  description: string;
  quantity: number;
  unit_price: number;
  price: number;
  tax?: string;
  tax_percentage?: number;
}

interface QuotationItemsTableProps {
  items: QuotationItem[];
  onItemsChange: (items: QuotationItem[]) => void;
  itemsLength?: number; // For calculating tabindex
}

export default function QuotationItemsTable({
  items,
  onItemsChange,
  itemsLength,
}: QuotationItemsTableProps) {
  // State to track raw input values for unit prices during typing
  const [unitPriceInputs, setUnitPriceInputs] = useState<{ [key: string]: string }>({});
  const generateItemId = () => {
    return `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const addNewItem = () => {
    const newItem: QuotationItem = {
      id: generateItemId(),
      finished_product_id: undefined,
      finished_product: undefined,
      item_id: undefined, // Legacy field
      item: '', // Legacy field
      description: '',
      quantity: 1,
      unit_price: 0,
      price: 0,
      tax: '',
    };
    const newItems = [...items, newItem];
    onItemsChange(newItems);

    // Auto-focus on the new item's text box after a short delay
    setTimeout(() => {
      const newItemIndex = newItems.length - 1;
      const newItemInput = document.querySelector(
        `[data-item-index="${newItemIndex}"] input`,
      ) as HTMLInputElement;
      if (newItemInput) {
        newItemInput.focus();
      }
    }, 100);
  };

  const updateItem = (index: number, updates: Partial<QuotationItem>) => {
    const updatedItems = items.map((item, i) => {
      if (i === index) {
        const updatedItem = { ...item, ...updates };

        // Recalculate price if quantity or unit_price changed
        if ('quantity' in updates || 'unit_price' in updates) {
          updatedItem.price = updatedItem.quantity * updatedItem.unit_price;
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
    // Clean up the input state for the removed item
    const itemId = items[index].id;
    if (itemId) {
      setUnitPriceInputs((prev) => {
        const newInputs = { ...prev };
        delete newInputs[itemId];
        return newInputs;
      });
    }
  };

  const cloneItem = (index: number) => {
    const itemToClone = items[index];
    const clonedItem: QuotationItem = {
      ...itemToClone,
      id: generateItemId(),
    };
    const updatedItems = [...items];
    updatedItems.splice(index + 1, 0, clonedItem);
    onItemsChange(updatedItems);
  };

  // Search function for TypeaheadInput
  const searchItems = async (query: string) => {
    try {
      const response = await api.get(
        `/sales/finished-products/?search=${encodeURIComponent(query)}`,
      );
      return response.data.results.map((product: FinishedProduct) => ({
        id: product.id,
        name: product.name,
        secondary: `${product.category_name}${product.dimensions_display ? ` - ${product.dimensions_display}` : ''}`,
      }));
    } catch (error) {
      console.error('Error searching finished products:', error);
      return [];
    }
  };

  const getTopItems = async () => {
    try {
      const response = await api.get(`/sales/finished-products/?limit=5`);
      return response.data.results.map((product: FinishedProduct) => ({
        id: product.id,
        name: product.name,
        secondary: `${product.category_name}${product.dimensions_display ? ` - ${product.dimensions_display}` : ''}`,
      }));
    } catch (error) {
      console.error('Error getting top finished products:', error);
      return [];
    }
  };

  const handleItemSelect = async (index: number, option: AutocompleteOption | null) => {
    if (option) {
      try {
        // Fetch full product details
        const response = await api.get(`/sales/finished-products/${option.id}/`);
        const product: FinishedProduct = response.data;

        updateItem(index, {
          finished_product_id: product.id,
          finished_product: product,
          item_id: product.id, // Legacy field for backward compatibility
          item: product.name, // Legacy field for backward compatibility
          description: product.description || '',
        });
      } catch (error) {
        console.error('Error fetching product details:', error);
        // Fallback to basic info
        updateItem(index, {
          finished_product_id: Number(option.id),
          item_id: Number(option.id), // Legacy field
          item: option.name, // Legacy field
          description: '',
        });
      }
    } else {
      updateItem(index, {
        finished_product_id: undefined,
        finished_product: undefined,
        item_id: undefined, // Legacy field
        item: '', // Legacy field
        description: '',
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-LK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Helper functions for unit price input handling
  const getUnitPriceDisplayValue = (item: QuotationItem) => {
    const itemId = item.id;
    // If we have a raw input value for this item, use it (user is typing)
    if (itemId && unitPriceInputs[itemId] !== undefined) {
      return unitPriceInputs[itemId];
    }
    // Otherwise, format the stored value
    return item.unit_price === 0 ? '' : item.unit_price.toFixed(2);
  };

  const handleUnitPriceChange = (index: number, inputValue: string) => {
    const item = items[index];
    const itemId = item.id;

    // Only allow numbers, decimal points, and backspace
    if (inputValue === '' || /^\d*\.?\d*$/.test(inputValue)) {
      // Update the raw input state
      if (itemId) {
        setUnitPriceInputs((prev) => ({
          ...prev,
          [itemId]: inputValue,
        }));
      }

      // Update the actual item value
      const numValue = parseFloat(inputValue) || 0;
      updateItem(index, { unit_price: numValue });
    }
  };

  const handleUnitPriceBlur = (index: number, inputValue: string) => {
    const item = items[index];
    const itemId = item.id;

    // Format to 2 decimal places and update the item
    const value = parseFloat(inputValue) || 0;
    updateItem(index, { unit_price: value });

    // Clear the raw input state (will fall back to formatted display)
    if (itemId) {
      setUnitPriceInputs((prev) => {
        const newInputs = { ...prev };
        delete newInputs[itemId];
        return newInputs;
      });
    }
  };

  // If no items, automatically add the first item
  useEffect(() => {
    if (items.length === 0) {
      addNewItem();
    }
  }, [items.length]);

  return (
    <div className="space-y-4">
      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-x-auto">
        <Table hoverable>
          <Table.Head>
            <Table.HeadCell>Item</Table.HeadCell>
            <Table.HeadCell>Description</Table.HeadCell>
            <Table.HeadCell className="w-24">Quantity</Table.HeadCell>
            <Table.HeadCell className="w-32">Unit Price</Table.HeadCell>
            <Table.HeadCell className="w-32 text-right">Amount</Table.HeadCell>
            <Table.HeadCell className="w-12"></Table.HeadCell>
          </Table.Head>
          <Table.Body>
            {items.map((item, index) => (
              <Table.Row
                key={item.id}
                className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
              >
                <Table.Cell className="w-48 align-top" style={{ minHeight: '32px' }}>
                  <div className="flex items-start space-x-3" style={{ minHeight: '32px' }}>
                    {/* Draggable handle */}
                    <div className="cursor-move -ml-6 mt-2">
                      <RxDragHandleDots2 className="w-4 h-4 text-gray-400" />
                    </div>

                    <div className="flex-1" data-item-index={index}>
                      <TypeaheadInput
                        value={
                          item.finished_product_id || item.item
                            ? {
                                id: item.finished_product_id || 'manual',
                                name: item.finished_product?.name || item.item || '',
                                secondary: item.finished_product
                                  ? `${item.finished_product.category_name}${item.finished_product.dimensions_display ? ` - ${item.finished_product.dimensions_display}` : ''}`
                                  : item.description || '',
                              }
                            : null
                        }
                        onChange={(option) => handleItemSelect(index, option)}
                        placeholder="Search products..."
                        searchFunction={searchItems}
                        getInitialOptions={getTopItems}
                        className="w-full"
                        label=""
                        sizing="sm"
                        tabIndex={index === 0 ? 4 : index * 4 + 4}
                      />
                    </div>
                  </div>
                </Table.Cell>

                <Table.Cell
                  className="w-64 align-top"
                  style={{ height: 'auto', minHeight: '32px' }}
                >
                  <AutoExpandingTextarea
                    value={item.description}
                    onChange={(value) => updateItem(index, { description: value })}
                    placeholder="Item description..."
                    className="text-xs"
                    minRows={1}
                    maxRows={5}
                    variant="input"
                    tabIndex={index === 0 ? 5 : index * 4 + 5}
                    enableBulletPoints={true}
                  />
                </Table.Cell>

                <Table.Cell className="align-top" style={{ minHeight: '32px' }}>
                  <StandardTextInput
                    type="number"
                    value={item.quantity}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Only allow whole numbers
                      if (value === '' || /^\d+$/.test(value)) {
                        updateItem(index, { quantity: parseInt(value) || 0 });
                      }
                    }}
                    onBlur={(e) => {
                      // Ensure it's a whole number on blur
                      const value = parseInt(e.target.value) || 0;
                      updateItem(index, { quantity: value });
                    }}
                    sizing="sm"
                    className="text-center"
                    min="0"
                    step="1"
                    tabIndex={index === 0 ? 6 : index * 4 + 6}
                  />
                </Table.Cell>

                <Table.Cell className="align-top" style={{ minHeight: '32px' }}>
                  <StandardTextInput
                    type="text"
                    value={getUnitPriceDisplayValue(item)}
                    onChange={(e) => handleUnitPriceChange(index, e.target.value)}
                    onBlur={(e) => handleUnitPriceBlur(index, e.target.value)}
                    sizing="sm"
                    className="text-right"
                    tabIndex={index === 0 ? 7 : index * 4 + 7}
                  />
                </Table.Cell>

                <Table.Cell className="text-right align-top" style={{ minHeight: '32px' }}>
                  <div
                    className="font-medium flex items-start justify-end pt-2"
                    style={{ minHeight: '32px' }}
                  >
                    Rs{formatCurrency(item.price)}
                  </div>
                </Table.Cell>

                <Table.Cell className="align-top" style={{ minHeight: '32px' }}>
                  <div
                    className="flex items-start justify-end space-x-1 pt-1"
                    style={{ minHeight: '32px' }}
                  >
                    <button
                      onClick={() => cloneItem(index)}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                      title="Clone item"
                    >
                      <HiDuplicate className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => removeItem(index)}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                      title="Remove item"
                    >
                      <HiTrash className="w-3 h-3" />
                    </button>
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}

            {/* Add Item Row */}
            <Table.Row
              className="bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 border-b border-gray-200 dark:border-gray-700 cursor-pointer transition-colors !rounded-none"
              onClick={addNewItem}
            >
              <Table.Cell colSpan={6} className="py-3 !rounded-none">
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={addNewItem}
                    className="flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                    tabIndex={(itemsLength || items.length) * 4 + 8}
                  >
                    <IoIosAddCircleOutline className="w-5 h-5 mr-2" />
                    <span className="font-medium">Add Item</span>
                  </button>
                </div>
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
              <h4 className="font-medium text-gray-900 dark:text-white">Item #{index + 1}</h4>
              <div className="flex items-center space-x-1">
                <Button size="xs" color="gray" onClick={() => cloneItem(index)} title="Clone item">
                  <HiDuplicate className="w-3 h-3" />
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Item
                  </label>
                  <TypeaheadInput
                    value={
                      item.finished_product_id || item.item
                        ? {
                            id: item.finished_product_id || 'manual',
                            name: item.finished_product?.name || item.item || '',
                            secondary: item.finished_product
                              ? `${item.finished_product.category_name}${item.finished_product.dimensions_display ? ` - ${item.finished_product.dimensions_display}` : ''}`
                              : item.description || '',
                          }
                        : null
                    }
                    onChange={(option) => handleItemSelect(index, option)}
                    placeholder="Search products..."
                    searchFunction={searchItems}
                    getInitialOptions={getTopItems}
                    className="w-full"
                    sizing="sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <AutoExpandingTextarea
                    value={item.description}
                    onChange={(value) => updateItem(index, { description: value })}
                    placeholder="Item description..."
                    className="text-sm"
                    minRows={1}
                    maxRows={5}
                    variant="input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Quantity
                  </label>
                  <StandardTextInput
                    type="number"
                    value={item.quantity}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Only allow whole numbers
                      if (value === '' || /^\d+$/.test(value)) {
                        updateItem(index, { quantity: parseInt(value) || 0 });
                      }
                    }}
                    onBlur={(e) => {
                      // Ensure it's a whole number on blur
                      const value = parseInt(e.target.value) || 0;
                      updateItem(index, { quantity: value });
                    }}
                    min="0"
                    step="1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Unit Price
                  </label>
                  <StandardTextInput
                    type="text"
                    value={getUnitPriceDisplayValue(item)}
                    onChange={(e) => handleUnitPriceChange(index, e.target.value)}
                    onBlur={(e) => handleUnitPriceBlur(index, e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Amount
                  </label>
                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm font-medium">
                    Rs{formatCurrency(item.price)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Add Item Button for Mobile */}
        <div className="flex justify-start pt-4">
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
