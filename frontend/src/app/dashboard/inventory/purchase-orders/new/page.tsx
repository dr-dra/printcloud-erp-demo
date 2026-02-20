'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Label, Datepicker, Dropdown } from 'flowbite-react';
import { HiArrowLeft, HiChevronDown } from 'react-icons/hi';
import DashboardLayout from '@/components/DashboardLayout';
import { StandardTextInput, StandardSelect } from '@/components/common/inputs';
import TypeaheadInput from '@/components/common/TypeaheadInput';
import AutoExpandingTextarea from '@/components/common/AutoExpandingTextarea';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import PurchaseOrderItemsTableV2, {
  PurchaseOrderItem,
} from '@/components/purchaseOrders/PurchaseOrderItemsTableV2';
import PurchaseOrderPrnPull from '@/components/purchaseOrders/PurchaseOrderPrnPull';
import { purchaseOrdersAPI, api } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

interface AutocompleteOption {
  id: number | string;
  name: string;
  secondary?: string;
}

function NewPurchaseOrderPage() {
  const DEFAULT_VAT_RATE = 18;
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [poNumber, setPoNumber] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  // Navigation warning state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const isPageLoadedRef = useRef(false);
  const navigationEnabledRef = useRef(false);

  const [selectedSupplier, setSelectedSupplier] = useState<AutocompleteOption | null>(null);
  const [items, setItems] = useState<PurchaseOrderItem[]>([]);
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedDate, setExpectedDate] = useState<string>('');
  const [terms, setTerms] = useState('Net 30');
  const [notes, setNotes] = useState('');
  const [supplierNotes, setSupplierNotes] = useState('');

  // Totals state
  const [showSubtotal, setShowSubtotal] = useState(true);
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountInput, setDiscountInput] = useState('');
  const [showVat, setShowVat] = useState(true);

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);
  const discount = showDiscount ? discountAmount : 0;
  const vatRate = showVat ? DEFAULT_VAT_RATE : 0;
  const taxAmount = (subtotal - discount) * (vatRate / 100);
  const total = subtotal - discount + taxAmount;

  // Fetch PO number on load
  useEffect(() => {
    const fetchPoNumber = async () => {
      // Generate fallback PO number first
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const time =
        String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
      const fallbackPoNumber = `PO${year}${month}${day}-${time}`;

      try {
        const response = await purchaseOrdersAPI.getNextPurchaseOrderNumber();
        if (response.data?.po_number) {
          setPoNumber(response.data.po_number);
        } else {
          setPoNumber(fallbackPoNumber);
        }
      } catch (error) {
        console.warn('[NewPurchaseOrderPage] Using fallback PO number generation:', error);
        setPoNumber(fallbackPoNumber);
      }
    };

    if (isAuthenticated) {
      fetchPoNumber();
    }
  }, [isAuthenticated]);

  // Navigation warnings
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (navigationEnabledRef.current && !isSaved && items.length > 0) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isSaved, items.length]);

  useEffect(() => {
    const timer = setTimeout(() => {
      isPageLoadedRef.current = true;
      if (items.length > 0) {
        navigationEnabledRef.current = true;
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [items.length]);

  const shouldShowWarning = () => {
    return navigationEnabledRef.current && !isSaved && items.length > 0 && isPageLoadedRef.current;
  };

  const getWarningMessage = () => {
    return `Do you want to leave the page without saving Purchase Order [${poNumber}]?`;
  };

  // Intercept link clicks
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!shouldShowWarning()) return;

      const target = e.target as HTMLElement;
      const link = target.closest('a');

      if (link && link.href && !link.href.includes('/dashboard/inventory/purchase-orders/new')) {
        e.preventDefault();
        e.stopPropagation();

        setPendingNavigation(() => () => {
          window.location.href = link.href;
        });
        setShowConfirmDialog(true);
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [isSaved, items.length, poNumber]);

  // Intercept browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      if (!shouldShowWarning()) return;

      window.history.pushState(null, '', window.location.href);

      setPendingNavigation(() => () => {
        window.history.back();
      });
      setShowConfirmDialog(true);
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isSaved, items.length]);

  const handleConfirmNavigation = () => {
    setShowConfirmDialog(false);
    navigationEnabledRef.current = false;

    setTimeout(() => {
      if (pendingNavigation) {
        pendingNavigation();
        setPendingNavigation(null);
      }
    }, 50);
  };

  const handleCancelNavigation = () => {
    setShowConfirmDialog(false);
    setPendingNavigation(null);
    navigationEnabledRef.current = true;
  };

  // Supplier search functions
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

  // Validation
  const hasValidItems = () => {
    return items.some(
      (item) => item.item_name.trim() !== '' && item.quantity > 0 && item.unit_price > 0,
    );
  };

  const isFormValid = () => {
    return selectedSupplier !== null && hasValidItems();
  };

  // Handle discount input
  const getDiscountDisplayValue = () => {
    if (discountInput !== '') {
      return discountInput;
    }
    return discountAmount === 0 ? '' : discountAmount.toFixed(2);
  };

  const handleDiscountChange = (inputValue: string) => {
    if (inputValue === '' || /^\d*\.?\d*$/.test(inputValue)) {
      setDiscountInput(inputValue);
      const numValue = parseFloat(inputValue) || 0;
      setDiscountAmount(numValue);
    }
  };

  const handleDiscountBlur = (inputValue: string) => {
    const value = parseFloat(inputValue) || 0;
    setDiscountAmount(value);
    setDiscountInput('');
  };

  // Save handlers
  const handleSave = async (status: string = 'draft') => {
    if (!selectedSupplier) {
      toast.error('Please select a supplier');
      return;
    }
    if (!hasValidItems()) {
      toast.error('Please add at least one valid line item');
      return;
    }

    setLoading(true);
    try {
      const orderPayload = {
        po_number: poNumber,
        supplier: selectedSupplier.id,
        order_date: orderDate,
        expected_delivery_date: expectedDate || null,
        notes,
        supplier_notes: supplierNotes,
        tax_amount: taxAmount,
        discount_amount: discount,
        status,
      };

      const response = await purchaseOrdersAPI.createPurchaseOrder(orderPayload);
      const poId = response.data.id;

      const payloadLines = items
        .filter((line) => line.item_name?.trim())
        .map((line, index) => ({
          purchase_order: poId,
          line_number: index + 1,
          item: line.item_id ? Number(line.item_id) : null,
          item_name: line.item_name.trim(),
          description: '',
          quantity: line.quantity || 0,
          unit_of_measure: line.unit_of_measure || 'units',
          unit_price: line.unit_price || 0,
          tax_rate: 0,
          is_non_stock: line.is_non_stock || false,
        }));

      if (payloadLines.length > 0) {
        await Promise.all(
          payloadLines.map((payload) => api.post('/purchases/order-items/', payload)),
        );
      }

      await purchaseOrdersAPI.recalculatePurchaseOrder(poId);

      setIsSaved(true);
      navigationEnabledRef.current = false;

      sessionStorage.setItem('newlyPurchaseOrderId', String(poId));
      toast.success('Purchase order created successfully');

      setTimeout(() => {
        router.push(`/dashboard/inventory/purchase-orders/${poId}`);
      }, 100);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to create purchase order');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (shouldShowWarning()) {
      setPendingNavigation(() => () => {
        router.push('/dashboard/inventory/purchase-orders');
      });
      setShowConfirmDialog(true);
    } else {
      router.push('/dashboard/inventory/purchase-orders');
    }
  };

  // Global calendar hiding effect
  useEffect(() => {
    const hideAllCalendars = () => {
      const selectors = [
        '.datepicker-dropdown',
        '.datepicker-picker',
        '[data-datepicker]',
        '[role="dialog"]:has(.datepicker-picker)',
        '.popover:has(.datepicker-picker)',
        '.datepicker',
        '.datepicker-container',
        '.datepicker-calendar',
        '[class*="datepicker"]',
        '[class*="calendar"]',
      ];

      selectors.forEach((selector) => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach((element) => {
            (element as HTMLElement).style.display = 'none';
            (element as HTMLElement).style.visibility = 'hidden';
            (element as HTMLElement).style.opacity = '0';
            (element as HTMLElement).style.pointerEvents = 'none';
          });
        } catch {
          // Ignore invalid selectors
        }
      });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab' || event.key === 'Escape') {
        setTimeout(hideAllCalendars, 10);
      }
    };

    const handleFocusChange = () => {
      setTimeout(() => {
        const activeElement = document.activeElement;
        const isDatepickerElement = activeElement?.closest(
          '[class*="datepicker"], [class*="calendar"], [data-datepicker]',
        );

        if (!isDatepickerElement) {
          hideAllCalendars();
        }
      }, 50);
    };

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const isDatepickerElement = target.closest(
        '[class*="datepicker"], [class*="calendar"], [data-datepicker]',
      );

      if (!isDatepickerElement) {
        hideAllCalendars();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', handleFocusChange);
    document.addEventListener('click', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', handleFocusChange);
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  return (
    <DashboardLayout>
      <div className="p-2">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <Button color="gray" onClick={handleBack} className="flex items-center">
              <HiArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                New Purchase Order
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Inventory / Purchase Orders / New
              </p>
            </div>
          </div>

          {isFormValid() ? (
            <Dropdown
              label=""
              dismissOnClick={false}
              renderTrigger={() => (
                <button
                  type="button"
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-center text-white bg-teal-600 rounded-lg hover:bg-teal-700 focus:ring-4 focus:outline-none focus:ring-teal-300 dark:bg-teal-600 dark:hover:bg-teal-700 dark:focus:ring-teal-800"
                  disabled={loading}
                >
                  <span>{loading ? 'Saving...' : 'Save Purchase Order'}</span>
                  <HiChevronDown className="ml-2 h-4 w-4" />
                </button>
              )}
            >
              <Dropdown.Item onClick={() => handleSave('draft')}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                  />
                </svg>
                Save as Draft
              </Dropdown.Item>
              <Dropdown.Item onClick={() => handleSave('sent')}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
                Save & Mark as Sent
              </Dropdown.Item>
              <Dropdown.Item onClick={() => handleSave('draft')}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Save & Download PDF
              </Dropdown.Item>
              <Dropdown.Item onClick={() => handleSave('draft')}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                Save & Email
              </Dropdown.Item>
              <Dropdown.Item onClick={() => handleSave('draft')}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                  />
                </svg>
                Save & Print
              </Dropdown.Item>
            </Dropdown>
          ) : (
            <Button
              disabled={true}
              className="bg-gray-400 cursor-not-allowed"
              tabIndex={items.length * 5 + 15}
            >
              Save Purchase Order
            </Button>
          )}
        </div>

        <form className="space-y-4">
          {/* Main Form Card */}
          <Card className="p-4">
            <div className="grid grid-cols-12 gap-4">
              {/* Left Column - Supplier (40% width) */}
              <div className="col-span-12 lg:col-span-5 space-y-3">
                <div>
                  <TypeaheadInput
                    value={selectedSupplier}
                    onChange={setSelectedSupplier}
                    placeholder="Search suppliers..."
                    searchFunction={searchSuppliers}
                    getInitialOptions={getTopSuppliers}
                    label="Supplier *"
                    className="w-full"
                    tabIndex={1}
                  />
                </div>

                <div>
                  <Label htmlFor="terms">Payment Terms *</Label>
                  <StandardSelect
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                    tabIndex={2}
                  >
                    <option value="">Select payment terms</option>
                    <option value="Net 30">Net 30 Days</option>
                    <option value="Net 15">Net 15 Days</option>
                    <option value="Net 7">Net 7 Days</option>
                    <option value="Cash on Delivery">Cash on Delivery</option>
                    <option value="Advance Payment">Advance Payment</option>
                  </StandardSelect>
                </div>
              </div>

              {/* Right Column - PO fields (60% width, right-aligned) */}
              <div className="col-span-12 lg:col-span-7 space-y-3">
                <div className="ml-auto w-3/5 space-y-2">
                  <div className="flex items-center space-x-3">
                    <Label htmlFor="po_number" className="w-28 text-sm">
                      PO #: *
                    </Label>
                    <div className="flex-1">
                      <StandardTextInput
                        value={poNumber}
                        className="text-right"
                        readOnly
                        tabIndex={-1}
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Label htmlFor="order_date" className="w-28 text-sm">
                      Order Date: *
                    </Label>
                    <div className="flex-1">
                      <Datepicker
                        value={orderDate}
                        onSelectedDateChanged={(date) => {
                          const dateStr = date ? date.toISOString().split('T')[0] : '';
                          setOrderDate(dateStr);
                        }}
                        placeholder="Select order date"
                        autoHide={true}
                        language="en-GB"
                        weekStart={1}
                        tabIndex={-1}
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Label htmlFor="expected_date" className="w-28 text-sm">
                      Expected Date:
                    </Label>
                    <div className="flex-1">
                      <Datepicker
                        value={expectedDate}
                        onSelectedDateChanged={(date) => {
                          const dateStr = date ? date.toISOString().split('T')[0] : '';
                          setExpectedDate(dateStr);
                        }}
                        placeholder="Select expected date"
                        autoHide={true}
                        minDate={orderDate ? new Date(orderDate) : undefined}
                        language="en-GB"
                        weekStart={1}
                        tabIndex={-1}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Items Section */}
          <Card className="p-4 overflow-visible">
            <PurchaseOrderItemsTableV2
              items={items}
              onItemsChange={setItems}
              itemsLength={items.length}
              supplierId={selectedSupplier?.id ? Number(selectedSupplier.id) : null}
            />
          </Card>

          <Card className="p-4">
            <PurchaseOrderPrnPull purchaseOrderStatus="draft" />
          </Card>

          {/* Totals Section */}
          <Card className="p-4">
            <div className="max-w-md ml-auto space-y-4">
              <div className="flex justify-between items-center gap-8">
                <div className="flex items-center space-x-3 pl-2.5">
                  <input
                    type="checkbox"
                    id="show_subtotal"
                    checked={showSubtotal}
                    onChange={(e) => setShowSubtotal(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span className="text-sm font-medium">Subtotal:</span>
                </div>
                <span className="text-sm">
                  Rs. {subtotal.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between items-center gap-8">
                <div className="flex items-center space-x-3 pl-2.5">
                  <input
                    type="checkbox"
                    id="show_discount"
                    checked={showDiscount}
                    onChange={(e) => setShowDiscount(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span className="text-sm font-medium">Discount:</span>
                </div>
                <div className="w-32">
                  <StandardTextInput
                    value={getDiscountDisplayValue()}
                    type="text"
                    placeholder="0.00"
                    className="text-right h-10"
                    style={{ textAlign: 'right' }}
                    tabIndex={items.length * 5 + 10}
                    disabled={!showDiscount}
                    onChange={(e) => handleDiscountChange(e.target.value)}
                    onBlur={(e) => handleDiscountBlur(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-between items-center gap-8">
                <div className="flex items-center space-x-3 pl-2.5">
                  <input
                    type="checkbox"
                    id="show_vat"
                    checked={showVat}
                    onChange={(e) => setShowVat(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span className="text-sm font-medium">{`VAT ${DEFAULT_VAT_RATE}%:`}</span>
                </div>
                <div className="w-32">
                  <StandardTextInput
                    value={taxAmount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                    type="text"
                    className="text-right h-10"
                    style={{ textAlign: 'right' }}
                    tabIndex={items.length * 5 + 11}
                    readOnly
                  />
                </div>
              </div>

              <div className="flex justify-between items-center gap-8">
                <span className="text-sm font-medium pl-2.5">Tax Amount:</span>
                <span className="text-sm">
                  Rs. {taxAmount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="border-t pt-3">
                <div className="flex justify-between items-center gap-8">
                  <span className="text-sm font-semibold pl-2.5">Grand Total:</span>
                  <span className={`text-sm font-semibold ${!showSubtotal ? 'text-gray-400' : ''}`}>
                    Rs. {total.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Notes Section */}
          <Card className="p-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="supplier_notes">Supplier Notes (Visible on PO)</Label>
                <AutoExpandingTextarea
                  value={supplierNotes}
                  onChange={setSupplierNotes}
                  placeholder="Notes visible to supplier..."
                  minRows={1}
                  maxRows={6}
                  id="supplier_notes"
                  name="supplier_notes"
                  tabIndex={items.length * 5 + 12}
                  enableBulletPoints={true}
                />
              </div>

              <div>
                <Label htmlFor="notes">Internal Notes</Label>
                <AutoExpandingTextarea
                  value={notes}
                  onChange={setNotes}
                  placeholder="Internal notes (not visible to supplier)..."
                  minRows={1}
                  maxRows={6}
                  id="notes"
                  name="notes"
                  tabIndex={items.length * 5 + 13}
                  enableBulletPoints={true}
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end mt-4">
              <Button
                onClick={() => handleSave('draft')}
                disabled={loading || !isFormValid()}
                className={`${isFormValid() ? 'bg-teal-600 hover:bg-teal-700' : 'bg-gray-400 cursor-not-allowed'}`}
                tabIndex={items.length * 5 + 14}
              >
                {loading ? 'Saving...' : 'Save Purchase Order'}
              </Button>
            </div>
          </Card>
        </form>
      </div>

      {/* Navigation Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showConfirmDialog}
        message={getWarningMessage()}
        confirmLabel="Yes, Leave"
        cancelLabel="No, Stay"
        onConfirm={handleConfirmNavigation}
        onCancel={handleCancelNavigation}
      />
    </DashboardLayout>
  );
}

// Wrapper with Suspense boundary
export default function NewPurchaseOrderPageWrapper() {
  return (
    <Suspense fallback={<div className="p-4">Loading...</div>}>
      <NewPurchaseOrderPage />
    </Suspense>
  );
}
