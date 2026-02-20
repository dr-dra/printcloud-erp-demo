'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button, Card, Label, Datepicker, Dropdown, Spinner } from 'flowbite-react';
import { StandardTextInput, StandardSelect } from '@/components/common/inputs';
import { HiArrowLeft, HiChevronDown } from 'react-icons/hi';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'sonner';

import DashboardLayout from '@/components/DashboardLayout';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { getErrorMessage } from '@/utils/errorHandling';
import TypeaheadInput from '@/components/common/TypeaheadInput';
import CustomerModal from '@/components/common/CustomerModal';
import QuotationItemsTable from '@/components/quotations/QuotationItemsTable';
import AutoExpandingTextarea from '@/components/common/AutoExpandingTextarea';
import ErrorBanner from '@/components/common/ErrorBanner';
import type { SalesQuotation } from '@/types/quotations';

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

interface QuotationFormData {
  customer: number | null;
  terms: string;
  quot_number: string;
  date: string;
  required_date: string;
  delivery_charge: number;
  notes?: string;
  private_notes?: string;
  items?: QuotationItem[];
  show_subtotal?: boolean;
  show_delivery_charges?: boolean;
}

interface FinishedProduct {
  id: number;
  name: string;
  category_name: string;
  dimensions_display: string;
  description: string;
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
}

