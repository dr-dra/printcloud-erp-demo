'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button, Card, Label, Datepicker } from 'flowbite-react';
import { StandardTextInput } from '@/components/common/inputs';
import { HiArrowLeft } from 'react-icons/hi';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'sonner';

import DashboardLayout from '@/components/DashboardLayout';
import { ordersAPI } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { getErrorMessage } from '@/utils/errorHandling';
import TypeaheadInput from '@/components/common/TypeaheadInput';
import CustomerModal from '@/components/common/CustomerModal';
import QuotationItemsTable from '@/components/quotations/QuotationItemsTable';
import AutoExpandingTextarea from '@/components/common/AutoExpandingTextarea';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { api } from '@/lib/api';
import { useOrderDetail } from '@/hooks/useOrderDetail';

// Types
interface Customer {
  id: number;
  name: string;
  email?: string;
  contact?: string;
}

interface AutocompleteOption {
  id: number | string;
  name: string;
  secondary?: string;
}

interface OrderFormData {
  customer: number | null;
  order_number: string;
  order_date: string;
  required_date: string;
  po_so_number: string;
  notes?: string;
  private_notes?: string;
  items?: OrderItem[];
}

interface OrderItem {
  id?: string;
  item_id?: number;
  item?: string;
  description: string;
  quantity: number;
  unit_price: number;
  price: number;
  finished_product_id?: number;
}

