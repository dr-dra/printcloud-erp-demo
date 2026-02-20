/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * POS - Designer View (Refactored)
 *
 * Main entry point for the Designer POS interface. Designers create orders
 * that are saved for payment at the cashier (Accounting POS).
 *
 * Features:
 * - Quick access grid for frequently used items
 * - Product search functionality
 * - Customer selection (walk-in or registered customer)
 * - Order creation and saving (no payment processing)
 * - Real-time WebSocket updates for order status
 *
 * Workflow:
 * 1. Designer adds items to cart
 * 2. Designer selects customer (walk-in or registered)
 * 3. Designer saves order (generates 3-digit code for customer)
 * 4. Customer takes code to cashier for payment
 *
 * This file has been refactored from 775 lines to ~150 lines by extracting:
 * - Customer search logic → useCustomerSearch hook
 * - Order cart management → useOrderCart hook
 * - Order operations → useOrderOperations hook
 * - UI components → 7 shared components from components/shared/
 *
 * @module POSPage
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import POSAddCustomerModal from './components/POSAddCustomerModal';
import POSAddCustomItemModal from './components/POSAddCustomItemModal';
import { toast } from 'sonner';
import type { POSQuickServiceItem, Customer, POSLocation } from '@/lib/posApi';
import { getQuickServiceItems, searchPOSProducts, getPOSLocations } from '@/lib/posApi';
import { useAuth } from '@/context/AuthContext';

// Import shared hooks
import { useCustomerSearch } from './hooks/useCustomerSearch';
import { useOrderCart } from './hooks/useOrderCart';
import { useOrderOperations } from './hooks/useOrderOperations';

// Import shared components
import { ConnectionStatusBanner } from './components/shared/ConnectionStatusBanner';
import { CustomerSelectionPanel } from './components/shared/CustomerSelectionPanel';
import { OrderItemsList } from './components/shared/OrderItemsList';
import { QuickAccessGrid } from './components/shared/QuickAccessGrid';
import { OrderSuccessModal } from './components/shared/OrderSuccessModal';
import { OrderSummaryPanel } from './components/shared/OrderSummaryPanel';

// WebSocket hook for real-time updates
import { useOrders } from '@/hooks/useOrders';

/**
 * POS Designer Page Component
 *
 * Main interface for designers to create orders. Orders are saved without payment
 * and given a 3-digit code for customers to pay at the cashier.
 *
 * @returns Designer POS page element
 */
