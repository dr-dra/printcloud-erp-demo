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
import { api } from '@/lib/api';
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

interface QuotationFormData {
  customer: number | null;
  terms: string;
  quot_number: string;
  date: string;
  required_date: string;
  delivery_charge: number;
  vat_rate?: number;
  vat_amount?: number;
  notes?: string;
  private_notes?: string;
  items?: QuotationItem[];
  show_subtotal?: boolean;
  show_delivery_charges?: boolean;
}

interface QuotationItem {
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

function NewQuotationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<QuotationItem[]>([]);
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
  const [showDeliveryCharges, setShowDeliveryCharges] = useState(true);
  const [vatRateInput, setVatRateInput] = useState<string>(DEFAULT_VAT_RATE.toString());
  const [deliveryChargeInput, setDeliveryChargeInput] = useState<string>('');

  // Form setup
  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<QuotationFormData>({
    // resolver: yupResolver(quotationSchema),
    defaultValues: {
      customer: null,
      terms: 'Advance Payment',
      quot_number: '',
      date: new Date().toISOString().split('T')[0], // Today's date
      required_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
      delivery_charge: 0.0,
      notes: '',
      private_notes: '',
      items: [],
    },
  });

  // Sync items state with form
  useEffect(() => {
    setValue('items', items);
  }, [items, setValue]);

  // Handle pre-filled data from costing sheets
  useEffect(() => {
    const loadQuotationData = async () => {
      const fromCosting = searchParams.get('from');

      if (fromCosting === 'costing') {
        try {
          const storedData = sessionStorage.getItem('quotationDraft');

          if (storedData) {
            const quotationData = JSON.parse(storedData);

            // Store project name for warning message
            if (quotationData.project_name) {
              setProjectName(quotationData.project_name);
            }

            // Set customer if provided
            if (quotationData.customer_name) {
              const customerOption = {
                id: quotationData.customer_id || 0,
                name: quotationData.customer_name,
                secondary: '',
              };
              setSelectedCustomer(customerOption);
              setValue('customer', quotationData.customer_id || null);
            }

            // Set items from costing sheets
            if (quotationData.line_items && quotationData.line_items.length > 0) {
              try {
                // Process each line item, fetching FinishedProduct data where available
                const processedItems = await Promise.all(
                  quotationData.line_items.map(async (item: any, index: number) => {
                    let itemName = item.item || ''; // Default to item name from costing
                    let description = item.description || ''; // Default description
                    let finishedProductId = item.finished_product_id;
                    let finishedProduct: { is_vat_exempt?: boolean } | undefined;

                    // If we have a finished_product_id, fetch the full product details from the API
                    if (finishedProductId) {
                      try {
                        const response = await api.get(
                          `/sales/finished-products/${finishedProductId}/`,
                        );
                        finishedProduct = response.data;

                        // Use the FinishedProduct name if item name is empty
                        if (!itemName && finishedProduct.name) {
                          itemName = finishedProduct.name;
                        }

                        // Use the FinishedProduct description if available
                        if (finishedProduct.description && finishedProduct.description.trim()) {
                          description = finishedProduct.description;
                        }
                      } catch (error) {
                        console.warn(
                          `Failed to fetch FinishedProduct data for ID ${finishedProductId}:`,
                          error,
                        );
                        // Keep the existing data if API call fails
                      }
                    } else if (itemName) {
                      // If we don't have a finished_product_id but we have an item name,
                      // try to find the finished product by name
                      try {
                        const response = await api.get(
                          `/sales/finished-products/?search=${encodeURIComponent(itemName)}`,
                        );

                        // Look for exact match (case-insensitive)
                        const exactMatch = response.data.results?.find(
                          (product: any) => product.name.toLowerCase() === itemName.toLowerCase(),
                        );

                        if (exactMatch) {
                          finishedProductId = exactMatch.id;
                          finishedProduct = exactMatch;

                          // Use the FinishedProduct description if available
                          if (exactMatch.description && exactMatch.description.trim()) {
                            description = exactMatch.description;
                          }
                        }
                      } catch (error) {
                        console.warn(
                          `Failed to search for FinishedProduct by name "${itemName}":`,
                          error,
                        );
                        // Keep the existing data if API call fails
                      }
                    }

                    return {
                      id: `costing-${index}`,
                      item_id: index + 1, // Temporary ID for form validation
                      item: itemName,
                      description: description,
                      quantity: item.quantity,
                      unit_price: item.unit_price,
                      price: item.total || item.quantity * item.unit_price,
                      costing_sheet_id:
                        item.costing_sheet_id || quotationData.costing_sheet_ids?.[index] || null,
                      finished_product_id: finishedProductId, // Store the FinishedProduct ID (may have been found by name search)
                      finished_product: finishedProduct,
                      tax_percentage: item.tax_percentage,
                    };
                  }),
                );

                setItems(processedItems);
              } catch (error) {
                console.error('Error processing line items from costing data:', error);
                // Fall back to creating items without FinishedProduct descriptions
                const fallbackItems: QuotationItem[] = quotationData.line_items.map(
                  (item: any, index: number) => ({
                    id: `costing-${index}`,
                    item_id: index + 1,
                    item: item.item,
                    description: item.description,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    price: item.total || item.quantity * item.unit_price,
                    costing_sheet_id:
                      item.costing_sheet_id || quotationData.costing_sheet_ids?.[index] || null,
                    finished_product_id: item.finished_product_id,
                    tax_percentage: item.tax_percentage,
                  }),
                );
                setItems(fallbackItems);
              }
            }

            // Store costing_id for later use in form submission
            if (quotationData.costing_id) {
              // We'll store this in a ref or state for use during submission
              (window as any).quotationCostingId = quotationData.costing_id;
            }
            if (quotationData.costing_sheet_ids) {
              (window as any).quotationCostingSheetIds = quotationData.costing_sheet_ids;
            }

            // Clear the stored data after a brief delay to prevent React Strict Mode double execution issues
            setTimeout(() => {
              sessionStorage.removeItem('quotationDraft');
            }, 100);
          }
        } catch (error) {
          console.error('Error parsing pre-filled data from sessionStorage:', error);
          // Don't show error toast for sessionStorage issues
        }
      }
    };

    loadQuotationData();
  }, [searchParams, setValue]);

