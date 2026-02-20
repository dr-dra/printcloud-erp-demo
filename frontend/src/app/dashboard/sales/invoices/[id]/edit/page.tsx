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
import { invoicesAPI } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { getErrorMessage } from '@/utils/errorHandling';
import TypeaheadInput from '@/components/common/TypeaheadInput';
import CustomerModal from '@/components/common/CustomerModal';
import QuotationItemsTable from '@/components/quotations/QuotationItemsTable';
import AutoExpandingTextarea from '@/components/common/AutoExpandingTextarea';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { api } from '@/lib/api';
import { useInvoiceDetail } from '@/hooks/useInvoiceDetail';

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

interface InvoiceFormData {
  customer: number | null;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  po_so_number: string;
  notes?: string;
  customer_notes?: string;
  items?: InvoiceItem[];
}

interface InvoiceItem {
  id?: string;
  item_id?: number;
  item?: string;
  description: string;
  quantity: number;
  unit_price: number;
  price: number;
}

export default function EditInvoicePage() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = params.id as string;
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<InvoiceItem[]>([]);
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

  // Load invoice data
  const {
    invoice,
    loading: invoiceLoading,
    error: invoiceError,
  } = useInvoiceDetail(invoiceId, isAuthenticated);

  const invoiceTypeLabel =
    invoice?.invoice_type_display ||
    (invoice?.invoice_type === 'tax_invoice' ? 'Tax Invoice' : 'Proforma Invoice');

  // Form setup
  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<InvoiceFormData>({
    defaultValues: {
      customer: null,
      invoice_number: '',
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      po_so_number: '',
      notes: '',
      customer_notes: '',
      items: [],
    },
  });

  // Load invoice data into form
  useEffect(() => {
    if (invoice) {
      // Set form values
      reset({
        customer: invoice.customer_detail?.id || null,
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date,
        due_date: invoice.due_date || '',
        po_so_number: invoice.po_so_number || '',
        notes: invoice.notes || '',
        customer_notes: invoice.customer_notes || '',
      });

      // Set customer
      if (invoice.customer_detail) {
        setSelectedCustomer({
          id: invoice.customer_detail.id,
          name: invoice.customer_detail.name,
          secondary: invoice.customer_detail.email || invoice.customer_detail.phone || '',
        });
      }

      // Set items
      if (invoice.items && invoice.items.length > 0) {
        const invoiceItems = invoice.items.map((item: any, index: number) => ({
          id: `item-${index}`,
          item_id: index + 1,
          item: item.item_name,
          description: item.description || '',
          quantity: parseFloat(item.quantity as string) || 0,
          unit_price: parseFloat(item.unit_price as string) || 0,
          price: parseFloat(item.amount as string) || 0,
        }));
        setItems(invoiceItems);
      }

      // Set pricing
      setDiscountInput(invoice.discount?.toString() || '0');
      setDeliveryChargeInput(invoice.delivery_charge?.toString() || '0');
      const vatRate =
        typeof (invoice as any).vat_rate === 'number'
          ? (invoice as any).vat_rate
          : parseFloat(String((invoice as any).vat_rate ?? '0'));
      const vatPercent = (Number.isFinite(vatRate) ? vatRate : 0) * 100;
      setVatRateInput(vatPercent.toString());
    }
  }, [invoice, reset]);

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
    const invoiceNumber = watch('invoice_number') || '';
    return `Do you want to leave the page without saving changes to Invoice [${invoiceNumber}]?`;
  };

  // Intercept all link clicks
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!shouldShowWarning()) return;

      const target = e.target as HTMLElement;
      const link = target.closest('a');

      if (link && link.href && !link.href.includes(`/dashboard/sales/invoices/${invoiceId}/edit`)) {
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
  }, [isSaved, items.length, invoiceId, watch]);

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
        item.item && // Item has a name
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
  const onSubmit = async (data: InvoiceFormData) => {
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

      const invoiceData = {
        ...data,
        subtotal: subtotal,
        discount: discount,
        delivery_charge: deliveryCharge,
        vat_rate: vatRatePercent / 100,
        tax_amount: vatAmount,
        net_total: total,
        items: items.map((item) => ({
          item_name: item.item,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.price,
        })),
      };

      await invoicesAPI.updateInvoice(parseInt(invoiceId), invoiceData);

      // Mark as saved to prevent warning
      setIsSaved(true);

      // Disable navigation warnings before redirect
      navigationEnabledRef.current = false;

      toast.success('Invoice updated successfully');

      // Small delay before redirect
      setTimeout(() => {
        router.push(`/dashboard/sales/invoices/${invoiceId}`);
      }, 100);
    } catch (error) {
      const errorMessage = getErrorMessage(error as any);
      toast.error(`Failed to update invoice: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (shouldShowWarning()) {
      setPendingNavigation(() => () => {
        router.push(`/dashboard/sales/invoices/${invoiceId}`);
      });

      setShowConfirmDialog(true);
    } else {
      router.push(`/dashboard/sales/invoices/${invoiceId}`);
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
  if (invoiceLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading invoice...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Show error state
  if (invoiceError || !invoice) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p className="text-red-600">{invoiceError || 'Invoice not found'}</p>
            <Button onClick={() => router.push('/dashboard/sales/invoices')} className="mt-4">
              Back to Invoices
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
                Edit Invoice: {invoice.invoice_number}
                {invoiceTypeLabel && (
                  <span className="ml-2 text-sm font-medium text-gray-500">
                    ({invoiceTypeLabel})
                  </span>
                )}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Sales / Invoices / Edit Invoice
              </p>
            </div>
          </div>

          <Button
            onClick={handleSubmit(onSubmit)}
            disabled={loading || !isFormValid()}
            className={`${isFormValid() ? 'bg-teal-600 hover:bg-teal-700' : 'bg-gray-400 cursor-not-allowed'}`}
          >
            {loading ? 'Saving...' : 'Update Invoice'}
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

              {/* Right Column - Invoice fields (60% width, right-aligned) */}
              <div className="col-span-12 lg:col-span-7 space-y-3">
                <div className="ml-auto w-3/5 space-y-2">
                  <div className="flex items-center space-x-3">
                    <Label htmlFor="invoice_number" className="w-24 text-sm">
                      Invoice #: *
                    </Label>
                    <div className="flex-1">
                      <Controller
                        name="invoice_number"
                        control={control}
                        render={({ field }) => (
                          <StandardTextInput
                            {...field}
                            color={errors.invoice_number ? 'failure' : 'gray'}
                            helperText={errors.invoice_number?.message}
                            className="text-right"
                            readOnly
                            tabIndex={-1}
                          />
                        )}
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Label htmlFor="invoice_date" className="w-24 text-sm">
                      Invoice Date: *
                    </Label>
                    <div className="flex-1">
                      <Controller
                        name="invoice_date"
                        control={control}
                        render={({ field }) => (
                          <div>
                            <Datepicker
                              value={field.value || ''}
                              onSelectedDateChanged={(date) => {
                                const dateStr = date ? date.toISOString().split('T')[0] : '';
                                field.onChange(dateStr);
                              }}
                              placeholder="Select invoice date"
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
                    <Label htmlFor="due_date" className="w-24 text-sm">
                      Due Date: *
                    </Label>
                    <div className="flex-1">
                      <Controller
                        name="due_date"
                        control={control}
                        render={({ field }) => (
                          <div>
                            <Datepicker
                              value={field.value || ''}
                              onSelectedDateChanged={(date) => {
                                const dateStr = date ? date.toISOString().split('T')[0] : '';
                                field.onChange(dateStr);
                              }}
                              placeholder="Select due date"
                              autoHide={true}
                              minDate={
                                watch('invoice_date') ? new Date(watch('invoice_date')) : undefined
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
                <Label htmlFor="customer_notes">Customer Notes</Label>
                <Controller
                  name="customer_notes"
                  control={control}
                  render={({ field }) => (
                    <AutoExpandingTextarea
                      value={field.value || ''}
                      onChange={field.onChange}
                      placeholder="Customer-visible notes..."
                      minRows={1}
                      maxRows={6}
                      id="customer_notes"
                      name="customer_notes"
                      tabIndex={items.length * 4 + 12}
                      enableBulletPoints={true}
                    />
                  )}
                />
              </div>

              <div>
                <Label htmlFor="notes">Internal Notes</Label>
                <Controller
                  name="notes"
                  control={control}
                  render={({ field }) => (
                    <AutoExpandingTextarea
                      value={field.value || ''}
                      onChange={field.onChange}
                      placeholder="Internal notes (not visible to customer)..."
                      minRows={1}
                      maxRows={6}
                      id="notes"
                      name="notes"
                      tabIndex={items.length * 4 + 13}
                      enableBulletPoints={true}
                    />
                  )}
                />
              </div>
            </div>

            {/* Bottom Save Button */}
            <div className="flex justify-end mt-4">
              <Button
                onClick={handleSubmit(onSubmit)}
                disabled={loading || !isFormValid()}
                className={`${isFormValid() ? 'bg-teal-600 hover:bg-teal-700' : 'bg-gray-400 cursor-not-allowed'}`}
                tabIndex={items.length * 4 + 14}
              >
                {loading ? 'Saving...' : 'Update Invoice'}
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