export default function POSPage() {
  const { user } = useAuth();
  const router = useRouter();
  // ============================================================================
  // HOOKS & STATE
  // ============================================================================

  useEffect(() => {
    if (!user?.role) return;
    if (['admin', 'accounting', 'cashier'].includes(user.role)) {
      router.replace('/dashboard/sales/pos/accounting');
    }
  }, [user?.role, router]);

  // Customer search hook
  const customerSearch = useCustomerSearch();

  // Order cart hook
  const orderCart = useOrderCart();

  // Order operations hook
  const { isLoading, saveOrUpdateOrder } = useOrderOperations();

  // WebSocket connection for real-time updates
  const { connectionStatus } = useOrders({});

  // ============================================================================
  // LOCAL STATE (Designer-specific)
  // ============================================================================

  // Location selection
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  const [locations, setLocations] = useState<POSLocation[]>([]);

  // Quick access items and search
  const [quickServices, setQuickServices] = useState<POSQuickServiceItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [miscProductId, setMiscProductId] = useState<number | null>(null);

  // Modals
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showAddCustomItemModal, setShowAddCustomItemModal] = useState(false);
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);
  const [successOrderDisplayCode, setSuccessOrderDisplayCode] = useState('');

  // ============================================================================
  // EFFECTS
  // ============================================================================

  /**
   * Load initial data on mount
   */
  useEffect(() => {
    loadLocations();
    loadQuickServices();
    loadMiscProduct();
  }, []);

  /**
   * Product search with debouncing (300ms)
   */
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await searchPOSProducts(searchQuery, 9, 'sales_count');
        const resultsData = response.data?.results || response.data || [];
        setSearchResults(Array.isArray(resultsData) ? resultsData : []);
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  /**
   * Load available POS locations
   * Auto-selects the first location or restores from localStorage
   */
  const loadLocations = useCallback(async () => {
    try {
      const response = await getPOSLocations({ allow_sales: true });
      const locationData = response.data?.results || response.data || [];
      const locationsArray = Array.isArray(locationData) ? locationData : [];

      console.log('[Designer POS] Loaded locations:', locationsArray);
      setLocations(locationsArray);

      if (locationsArray.length === 0) {
        console.error('[Designer POS] No locations available!');
        toast.error('No POS locations available. Please contact administrator.');
        return;
      }

      // Try to restore location from localStorage, otherwise select first
      const storedLocationId = localStorage.getItem('selectedPOSLocation');
      if (storedLocationId && locationsArray.some((loc) => loc.id === parseInt(storedLocationId))) {
        const locationId = parseInt(storedLocationId);
        setSelectedLocation(locationId);
        console.log('[Designer POS] Restored location from localStorage:', locationId);
      } else if (locationsArray.length > 0) {
        setSelectedLocation(locationsArray[0].id);
        localStorage.setItem('selectedPOSLocation', locationsArray[0].id.toString());
        console.log('[Designer POS] Auto-selected first location:', locationsArray[0].id);
      }
    } catch (error) {
      console.error('[Designer POS] Failed to load locations:', error);
      toast.error('Failed to load locations. Please refresh the page.');
      setLocations([]);
    }
  }, []);

  /**
   * Load quick service items
   * Loads all quick services regardless of location
   */
  const loadQuickServices = useCallback(async () => {
    try {
      const response = await getQuickServiceItems(undefined, 9);
      const servicesData = response.data?.results || response.data || [];
      setQuickServices(Array.isArray(servicesData) ? servicesData : []);
    } catch (error) {
      console.error('Failed to load quick services:', error);
      setQuickServices([]);
    }
  }, []);

  /**
   * Load MISC product for custom items
   * Searches for 'MISC-CUSTOM' product to use for custom item entries
   */
  const loadMiscProduct = useCallback(async () => {
    try {
      const response = await searchPOSProducts('MISC-CUSTOM', 1);
      const products = response.data?.results || response.data || [];
      if (products.length > 0) {
        setMiscProductId(products[0].id);
      }
    } catch (error) {
      console.error('Failed to load misc product:', error);
    }
  }, []);

  // ============================================================================
  // DESIGNER SAVE LOGIC (Unique to Designer POS - not in shared hooks)
  // ============================================================================

  /**
   * Save order for payment at cashier
   * Generates 3-digit display code for customer
   */
  const handleDesignerSave = async () => {
    console.log('[Designer POS] Save clicked. Selected location:', selectedLocation);
    console.log('[Designer POS] Available locations:', locations);

    if (!selectedLocation) {
      if (locations.length === 0) {
        toast.error('No POS locations available. Please contact administrator.');
      } else {
        toast.error('Location not loaded. Please refresh the page.');
      }
      return;
    }

    try {
      const response = await saveOrUpdateOrder({
        orderItems: orderCart.orderItems,
        selectedCustomer: customerSearch.selectedCustomer,
        selectedLocation: selectedLocation!, // Use correct parameter name
        editingOrderId: null, // Designer always creates new orders
      });

      console.log('[Designer POS] Order saved successfully:', response);

      // Show success modal with 3-digit code
      if (response) {
        setSuccessOrderDisplayCode(response.display_code || response.order_number);
        setShowOrderSuccess(true);
      } else {
        console.error('[Designer POS] Response is null');
        toast.error('Order save failed - no response from server');
      }
    } catch (error) {
      console.error('[Designer POS] Failed to save order:', error);
      // Error handling in hook already shows toast
    }
  };

  /**
   * Reset form after successful order creation
   */
  const resetForm = () => {
    orderCart.resetCart();
    customerSearch.clearCustomer();
    setSearchQuery('');
    setSuccessOrderDisplayCode('');
  };

  /**
   * Handle customer added via modal
   */
  const handleCustomerAdded = (newCustomer: Customer) => {
    customerSearch.selectCustomer(newCustomer);
    setShowAddCustomerModal(false);
    toast.success('Customer added successfully');
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  // Quick access items: show search results when searching, otherwise quick services
  const displayedQuickAccessItems = searchQuery.length >= 2 ? searchResults : quickServices;

  return (
    <DashboardLayout>
      {/* Modals */}
      <POSAddCustomerModal
        show={showAddCustomerModal}
        onClose={() => setShowAddCustomerModal(false)}
        onSuccess={handleCustomerAdded}
      />
      <POSAddCustomItemModal
        show={showAddCustomItemModal}
        onClose={() => setShowAddCustomItemModal(false)}
        onSuccess={orderCart.addCustomItem}
        miscProductId={miscProductId || 0}
      />
      <OrderSuccessModal
        show={showOrderSuccess}
        orderNumber={successOrderDisplayCode}
        displayCode={successOrderDisplayCode}
        onClose={() => {
          setShowOrderSuccess(false);
          resetForm();
        }}
      />

      <div className="h-[calc(100vh-6rem)] flex flex-col p-3">
        {/* Connection Status Banner */}
        <ConnectionStatusBanner status={connectionStatus} />

        {/* Header */}
        <div className="flex justify-between items-center mb-3 flex-shrink-0">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">POS - Designer</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Create orders for payment at cashier
            </p>
          </div>
          <div className="flex items-center gap-6">
            {/* Location Display/Selector - Always show */}
            <div className="text-right">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                Location {!selectedLocation && <span className="text-red-500">*</span>}
              </div>
              {locations.length > 1 ? (
                <select
                  value={selectedLocation || ''}
                  onChange={(e) => {
                    const locationId = parseInt(e.target.value);
                    setSelectedLocation(locationId);
                    localStorage.setItem('selectedPOSLocation', locationId.toString());
                  }}
                  className="text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg px-3 py-1.5 focus:ring-primary-500 focus:border-primary-500"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              ) : selectedLocation && locations.length === 1 ? (
                <div className="text-base font-semibold text-gray-900 dark:text-white">
                  {locations[0].name}
                </div>
              ) : (
                <div className="text-sm text-red-500 dark:text-red-400">Loading...</div>
              )}
            </div>

            <div className="text-right">
              <div className="text-sm text-gray-500 dark:text-gray-400">Current Order</div>
              <div className="text-xl font-semibold text-gray-900 dark:text-white">
                {orderCart.orderItems.reduce((sum, item) => sum + item.quantity, 0)} items
              </div>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0 flex-1">
          {/* LEFT: Search + Quick Access */}
          <div className="lg:col-span-4 flex flex-col gap-3 min-h-0">
            <QuickAccessGrid
              items={displayedQuickAccessItems}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onAddItem={(item, quantityIncrement) => {
                if (searchQuery.length >= 2) {
                  orderCart.addSearchItem(item, quantityIncrement);
                } else {
                  orderCart.addQuickServiceItem(item as POSQuickServiceItem, quantityIncrement);
                }
              }}
              canAddCustom={!!miscProductId}
              onAddCustomItem={() => setShowAddCustomItemModal(true)}
            />
          </div>

          {/* CENTER: Order Items */}
          <div className="lg:col-span-4 flex flex-col gap-3 min-h-0">
            <OrderItemsList
              items={orderCart.orderItems}
              onQuantityChange={orderCart.updateQuantity}
              onRemove={orderCart.removeItem}
              editingOrderNumber={null}
            />
          </div>

          {/* RIGHT: Customer + Summary */}
          <div className="lg:col-span-4 flex flex-col gap-3 min-h-0">
            <CustomerSelectionPanel
              isWalkIn={customerSearch.isWalkIn}
              selectedCustomer={customerSearch.selectedCustomer}
              onCustomerChange={(customer) => customerSearch.selectCustomer(customer)}
              onAddCustomer={() => setShowAddCustomerModal(true)}
            />

            <OrderSummaryPanel
              subtotal={orderCart.subtotal}
              tax={orderCart.tax}
              total={orderCart.total}
              orderItems={orderCart.orderItems}
              connectionStatus={connectionStatus}
              onAction={handleDesignerSave}
              actionLabel={isLoading ? 'Saving...' : 'Save Order'}
              actionDisabled={orderCart.orderItems.length === 0 || isLoading || !selectedLocation}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