  // Warn user before leaving page without saving (browser refresh/close only)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Only warn if navigation is enabled (not during programmatic navigation after user confirmed)
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
    // Enable navigation warnings after 2 seconds, but only if we have items
    const timer = setTimeout(() => {
      isPageLoadedRef.current = true;
      // Only enable warnings if there are actually items to save
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
    const quotNumber = watch('quot_number') || '';
    return projectName
      ? `Do you want to leave the page without saving Quotation ${projectName} - Quotation [${quotNumber}]?`
      : `Do you want to leave the page without saving Quotation [${quotNumber}]?`;
  };

  // Intercept all link clicks
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!shouldShowWarning()) return;

      const target = e.target as HTMLElement;
      const link = target.closest('a');

      if (link && link.href && !link.href.includes('/dashboard/sales/quotations/new')) {
        e.preventDefault();
        e.stopPropagation();

        // Store the navigation action
        setPendingNavigation(() => () => {
          window.location.href = link.href;
        });

        // Show confirmation dialog
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

      // Push the current state back to prevent navigation
      window.history.pushState(null, '', window.location.href);

      // Store the navigation action
      setPendingNavigation(() => () => {
        window.history.back();
      });

      // Show confirmation dialog
      setShowConfirmDialog(true);
    };

    // Push initial state to enable back button interception
    window.history.pushState(null, '', window.location.href);

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isSaved, items.length]);

  // Handle confirmation dialog actions
  const handleConfirmNavigation = () => {
    setShowConfirmDialog(false);

    // Disable navigation warnings before executing navigation
    navigationEnabledRef.current = false;

    // Small delay to ensure ref update is processed
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
    // Re-enable navigation warnings since user decided to stay
    navigationEnabledRef.current = true;
  };

  // Generate quotation number from backend and focus customer input
  useEffect(() => {
    const fetchQuotationNumber = async () => {
      try {
        const response = await api.get('/sales/quotations/next-number/');

        if (response.data.success) {
          setValue('quot_number', response.data.quot_number);
        } else {
          console.error('Failed to fetch quotation number:', response.data.error);
          // Fallback to timestamp-based generation
          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate()).padStart(2, '0');
          const time =
            String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
          const quotNumber = `Q${year}${month}${day}-${time}`;
          setValue('quot_number', quotNumber);
        }
      } catch (error) {
        console.error('Error fetching quotation number:', error);
        // Fallback to timestamp-based generation
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const time =
          String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
        const quotNumber = `Q${year}${month}${day}-${time}`;
        setValue('quot_number', quotNumber);
      }
    };

    if (isAuthenticated) {
      fetchQuotationNumber();
    }

    // Only focus customer input if NOT coming from costing (empty quotation)
    const fromCosting = searchParams.get('from');
    if (!fromCosting) {
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
    const deliveryCharge = parseFloat(String(watch('delivery_charge') || 0)) || 0;
    const vatRatePercent = Math.max(0, parseFloat(vatRateInput) || 0);
    const vatAmount = (subtotal + deliveryCharge) * (vatRatePercent / 100);
    const total = subtotal + deliveryCharge + vatAmount;
    return { subtotal, deliveryCharge, vatAmount, total, vatRatePercent };
  };

  const { subtotal, vatAmount, total, vatRatePercent } = calculateTotals();

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

  const getItemVatStatus = (item: QuotationItem): boolean | null => {
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

    const { hasExempt, hasTaxable, hasUnknown } = getVatFlags();
    if (hasExempt && hasTaxable) {
      toast.error('Cannot mix VAT-exempt and VATable items in the same quotation.');
      return;
    }
    if (hasExempt && vatRatePercent > 0) {
      toast.error('VAT rate must be 0% for VAT-exempt quotations.');
      return;
    }
    if (hasTaxable && vatRatePercent <= 0) {
      toast.error('VAT rate must be greater than 0% for VATable quotations.');
      return;
    }
    if (hasUnknown && (hasExempt || hasTaxable)) {
      toast.error('Select Finished Product for all items to enforce VAT exemption rules.');
      return;
    }

    try {
      setLoading(true);

      const vatRateDecimal = vatRatePercent / 100;

      const quotationData = {
        ...data,
        show_subtotal: showSubtotal,
        show_delivery_charges: showDeliveryCharges,
        vat_rate: vatRateDecimal,
        vat_amount: vatAmount,
        costing_id: (window as any).quotationCostingId || null, // Include costing reference
        items: items.map((item) => ({
          item_id: item.item_id,
          item: item.item,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          price: item.price,
          costing_sheet_id: (item as any).costing_sheet_id || null, // Include costing sheet reference
          finished_product_id: item.finished_product_id || null, // Include FinishedProduct reference
        })),
      };

      const response = await api.post('/sales/quotations/create/', quotationData);

      // Mark as saved to prevent warning
      setIsSaved(true);

      // Disable navigation warnings before redirect
      navigationEnabledRef.current = false;

      // Store the newly created quotation ID for highlighting on the list page
      const quotationId = response.data.id;
      sessionStorage.setItem('newlyQuotationId', quotationId.toString());

      toast.success('Quotation created successfully');

      // Use a small delay before redirect to ensure state updates complete
      setTimeout(() => {
        router.push('/dashboard/sales/quotations');
      }, 100);
    } catch (error) {
      const errorMessage = getErrorMessage(error as any);
      toast.error(`Failed to create quotation: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (shouldShowWarning()) {
      // Store the navigation action
      setPendingNavigation(() => () => {
        router.push('/dashboard/sales/quotations');
      });

      // Show confirmation dialog
      setShowConfirmDialog(true);
    } else {
      router.push('/dashboard/sales/quotations');
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

  // Helper functions for delivery charge input handling
  const getDeliveryChargeDisplayValue = (fieldValue: number) => {
    // If we have a raw input value, use it (user is typing)
    if (deliveryChargeInput !== '') {
      return deliveryChargeInput;
    }
    // Otherwise, format the stored value
    return fieldValue === 0 ? '' : fieldValue.toFixed(2);
  };

  const handleDeliveryChargeChange = (
    inputValue: string,
    fieldOnChange: (value: number) => void,
  ) => {
    // Only allow numbers, decimal points, and backspace
    if (inputValue === '' || /^\d*\.?\d*$/.test(inputValue)) {
      // Update the raw input state
      setDeliveryChargeInput(inputValue);

      // Update the form field value
      const numValue = parseFloat(inputValue) || 0;
      fieldOnChange(numValue);
    }
  };

  const handleDeliveryChargeBlur = (inputValue: string, fieldOnChange: (value: number) => void) => {
    // Format to 2 decimal places and update the field
    const value = parseFloat(inputValue) || 0;
    fieldOnChange(value);

    // Clear the raw input state (will fall back to formatted display)
    setDeliveryChargeInput('');
  };

  // Handle save actions
  const handleSaveAndDownload = async (data: QuotationFormData) => {
    // onSubmit already handles the save and redirect
    await onSubmit(data);
    // TODO: Add PDF download logic after redirect completes
  };

  const handleSaveAndEmail = async (data: QuotationFormData) => {
    // onSubmit already handles the save and redirect
    await onSubmit(data);
    // TODO: Add email logic after redirect completes
  };

  const handleSaveAndPrint = async (data: QuotationFormData) => {
    // onSubmit already handles the save and redirect
    await onSubmit(data);
    // TODO: Add print logic after redirect completes
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
                New Quotation
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Sales / Quotation / New Quotation
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
                  <span>{loading ? 'Saving...' : 'Save Quotation'}</span>
                  <HiChevronDown className="ml-2 h-4 w-4" />
                </button>
              )}
            >
              <Dropdown.Item onClick={handleSubmit(onSubmit)}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                  />
                </svg>
                Save Quotation
              </Dropdown.Item>
              <Dropdown.Item onClick={handleSubmit(handleSaveAndDownload)}>
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
              <Dropdown.Item onClick={handleSubmit(handleSaveAndEmail)}>
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
              <Dropdown.Item onClick={handleSubmit(handleSaveAndPrint)}>
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
              Save Quotation
            </Button>
          )}
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
              </div>

              {/* Right Column - Quotation fields (60% width, right-aligned) */}
              <div className="col-span-12 lg:col-span-7 space-y-3">
                <div className="ml-auto w-3/5 space-y-2">
                  <div className="flex items-center space-x-3">
                    <Label htmlFor="quot_number" className="w-24 text-sm">
                      Quote #: *
                    </Label>
                    <div className="flex-1">
                      <Controller
                        name="quot_number"
                        control={control}
                        render={({ field }) => (
                          <StandardTextInput
                            {...field}
                            color={errors.quot_number ? 'failure' : 'gray'}
                            helperText={errors.quot_number?.message}
                            className="text-right"
                            readOnly
                            tabIndex={-1}
                          />
                        )}
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Label htmlFor="date" className="w-24 text-sm">
                      Issue Date: *
                    </Label>
                    <div className="flex-1">
                      <Controller
                        name="date"
                        control={control}
                        render={({ field }) => (
                          <div>
                            <Datepicker
                              value={field.value || ''}
                              onSelectedDateChanged={(date) => {
                                const dateStr = date ? date.toISOString().split('T')[0] : '';
                                field.onChange(dateStr);
                              }}
                              placeholder="Select quotation date"
                              autoHide={true}
                              language="en-GB"
                              weekStart={1}
                              tabIndex={-1}
                              onBlur={() => {
                                // Force hide the calendar when tabbing away
                                setTimeout(() => {
                                  // Target multiple possible datepicker selectors
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
                            {errors.date && (
                              <p className="mt-1 text-sm text-red-600">{errors.date.message}</p>
                            )}
                          </div>
                        )}
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Label htmlFor="required_date" className="w-24 text-sm">
                      Exp Date: *
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
                              placeholder="Select expiry date"
                              autoHide={true}
                              minDate={watch('date') ? new Date(watch('date')) : undefined}
                              language="en-GB"
                              weekStart={1}
                              tabIndex={-1}
                              onBlur={() => {
                                // Force hide the calendar when tabbing away
                                setTimeout(() => {
                                  // Target multiple possible datepicker selectors
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
                            {errors.required_date && (
                              <p className="mt-1 text-sm text-red-600">
                                {errors.required_date.message}
                              </p>
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
                    id="show_delivery_charges"
                    checked={showDeliveryCharges}
                    onChange={(e) => setShowDeliveryCharges(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span className="text-sm font-medium">Delivery Charges:</span>
                </div>
                <div className="w-32">
                  <Controller
                    name="delivery_charge"
                    control={control}
                    render={({ field }) => (
                      <StandardTextInput
                        value={getDeliveryChargeDisplayValue(field.value)}
                        type="text"
                        placeholder="0.00"
                        className="text-right h-10 text-right"
                        style={{ textAlign: 'right' }}
                        tabIndex={items.length * 4 + 9}
                        disabled={!showDeliveryCharges}
                        onChange={(e) => handleDeliveryChargeChange(e.target.value, field.onChange)}
                        onBlur={(e) => handleDeliveryChargeBlur(e.target.value, field.onChange)}
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
                onClick={handleSubmit(onSubmit)}
                disabled={loading || !isFormValid()}
                className={`${isFormValid() ? 'bg-teal-600 hover:bg-teal-700' : 'bg-gray-400 cursor-not-allowed'}`}
                tabIndex={items.length * 4 + 12}
              >
                {loading ? 'Saving...' : 'Save Quotation'}
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
export default function NewQuotationPageWrapper() {
  return (
    <Suspense fallback={<div className="p-4">Loading...</div>}>
      <NewQuotationPage />
    </Suspense>
  );
}
