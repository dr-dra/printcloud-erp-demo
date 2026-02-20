/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * POS - Accounting/Cashier View (Refactored)
 *
 * Main entry point for the Accounting/Cashier POS interface. This view supports both
 * order creation and payment processing with cash drawer session management.
 *
 * Features:
 * - Cash drawer session management (open, force close, active session)
 * - Order creation and editing
 * - Payment processing (cash, card, account, etc.)
 * - Retrieve pending orders by 3-digit code
 * - Real-time WebSocket updates for order status
 * - Management view toggle for advanced operations
 *
 * User Roles:
 * - Admin/Accounting/Cashier: Full access to payment processing and session management
 * - Other roles: Redirected to Designer POS
 *
 * Workflow:
 * 1. Cashier opens session with opening balance
 * 2. Cashier creates new orders or retrieves pending orders
 * 3. Cashier processes payments (cash/card/account)
 * 4. Cashier closes session at end of shift (Z-Report)
 *
 * This file has been refactored from 1,775 lines to ~420 lines by extracting:
 * - Customer search logic → useCustomerSearch hook
 * - Order cart management → useOrderCart hook
 * - Order operations → useOrderOperations hook
 * - Session management → useSessionManagement hook
 * - Payment processing → usePaymentProcessing hook
 * - UI components → 15+ shared and session-specific components
 *
 * @module AccountingPage
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MdOutlineDashboardCustomize } from 'react-icons/md';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import ManagementView from './ManagementView';
import {
  getQuickServiceItems,
  searchPOSProducts,
  getPendingOrders,
  getPOSLocations,
  completeOrderPayment,
} from '@/lib/posApi';
import type {
  POSQuickServiceItem,
  POSProductSearch,
  POSOrderListItem,
  POSLocation,
  Customer,
  PaymentData,
} from '@/lib/posApi';
import { useOrders } from '@/hooks/useOrders';
import POSAddCustomerModal from '../components/POSAddCustomerModal';
import POSAddCustomItemModal from '../components/POSAddCustomItemModal';
import { toast } from 'sonner';

// Import shared hooks
import { useCustomerSearch } from '../hooks/useCustomerSearch';
import { useOrderCart } from '../hooks/useOrderCart';
import { useOrderOperations } from '../hooks/useOrderOperations';
import { useSessionManagement } from '../hooks/useSessionManagement';
import { usePaymentProcessing } from '../hooks/usePaymentProcessing';

// Import shared components
import { ConnectionStatusBanner } from '../components/shared/ConnectionStatusBanner';
import { CustomerSelectionPanel } from '../components/shared/CustomerSelectionPanel';
import { OrderItemsList } from '../components/shared/OrderItemsList';
import { QuickAccessGrid } from '../components/shared/QuickAccessGrid';
import { OrderSuccessModal } from '../components/shared/OrderSuccessModal';
import { OrderSummaryPanel } from '../components/shared/OrderSummaryPanel';
import { VoidOrderModal } from '../components/shared/VoidOrderModal';
import { formatCurrency } from '../utils/currency';

// Import session components
import { OpenSessionView } from '../components/session/OpenSessionView';
import { ForceCloseSessionView } from '../components/session/ForceCloseSessionView';
import { PaymentInterface } from '../components/session/PaymentInterface';
import { RetrieveOrderPanel } from '../components/session/RetrieveOrderPanel';

/**
 * View mode type: transaction (normal POS operations) or management (admin dashboard)
 */
type ViewMode = 'transaction' | 'management';

/**
 * Accounting POS Page Component
 *
 * Main interface for cashiers to process orders and payments. Supports both simplified
 * order creation (for non-payment users) and full payment processing (for authorized users).
 *
 * @returns Accounting POS page element
 */