export default function EditQuotationPage() {
  const router = useRouter();
  const params = useParams();
  const quotationId = params.id as string;
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<QuotationItem[]>([]);

  // Customer modal and selection state
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<AutocompleteOption | null>(null);
  const [showSubtotal, setShowSubtotal] = useState(true);
  const [showDeliveryCharges, setShowDeliveryCharges] = useState(true);

  // Track original state for change detection
  const [originalFormData, setOriginalFormData] = useState<QuotationFormData | null>(null);
  const [originalItems, setOriginalItems] = useState<QuotationItem[]>([]);
  const [originalShowSubtotal, setOriginalShowSubtotal] = useState(true);
  const [originalShowDeliveryCharges, setOriginalShowDeliveryCharges] = useState(true);

  // Form setup
  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<QuotationFormData>({
    // resolver: yupResolver(quotationSchema),
    defaultValues: {
      customer: null,
      terms: 'Advance Payment',
      quot_number: '',
      date: new Date().toISOString().split('T')[0],
      required_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      delivery_charge: 0.0,
      notes: '',
      private_notes: '',
      items: [],
    },
  });

  // Load existing quotation data
  useEffect(() => {
    const fetchQuotation = async () => {
      if (!isAuthenticated || !quotationId) return;

      try {
        setInitialLoading(true);
        setError(null);

        const response = await api.get<SalesQuotation>(`/sales/quotations/${quotationId}/`);
        const quotation = response.data;

        // Transform quotation data to form format
        const formData: QuotationFormData = {
          customer: quotation.customer?.id || null,
          terms: quotation.terms || 'Advance Payment',
          quot_number: quotation.quot_number,
          date: quotation.date || new Date().toISOString().split('T')[0],
          required_date:
            quotation.required_date ||
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          delivery_charge: quotation.delivery_charge || 0,
          notes: quotation.notes || '',
          private_notes: quotation.private_notes || '',
          items: [],
        };

        // Set customer selection
        if (quotation.customer) {
          setSelectedCustomer({
            id: quotation.customer.id,
            name: quotation.customer.name,
            secondary: quotation.customer.email || quotation.customer.contact || '',
          });
        }

        // Transform items
        const transformedItems: QuotationItem[] =
          quotation.items?.map((item, index) => ({
            id: `existing-${item.id || index}`,
            // Support both new finished_product structure and legacy item structure
            finished_product_id: item.finished_product || item.item_id,
            finished_product: item.finished_product
              ? {
                  id: item.finished_product,
                  name: item.finished_product_name || item.item || '',
                  category_name: item.finished_product_category || '',
                  dimensions_display: item.finished_product_dimensions || '',
                  description: item.description || '',
                }
              : undefined,
            // Legacy fields for backward compatibility
            item_id: item.item_id,
            item: item.item || item.finished_product_name || '',
            description: item.description || '',
            quantity: Number(item.quantity) || 0,
            unit_price: Number(item.unit_price) || 0,
            price: Number(item.price) || 0,
          })) || [];

        setItems(transformedItems);

        // Set display preferences
        const subtotalPref = quotation.show_subtotal !== false;
        const deliveryChargesPref = quotation.show_delivery_charges !== false;
        setShowSubtotal(subtotalPref);
        setShowDeliveryCharges(deliveryChargesPref);

        // Store original data for change detection
        setOriginalFormData(formData);
        setOriginalItems([...transformedItems]);
        setOriginalShowSubtotal(subtotalPref);
        setOriginalShowDeliveryCharges(deliveryChargesPref);

        // Reset form with the loaded data
        reset(formData);
      } catch (err) {
        const errorMessage = getErrorMessage(err as any);
        setError(errorMessage);
        console.error('Error fetching quotation:', err);
      } finally {
        setInitialLoading(false);
      }
    };

    fetchQuotation();
  }, [isAuthenticated, quotationId, reset]);

  // Sync items state with form
  useEffect(() => {
    setValue('items', items);
  }, [items, setValue]);

  // Calculate totals
  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => {
      const price = Number(item.price) || 0;
      return sum + price;
    }, 0);
    const deliveryCharge = Number(watch('delivery_charge')) || 0;
    const total = subtotal + deliveryCharge;
    return { subtotal, deliveryCharge, total };
  };

  const { subtotal, total } = calculateTotals();

  // Validation functions
  const hasValidItems = () => {
    return items.some(
      (item) =>
        (item.finished_product_id || item.item_id) && // Item is selected (either new or legacy)
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

  // Check if any changes have been made
  const hasChanges = () => {
    if (!originalFormData) return false;

    const currentFormData = watch();

    // Check form field changes
    const formChanged =
      currentFormData.customer !== originalFormData.customer ||
      currentFormData.terms !== originalFormData.terms ||
      currentFormData.date !== originalFormData.date ||
      currentFormData.required_date !== originalFormData.required_date ||
      Number(currentFormData.delivery_charge) !== Number(originalFormData.delivery_charge) ||
      currentFormData.notes !== originalFormData.notes ||
      currentFormData.private_notes !== originalFormData.private_notes;

    // Check display preferences changes
    const preferencesChanged =
      showSubtotal !== originalShowSubtotal || showDeliveryCharges !== originalShowDeliveryCharges;

    // Check items changes
    const itemsChanged = () => {
      if (items.length !== originalItems.length) return true;

      return items.some((item, index) => {
        const originalItem = originalItems[index];
        if (!originalItem) return true;

        return (
          item.finished_product_id !== originalItem.finished_product_id ||
          item.item_id !== originalItem.item_id ||
          item.item !== originalItem.item ||
          item.description !== originalItem.description ||
          Number(item.quantity) !== Number(originalItem.quantity) ||
          Number(item.unit_price) !== Number(originalItem.unit_price) ||
          Number(item.price) !== Number(originalItem.price)
        );
      });
    };

    return formChanged || preferencesChanged || itemsChanged();
  };

  // Handle form submission
  const onSubmit = async (data: QuotationFormData) => {
    if (!isAuthenticated) return;

    // Basic validation
    if (!data.customer) {
      toast.error('Please select a customer');
      return;
    }
    if (!data.terms) {
      toast.error('Please select payment terms');
      return;
    }
    if (items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    try {
      setLoading(true);

      const quotationData = {
        ...data,
        show_subtotal: showSubtotal,
        show_delivery_charges: showDeliveryCharges,
        items: items.map((item) => ({
          finished_product: item.finished_product_id,
          item_id: item.item_id, // Legacy field
          item: item.item, // Legacy field
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          price: item.price,
        })),
      };

      const response = await api.patch(`/sales/quotations/${quotationId}/edit/`, quotationData);

      // Store updated quotation ID in sessionStorage for highlighting
      if (response.data?.id) {
        sessionStorage.setItem('updatedQuotationId', response.data.id.toString());
      }

      toast.success('Quotation updated successfully');
      router.push('/dashboard/sales/quotations');
    } catch (error) {
      const errorMessage = getErrorMessage(error as any);
      toast.error(`Failed to update quotation: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    router.push('/dashboard/sales/quotations');
  };

  // Customer search function for AutocompleteInput
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
    // Convert the created customer to AutocompleteOption format
    const customerOption = {
      id: customer.id,
      name: customer.name,
      secondary: customer.email || customer.contact || '',
    };

    // Set the newly created customer as selected
    setSelectedCustomer(customerOption);
    setValue('customer', customer.id);

    // Close the modal
    setShowCustomerModal(false);
  };

  // Handle save actions
  const handleSaveAndDownload = async (data: QuotationFormData) => {
    await onSubmit(data);
    // TODO: Add PDF download logic
    toast.success('Quotation updated and PDF downloaded');
  };

  const handleSaveAndEmail = async (data: QuotationFormData) => {
    await onSubmit(data);
    // TODO: Add email logic
    toast.success('Quotation updated and email sent');
  };

  const handleSaveAndPrint = async (data: QuotationFormData) => {
    await onSubmit(data);
    // TODO: Add print logic
    toast.success('Quotation updated and ready for printing');
  };

  // Handle retry
  const handleRetry = () => {
    window.location.reload();
  };

  // Global calendar hiding effect
  useEffect(() => {
    const hideAllCalendars = () => {
      // Target all possible datepicker elements
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
      // Only hide calendar on Tab key (not arrow keys to allow date selection)
      if (event.key === 'Tab' || event.key === 'Escape') {
        setTimeout(hideAllCalendars, 10);
      }
    };

    const handleFocusChange = () => {
      // Only hide calendars when focus changes to non-datepicker elements
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

    // Add multiple event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', handleFocusChange);
    document.addEventListener('click', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', handleFocusChange);
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // Global calendar hiding effect
  useEffect(() => {
    const hideAllCalendars = () => {
      // Target all possible datepicker elements
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
      // Only hide calendar on Tab key (not arrow keys to allow date selection)
      if (event.key === 'Tab' || event.key === 'Escape') {
        setTimeout(hideAllCalendars, 10);
      }
    };

    const handleFocusChange = () => {
      // Only hide calendars when focus changes to non-datepicker elements
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

    // Add multiple event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', handleFocusChange);
    document.addEventListener('click', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', handleFocusChange);
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  if (initialLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-64">
          <Spinner size="xl" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-4">
          <ErrorBanner
            title="Unable to load quotation"
            error={error}
            onRetry={handleRetry}
            onDismiss={() => setError(null)}
          />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-3 lg:p-4">
        {/* Compact Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm mb-4">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={handleBack}
                  className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors flex-shrink-0"
                  title="Back to Quotations"
                >
                  <HiArrowLeft className="h-5 w-5" />
                </button>
                <div className="min-w-0">
                  <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                    Edit Quotation #{watch('quot_number')}
                  </h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {selectedCustomer?.name || 'No customer selected'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {hasChanges() && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 hidden sm:inline">
                    Unsaved changes
                  </span>
                )}
                {isFormValid() && hasChanges() ? (
                  <Dropdown
                    label=""
                    dismissOnClick={false}
                    renderTrigger={() => (
                      <button
                        type="button"
                        className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 focus:ring-2 focus:outline-none focus:ring-teal-300 dark:focus:ring-teal-800 transition-colors"
                        disabled={loading}
                      >
                        <span>{loading ? 'Updating...' : 'Update'}</span>
                        <HiChevronDown className="ml-1.5 h-4 w-4" />
                      </button>
                    )}
                  >
                    <Dropdown.Item onClick={handleSubmit(onSubmit)}>Update Quotation</Dropdown.Item>
                    <Dropdown.Item onClick={handleSubmit(handleSaveAndDownload)}>
                      Update & Download PDF
                    </Dropdown.Item>
                    <Dropdown.Item onClick={handleSubmit(handleSaveAndEmail)}>
                      Update & Email
                    </Dropdown.Item>
                    <Dropdown.Item onClick={handleSubmit(handleSaveAndPrint)}>
                      Update & Print
                    </Dropdown.Item>
                  </Dropdown>
                ) : (
                  <Button
                    size="xs"
                    disabled={true}
                    className="bg-gray-400 cursor-not-allowed"
                    tabIndex={items.length * 4 + 12}
                  >
                    {!isFormValid() ? 'Update' : 'No Changes'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          {/* Main Form Card - Compact Layout */}
          <Card className="p-3">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              {/* Left Column - Customer & Terms */}
              <div className="lg:col-span-5 space-y-2">
                <TypeaheadInput
                  value={selectedCustomer}
                  onChange={handleCustomerChange}
                  placeholder="Search customers..."
                  searchFunction={searchCustomers}
                  label="Customer *"
                  onAddNew={handleAddNewCustomer}
                  addNewLabel="Add Customer"
                  className="w-full"
                  tabIndex={1}
                />
                {errors.customer && (
                  <p className="text-xs text-red-600">{errors.customer.message}</p>
                )}

                <div>
                  <Label htmlFor="terms" className="text-xs">
                    Terms *
                  </Label>
                  <Controller
                    name="terms"
                    control={control}
                    render={({ field }) => (
                      <StandardSelect
                        {...field}
                        color={errors.terms ? 'failure' : 'gray'}
                        tabIndex={2}
                        sizing="sm"
                      >
                        <option value="">Select payment terms</option>
                        <option value="Net 30">Net 30 Days</option>
                        <option value="Net 15">Net 15 Days</option>
                        <option value="Net 7">Net 7 Days</option>
                        <option value="Cash on Delivery">Cash on Delivery</option>
                        <option value="Advance Payment">Advance Payment</option>
                      </StandardSelect>
                    )}
                  />
                </div>
              </div>

              {/* Right Column - Quotation Details */}
              <div className="lg:col-span-7">
                <div className="lg:ml-auto lg:w-4/5 space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="w-20 text-xs text-gray-600 dark:text-gray-400 flex-shrink-0">
                      Quote #
                    </Label>
                    <Controller
                      name="quot_number"
                      control={control}
                      render={({ field }) => (
                        <StandardTextInput
                          {...field}
                          sizing="sm"
                          className="text-right flex-1"
                          readOnly
                          tabIndex={-1}
                        />
                      )}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Label className="w-20 text-xs text-gray-600 dark:text-gray-400 flex-shrink-0">
                      Issue Date
                    </Label>
                    <Controller
                      name="date"
                      control={control}
                      render={({ field }) => (
                        <div className="flex-1">
                          <Datepicker
                            value={field.value || ''}
                            onSelectedDateChanged={(date) => {
                              const dateStr = date ? date.toISOString().split('T')[0] : '';
                              field.onChange(dateStr);
                            }}
                            placeholder="Select date"
                            autoHide={true}
                            language="en-GB"
                            weekStart={1}
                            tabIndex={-1}
                          />
                        </div>
                      )}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Label className="w-20 text-xs text-gray-600 dark:text-gray-400 flex-shrink-0">
                      Expiry Date
                    </Label>
                    <Controller
                      name="required_date"
                      control={control}
                      render={({ field }) => (
                        <div className="flex-1">
                          <Datepicker
                            value={field.value || ''}
                            onSelectedDateChanged={(date) => {
                              const dateStr = date ? date.toISOString().split('T')[0] : '';
                              field.onChange(dateStr);
                            }}
                            placeholder="Select date"
                            autoHide={true}
                            minDate={watch('date') ? new Date(watch('date')) : undefined}
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
          </Card>

          {/* Items Section */}
          <Card className="p-3">
            <QuotationItemsTable
              items={items}
              onItemsChange={setItems}
              itemsLength={items.length}
            />
            {errors.items && <p className="mt-2 text-xs text-red-600">{errors.items.message}</p>}
          </Card>

          {/* Totals & Notes Combined Section */}
          <Card className="p-3">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Notes - Left Side */}
              <div className="lg:col-span-7 space-y-3">
                <div>
                  <Label
                    htmlFor="notes"
                    className="text-xs font-medium text-gray-600 dark:text-gray-400"
                  >
                    Notes (visible to customer)
                  </Label>
                  <Controller
                    name="notes"
                    control={control}
                    render={({ field }) => (
                      <AutoExpandingTextarea
                        value={field.value || ''}
                        onChange={field.onChange}
                        placeholder="Customer-visible notes..."
                        minRows={2}
                        maxRows={4}
                        id="notes"
                        name="notes"
                        tabIndex={items.length * 4 + 10}
                      />
                    )}
                  />
                </div>

                <div>
                  <Label
                    htmlFor="private_notes"
                    className="text-xs font-medium text-gray-600 dark:text-gray-400"
                  >
                    Private Notes (internal only)
                  </Label>
                  <Controller
                    name="private_notes"
                    control={control}
                    render={({ field }) => (
                      <AutoExpandingTextarea
                        value={field.value || ''}
                        onChange={field.onChange}
                        placeholder="Internal notes..."
                        minRows={2}
                        maxRows={4}
                        id="private_notes"
                        name="private_notes"
                        tabIndex={items.length * 4 + 11}
                      />
                    )}
                  />
                </div>
              </div>

              {/* Totals - Right Side */}
              <div className="lg:col-span-5">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="show_subtotal"
                        checked={showSubtotal}
                        onChange={(e) => setShowSubtotal(e.target.checked)}
                        className="w-3.5 h-3.5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                      />
                      <label
                        htmlFor="show_subtotal"
                        className="text-sm text-gray-700 dark:text-gray-300"
                      >
                        Subtotal
                      </label>
                    </div>
                    <span className="text-sm text-gray-900 dark:text-white">
                      Rs. {subtotal.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="show_delivery_charges"
                        checked={showDeliveryCharges}
                        onChange={(e) => setShowDeliveryCharges(e.target.checked)}
                        className="w-3.5 h-3.5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                      />
                      <label
                        htmlFor="show_delivery_charges"
                        className="text-sm text-gray-700 dark:text-gray-300"
                      >
                        Delivery
                      </label>
                    </div>
                    <div className="w-24">
                      <Controller
                        name="delivery_charge"
                        control={control}
                        render={({ field }) => (
                          <StandardTextInput
                            {...field}
                            value={field.value ? Number(field.value).toFixed(2) : '0.00'}
                            type="text"
                            sizing="sm"
                            className="text-right"
                            tabIndex={items.length * 4 + 9}
                            disabled={!showDeliveryCharges}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^0-9.]/g, '');
                              const numValue = parseFloat(value) || 0;
                              field.onChange(numValue);
                            }}
                          />
                        )}
                      />
                    </div>
                  </div>

                  <div className="border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        Grand Total
                      </span>
                      <span className="text-base font-bold text-gray-900 dark:text-white">
                        Rs. {total.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
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
    </DashboardLayout>
  );
}
