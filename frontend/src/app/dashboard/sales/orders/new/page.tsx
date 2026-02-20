'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Card, Label, Datepicker, Dropdown } from 'flowbite-react';
import { StandardTextInput } from '@/components/common/inputs';
import { HiArrowLeft, HiChevronDown } from 'react-icons/hi';
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
  vat_rate?: number;
  vat_amount?: number;
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
  finished_product?: {
    is_vat_exempt?: boolean;
  };
  costing_sheet_id?: number;
  tax_percentage?: number;
}

const DEFAULT_VAT_RATE = 18;

// Helper to get initial items from sessionStorage (runs once before first render)
function getInitialItems(): OrderItem[] {
  if (typeof window === 'undefined') return [];

  try {
    const storedData = sessionStorage.getItem('orderDraft');
    if (storedData) {
      const orderData = JSON.parse(storedData);
      if (orderData.line_items && orderData.line_items.length > 0) {
        return orderData.line_items.map((item: any, index: number) => {
          const quantity = Number(item.quantity) || 1;
          const unitPrice = Number(item.unit_price) || 0;
          const total = Number(item.total) || quantity * unitPrice;
          return {
            id: `quotation-${index}`,
            item_id: index + 1,
            item: item.item || '',
            description: item.description || '',
            quantity: quantity,
            unit_price: unitPrice,
            price: total,
            finished_product_id: item.finished_product_id || null,
            costing_sheet_id: item.costing_sheet_id || orderData.costing_sheet_ids?.[index] || null,
            tax_percentage: item.tax_percentage,
          };
        });
      }
    }
  } catch (error) {
    console.error('Error loading initial items:', error);
  }
  return [];
}

function NewOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<OrderItem[]>(getInitialItems);
  const [isSaved, setIsSaved] = useState(false);
  const [quotationReference, setQuotationReference] = useState<string>('');

  // Navigation warning state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const isPageLoadedRef = useRef(false);
  const navigationEnabledRef = useRef(false);
  const quotationDataProcessedRef = useRef(false);
  const descriptionsLoadedRef = useRef(false);

  // Customer modal and selection state
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<AutocompleteOption | null>(null);
  const [discountInput, setDiscountInput] = useState<string>('');
  const [deliveryChargeInput, setDeliveryChargeInput] = useState<string>('');
  const [vatRateInput, setVatRateInput] = useState<string>(DEFAULT_VAT_RATE.toString());

  // Form setup
  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<OrderFormData>({
    defaultValues: {
      customer: null,
      order_number: '',
      order_date: new Date().toISOString().split('T')[0], // Today's date
      required_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
      po_so_number: '',
      notes: '',
      private_notes: '',
      items: [],
    },
  });

  // Sync items state with form
  useEffect(() => {
    setValue('items', items);
  }, [items, setValue]);

  // State to store quotation data for private notes (set after user loads)
  const [pendingQuotationData, setPendingQuotationData] = useState<{
    reference: string;
    private_notes?: string;
  } | null>(null);

  // Handle pre-filled data from quotation (customer, notes, etc. - items handled at init)
  useEffect(() => {
    const loadOrderData = async () => {
      const fromSource = searchParams.get('from');

      // Skip if not from quotation/costing or already processed
      if (
        (fromSource !== 'quotation' && fromSource !== 'costing') ||
        quotationDataProcessedRef.current
      ) {
        return;
      }

      try {
        const storedData = sessionStorage.getItem('orderDraft');
        if (!storedData) return;

        const orderData = JSON.parse(storedData);

        // Store reference for display and set private notes
        if (orderData.quotation_number) {
          setQuotationReference(`Quotation #${orderData.quotation_number}`);
          // Store for private notes (will be set when user loads)
          setPendingQuotationData({
            reference: `Quotation #${orderData.quotation_number}`,
            private_notes: orderData.private_notes,
          });
        } else if (orderData.costing_id) {
          const reference = `Costing #${orderData.costing_id}`;
          setQuotationReference(reference);

          // Set private notes directly if user is available, otherwise defer
          if (user) {
            const today = new Date();
            const formattedDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
            const userName = user.display_name || user.username || 'User';
            setValue(
              'private_notes',
              `Created from ${reference} on ${formattedDate} by ${userName}`,
            );
          } else {
            // Store for private notes (will be set when user loads)
            setPendingQuotationData({
              reference: reference,
            });
          }
        }

        // Store quotation_id for later use in form submission
        if (orderData.quotation_id) {
          (window as any).orderQuotationId = orderData.quotation_id;
        }

        // Store costing_id and costing_sheet_ids for later use in form submission
        if (orderData.costing_id) {
          (window as any).orderCostingId = orderData.costing_id;
          // Collect costing sheet IDs from line items for locking
          const sheetIds =
            orderData.line_items
              ?.map(
                (item: any, index: number) =>
                  item.costing_sheet_id || orderData.costing_sheet_ids?.[index] || null,
              )
              .filter((id: number | null) => id !== null) || [];
          (window as any).orderCostingSheetIds = sheetIds;
        }

        // Set customer if provided
        if (orderData.customer_name) {
          const customerOption = {
            id: orderData.customer_id || 0,
            name: orderData.customer_name,
            secondary: '',
          };
          setSelectedCustomer(customerOption);
          setValue('customer', orderData.customer_id || null);
        }

        // Set notes if provided
        if (orderData.notes) {
          setValue('notes', orderData.notes);
        }

        // Set private notes if provided directly
        if (orderData.private_notes && !orderData.quotation_number && !orderData.costing_id) {
          setValue('private_notes', orderData.private_notes);
        }

        // Set discount and delivery charge
        if (orderData.discount) {
          setDiscountInput(orderData.discount.toString());
        }
        if (orderData.delivery_charge) {
          setDeliveryChargeInput(orderData.delivery_charge.toString());
        }

        // Fetch finished product descriptions for items coming from costing
        if (
          fromSource === 'costing' &&
          orderData.line_items &&
          orderData.line_items.length > 0 &&
          !descriptionsLoadedRef.current
        ) {
          descriptionsLoadedRef.current = true;
          try {
            // Use the line_items from orderData directly since items state might not be updated yet
            const processedItems = await Promise.all(
              orderData.line_items.map(async (item: any, index: number) => {
                const quantity = Number(item.quantity) || 1;
                const unitPrice = Number(item.unit_price) || 0;
                const total = Number(item.total) || quantity * unitPrice;
                let description = item.description || '';
                let finishedProductId = item.finished_product_id;
                let finishedProduct: { is_vat_exempt?: boolean } | undefined;

                // Fetch description from finished_products if we have an ID
                if (finishedProductId && !description) {
                  try {
                    const response = await api.get(
                      `/sales/finished-products/${finishedProductId}/`,
                    );
                    finishedProduct = response.data;
                    if (finishedProduct.description && finishedProduct.description.trim()) {
                      description = finishedProduct.description;
                    }
                  } catch (error) {
                    console.warn(
                      `Failed to fetch FinishedProduct data for ID ${finishedProductId}:`,
                      error,
                    );
                  }
                } else if (item.item && !description) {
                  // Try to find by name if no finished_product_id
                  try {
                    const response = await api.get(
                      `/sales/finished-products/?search=${encodeURIComponent(item.item)}`,
                    );
                    const exactMatch = response.data.results?.find(
                      (product: any) => product.name.toLowerCase() === item.item?.toLowerCase(),
                    );
                    if (exactMatch) {
                      finishedProductId = exactMatch.id;
                      if (exactMatch.description && exactMatch.description.trim()) {
                        description = exactMatch.description;
                      }
                      finishedProduct = exactMatch;
                    }
                  } catch (error) {
                    console.warn(`Failed to search FinishedProduct by name "${item.item}":`, error);
                  }
                }

                return {
                  id: `costing-${index}`,
                  item_id: index + 1,
                  item: item.item || '',
                  description: description,
                  quantity: quantity,
                  unit_price: unitPrice,
                  price: total,
                  finished_product_id: finishedProductId || null,
                  finished_product: finishedProduct,
                  costing_sheet_id:
                    item.costing_sheet_id || orderData.costing_sheet_ids?.[index] || null,
                  tax_percentage: item.tax_percentage,
                };
              }),
            );
            setItems(processedItems);
          } catch (error) {
            console.error('Error fetching finished product descriptions:', error);
          }
        }

        // Mark as processed and clear storage
        quotationDataProcessedRef.current = true;
        sessionStorage.removeItem('orderDraft');
      } catch (error) {
        console.error('[OrderDraft] Error:', error);
      }
    };

    loadOrderData();
  }, [searchParams, setValue, user]);

  // Set private notes once user is loaded
  useEffect(() => {
    if (pendingQuotationData && user) {
      const today = new Date();
      const formattedDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
      const userName = user.display_name || user.username || 'User';
      const quotationNote = `Created from ${pendingQuotationData.reference} on ${formattedDate} by ${userName}`;

      // Combine with existing private notes if any
      if (pendingQuotationData.private_notes) {
        setValue('private_notes', `${quotationNote}\n\n${pendingQuotationData.private_notes}`);
      } else {
        setValue('private_notes', quotationNote);
      }

      // Clear pending data
      setPendingQuotationData(null);
    }
  }, [pendingQuotationData, user, setValue]);

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
    return `Do you want to leave the page without saving Order [${orderNumber}]?`;
  };

  // Intercept all link clicks
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!shouldShowWarning()) return;

      const target = e.target as HTMLElement;
      const link = target.closest('a');

      if (link && link.href && !link.href.includes('/dashboard/sales/orders/new')) {
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
  }, [isSaved, items.length, watch]);

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

  // Generate order number from backend and focus customer input
  useEffect(() => {
    const fetchOrderNumber = async () => {
      try {
        const response = await ordersAPI.getNextOrderNumber();

        if (response.data.success) {
          setValue('order_number', response.data.order_number);
        } else {
          console.error('Failed to fetch order number:', response.data.error);
          // Fallback to timestamp-based generation
          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate()).padStart(2, '0');
          const time =
            String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
          const orderNumber = `ORD${year}${month}${day}-${time}`;
          setValue('order_number', orderNumber);
        }
      } catch (error) {
        console.error('Error fetching order number:', error);
        // Fallback to timestamp-based generation
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const time =
          String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
        const orderNumber = `ORD${year}${month}${day}-${time}`;
        setValue('order_number', orderNumber);
      }
    };

    if (isAuthenticated) {
      fetchOrderNumber();
    }

    // Only focus customer input if NOT coming from quotation (customer already pre-filled)
    const fromQuotation = searchParams.get('from');
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (!fromQuotation) {
      timer = setTimeout(() => {
        const customerInput = document.querySelector(
          'input[placeholder*="customer"], input[placeholder*="Customer"]',
        ) as HTMLInputElement;
        if (customerInput) {
          customerInput.focus();
        }
      }, 100);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [setValue, isAuthenticated, searchParams]);

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

  const getItemVatStatus = (item: OrderItem): boolean | null => {
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
  const onSubmit = async (data: OrderFormData, saveAndConfirm: boolean = false) => {
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

    const { hasExempt, hasTaxable, hasUnknown } = getVatFlags();
    if (hasExempt && hasTaxable) {
      toast.error('Cannot mix VAT-exempt and VATable items in the same order.');
      return;
    }
    if (hasExempt && vatRatePercent > 0) {
      toast.error('VAT rate must be 0% for VAT-exempt orders.');
      return;
    }
    if (hasTaxable && vatRatePercent <= 0) {
      toast.error('VAT rate must be greater than 0% for VATable orders.');
      return;
    }
    if (hasUnknown && (hasExempt || hasTaxable)) {
      toast.error('Select Finished Product for all items to enforce VAT exemption rules.');
      return;
    }

    try {
      setLoading(true);

      // Determine prepared_from based on source
      let preparedFrom = 'direct';
      if ((window as any).orderQuotationId) {
        preparedFrom = 'quotation';
      } else if ((window as any).orderCostingId) {
        preparedFrom = 'costing';
      }

      const orderData = {
        ...data,
        subtotal: subtotal,
        discount: discount,
        delivery_charge: deliveryCharge,
        vat_rate: vatRatePercent / 100,
        vat_amount: vatAmount,
        net_total: total,
        status: saveAndConfirm ? 'confirmed' : 'draft',
        quotation: (window as any).orderQuotationId || null,
        costing: (window as any).orderCostingId || null,
        costing_sheet_ids: (window as any).orderCostingSheetIds || [],
        prepared_from: preparedFrom,
        prepared_reff: quotationReference || null,
        items: items.map((item) => ({
          item_name: item.item,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.price,
          finished_product_id: item.finished_product_id || null,
          costing_sheet_id: item.costing_sheet_id || null,
        })),
      };

      const response = await ordersAPI.createOrder(orderData);

      // Mark as saved to prevent warning
      setIsSaved(true);

      // Disable navigation warnings before redirect
      navigationEnabledRef.current = false;

      // Store the newly created order ID for highlighting on the list page
      const orderId = response.data.id;
      sessionStorage.setItem('newlyOrderId', orderId.toString());

      toast.success('Order created successfully');

      // Use a small delay before redirect to ensure state updates complete
      setTimeout(() => {
        router.push('/dashboard/sales/orders');
      }, 100);
    } catch (error) {
      const errorMessage = getErrorMessage(error as any);
      toast.error(`Failed to create order: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (shouldShowWarning()) {
      setPendingNavigation(() => () => {
        router.push('/dashboard/sales/orders');
      });

      setShowConfirmDialog(true);
    } else {
      router.push('/dashboard/sales/orders');
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

  // Handle save actions
  const handleSaveDraft = async (data: OrderFormData) => {
    await onSubmit(data, false);
  };

  const handleSaveAndConfirm = async (data: OrderFormData) => {
    await onSubmit(data, true);
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
                New Order
                {quotationReference && (
                  <span className="ml-2 text-base font-normal text-purple-600 dark:text-purple-400">
                    (from {quotationReference})
                  </span>
                )}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Sales / Orders / New Order</p>
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
                  <span>{loading ? 'Saving...' : 'Save Order'}</span>
                  <HiChevronDown className="ml-2 h-4 w-4" />
                </button>
              )}
            >
              <Dropdown.Item onClick={handleSubmit(handleSaveDraft)}>
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
              <Dropdown.Item onClick={handleSubmit(handleSaveAndConfirm)}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Save and Confirm
              </Dropdown.Item>
            </Dropdown>
          ) : (
            <Button
              disabled={true}
              className="bg-gray-400 cursor-not-allowed"
              tabIndex={items.length * 4 + 12}
            >
              Save Order
            </Button>
          )}
        </div>

        <form onSubmit={handleSubmit(handleSaveDraft)} className="space-y-4">
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
                onClick={handleSubmit(handleSaveDraft)}
                disabled={loading || !isFormValid()}
                className={`${isFormValid() ? 'bg-teal-600 hover:bg-teal-700' : 'bg-gray-400 cursor-not-allowed'}`}
                tabIndex={items.length * 4 + 13}
              >
                {loading ? 'Saving...' : 'Save Order'}
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
export default function NewOrderPageWrapper() {
  return (
    <Suspense fallback={<div className="p-4">Loading...</div>}>
      <NewOrderPage />
    </Suspense>
  );
}