export default function AccountingPage() {
  const { user } = useAuth();
  const router = useRouter();

  // Check if user can process payments (admin, accounting, or cashier role)
  const canProcessPayments =
    user?.role === 'admin' || user?.role === 'accounting' || user?.role === 'cashier';

  useEffect(() => {
    if (!user?.role) return;
    if (!canProcessPayments) {
      router.replace('/dashboard/sales/pos');
    }
  }, [user?.role, canProcessPayments, router]);

  if (user?.role && !canProcessPayments) {
    return null;
  }

  // ============================================================================
  // HOOKS & STATE
  // ============================================================================

  // Customer search hook
  const customerSearch = useCustomerSearch();

  // Order cart hook
  const orderCart = useOrderCart();

  // Order operations hook
  const orderOperations = useOrderOperations();

  // Location selection
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  const [locations, setLocations] = useState<POSLocation[]>([]);

  // Session management hook (only for payment users)
  const sessionManagement = useSessionManagement(canProcessPayments ? selectedLocation : null);

  // Payment processing hook (only for payment users)
  const paymentProcessing = usePaymentProcessing(orderCart.total);

  // Pending orders (real-time + initial load)
  const [pendingOrders, setPendingOrders] = useState<POSOrderListItem[]>([]);
  const [combinedOrders, setCombinedOrders] = useState<POSOrderListItem[]>([]);

  // Load pending orders callback
  const loadPendingOrders = useCallback(async () => {
    if (!canProcessPayments) return;
    try {
      const response = await getPendingOrders();
      setPendingOrders(response.data);
    } catch (error) {
      console.error('Failed to load pending orders:', error);
    }
  }, [canProcessPayments]);

  // Real-time orders from WebSocket
  const { orders: realTimeOrders, connectionStatus } = useOrders({
    onReconnect: loadPendingOrders,
  });

  // ============================================================================
  // LOCAL STATE
  // ============================================================================

  // View mode toggle
  const [viewMode, setViewMode] = useState<ViewMode>('transaction');

  // Quick access items and search
  const [quickServices, setQuickServices] = useState<POSQuickServiceItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<POSProductSearch[]>([]);

  // Modals
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showAddCustomItemModal, setShowAddCustomItemModal] = useState(false);
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);
  const [successOrderDisplayCode, setSuccessOrderDisplayCode] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  // Misc product ID for custom items
  const [miscProductId, setMiscProductId] = useState<number | null>(null);

  // Payment mode toggle (only for payment users)
  const [isPaymentMode, setIsPaymentMode] = useState(false);

  // Payment processing loading state
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Void order modal state
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);

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
   * Load cash drawer session when location is selected (for payment users)
   */
  useEffect(() => {
    if (canProcessPayments && selectedLocation) {
      console.log('[Accounting POS] Loading session for location:', selectedLocation);
      sessionManagement.loadCashDrawerSession();
    }
  }, [canProcessPayments, selectedLocation, sessionManagement.loadCashDrawerSession]);

  /**
   * Load payment-related data for authorized users
   */
  useEffect(() => {
    if (canProcessPayments && selectedLocation) {
      loadPendingOrders();
    }
  }, [canProcessPayments, selectedLocation, loadPendingOrders]);

  /**
   * Merge real-time orders with pending orders
   */
  useEffect(() => {
    if (!canProcessPayments) return;

    const pendingRealTimeOrders = realTimeOrders.filter((o) => o.status === 'pending_payment');
    const allOrders = [...pendingRealTimeOrders, ...pendingOrders];

    const uniqueOrders = allOrders.reduce((acc, current) => {
      if (!acc.find((item) => item.id === current.id)) {
        acc.push(current);
      }
      return acc;
    }, [] as POSOrderListItem[]);

    uniqueOrders.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    setCombinedOrders(uniqueOrders);
  }, [realTimeOrders, pendingOrders, canProcessPayments]);

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

  /**
   * Reset payment method to cash if user switches to walk-in while account is selected
   */
  useEffect(() => {
    if (
      (customerSearch.isWalkIn || !customerSearch.selectedCustomer) &&
      paymentProcessing.paymentMethod === 'account'
    ) {
      paymentProcessing.setPaymentMethod('cash');
    }
  }, [
    customerSearch.isWalkIn,
    customerSearch.selectedCustomer,
    paymentProcessing.paymentMethod,
    paymentProcessing.setPaymentMethod,
  ]);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  const loadLocations = useCallback(async () => {
    try {
      const response = await getPOSLocations({ allow_sales: true });
      const locationData = response.data?.results || response.data || [];
      const locationsArray = Array.isArray(locationData) ? locationData : [];

      console.log('[Accounting POS] Loaded locations:', locationsArray);
      setLocations(locationsArray);

      if (locationsArray.length === 0) {
        console.error('[Accounting POS] No locations available!');
        toast.error('No POS locations available. Please contact administrator.');
        return;
      }

      // Try to restore location from localStorage, otherwise select first
      const storedLocationId = localStorage.getItem('selectedPOSLocation');
      if (storedLocationId && locationsArray.some((loc) => loc.id === parseInt(storedLocationId))) {
        const locationId = parseInt(storedLocationId);
        setSelectedLocation(locationId);
        console.log('[Accounting POS] Restored location from localStorage:', locationId);
      } else if (locationsArray.length > 0) {
        setSelectedLocation(locationsArray[0].id);
        localStorage.setItem('selectedPOSLocation', locationsArray[0].id.toString());
        console.log('[Accounting POS] Auto-selected first location:', locationsArray[0].id);
      }
    } catch (error) {
      console.error('[Accounting POS] Failed to load locations:', error);
      toast.error('Failed to load locations. Please refresh the page.');
      setLocations([]);
    }
  }, []);

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
  // ORDER OPERATIONS
  // ============================================================================

  /**
   * Handle order save for designer mode (no payment processing)
   */
  const handleDesignerSave = useCallback(async () => {
    if (!selectedLocation) {
      toast.error('Please select a location');
      return;
    }

    try {
      const response = await orderOperations.saveOrUpdateOrder({
        orderItems: orderCart.orderItems,
        selectedCustomer: customerSearch.selectedCustomer,
        locationId: selectedLocation,
        editingOrderId: orderCart.editingOrderId,
        sessionId: null, // No session required for designer mode
      });

      setSuccessOrderDisplayCode(response.display_code || response.order_number);
      setShowOrderSuccess(true);
    } catch {
      // Error already handled in hook
    }
  }, [selectedLocation, orderCart, customerSearch, orderOperations]);

  /**
   * Handle payment processing (saves order first if needed, then switches to payment mode)
   */
  const handleProcessPaymentClick = useCallback(async () => {
    console.log('[Accounting POS] Pay Now clicked. Selected location:', selectedLocation);
    console.log('[Accounting POS] Available locations:', locations);
    console.log('[Accounting POS] Session ID:', sessionManagement.cashDrawerSessionId);

    if (!selectedLocation) {
      if (locations.length === 0) {
        toast.error('No POS locations available. Please contact administrator.');
      } else {
        toast.error('Location not loaded. Please refresh the page.');
      }
      return;
    }

    try {
      const order = await orderOperations.saveOrUpdateOrder({
        orderItems: orderCart.orderItems,
        selectedCustomer: customerSearch.selectedCustomer,
        selectedLocation: selectedLocation, // Use correct parameter name
        editingOrderId: orderCart.editingOrderId,
      });

      orderCart.setEditingOrderId(order.id);
      orderCart.setEditingOrderNumber(order.order_number);
      setIsPaymentMode(true);
    } catch {
      // Error already handled in hook
    }
  }, [selectedLocation, orderCart, customerSearch, orderOperations, sessionManagement]);

  /**
   * Load order for editing/payment
   */
  const handleLoadOrder = useCallback(
    async (orderNumber: string) => {
      try {
        await orderOperations.loadOrderForEditing(orderNumber, (order, items) => {
          console.log('[Accounting POS] Loading order:', {
            order_id: order.id,
            order_number: order.order_number,
            mapped_items: items,
            raw_order_items: order.items,
            raw_order: order,
          });

          // Set order items (use mapped items, NOT order.items)
          orderCart.setOrderItems(items);
          orderCart.setEditingOrderId(order.id);
          orderCart.setEditingOrderNumber(order.order_number);
          orderCart.setEditingOrderDisplayCode(order.display_code);

          // Set customer
          if (order.customer) {
            customerSearch.selectCustomer({
              id: order.customer.toString(),
              name: order.customer_name || 'Customer',
            });
          } else {
            customerSearch.setIsWalkIn(true);
            customerSearch.clearCustomer();
          }

          // Reset payment mode
          setIsPaymentMode(false);
        });
      } catch {
        // Error already handled in hook
      }
    },
    [orderOperations, orderCart, customerSearch],
  );

  /**
   * Complete payment and refresh orders
   * This matches the PaymentInterface callback signature
   */
  const handleCompletePayment = useCallback(
    async (
      paymentMethod: 'cash' | 'card' | 'account',
      amountTendered: string,
      printReceipt: boolean,
    ) => {
      if (!orderCart.editingOrderId) {
        toast.error('No order selected');
        return;
      }

      if (!sessionManagement.cashDrawerSessionId) {
        toast.error('No open session. Please open a session first.');
        return;
      }

      setIsProcessingPayment(true);

      try {
        // Prepare payment data
        const amount =
          paymentMethod === 'cash'
            ? parseFloat(amountTendered) || orderCart.total
            : orderCart.total;

        const payments: PaymentData[] = [
          {
            payment_method: paymentMethod,
            amount,
            reference_number: paymentMethod === 'card' ? `CARD-${Date.now()}` : undefined,
          },
        ];

        console.log('[Accounting POS] Processing payment:', {
          orderId: orderCart.editingOrderId,
          sessionId: sessionManagement.cashDrawerSessionId,
          method: paymentMethod,
          amount,
          printReceipt,
        });

        // Call payment API
        const response = await completeOrderPayment(orderCart.editingOrderId, {
          cash_drawer_session_id: sessionManagement.cashDrawerSessionId,
          payments,
          print_receipt: printReceipt,
        });

        console.log('[Accounting POS] Payment successful:', response.data.receipt_number);
        toast.success(`Payment completed! Receipt: ${response.data.receipt_number}`);

        // Refresh data and reset form
        await loadPendingOrders();

        // Reset form inline to avoid dependency cycle
        orderCart.resetCart();
        customerSearch.clearCustomer();
        paymentProcessing.resetPayment();
        setSearchQuery('');
        setIsPaymentMode(false);
      } catch (error: any) {
        console.error('[Accounting POS] Payment failed:', error);
        const errorMessage =
          error.response?.data?.error || 'Failed to complete payment. Please try again.';
        toast.error(errorMessage);
      } finally {
        setIsProcessingPayment(false);
      }
    },
    [orderCart, sessionManagement, loadPendingOrders, customerSearch, paymentProcessing],
  );

  /**
   * Handle voiding current order
   */
  const handleVoidOrder = useCallback(
    async (voidReason: string) => {
      if (!orderCart.editingOrderId) {
        toast.error('No order selected');
        return;
      }

      setIsVoiding(true);

      try {
        const success = await orderOperations.voidOrder(orderCart.editingOrderId, voidReason);

        if (success) {
          console.log('[Accounting POS] Order voided successfully');
          toast.success('Order voided successfully');

          // Refresh pending orders list
          await loadPendingOrders();

          // Reset form and close modal
          resetForm();
          setShowVoidModal(false);
        }
      } catch (error: any) {
        console.error('[Accounting POS] Void failed:', error);
        toast.error('Failed to void order');
      } finally {
        setIsVoiding(false);
      }
    },
    [orderCart.editingOrderId, orderOperations, loadPendingOrders],
  );

  /**
   * Reset form after successful operation
   */
  const resetForm = useCallback(() => {
    orderCart.resetCart();
    customerSearch.clearCustomer();
    paymentProcessing.resetPayment();
    setSearchQuery('');
    setIsPaymentMode(false);
  }, [orderCart, customerSearch, paymentProcessing]);

  /**
   * Handle customer added via modal
   */
  const handleCustomerAdded = useCallback(
    (newCustomer: Customer) => {
      customerSearch.selectCustomer(newCustomer);
      setShowAddCustomerModal(false);
      toast.success('Customer added successfully');
    },
    [customerSearch],
  );

  /**
   * Handle session closed from Management View
   */
  const handleSessionClosed = useCallback(() => {
    console.log('[Accounting] Session closed - refreshing state');
    resetForm();
    sessionManagement.loadCashDrawerSession();
    toast.info('Session closed. Please open a new session to continue.');
  }, [resetForm, sessionManagement]);

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
      <VoidOrderModal
        show={showVoidModal}
        orderNumber={orderCart.editingOrderDisplayCode || orderCart.editingOrderNumber || ''}
        customerName={customerSearch.selectedCustomer?.name || 'Walk-in Customer'}
        orderTotal={formatCurrency(orderCart.total)}
        itemCount={orderCart.orderItems.reduce((sum, item) => sum + item.quantity, 0)}
        isVoiding={isVoiding}
        onConfirm={handleVoidOrder}
        onCancel={() => setShowVoidModal(false)}
      />
      <OrderSuccessModal
        show={showOrderSuccess}
        orderCode={successOrderDisplayCode}
        orderNumber={successOrderDisplayCode}
        onClose={() => {
          setShowOrderSuccess(false);
          resetForm();
        }}
        onPrint={() => window.print()}
        isCopied={isCopied}
        onCopy={() => {
          navigator.clipboard.writeText(successOrderDisplayCode);
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 1000);
        }}
      />

      <div className="h-[calc(100vh-6rem)] flex flex-col p-3">
        {/* Management View Overlay */}
        {viewMode === 'management' && (
          <div className="h-full">
            <ManagementView
              onClose={() => setViewMode('transaction')}
              currentSessionId={sessionManagement.cashDrawerSessionId}
              pendingOrdersCount={combinedOrders.length}
              currentOrderItemsCount={orderCart.orderItems.reduce(
                (sum, item) => sum + item.quantity,
                0,
              )}
              onSessionClosed={handleSessionClosed}
            />
          </div>
        )}

        {/* Transaction View */}
        {viewMode === 'transaction' && (
          <>
            {/* Connection Status Banner */}
            <ConnectionStatusBanner status={connectionStatus} />

            {/* Header */}
            <div className="flex justify-between items-center mb-3 flex-shrink-0">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {canProcessPayments ? 'POS - Payments' : 'POS - Designer'}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {canProcessPayments ? (
                    orderCart.editingOrderId ? (
                      <span className="flex items-center gap-2">
                        Editing Order{' '}
                        <span className="font-bold text-primary-600 text-lg">
                          #{orderCart.editingOrderDisplayCode}
                        </span>
                        <span className="text-xs">({orderCart.editingOrderNumber})</span>
                      </span>
                    ) : (
                      'New Order & Payment'
                    )
                  ) : (
                    'Create orders for payment at cashier'
                  )}
                </p>
              </div>
              <div className="flex items-center gap-6">
                {canProcessPayments && (
                  <div className="text-right">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Pending Orders</div>
                    <div className="text-xl font-semibold text-amber-600 dark:text-amber-400">
                      {combinedOrders.length}
                    </div>
                  </div>
                )}
                <div className="text-right">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Current Order</div>
                  <div className="text-xl font-semibold text-gray-900 dark:text-white">
                    {orderCart.orderItems.reduce((sum, item) => sum + item.quantity, 0)} items
                  </div>
                </div>

                {/* Management Mode Toggle */}
                {canProcessPayments && (
                  <button
                    onClick={() => setViewMode('management')}
                    className="p-2 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="Management Mode"
                  >
                    <MdOutlineDashboardCustomize className="w-7 h-7" />
                  </button>
                )}
              </div>
            </div>

            {/* MAIN CONTENT - Conditional based on session state */}
            {canProcessPayments && sessionManagement.isLoadingSession ? (
              // CENTERED LOADING STATE - Hide everything while checking session
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary-600 mx-auto mb-4"></div>
                  <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                    Loading session data...
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Please wait</p>
                </div>
              </div>
            ) : canProcessPayments && sessionManagement.currentSession?.is_stale ? (
              // FORCE CLOSE OLD SESSION VIEW
              <ForceCloseSessionView
                currentSession={sessionManagement.currentSession}
                onForceClose={sessionManagement.handleForceCloseOldSession}
                isLoading={sessionManagement.isSubmitting}
              />
            ) : canProcessPayments && sessionManagement.cashDrawerSessionId === null ? (
              // OPEN SESSION VIEW
              <OpenSessionView
                lastClosedSession={sessionManagement.lastClosedSession}
                isLoadingSession={false}
                isLoading={false}
                onOpenSession={sessionManagement.handleOpenDrawer}
              />
            ) : (
              // SESSION ACTIVE OR NON-PAYMENT USER - Show normal POS UI
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0 flex-1">
                {/* LEFT: Search + Quick Access */}
                <div
                  className={`lg:col-span-4 flex flex-col gap-3 min-h-0 ${isPaymentMode ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <QuickAccessGrid
                    items={displayedQuickAccessItems}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    onAddItem={(item, quantityIncrement) => {
                      if (searchQuery.length >= 2) {
                        orderCart.addSearchItem(item as POSProductSearch, quantityIncrement);
                      } else {
                        orderCart.addQuickServiceItem(
                          item as POSQuickServiceItem,
                          quantityIncrement,
                        );
                      }
                    }}
                    canAddCustom={!!miscProductId && !isPaymentMode}
                    onAddCustomItem={() => setShowAddCustomItemModal(true)}
                  />
                </div>

                {/* CENTER: Retrieve Order Panel + Order Items */}
                <div className="lg:col-span-4 flex flex-col gap-3 min-h-0">
                  {canProcessPayments && !isPaymentMode && (
                    <RetrieveOrderPanel
                      pendingOrders={combinedOrders}
                      onLoadOrder={handleLoadOrder}
                      connectionStatus={connectionStatus}
                      editingOrderId={orderCart.editingOrderId}
                      onClearOrder={resetForm}
                    />
                  )}

                  <OrderItemsList
                    items={orderCart.orderItems}
                    editingOrderId={orderCart.editingOrderId}
                    editingOrderDisplayCode={orderCart.editingOrderDisplayCode}
                    onQuantityChange={orderCart.updateQuantity}
                    onRemove={orderCart.removeItem}
                    showVoidButton={canProcessPayments && !isPaymentMode}
                    onVoidOrder={() => setShowVoidModal(true)}
                    isVoiding={isVoiding}
                  />
                </div>

                {/* RIGHT: Customer/Summary OR Payment Interface */}
                <div className="lg:col-span-4 flex flex-col gap-3 min-h-0">
                  {canProcessPayments && isPaymentMode ? (
                    // PAYMENT MODE
                    <PaymentInterface
                      orderDisplayCode={
                        orderCart.editingOrderDisplayCode || orderCart.editingOrderNumber
                      }
                      orderTotal={orderCart.total}
                      selectedCustomer={customerSearch.selectedCustomer}
                      isWalkIn={customerSearch.isWalkIn}
                      hasCashDrawerSession={sessionManagement.cashDrawerSessionId !== null}
                      isLoading={isProcessingPayment || orderOperations.isLoading}
                      onBack={() => setIsPaymentMode(false)}
                      onCompletePayment={handleCompletePayment}
                      onOpenDrawerSession={() => {
                        setIsPaymentMode(false);
                        toast.info('Please open a cash drawer session first');
                      }}
                    />
                  ) : (
                    // CART MODE
                    <>
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
                        onAction={
                          canProcessPayments ? handleProcessPaymentClick : handleDesignerSave
                        }
                        actionLabel={
                          orderOperations.isLoading
                            ? 'Processing...'
                            : canProcessPayments
                              ? orderCart.editingOrderId
                                ? 'Update & Pay'
                                : 'Pay Now'
                              : 'Save Order'
                        }
                        actionDisabled={
                          orderCart.orderItems.length === 0 ||
                          orderOperations.isLoading ||
                          !selectedLocation
                        }
                        isPrimaryAction={canProcessPayments}
                      />
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
