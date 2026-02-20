'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect } from 'react';
import { Button, Spinner, Dropdown } from 'flowbite-react';
import { StandardTextInput } from '@/components/common/inputs';
import { HiArrowLeft, HiChevronDown } from 'react-icons/hi';
import DashboardLayout from '@/components/DashboardLayout';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  CostingSheet,
  CostingVariant,
  SheetAction,
  COMPONENT_DEFINITIONS,
  ComponentType,
} from '@/types/costing';
import {
  createDefaultVariant,
  mapJsonToComponents,
  mapComponentsToJson,
} from '@/utils/formulaUtils';
import CostingGrid from '@/components/costing/CostingGrid';
import AutocompleteInput from '@/components/common/AutocompleteInput';
import CustomerModal from '@/components/common/CustomerModal';

interface Customer {
  id: number;
  name: string;
  email?: string;
  contact?: string;
}

interface CostingEstimatingDetail {
  id: number;
  costingId: number;
  customerId?: number;
  customerName?: string;
  projectName?: string;
  notes?: string;
  isOutbound: boolean;
  isActive: boolean;
  createdBy?: number;
  createdDate?: string;
  sheets: CostingSheetDetail[];
  customer_data?: {
    id: number;
    name: string;
    email?: string;
    contact?: string;
  } | null;
  sales_person_data?: {
    id: number;
    name: string;
    user?: string;
  } | null;
}

interface CostingSheetDetail {
  id: number;
  costingId: number;
  quantity?: string | number;
  subTotal?: string | number;
  profitMargin?: string | number;
  profitAmount?: string | number;
  taxPercentage?: string | number;
  taxProfitAmount?: string | number;
  total?: string | number;
  unitPrice?: string | number;
  formulas?: any;
  activeSheet: number;
  is_locked: number;
}

