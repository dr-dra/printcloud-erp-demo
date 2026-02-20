'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useRef } from 'react';
import { Button, Spinner, Dropdown } from 'flowbite-react';
import { StandardTextInput } from '@/components/common/inputs';
import { HiArrowLeft, HiChevronDown } from 'react-icons/hi';
import DashboardLayout from '@/components/DashboardLayout';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  CostingSheet,
  CostingVariant,
  SheetAction,
  COMPONENT_DEFINITIONS,
  ComponentType,
} from '@/types/costing';
import { createDefaultVariant } from '@/utils/formulaUtils';
import CostingGrid from '@/components/costing/CostingGrid';
import TypeaheadInput from '@/components/common/TypeaheadInput';
import CustomerModal from '@/components/common/CustomerModal';

interface Customer {
  id: number;
  name: string;
  email?: string;
  contact?: string;
}

interface _SalesPerson {
  id: number;
  full_name: string;
  user: string;
  department?: string;
  designation?: string;
}

export default function NewCostingPage() {
  const { loading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  // Costing Sheet State
  const [costingSheet, setCostingSheet] = useState<CostingSheet>({
    project_name: '',
    customer: undefined,
    sales_person: undefined,
    notes: '',
    is_outbound: false,
    is_active: true,
    variants: [],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<{
    id: number | string;
    name: string;
    secondary?: string;
  } | null>(null);
  const [selectedSalesPerson, setSelectedSalesPerson] = useState<{
    id: number | string;
    name: string;
    secondary?: string;
  } | null>(null);

  // Customer Modal State
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  // Ref for project name input to auto-focus
  const projectNameRef = useRef<HTMLInputElement>(null);

  // Initialize with default sheet and auto-load current user's employee info
  useEffect(() => {
    // Initialize with one default sheet
    const defaultVariant = createDefaultVariant('', 500, 0);

    // Create default components
    const componentOrder: ComponentType[] = [
      'paper',
      'board',
      'artwork',
      'plates',
      'printing',
      'ink',
      'blocks',
      'cutting',
      'folding',
      'binding',
      'misc',
      'transport',
      'discount',
      'lamination',
      'overheads',
    ];

    const defaultComponents = componentOrder.map((type, index) => ({
      component_type: type,
      name: COMPONENT_DEFINITIONS[type],
      formula: '',
      calculated_cost: 0,
      sort_order: index,
      is_active: true,
    }));

    setCostingSheet((prev) => ({
      ...prev,
      variants: [
        {
          ...defaultVariant,
          components: defaultComponents,
        },
      ],
    }));

    // Auto-load current user's employee information
    const loadCurrentUserEmployee = async () => {
      try {
        const response = await api.get('/employees/employees/me/');
        const employee = response.data;

        // Set the current user as the sales person
        const salesPersonOption = {
          id: employee.id,
          name: employee.full_name,
          secondary: employee.department || employee.designation || '',
        };

        setSelectedSalesPerson(salesPersonOption);
        setCostingSheet((prev) => ({
          ...prev,
          sales_person: employee.id,
        }));

        console.log('✅ Auto-loaded sales person:', employee.full_name);
      } catch (error: any) {
        if (error.response?.status === 404) {
          console.log(
            'ℹ️ Current user does not have an employee record - sales person field will remain empty',
          );
        } else {
          console.error('❌ Error loading current user employee info:', error);
        }
        // This is normal if the current user doesn't have an employee record
      }
    };

    loadCurrentUserEmployee();
  }, []);

  // Auto-focus project name field when component mounts
  useEffect(() => {
    if (projectNameRef.current) {
      projectNameRef.current.focus();
    }
  }, []);

  // Navigation handlers
  const handleBackToList = () => {
    router.push('/dashboard/sales/costing');
  };

  const handleSheetAction = (action: SheetAction, index?: number) => {
    switch (action) {
      case 'add': {
        // Pre-populate with the same sheet name as the previous sheet (last sheet)
        const previousSheetName =
          costingSheet.variants.length > 0
            ? costingSheet.variants[costingSheet.variants.length - 1].name
            : '';

        const newVariant = createDefaultVariant(
          previousSheetName || '',
          500,
          costingSheet.variants.length,
        );

        // Create default components for new sheet
        const componentOrder: ComponentType[] = [
          'paper',
          'board',
          'artwork',
          'plates',
          'printing',
          'ink',
          'blocks',
          'cutting',
          'folding',
          'binding',
          'misc',
          'transport',
          'discount',
          'lamination',
          'overheads',
        ];

        const defaultComponents = componentOrder.map((type, sortIndex) => ({
          component_type: type,
          name: COMPONENT_DEFINITIONS[type],
          formula: '',
          calculated_cost: 0,
          sort_order: sortIndex,
          is_active: true,
        }));

        setCostingSheet((prev) => ({
          ...prev,
          variants: [...prev.variants, { ...newVariant, components: defaultComponents }],
        }));
        break;
      }

      case 'clone': {
        if (index !== undefined && costingSheet.variants[index]) {
          const sourceVariant = costingSheet.variants[index];
          const clonedVariant = {
            ...sourceVariant,
            id: undefined, // Remove ID for new variant
            name: `${sourceVariant.name} - Copy`,
            sort_order: costingSheet.variants.length,
            is_locked: false, // Cloned sheets are never locked
            components: sourceVariant.components.map((comp) => ({
              ...comp,
              id: undefined, // Remove ID for new components
            })),
          };

          setCostingSheet((prev) => ({
            ...prev,
            variants: [...prev.variants, clonedVariant],
          }));
        }
        break;
      }

      case 'delete': {
        if (
          index !== undefined &&
          costingSheet.variants.length > 1 &&
          !costingSheet.variants[index].is_locked
        ) {
          setCostingSheet((prev) => ({
            ...prev,
            variants: prev.variants.filter((_, i) => i !== index),
          }));
        }
        break;
      }
    }
  };

  const _handleSheetRename = (index: number, newName: string) => {
    setCostingSheet((prev) => ({
      ...prev,
      variants: prev.variants.map((variant, i) =>
        i === index ? { ...variant, name: newName } : variant,
      ),
    }));
  };

  const handleVariantChange = (index: number, updatedVariant: CostingVariant) => {
    setCostingSheet((prev) => ({
      ...prev,
      variants: prev.variants.map((variant, i) => (i === index ? updatedVariant : variant)),
    }));
  };

  const handleSaveCosting = async (
    redirectToList = true,
  ): Promise<{ costingId: number; sheetIds: number[] } | null> => {
    // Validation 1: Project name is required
    if (!costingSheet.project_name.trim()) {
      toast.error('Please enter a project name');
      return null;
    }

    // Validation 2: At least one variant/sheet is required
    if (costingSheet.variants.length === 0) {
      toast.error('Please add at least one costing sheet');
      return null;
    }

    // Validation 3: All sheets must have names
    const emptySheetNames = costingSheet.variants
      .map((variant, index) => ({ variant, index }))
      .filter(({ variant }) => !variant.name.trim());

    if (emptySheetNames.length > 0) {
      const sheetNumbers = emptySheetNames.map(({ index }) => index + 1).join(', ');
      toast.error(`Please enter sheet name(s) for sheet(s): ${sheetNumbers}`);
      return null;
    }

    // Validation 4: Customer is required
    if (!costingSheet.customer) {
      toast.error('Please select a customer');
      return null;
    }

    setIsSaving(true);
    try {
      const response = await api.post('/costings/costing-sheets/', costingSheet);

      console.log('[CostingNew] Response data:', response.data);

      if (response.data && (response.data.id || response.data.costingId)) {
        const costingId = response.data.costingId || response.data.id;
        const sheetIds = Array.isArray(response.data.sheets)
          ? response.data.sheets.map((sheet: { id: number }) => sheet.id)
          : [];

        console.log('[CostingNew] Successfully created costing ID:', costingId);

        // Store newly created costing ID in sessionStorage for highlighting
        sessionStorage.setItem('newlyCostingId', costingId.toString());

        toast.success(`Costing #${costingId} Successfully saved`);

        // Redirect to costing list
        if (redirectToList) {
          router.push('/dashboard/sales/costing');
        }
        return { costingId, sheetIds };
      } else {
        console.warn('[CostingNew] Unexpected response structure:', response.data);
        toast.error('Costing saved but response format unexpected. Refreshing...');
        // Still redirect even if response is unexpected
        if (redirectToList) {
          setTimeout(() => router.push('/dashboard/sales/costing'), 1000);
        }
        return null;
      }
    } catch (error: any) {
      console.error('[CostingNew] Full error object:', error);
      console.error('[CostingNew] Error response status:', error.response?.status);
      console.error('[CostingNew] Error response data:', error.response?.data);
      console.error('[CostingNew] Error message:', error.message);

      // Extract detailed error message
      let errorMessage = 'Error saving costing sheet. Please try again.';

      if (
        error.response?.status === 500 ||
        error.response?.status === 502 ||
        error.response?.status === 503
      ) {
        errorMessage = 'Server error. Please contact support if the problem persists.';
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.data?.non_field_errors) {
        errorMessage = Array.isArray(error.response.data.non_field_errors)
          ? error.response.data.non_field_errors[0]
          : error.response.data.non_field_errors;
      } else if (typeof error.response?.data === 'string') {
        errorMessage = error.response.data;
      } else if (error.message) {
        errorMessage = error.message;
      }

      console.error('[CostingNew] Final error message:', errorMessage);
      toast.error(errorMessage);
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateQuotation = (costingId: number | null = null, sheetIds: number[] = []) => {
    if (!costingSheet.project_name.trim()) {
      toast.error('Please enter a project name');
      return;
    }

    // Validate that all sheets have names
    const emptySheetNames = costingSheet.variants
      .map((variant, index) => ({ variant, index }))
      .filter(({ variant }) => !variant.name.trim());

    if (emptySheetNames.length > 0) {
      const sheetNumbers = emptySheetNames.map(({ index }) => index + 1).join(', ');
      toast.error(`Please enter sheet name(s) for sheet(s): ${sheetNumbers}`);
      return;
    }

    // Get all sheets (since we're creating from unsaved costing, all sheets are included)
    const selectedSheets = costingSheet.variants;

    // Prepare quotation data (use Ex-VAT pricing)
    const quotationData = {
      customer_name: selectedCustomer?.name || '',
      customer_id: selectedCustomer?.id || null,
      project_name: costingSheet.project_name,
      costing_id: costingId,
      costing_sheet_ids: sheetIds,
      line_items: selectedSheets.map((sheet, index) => {
        const quantity = sheet.quantity || 0;
        const unitPriceExVatRaw =
          quantity > 0 ? (sheet.sub_total + sheet.profit_amount) / quantity : 0;
        const unitPriceExVat = Number(unitPriceExVatRaw.toFixed(2));
        const lineTotalExVat = Number((unitPriceExVat * quantity).toFixed(2));

        return {
          item: sheet.name,
          description: `${costingSheet.project_name} - ${sheet.name}`,
          quantity,
          unit_price: unitPriceExVat,
          total: lineTotalExVat,
          costing_sheet_id: sheetIds[index] || null,
          finished_product_name: sheet.name,
          finished_product_id: sheet.finished_product_id || null,
          tax_percentage: sheet.tax_percentage || 0,
        };
      }),
    };

    // Store quotation data in sessionStorage and navigate with clean URL
    sessionStorage.setItem('quotationDraft', JSON.stringify(quotationData));
    router.push('/dashboard/sales/quotations/new?from=costing');
  };

  const handleCreateOrder = (costingId: number | null = null, sheetIds: number[] = []) => {
    if (!costingSheet.project_name.trim()) {
      toast.error('Please enter a project name');
      return;
    }

    const emptySheetNames = costingSheet.variants
      .map((variant, index) => ({ variant, index }))
      .filter(({ variant }) => !variant.name.trim());

    if (emptySheetNames.length > 0) {
      const sheetNumbers = emptySheetNames.map(({ index }) => index + 1).join(', ');
      toast.error(`Please enter sheet name(s) for sheet(s): ${sheetNumbers}`);
      return;
    }

    const selectedSheets = costingSheet.variants;

    const orderData = {
      customer_name: selectedCustomer?.name || '',
      customer_id: selectedCustomer?.id || null,
      costing_id: costingId,
      costing_sheet_ids: sheetIds,
      line_items: selectedSheets.map((sheet, index) => {
        const quantity = sheet.quantity || 0;
        const unitPriceExVatRaw =
          quantity > 0 ? (sheet.sub_total + sheet.profit_amount) / quantity : 0;
        const unitPriceExVat = Number(unitPriceExVatRaw.toFixed(2));
        const lineTotalExVat = Number((unitPriceExVat * quantity).toFixed(2));

        return {
          item: sheet.name,
          description: '',
          quantity,
          unit_price: unitPriceExVat,
          total: lineTotalExVat,
          costing_sheet_id: sheetIds[index] || null,
          finished_product_id: sheet.finished_product_id || null,
          tax_percentage: sheet.tax_percentage || 0,
        };
      }),
    };

    sessionStorage.setItem('orderDraft', JSON.stringify(orderData));
    router.push('/dashboard/sales/orders/new?from=costing');
  };

  const handleSaveAndCreateQuotation = async () => {
    const result = await handleSaveCosting(false);
    if (result) {
      handleCreateQuotation(result.costingId, result.sheetIds);
    }
  };

  const handleSaveAndCreateOrder = async () => {
    const result = await handleSaveCosting(false);
    if (result) {
      handleCreateOrder(result.costingId, result.sheetIds);
    }
  };

  // Search functions for autocomplete
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

  const searchSalesPersons = async (query: string) => {
    try {
      const response = await api.get(`/employees/employees/?search=${encodeURIComponent(query)}`);
      return response.data.results.map((employee: any) => ({
        id: employee.id,
        name: employee.full_name,
        secondary: employee.user || '',
      }));
    } catch (error) {
      console.error('Error searching sales persons:', error);
      return [];
    }
  };

  const getTopSalesPersons = async () => {
    try {
      const response = await api.get(`/employees/employees/?limit=5`);
      return response.data.results.map((employee: any) => ({
        id: employee.id,
        name: employee.full_name,
        secondary: employee.user || '',
      }));
    } catch (error) {
      console.error('Error getting top sales persons:', error);
      return [];
    }
  };

  // Handle customer/sales person changes
  const handleCustomerChange = (
    customer: { id: number | string; name: string; secondary?: string } | null,
  ) => {
    setSelectedCustomer(customer);
    setCostingSheet((prev) => ({
      ...prev,
      customer: customer ? Number(customer.id) : undefined,
    }));
  };

  const handleSalesPersonChange = (
    salesPerson: { id: number | string; name: string; secondary?: string } | null,
  ) => {
    setSelectedSalesPerson(salesPerson);
    setCostingSheet((prev) => ({
      ...prev,
      sales_person: salesPerson ? Number(salesPerson.id) : undefined,
    }));
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
    setCostingSheet((prev) => ({
      ...prev,
      customer: customer.id,
    }));

    // Close the modal
    setShowCustomerModal(false);
  };

  // Show loading state while auth is being checked
  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="p-4">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <span className="ml-2 text-gray-600">Checking authentication...</span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="p-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <Button color="gray" onClick={handleBackToList} className="flex items-center">
              <HiArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                New Cost Estimate
              </h1>
            </div>
          </div>
        </div>

        {/* Costing Sheet Creation Interface */}
        <div className="space-y-3">
          {/* Header Form Section */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3 rounded-lg shadow">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Project Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Project Name
                </label>
                <StandardTextInput
                  ref={projectNameRef}
                  type="text"
                  value={costingSheet.project_name}
                  onChange={(e) =>
                    setCostingSheet((prev) => ({ ...prev, project_name: e.target.value }))
                  }
                  placeholder="Enter project name..."
                  className="w-full"
                />
              </div>

              {/* Customer */}
              <div>
                <TypeaheadInput
                  value={selectedCustomer}
                  onChange={handleCustomerChange}
                  placeholder="Search customers..."
                  searchFunction={searchCustomers}
                  getInitialOptions={getTopCustomers}
                  label="Customer"
                  onAddNew={handleAddNewCustomer}
                  addNewLabel="Add Customer"
                  className="w-full"
                />
              </div>

              {/* Sales Person */}
              <div>
                <TypeaheadInput
                  value={selectedSalesPerson}
                  onChange={handleSalesPersonChange}
                  placeholder="Search sales persons..."
                  searchFunction={searchSalesPersons}
                  getInitialOptions={getTopSalesPersons}
                  label="Sales Person"
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Main Costing Grid Container */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3 rounded-lg shadow">
            <div className="overflow-x-auto">
              <div className="flex space-x-1 min-w-max">
                {costingSheet.variants.map((variant, index) => (
                  <div
                    key={variant.id || index}
                    className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-sm flex-shrink-0"
                  >
                    <CostingGrid
                      variant={variant}
                      onVariantChange={(updatedVariant) => {
                        handleVariantChange(index, updatedVariant);
                      }}
                      isFirstSheet={index === 0}
                      isLastSheet={index === costingSheet.variants.length - 1}
                      showOnlyCalculation={index > 0}
                      totalSheets={costingSheet.variants.length}
                      sheetIndex={index}
                      onSheetAction={handleSheetAction}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3 rounded-lg shadow">
            <div className="flex items-center justify-end">
              <div className="flex space-x-3">
                <Dropdown
                  label=""
                  dismissOnClick={true}
                  renderTrigger={() => (
                    <button
                      disabled={isSaving}
                      className={`flex items-center justify-center px-4 py-2 text-sm font-medium text-white rounded-lg focus:ring-4 focus:outline-none bg-blue-600 hover:bg-blue-700 focus:ring-blue-300 ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      Save & Create
                      <HiChevronDown className="ml-2 h-4 w-4" />
                    </button>
                  )}
                >
                  <Dropdown.Item onClick={handleSaveAndCreateQuotation}>
                    Save & Create Quotation
                  </Dropdown.Item>
                  <Dropdown.Item onClick={handleSaveAndCreateOrder}>
                    Save & Create Order
                  </Dropdown.Item>
                </Dropdown>

                <Button
                  onClick={() => handleSaveCosting(true)}
                  disabled={isSaving || !costingSheet.project_name.trim()}
                  className="bg-green-600 hover:bg-green-700 focus:ring-green-300 text-white border-green-600 hover:border-green-700 focus:ring-4 disabled:bg-gray-400 disabled:border-gray-400 disabled:cursor-not-allowed"
                >
                  {isSaving ? <Spinner size="sm" className="mr-2" /> : null}
                  Save Costing
                </Button>
              </div>
            </div>
          </div>
        </div>
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
