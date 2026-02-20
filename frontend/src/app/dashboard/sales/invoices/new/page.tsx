'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Card, Label, Datepicker, Dropdown } from 'flowbite-react';
import { StandardTextInput, StandardSelect } from '@/components/common/inputs';
import { HiArrowLeft, HiChevronDown } from 'react-icons/hi';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'sonner';

import DashboardLayout from '@/components/DashboardLayout';
import { invoicesAPI, api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { getErrorMessage } from '@/utils/errorHandling';
import TypeaheadInput from '@/components/common/TypeaheadInput';
import CustomerModal from '@/components/common/CustomerModal';
import QuotationItemsTable from '@/components/quotations/QuotationItemsTable';
import AutoExpandingTextarea from '@/components/common/AutoExpandingTextarea';
import ConfirmDialog from '@/components/common/ConfirmDialog';

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
  terms: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  po_so_number: string;
  discount: number;
  vat_rate?: number;
  tax_amount?: number;
  notes?: string;
  private_notes?: string;
  items?: InvoiceItem[];
  show_subtotal?: boolean;
  show_discount?: boolean;
}

interface InvoiceItem {
  id?: string;
  item_id?: number;
  item?: string;
  description: string;
  quantity: number;
  unit_price: number;
  price: number;
  finished_product_id?: number;
  finished_product?: {
    is_vat_exempt?: boolean;
  };
  tax_percentage?: number;
}

const DEFAULT_VAT_RATE = 18;

function NewInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [isSaved, setIsSaved] = useState(false);
  const [projectName, setProjectName] = useState<string>('');

  // Navigation warning state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const isPageLoadedRef = useRef(false);
  const navigationEnabledRef = useRef(false);

  // Customer modal and selection state
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<AutocompleteOption | null>(null);
  const [showSubtotal, setShowSubtotal] = useState(true);
  const [showDiscount, setShowDiscount] = useState(true);
  const [vatRateInput, setVatRateInput] = useState<string>(DEFAULT_VAT_RATE.toString());
  const [discountInput, setDiscountInput] = useState<string>('');

  // Form setup
  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<InvoiceFormData>({
    defaultValues: {
      customer: null,
      terms: 'Net 7',
      invoice_number: '',
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      po_so_number: '',
      discount: 0.0,
      notes: '',
      private_notes: '',
      items: [],
    },
  });

  // Sync items state with form
  useEffect(() => {
    setValue('items', items);
  }, [items, setValue]);

  // Handle pre-filled data from orders
  useEffect(() => {
    const loadInvoiceData = async () => {
      const fromOrder = searchParams.get('from');

      if (fromOrder === 'order') {
        try {
          const storedData = sessionStorage.getItem('invoiceDraft');

          if (storedData) {
            const invoiceData = JSON.parse(storedData);

            if (invoiceData.project_name) {
              setProjectName(invoiceData.project_name);
            }

            if (invoiceData.customer_name) {
              const customerOption = {
                id: invoiceData.customer_id || 0,
                name: invoiceData.customer_name,
                secondary: '',
              };
              setSelectedCustomer(customerOption);
              setValue('customer', invoiceData.customer_id || null);
            }

            if (invoiceData.line_items && invoiceData.line_items.length > 0) {
              const processedItems: InvoiceItem[] = invoiceData.line_items.map(
                (item: any, index: number) => ({
                  id: `order-${index}`,
                  item_id: index + 1,
                  item: item.item,
                  description: item.description,
                  quantity: item.quantity,
                  unit_price: item.unit_price,
                  price: item.total || item.quantity * item.unit_price,
                  finished_product_id: item.finished_product_id,
                  tax_percentage: item.tax_percentage,
                }),
              );
              setItems(processedItems);
            }

            setTimeout(() => {
              sessionStorage.removeItem('invoiceDraft');
            }, 100);
          }
        } catch (error) {
          console.error('Error parsing pre-filled data from sessionStorage:', error);
        }
      }
    };

    loadInvoiceData();
  }, [searchParams, setValue]);

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

  // Enable navigation warnings after page loads
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
    const invoiceNum = watch('invoice_number') || '';
    return projectName
      ? `Do you want to leave the page without saving Invoice ${projectName} - Invoice [${invoiceNum}]?`
      : `Do you want to leave the page without saving Invoice [${invoiceNum}]?`;
  };

  // Intercept all link clicks
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!shouldShowWarning()) return;

      const target = e.target as HTMLElement;
      const link = target.closest('a');

      if (link && link.href && !link.href.includes('/dashboard/sales/invoices/new')) {
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
  }, [isSaved, items.length, projectName, watch]);

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

  // Generate invoice number from backend and focus customer input
  useEffect(() => {
    const fetchInvoiceNumber = async () => {
      try {
        const response = await invoicesAPI.getNextInvoiceNumber();

        if (response.data.success) {
          setValue('invoice_number', response.data.invoice_number);
        } else {
          console.error('Failed to fetch invoice number:', response.data.error);
          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate()).padStart(2, '0');
          const time =
            String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
          const invoiceNum = `INV${year}${month}${day}-${time}`;
          setValue('invoice_number', invoiceNum);
        }
      } catch (error) {
        console.error('Error fetching invoice number:', error);
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const time =
          String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
        const invoiceNum = `INV${year}${month}${day}-${time}`;
        setValue('invoice_number', invoiceNum);
      }
    };

    if (isAuthenticated) {
      fetchInvoiceNumber();
    }

    const fromOrder = searchParams.get('from');
    if (!fromOrder) {
      const timer = setTimeout(() => {
        const customerInput = document.querySelector(
          'input[placeholder*="customer"], input[placeholder*="Customer"]',
        ) as HTMLInputElement;
        if (customerInput) {
          customerInput.focus();
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [setValue, isAuthenticated, searchParams]);

  // Calculate totals
  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + (item.price || 0), 0);
    const discountAmount = parseFloat(String(watch('discount') || 0)) || 0;
    const vatRatePercent = Math.max(0, parseFloat(vatRateInput) || 0);
    const vatAmount = (subtotal - discountAmount) * (vatRatePercent / 100);
    const total = subtotal - discountAmount + vatAmount;
    return { subtotal, discountAmount, vatAmount, total, vatRatePercent };
  };

  const { subtotal, discountAmount, vatAmount, total, vatRatePercent } = calculateTotals();

  // Validation functions
  const hasValidItems = () => {
    return items.some(
      (item) =>
        item.item_id && item.description.trim() !== '' && item.quantity > 0 && item.unit_price > 0,
    );
  };

  const isCustomerSelected = () => {
    return selectedCustomer !== null && watch('customer') !== null;
  };

  const isFormValid = () => {
    return hasValidItems() && isCustomerSelected();
  };

  const getItemVatStatus = (item: InvoiceItem): boolean | null => {
    if (typeof item.tax_percentage === 'number') {
      return item.tax_percentage === 0;
    }
    if (item.finished_product && typeof item.finished_product.is_vat_exempt === 'boolean') {
      return item.finished_product.is_vat_exempt;
    }
    return null;
  };

  const getVatFlags = () => {
    let hasExempt = false;
    let hasTaxable = false;
    let hasUnknown = false;

    items.forEach((item) => {
      const status = getItemVatStatus(item);
      if (status === true) hasExempt = true;
      else if (status === false) hasTaxable = true;
      else hasUnknown = true;
    });

    return { hasExempt, hasTaxable, hasUnknown };
  };

  useEffect(() => {
    const { hasExempt, hasTaxable, hasUnknown } = getVatFlags();
    if (!hasUnknown) {
      if (hasExempt && !hasTaxable) {
        setVatRateInput('0');
      } else if (hasTaxable && !hasExempt) {
        setVatRateInput(DEFAULT_VAT_RATE.toString());
      }
    }
  }, [items]);

  // Handle form submission
  const onSubmit = async (data: InvoiceFormData, status: string = 'draft') => {
    if (!isAuthenticated) return;

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

    const { hasExempt, hasTaxable, hasUnknown } = getVatFlags();
    if (hasExempt && hasTaxable) {
      toast.error('Cannot mix VAT-exempt and VATable items in the same invoice.');
      return;
    }
    if (hasExempt && vatRatePercent > 0) {
      toast.error('VAT rate must be 0% for VAT-exempt invoices.');
      return;
    }
    if (hasTaxable && vatRatePercent <= 0) {
      toast.error('VAT rate must be greater than 0% for VATable invoices.');
      return;
    }
    if (hasUnknown && (hasExempt || hasTaxable)) {
      toast.error('Select Finished Product for all items to enforce VAT exemption rules.');
      return;
    }

    try {
      setLoading(true);

      const vatRateDecimal = vatRatePercent / 100;

      const invoiceData = {
        invoice_number: data.invoice_number,
        customer: data.customer,
        invoice_date: data.invoice_date,
        due_date: data.due_date,
        po_so_number: data.po_so_number,
        notes: data.private_notes,
        customer_notes: data.notes,
        subtotal,
        discount: discountAmount,
        vat_rate: vatRateDecimal,
        tax_amount: vatAmount,
        net_total: total,
        status,
        items: items.map((item) => ({
          item_name: item.item,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.price,
          finished_product_id: item.finished_product_id || null,
        })),
      };

      const response = await invoicesAPI.createInvoice(invoiceData);

      setIsSaved(true);
      navigationEnabledRef.current = false;

      sessionStorage.setItem('newlyInvoiceId', response.data.id.toString());

      toast.success('Invoice created successfully');

      setTimeout(() => {
        router.push('/dashboard/sales/invoices');
      }, 100);
    } catch (error) {
      const errorMessage = getErrorMessage(error as any);
      toast.error(`Failed to create invoice: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (shouldShowWarning()) {
      setPendingNavigation(() => () => {
        router.push('/dashboard/sales/invoices');
      });

      setShowConfirmDialog(true);
    } else {
      router.push('/dashboard/sales/invoices');
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

  const handleCustomerChange = (customer: AutocompleteOption | null) => {
    setSelectedCustomer(customer);
    setValue('customer', customer ? Number(customer.id) : null);
  };

  const handleAddNewCustomer = () => {
    setShowCustomerModal(true);
  };

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

  // Helper functions for discount input handling
  const getDiscountDisplayValue = (fieldValue: number) => {
    if (discountInput !== '') {
      return discountInput;
    }
    return fieldValue === 0 ? '' : fieldValue.toFixed(2);
  };

  const handleDiscountChange = (inputValue: string, fieldOnChange: (value: number) => void) => {
    if (inputValue === '' || /^\d*\.?\d*$/.test(inputValue)) {
      setDiscountInput(inputValue);
      const numValue = parseFloat(inputValue) || 0;
      fieldOnChange(numValue);
    }
  };

  const handleDiscountBlur = (inputValue: string, fieldOnChange: (value: number) => void) => {
    const value = parseFloat(inputValue) || 0;
    fieldOnChange(value);
    setDiscountInput('');
  };

  // Handle save actions
  const handleSaveAsDraft = async (data: InvoiceFormData) => {
    await onSubmit(data, 'draft');
  };

  const handleSaveAndSend = async (data: InvoiceFormData) => {
    await onSubmit(data, 'sent');
  };

  const handleSaveAndDownload = async (data: InvoiceFormData) => {
    await onSubmit(data, 'draft');
    // TODO: Add PDF download logic after redirect completes
  };

  const handleSaveAndEmail = async (data: InvoiceFormData) => {
    await onSubmit(data, 'sent');
    // TODO: Add email logic after redirect completes
  };

  const handleSaveAndPrint = async (data: InvoiceFormData) => {
    await onSubmit(data, 'draft');
    // TODO: Add print logic after redirect completes
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
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">New Invoice</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Sales / Invoice / New Invoice
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
                  data-dropdown-trigger="hover"
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-center text-white bg-teal-600 rounded-lg hover:bg-teal-700 focus:ring-4 focus:outline-none focus:ring-teal-300 dark:bg-teal-600 dark:hover:bg-teal-700 dark:focus:ring-teal-800"
                  disabled={loading}
                >
                  <span>{loading ? 'Saving...' : 'Save Invoice'}</span>
                  <HiChevronDown className="ml-2 h-4 w-4" />
                </button>
              )}
            >
              <Dropdown.Item onClick={handleSubmit((data) => handleSaveAsDraft(data))}>
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
              <Dropdown.Item onClick={handleSubmit((data) => handleSaveAndSend(data))}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Save & Mark as Sent
              </Dropdown.Item>
              <Dropdown.Item onClick={handleSubmit((data) => handleSaveAndDownload(data))}>
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
              <Dropdown.Item onClick={handleSubmit((data) => handleSaveAndEmail(data))}>
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
              <Dropdown.Item onClick={handleSubmit((data) => handleSaveAndPrint(data))}>
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
              tabIndex={items.length * 4 + 12}
            >
              Save Invoice
            </Button>
          )}
        </div>

        <form onSubmit={handleSubmit((data) => handleSaveAsDraft(data))} className="space-y-4">
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
                  <Label htmlFor="terms">Terms *</Label>
                  <Controller
                    name="terms"
                    control={control}
                    render={({ field }) => (
                      <StandardSelect
                        {...field}
                        color={errors.terms ? 'failure' : 'gray'}
                        tabIndex={2}
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
                  {errors.terms && (
                    <p className="mt-1 text-sm text-red-600">{errors.terms.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="po_so_number">PO/SO Number</Label>
                  <Controller
                    name="po_so_number"
                    control={control}
                    render={({ field }) => (
                      <StandardTextInput
                        {...field}
                        placeholder="Enter customer PO/SO number"
                        tabIndex={3}
                      />
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
                              onBlur={() => {
                                setTimeout(() => {
                                  const selectors = [
                                    '.datepicker-dropdown',
                                    '.datepicker-picker',
                                    '[data-datepicker]',
                                    '[role="dialog"]:has(.datepicker-picker)',
                                    '.popover:has(.datepicker-picker)',
                                    '.datepicker',
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
                                }, 50);
                              }}
                            />
                            {errors.invoice_date && (
                              <p className="mt-1 text-sm text-red-600">
                                {errors.invoice_date.message}
                              </p>
                            )}
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
                              onBlur={() => {
                                setTimeout(() => {
                                  const selectors = [
                                    '.datepicker-dropdown',
                                    '.datepicker-picker',
                                    '[data-datepicker]',
                                    '[role="dialog"]:has(.datepicker-picker)',
                                    '.popover:has(.datepicker-picker)',
                                    '.datepicker',
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
                                }, 50);
                              }}
                            />
                            {errors.due_date && (
                              <p className="mt-1 text-sm text-red-600">{errors.due_date.message}</p>
                            )}
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
                  <Controller
                    name="discount"
                    control={control}
                    render={({ field }) => (
                      <StandardTextInput
                        value={getDiscountDisplayValue(field.value)}
                        type="text"
                        placeholder="0.00"
                        className="text-right h-10 text-right"
                        style={{ textAlign: 'right' }}
                        tabIndex={items.length * 4 + 9}
                        disabled={!showDiscount}
                        onChange={(e) => handleDiscountChange(e.target.value, field.onChange)}
                        onBlur={(e) => handleDiscountBlur(e.target.value, field.onChange)}
                      />
                    )}
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
                    tabIndex={items.length * 4 + 10}
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
                <Label htmlFor="notes">Customer Notes</Label>
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
                      tabIndex={items.length * 4 + 10}
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
                      tabIndex={items.length * 4 + 11}
                      enableBulletPoints={true}
                    />
                  )}
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <Button
                onClick={handleSubmit((data) => handleSaveAsDraft(data))}
                disabled={loading || !isFormValid()}
                className={`${isFormValid() ? 'bg-teal-600 hover:bg-teal-700' : 'bg-gray-400 cursor-not-allowed'}`}
                tabIndex={items.length * 4 + 12}
              >
                {loading ? 'Saving...' : 'Save Invoice'}
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

// Wrapper with Suspense boundary to fix useSearchParams() error
export default function NewInvoicePageWrapper() {
  return (
    <Suspense fallback={<div className="p-4">Loading...</div>}>
      <NewInvoicePage />
    </Suspense>
  );
}