export default function EditOrderPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [isSaved, setIsSaved] = useState(false);

  // Navigation warning state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const isPageLoadedRef = useRef(false);
  const navigationEnabledRef = useRef(false);

  // Customer modal and selection state
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<AutocompleteOption | null>(null);
  const [discountInput, setDiscountInput] = useState<string>('');
  const [deliveryChargeInput, setDeliveryChargeInput] = useState<string>('');
  const [vatRateInput, setVatRateInput] = useState<string>('0');

  // Load order data
  const {
    order,
    loading: orderLoading,
    error: orderError,
  } = useOrderDetail(orderId, isAuthenticated);

  // Form setup
  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<OrderFormData>({
    defaultValues: {
      customer: null,
      order_number: '',
      order_date: new Date().toISOString().split('T')[0],
      required_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      po_so_number: '',
      notes: '',
      private_notes: '',
      items: [],
    },
  });

  // Load order data into form
  useEffect(() => {
    if (order) {
      // Set form values
      reset({
        customer: order.customer?.id || null,
        order_number: order.order_number,
        order_date: order.order_date,
        required_date: order.required_date || '',
        po_so_number: order.po_so_number || '',
        notes: order.notes || '',
        private_notes: order.private_notes || '',
      });

      // Set customer
      if (order.customer) {
        setSelectedCustomer({
          id: order.customer.id,
          name: order.customer.name,
          secondary: order.customer.email || order.customer.contact || '',
        });
      }

      // Set items
      if (order.items && order.items.length > 0) {
        const orderItems = order.items.map((item: any) => ({
          id: `item-${item.id}`,
          item_id: item.finished_product_id || item.id,
          item: item.item_name,
          description: item.description || '',
          quantity: parseFloat(item.quantity) || 0,
          unit_price: parseFloat(item.unit_price) || 0,
          price: parseFloat(item.amount) || 0,
          finished_product_id: item.finished_product_id,
        }));
        setItems(orderItems);
      }

      // Set pricing
      setDiscountInput(order.discount?.toString() || '0');
      setDeliveryChargeInput(order.delivery_charge?.toString() || '0');
      const vatRate =
        typeof (order as any).vat_rate === 'number'
          ? (order as any).vat_rate
          : parseFloat(String((order as any).vat_rate ?? '0'));
      const vatPercent = (Number.isFinite(vatRate) ? vatRate : 0) * 100;
      setVatRateInput(vatPercent.toString());
    }
  }, [order, reset]);

  // Sync items state with form
  useEffect(() => {
    setValue('items', items);
  }, [items, setValue]);

  // Warn user before leaving page without saving (browser refresh/close only)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (navigationEnabledRef.current && !isSaved && items.length > 0) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isSaved, items.length]);

  // Enable navigation warnings after page loads (with delay to prevent false triggers)
  useEffect(() => {
    const timer = setTimeout(() => {
      isPageLoadedRef.current = true;
      if (items.length > 0) {
        navigationEnabledRef.current = true;
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [items.length]);

  // Function to check if navigation warning should be shown
  const shouldShowWarning = () => {
    return navigationEnabledRef.current && !isSaved && items.length > 0 && isPageLoadedRef.current;
  };

  // Get warning message
  const getWarningMessage = () => {
    const orderNumber = watch('order_number') || '';
    return `Do you want to leave the page without saving changes to Order [${orderNumber}]?`;
  };

  // Intercept all link clicks
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!shouldShowWarning()) return;

      const target = e.target as HTMLElement;
      const link = target.closest('a');

      if (link && link.href && !link.href.includes(`/dashboard/sales/orders/${orderId}/edit`)) {
        e.preventDefault();
        e.stopPropagation();

        setPendingNavigation(() => () => {
          window.location.href = link.href;
        });

        setShowConfirmDialog(true);
      }
    };

    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('click', handleClick, true);
    };
  }, [isSaved, items.length, orderId, watch]);

  // Intercept browser back/forward buttons
  useEffect(() => {
    const handlePopState = (_event: PopStateEvent) => {
      if (!shouldShowWarning()) return;

      window.history.pushState(null, '', window.location.href);

      setPendingNavigation(() => () => {
        window.history.back();
      });

      setShowConfirmDialog(true);
    };

    window.history.pushState(null, '', window.location.href);

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isSaved, items.length]);

  // Handle confirmation dialog actions
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

  // Calculate totals
  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + (item.price || 0), 0);
    const discount = parseFloat(discountInput) || 0;
    const deliveryCharge = parseFloat(deliveryChargeInput) || 0;
    const vatRatePercent = Math.max(0, parseFloat(vatRateInput) || 0);
    const vatAmount = (subtotal - discount + deliveryCharge) * (vatRatePercent / 100);
    const total = subtotal - discount + deliveryCharge + vatAmount;
    return { subtotal, discount, deliveryCharge, vatRatePercent, vatAmount, total };
  };

  const { subtotal, discount, deliveryCharge, vatRatePercent, vatAmount, total } =
    calculateTotals();

  // Validation functions
  const hasValidItems = () => {
    return items.some(
      (item) =>
        item.item_id && // Item is selected
        item.description.trim() !== '' && // Has description
        item.quantity > 0 && // Has valid quantity
        item.unit_price > 0, // Has valid unit price
    );
  };

  const isCustomerSelected = () => {
    return selectedCustomer !== null && watch('customer') !== null;
  };

  const isFormValid = () => {
    return hasValidItems() && isCustomerSelected();
  };

  // Handle form submission
  const onSubmit = async (data: OrderFormData) => {
    if (!isAuthenticated) return;

    // Basic validation
    if (!data.customer) {
      toast.error('Please select a customer');
      return;
    }
    if (items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    try {
      setLoading(true);

      const orderData = {
        ...data,
        subtotal: subtotal,
        discount: discount,
        delivery_charge: deliveryCharge,
        vat_rate: vatRatePercent / 100,
        vat_amount: vatAmount,
        net_total: total,
        items: items.map((item) => ({
          item_id: item.item_id,
          item: item.item,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.price,
          finished_product_id: item.finished_product_id || null,
        })),
      };

      await ordersAPI.updateOrder(parseInt(orderId), orderData);

      // Mark as saved to prevent warning
      setIsSaved(true);

      // Disable navigation warnings before redirect
      navigationEnabledRef.current = false;

      // Store the updated order ID for highlighting on the list page
      sessionStorage.setItem('updatedOrderId', orderId.toString());

      toast.success('Order updated successfully');

      // Use a small delay before redirect to ensure state updates complete
      setTimeout(() => {
        router.push('/dashboard/sales/orders');
      }, 100);
    } catch (error) {
      const errorMessage = getErrorMessage(error as any);
      toast.error(`Failed to update order: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (shouldShowWarning()) {
      setPendingNavigation(() => () => {
        router.push(`/dashboard/sales/orders/${orderId}`);
      });

      setShowConfirmDialog(true);
    } else {
      router.push(`/dashboard/sales/orders/${orderId}`);
    }
  };

  // Customer search function for TypeaheadInput
  const searchCustomers = async (query: string) => {
    try {
      const response = await api.get(`/customers/?search=${encodeURIComponent(query)}`);
      return response.data.results.map((customer: Customer) => ({
        id: customer.id,
        name: customer.name,
        secondary: customer.email || customer.contact || '',
      }));
    } catch (error) {
      console.error('Error searching customers:', error);
      return [];
    }
  };

  const getTopCustomers = async () => {
    try {
      const response = await api.get(`/customers/?limit=5`);
      return response.data.results.map((customer: Customer) => ({
        id: customer.id,
        name: customer.name,
        secondary: customer.email || customer.contact || '',
      }));
    } catch (error) {
      console.error('Error getting top customers:', error);
      return [];
    }
  };

  // Handle customer selection
  const handleCustomerChange = (customer: AutocompleteOption | null) => {
    setSelectedCustomer(customer);
    setValue('customer', customer ? Number(customer.id) : null);
  };

  // Handle add new customer
  const handleAddNewCustomer = () => {
    setShowCustomerModal(true);
  };

  // Handle customer creation
  const handleCustomerCreated = (customer: any) => {
    const customerOption = {
      id: customer.id,
      name: customer.name,
      secondary: customer.email || customer.contact || '',
    };

    setSelectedCustomer(customerOption);
    setValue('customer', customer.id);

    setShowCustomerModal(false);
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

  // Show loading state
  if (orderLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading order...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Show error state
  if (orderError || !order) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p className="text-red-600">{orderError || 'Order not found'}</p>
            <Button onClick={() => router.push('/dashboard/sales/orders')} className="mt-4">
              Back to Orders
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

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
                Edit Order: {order.order_number}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Sales / Orders / Edit Order
              </p>
            </div>
          </div>

          <Button
            onClick={handleSubmit(onSubmit)}
            disabled={loading || !isFormValid()}
            className={`${isFormValid() ? 'bg-teal-600 hover:bg-teal-700' : 'bg-gray-400 cursor-not-allowed'}`}
          >
            {loading ? 'Saving...' : 'Update Order'}
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Main Form Card */}
          <Card className="p-4">
            <div className="grid grid-cols-12 gap-4">
              {/* Left Column - Customer (40% width, left-aligned) */}
              <div className="col-span-12 lg:col-span-5 space-y-3">
                <div>
                  <TypeaheadInput
                    value={selectedCustomer}
                    onChange={handleCustomerChange}
                    placeholder="Search customers..."
                    searchFunction={searchCustomers}
                    getInitialOptions={getTopCustomers}
                    label="Customer *"
                    onAddNew={handleAddNewCustomer}
                    addNewLabel="Add Customer"
                    className="w-full"
                    tabIndex={1}
                  />
                  {errors.customer && (
                    <p className="mt-1 text-sm text-red-600">{errors.customer.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="po_so_number">PO/SO Number</Label>
                  <Controller
                    name="po_so_number"
                    control={control}
                    render={({ field }) => (
                      <StandardTextInput {...field} placeholder="Enter PO/SO number" tabIndex={2} />
                    )}
                  />
                </div>
              </div>

              {/* Right Column - Order fields (60% width, right-aligned) */}
              <div className="col-span-12 lg:col-span-7 space-y-3">
                <div className="ml-auto w-3/5 space-y-2">
                  <div className="flex items-center space-x-3">
                    <Label htmlFor="order_number" className="w-24 text-sm">
                      Order #: *
                    </Label>
                    <div className="flex-1">
                      <Controller
                        name="order_number"
                        control={control}
                        render={({ field }) => (
                          <StandardTextInput
                            {...field}
                            color={errors.order_number ? 'failure' : 'gray'}
                            helperText={errors.order_number?.message}
                            className="text-right"
                            readOnly
                            tabIndex={-1}
                          />
                        )}
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Label htmlFor="order_date" className="w-24 text-sm">
                      Order Date: *
                    </Label>
                    <div className="flex-1">
                      <Controller
                        name="order_date"
                        control={control}
                        render={({ field }) => (
                          <div>
                            <Datepicker
                              value={field.value || ''}
                              onSelectedDateChanged={(date) => {
                                const dateStr = date ? date.toISOString().split('T')[0] : '';
                                field.onChange(dateStr);
                              }}
                              placeholder="Select order date"
                              autoHide={true}
                              language="en-GB"
                              weekStart={1}
                              tabIndex={-1}
                            />
                          </div>
                        )}
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Label htmlFor="required_date" className="w-24 text-sm">
                      Required: *
                    </Label>
                    <div className="flex-1">
                      <Controller
                        name="required_date"
                        control={control}
                        render={({ field }) => (
                          <div>
                            <Datepicker
                              value={field.value || ''}
                              onSelectedDateChanged={(date) => {
                                const dateStr = date ? date.toISOString().split('T')[0] : '';
                                field.onChange(dateStr);
                              }}
                              placeholder="Select required date"
                              autoHide={true}
                              minDate={
                                watch('order_date') ? new Date(watch('order_date')) : undefined
                              }
                              language="en-GB"
                              weekStart={1}
                              tabIndex={-1}
                            />
                          </div>
                        )}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Items Section */}
          <Card className="p-4">
            <QuotationItemsTable
              items={items}
              onItemsChange={setItems}
              itemsLength={items.length}
            />

            {errors.items && <p className="mt-2 text-sm text-red-600">{errors.items.message}</p>}
          </Card>

          {/* Totals Section */}
          <Card className="p-4">
            <div className="max-w-md ml-auto space-y-4">
              <div className="flex justify-between items-center gap-8">
                <span className="text-sm font-medium pl-2.5">Subtotal:</span>
                <span className="text-sm">
                  Rs. {subtotal.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between items-center gap-8">
                <span className="text-sm font-medium pl-2.5">Discount:</span>
                <div className="w-32">
                  <StandardTextInput
                    value={discountInput}
                    type="text"
                    placeholder="0.00"
                    className="text-right h-10"
                    style={{ textAlign: 'right' }}
                    tabIndex={items.length * 4 + 9}
                    onChange={(e) => setDiscountInput(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-between items-center gap-8">
                <span className="text-sm font-medium pl-2.5">Delivery Charges:</span>
                <div className="w-32">
                  <StandardTextInput
                    value={deliveryChargeInput}
                    type="text"
                    placeholder="0.00"
                    className="text-right h-10"
                    style={{ textAlign: 'right' }}
                    tabIndex={items.length * 4 + 10}
                    onChange={(e) => setDeliveryChargeInput(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-between items-center gap-8">
                <span className="text-sm font-medium pl-2.5">VAT %:</span>
                <div className="w-32">
                  <StandardTextInput
                    value={vatRateInput}
                    type="text"
                    placeholder="0"
                    className="text-right h-10"
                    style={{ textAlign: 'right' }}
                    tabIndex={items.length * 4 + 11}
                    onChange={(e) => setVatRateInput(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-between items-center gap-8">
                <span className="text-sm font-medium pl-2.5">VAT Amount:</span>
                <span className="text-sm">
                  Rs. {vatAmount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="border-t pt-3">
                <div className="flex justify-between items-center gap-8">
                  <span className="text-sm font-semibold pl-2.5">Net Total:</span>
                  <span className="text-sm font-semibold">
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
                <Label htmlFor="notes">Notes</Label>
                <Controller
                  name="notes"
                  control={control}
                  render={({ field }) => (
                    <AutoExpandingTextarea
                      value={field.value || ''}
                      onChange={field.onChange}
                      placeholder="Customer-visible notes..."
                      minRows={1}
                      maxRows={6}
                      id="notes"
                      name="notes"
                      tabIndex={items.length * 4 + 11}
                      enableBulletPoints={true}
                    />
                  )}
                />
              </div>

              <div>
                <Label htmlFor="private_notes">Private Notes</Label>
                <Controller
                  name="private_notes"
                  control={control}
                  render={({ field }) => (
                    <AutoExpandingTextarea
                      value={field.value || ''}
                      onChange={field.onChange}
                      placeholder="Internal notes (not visible to customer)..."
                      minRows={1}
                      maxRows={6}
                      id="private_notes"
                      name="private_notes"
                      tabIndex={items.length * 4 + 12}
                      enableBulletPoints={true}
                    />
                  )}
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <Button
                onClick={handleSubmit(onSubmit)}
                disabled={loading || !isFormValid()}
                className={`${isFormValid() ? 'bg-teal-600 hover:bg-teal-700' : 'bg-gray-400 cursor-not-allowed'}`}
                tabIndex={items.length * 4 + 13}
              >
                {loading ? 'Saving...' : 'Update Order'}
              </Button>
            </div>
          </Card>
        </form>
      </div>

      {/* Customer Modal */}
      <CustomerModal
        isOpen={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        onCustomerCreated={handleCustomerCreated}
      />

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