export default function ViewEditCostingPage() {
  const { loading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const params = useParams();
  const costingId = params.id as string;

  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const [originalData, setOriginalData] = useState<CostingEstimatingDetail | null>(null);
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

  // Change detection state
  const [hasChanges, setHasChanges] = useState(false);
  const [originalCostingSheet, setOriginalCostingSheet] = useState<CostingSheet | null>(null);

  // Fetch costing data
  useEffect(() => {
    const fetchCostingData = async () => {
      if (!costingId) return;

      try {
        setLoading(true);
        setError(null);

        const response = await api.get(`/costings/costing-sheets/${costingId}/`);
        const data: CostingEstimatingDetail = response.data;
        setOriginalData(data);

        // Convert backend data to frontend format
        const variants: CostingVariant[] = data.sheets.map((sheet, index) => {
          let components: any[] = [];

          // If formulas exist, parse them using the new utility function
          if (sheet.formulas) {
            const formulaData =
              typeof sheet.formulas === 'string' ? JSON.parse(sheet.formulas) : sheet.formulas;

            // Use the mapping utility to convert JSON to components
            components = mapJsonToComponents(formulaData);
          }

          // If no components, create default ones (fallback)
          if (components.length === 0) {
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

            components = componentOrder.map((type, sortIndex) => ({
              component_type: type,
              name: COMPONENT_DEFINITIONS[type],
              formula: '',
              calculated_cost: 0,
              sort_order: sortIndex,
              is_active: true,
            }));
          }

          return {
            id: sheet.id,
            name: sheet.name || `Sheet ${(index + 1).toString().padStart(2, '0')}`,
            finished_product_id: sheet.finished_product_id,
            quantity: parseFloat(String(sheet.quantity || 0)) || 0,
            profit_margin: parseFloat(String(sheet.profitMargin || 0)) || 0,
            profit_amount: parseFloat(String(sheet.profitAmount || 0)) || 0,
            tax_percentage: parseFloat(String(sheet.taxPercentage || 0)) || 0,
            tax_profit_amount: parseFloat(String(sheet.taxProfitAmount || 0)) || 0,
            sub_total: parseFloat(String(sheet.subTotal || 0)) || 0,
            total: parseFloat(String(sheet.total || 0)) || 0,
            unit_price: parseFloat(String(sheet.unitPrice || 0)) || 0,
            is_included: sheet.activeSheet === 1,
            is_locked: sheet.is_locked === 1,
            linked_quotation_id: sheet.linked_quotation_id || null,
            linked_quotation_number: sheet.linked_quotation_number || null,
            linked_order_id: sheet.linked_order_id || null,
            linked_order_number: sheet.linked_order_number || null,
            sort_order: index,
            components: components,
          };
        });

        // Use customer data from backend (already fetched with legacy_id mapping)
        let customerData = null;
        if (data.customer_data) {
          customerData = {
            id: data.customer_data.id,
            name: data.customer_data.name,
            secondary: data.customer_data.email || data.customer_data.contact || '',
          };
        } else if (data.customerName) {
          // Fallback to customerName from estimating record
          customerData = {
            id: data.customerId || 0,
            name: data.customerName,
            secondary: '',
          };
        }

        // Use sales person data from backend (already fetched with legacy_id mapping)
        let salesPersonData = null;
        if (data.sales_person_data) {
          salesPersonData = {
            id: data.sales_person_data.id,
            name: data.sales_person_data.name,
            secondary: data.sales_person_data.user || '',
          };
        }

        // Set the costing sheet state
        const loadedCostingSheet = {
          id: data.id,
          project_name: data.projectName || '',
          customer: data.customerId,
          customer_name: data.customerName,
          sales_person: data.createdBy,
          notes: data.notes || '',
          is_outbound: data.isOutbound,
          is_active: data.isActive,
          variants: variants,
        };

        setCostingSheet(loadedCostingSheet);

        // Store original data for change detection
        setOriginalCostingSheet(JSON.parse(JSON.stringify(loadedCostingSheet)));
        setHasChanges(false);

        // Set selected customer and sales person
        setSelectedCustomer(customerData);
        setSelectedSalesPerson(salesPersonData);
      } catch (err: any) {
        console.error('Error fetching costing data:', err);
        setError('Failed to load costing data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchCostingData();
  }, [costingId]);

  // Change detection effect
  useEffect(() => {
    if (!originalCostingSheet) return;

    // Compare current state with original state
    const currentJson = JSON.stringify(costingSheet);
    const originalJson = JSON.stringify(originalCostingSheet);
    const hasDataChanges = currentJson !== originalJson;

    setHasChanges(hasDataChanges);
  }, [costingSheet, originalCostingSheet]);

  // Navigation handlers
  const handleBackToList = () => {
    // Use router.back() to return to the previous page with preserved state
    router.back();
  };

  const handleSheetAction = (action: SheetAction, index?: number) => {
    switch (action) {
      case 'add': {
        const newSheetNumber = costingSheet.variants.length + 1;
        const newVariant = createDefaultVariant(
          `Sheet ${newSheetNumber.toString().padStart(2, '0')}`,
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
          // Generate a unique temp ID for the cloned variant to ensure proper React key
          const tempId = `clone-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const clonedVariant: CostingVariant = {
            ...sourceVariant,
            id: tempId as any, // Use temp ID for proper React key handling (will be undefined when saving)
            name: sourceVariant.name, // Keep the same finished product name
            finished_product_id: sourceVariant.finished_product_id, // Keep the same finished product reference
            sort_order: costingSheet.variants.length,
            is_locked: false, // Cloned sheets are never locked
            is_included: true, // Cloned sheets should be included by default
            linked_quotation_id: null, // Remove any document link
            linked_quotation_number: null,
            linked_order_id: null,
            linked_order_number: null,
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

  // Validation function to check if all sheets have valid finished products
  const validateFinishedProducts = (): { isValid: boolean; invalidSheets: string[] } => {
    const invalidSheets: string[] = [];

    costingSheet.variants.forEach((variant, index) => {
      // Check if finished_product_id is missing or invalid
      if (!variant.finished_product_id) {
        const sheetName = variant.name || `Sheet ${(index + 1).toString().padStart(2, '0')}`;
        invalidSheets.push(sheetName);
      }
    });

    return {
      isValid: invalidSheets.length === 0,
      invalidSheets,
    };
  };

  const handleSaveCosting = async () => {
    if (!costingSheet.project_name.trim()) {
      alert('Please enter a project name');
      return;
    }

    // Validate finished products
    const validation = validateFinishedProducts();
    if (!validation.isValid) {
      toast.error(
        `Please select a valid Finished Product for: ${validation.invalidSheets.join(', ')}`,
        { duration: 5000 },
      );
      return;
    }

    setIsSaving(true);
    try {
      // Prepare the data for backend API
      const saveData = {
        project_name: costingSheet.project_name,
        customer: costingSheet.customer,
        notes: costingSheet.notes,
        is_outbound: costingSheet.is_outbound,
        is_active: costingSheet.is_active,
        variants: costingSheet.variants.map((variant) => {
          // Convert components to JSON format for backend storage
          const formulasJson = mapComponentsToJson(variant.components, variant);

          // Check if ID is a temporary clone ID (starts with "clone-") - send undefined for new sheets
          const variantIdStr = String(variant.id || '');
          const isNewSheet = !variant.id || variantIdStr.startsWith('clone-');

          return {
            id: isNewSheet ? undefined : variant.id, // Include ID for existing sheets, undefined for new sheets
            name: variant.name,
            finished_product_id: variant.finished_product_id,
            quantity: variant.quantity,
            profit_margin: variant.profit_margin,
            profit_amount: variant.profit_amount,
            tax_percentage: variant.tax_percentage,
            tax_profit_amount: variant.tax_profit_amount,
            sub_total: variant.sub_total,
            total: variant.total,
            unit_price: variant.unit_price,
            is_included: variant.is_included,
            is_locked: variant.is_locked,
            formulas: formulasJson, // Send converted JSON format
            components: variant.components, // Also send components for backend processing
          };
        }),
      };

      const response = await api.put(`/costings/costing-sheets/${costingId}/`, saveData);

      if (response.data.id) {
        const costingNumber = response.data.costingId || response.data.id;

        // Store updated costing ID in sessionStorage for highlighting
        sessionStorage.setItem('updatedCostingId', costingNumber.toString());

        toast.success(`Costing #${costingNumber} Successfully updated`);

        // Redirect to costing list page
        router.push('/dashboard/sales/costing');
      }
    } catch (error: any) {
      console.error('Error updating costing sheet:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      toast.error(`Error updating costing sheet: ${error.response?.data?.detail || error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateQuotation = () => {
    // Get selected (included) sheets that are not locked
    const selectedSheets = costingSheet.variants.filter(
      (variant) => variant.is_included && !variant.is_locked,
    );

    if (selectedSheets.length === 0) {
      alert('Please select at least one unlocked sheet to include in the quotation');
      return;
    }

    // Prepare quotation data
    const quotationData = {
      customer_name: selectedCustomer?.name || costingSheet.customer_name || '',
      customer_id: selectedCustomer?.id || costingSheet.customer || null,
      project_name: costingSheet.project_name,
      costing_id: originalData?.id,
      costing_sheet_ids: selectedSheets.map((sheet) => sheet.id),
      line_items: selectedSheets.map((sheet) => {
        const quantity = sheet.quantity || 0;
        const unitPriceExVatRaw =
          quantity > 0 ? (sheet.sub_total + sheet.profit_amount) / quantity : 0;
        const unitPriceExVat = Number(unitPriceExVatRaw.toFixed(2));
        const lineTotalExVat = Number((unitPriceExVat * quantity).toFixed(2));

        return {
          item: sheet.name || '',
          description: '',
          quantity,
          unit_price: unitPriceExVat,
          total: lineTotalExVat,
          costing_sheet_id: sheet.id,
          finished_product_id: sheet.finished_product_id || null,
          tax_percentage: sheet.tax_percentage || 0,
        };
      }),
    };

    // Store quotation data in sessionStorage and navigate with clean URL
    sessionStorage.setItem('quotationDraft', JSON.stringify(quotationData));
    router.push('/dashboard/sales/quotations/new?from=costing');
  };

  const handleCreateOrder = () => {
    // Get selected (included) sheets that are not locked
    const selectedSheets = costingSheet.variants.filter(
      (variant) => variant.is_included && !variant.is_locked,
    );

    if (selectedSheets.length === 0) {
      alert('Please select at least one unlocked sheet to include in the order');
      return;
    }

    // Prepare order data
    const orderData = {
      customer_name: selectedCustomer?.name || costingSheet.customer_name || '',
      customer_id: selectedCustomer?.id || costingSheet.customer || null,
      costing_id: originalData?.id,
      costing_sheet_ids: selectedSheets.map((sheet) => sheet.id),
      line_items: selectedSheets.map((sheet) => {
        const quantity = sheet.quantity || 0;
        const unitPriceExVatRaw =
          quantity > 0 ? (sheet.sub_total + sheet.profit_amount) / quantity : 0;
        const unitPriceExVat = Number(unitPriceExVatRaw.toFixed(2));
        const lineTotalExVat = Number((unitPriceExVat * quantity).toFixed(2));

        return {
          item: sheet.name || '',
          description: '',
          quantity,
          unit_price: unitPriceExVat,
          total: lineTotalExVat,
          costing_sheet_id: sheet.id,
          finished_product_id: sheet.finished_product_id || null,
          tax_percentage: sheet.tax_percentage || 0,
        };
      }),
    };

    // Store order data in sessionStorage and navigate with clean URL
    sessionStorage.setItem('orderDraft', JSON.stringify(orderData));
    router.push('/dashboard/sales/orders/new?from=costing');
  };

  // Helper function to save costing and return success status
  const saveCostingData = async (): Promise<boolean> => {
    if (!costingSheet.project_name.trim()) {
      alert('Please enter a project name');
      return false;
    }

    // Validate finished products
    const validation = validateFinishedProducts();
    if (!validation.isValid) {
      toast.error(
        `Please select a valid Finished Product for: ${validation.invalidSheets.join(', ')}`,
        { duration: 5000 },
      );
      return false;
    }

    setIsSaving(true);
    try {
      const saveData = {
        project_name: costingSheet.project_name,
        customer: costingSheet.customer,
        notes: costingSheet.notes,
        is_outbound: costingSheet.is_outbound,
        is_active: costingSheet.is_active,
        variants: costingSheet.variants.map((variant) => {
          const formulasJson = mapComponentsToJson(variant.components, variant);
          // Check if ID is a temporary clone ID (starts with "clone-") - send undefined for new sheets
          const variantIdStr = String(variant.id || '');
          const isNewSheet = !variant.id || variantIdStr.startsWith('clone-');

          return {
            id: isNewSheet ? undefined : variant.id,
            name: variant.name,
            finished_product_id: variant.finished_product_id,
            quantity: variant.quantity,
            profit_margin: variant.profit_margin,
            profit_amount: variant.profit_amount,
            tax_percentage: variant.tax_percentage,
            tax_profit_amount: variant.tax_profit_amount,
            sub_total: variant.sub_total,
            total: variant.total,
            unit_price: variant.unit_price,
            is_included: variant.is_included,
            is_locked: variant.is_locked,
            formulas: formulasJson,
            components: variant.components,
          };
        }),
      };

      const response = await api.put(`/costings/costing-sheets/${costingId}/`, saveData);

      if (response.data.id) {
        const costingNumber = response.data.costingId || response.data.id;
        toast.success(`Costing #${costingNumber} Successfully updated`);

        // Update original data to reflect the save
        setOriginalCostingSheet(JSON.parse(JSON.stringify(costingSheet)));
        setHasChanges(false);

        return true;
      }
      return false;
    } catch (error: any) {
      console.error('Error updating costing sheet:', error);
      toast.error(`Error updating costing sheet: ${error.response?.data?.detail || error.message}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateAndCreateQuotation = async () => {
    // First save the costing
    const saved = await saveCostingData();
    if (saved) {
      // Then create the quotation
      handleCreateQuotation();
    }
  };

  const handleUpdateAndCreateOrder = async () => {
    // First save the costing
    const saved = await saveCostingData();
    if (saved) {
      // Then create the order
      handleCreateOrder();
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
    const customerOption = {
      id: customer.id,
      name: customer.name,
      secondary: customer.email || customer.contact || '',
    };

    setSelectedCustomer(customerOption);
    setCostingSheet((prev) => ({
      ...prev,
      customer: customer.id,
    }));

    setShowCustomerModal(false);
  };

  // Show loading state while auth is being checked or data is loading
  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="p-4">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <span className="ml-2 text-gray-600">
              {authLoading ? 'Checking authentication...' : 'Loading costing data...'}
            </span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  // Show error state
  if (error) {
    return (
      <DashboardLayout>
        <div className="p-4">
          <div className="flex flex-col items-center justify-center h-64">
            <div className="text-red-600 mb-4">{error}</div>
            <div className="space-x-4">
              <Button onClick={() => window.location.reload()}>Retry</Button>
              <Button onClick={handleBackToList} color="gray">
                Back to List
              </Button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
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
                {costingSheet.project_name || 'View/Edit Costing Sheet'}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Costing ID: {originalData?.costingId} • Created:{' '}
                {originalData?.createdDate
                  ? new Date(originalData.createdDate).toLocaleDateString()
                  : 'Unknown'}
              </p>
            </div>
          </div>
        </div>

        {/* Costing Sheet View/Edit Interface */}
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
                <AutocompleteInput
                  value={selectedCustomer}
                  onChange={handleCustomerChange}
                  placeholder="Search customers..."
                  searchFunction={searchCustomers}
                  label="Customer"
                  onAddNew={handleAddNewCustomer}
                  addNewLabel="Add Customer"
                  className="w-full"
                />
              </div>

              {/* Sales Person */}
              <div>
                <AutocompleteInput
                  value={selectedSalesPerson}
                  onChange={handleSalesPersonChange}
                  placeholder="Search sales persons..."
                  searchFunction={searchSalesPersons}
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
                    className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-sm flex-shrink-0 relative"
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
                {/* Create button - disabled if no unlocked sheets are selected */}
                {(() => {
                  const hasSelectableSheets = costingSheet.variants.some(
                    (v) => v.is_included && !v.is_locked,
                  );
                  const buttonLabel = hasChanges ? 'Update & Create...' : 'Create...';

                  return hasSelectableSheets ? (
                    <Dropdown
                      label=""
                      dismissOnClick={true}
                      renderTrigger={() => (
                        <button
                          type="button"
                          disabled={isSaving}
                          className={`flex items-center justify-center px-4 py-2 text-sm font-medium text-white rounded-lg focus:ring-4 focus:outline-none bg-blue-600 hover:bg-blue-700 focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800 ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {isSaving ? 'Saving...' : buttonLabel}
                          <HiChevronDown className="ml-2 h-4 w-4" />
                        </button>
                      )}
                    >
                      <Dropdown.Item
                        onClick={
                          hasChanges ? handleUpdateAndCreateQuotation : handleCreateQuotation
                        }
                      >
                        {hasChanges ? 'Update & Create Quotation' : 'Create Quotation using this'}
                      </Dropdown.Item>
                      <Dropdown.Item
                        onClick={hasChanges ? handleUpdateAndCreateOrder : handleCreateOrder}
                      >
                        {hasChanges ? 'Update & Create Order' : 'Create Order using this'}
                      </Dropdown.Item>
                    </Dropdown>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-400 bg-gray-200 rounded-lg cursor-not-allowed dark:bg-gray-700 dark:text-gray-500"
                      title="No unlocked sheets selected"
                    >
                      {buttonLabel}
                      <HiChevronDown className="ml-2 h-4 w-4" />
                    </button>
                  );
                })()}

                <Button
                  onClick={handleSaveCosting}
                  disabled={isSaving || !costingSheet.project_name.trim() || !hasChanges}
                  className="bg-green-600 hover:bg-green-700 focus:ring-green-300 text-white border-green-600 hover:border-green-700 focus:ring-4 disabled:bg-gray-400 disabled:border-gray-400 disabled:cursor-not-allowed"
                >
                  {isSaving ? <Spinner size="sm" className="mr-2" /> : null}
                  {hasChanges ? 'Update Costing' : 'No Changes'}
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
