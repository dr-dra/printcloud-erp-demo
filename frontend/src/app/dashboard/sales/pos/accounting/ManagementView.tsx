/**
 * POS Management View (Refactored)
 *
 * Administrative interface for POS system management, accessible to cashiers/admins.
 * Provides three main tabs for different management tasks:
 * - Dashboard: Session overview with sales statistics and payment breakdowns
 * - Session/Reports: X-Report and Z-Report with session closing functionality
 * - Items & Categories: Product and category management (CRUD operations)
 *
 * Features:
 * - Session overview dashboard with real-time statistics
 * - X-Report (read-only snapshot) and Z-Report (session closing with reconciliation)
 * - Product management (add, edit, delete, clone)
 * - Category management with duplicate detection
 * - Cash drawer session tracking
 *
 * User Access:
 * - Requires admin, accounting, or cashier role
 * - Accessed via management mode toggle in POS-Payments view
 *
 * This file has been refactored from 2,134 lines to ~145 lines by extracting:
 * - Dashboard statistics and display → DashboardTab component
 * - Reports and session closing → ReportsTab component
 * - Product/category management → ItemsTab component
 * - All sub-components extracted to dedicated files in components/management/
 *
 * @module ManagementView
 */

'use client';

import { useState, useEffect } from 'react';
import { LayoutDashboard, Package, FileText, BarChart3 } from 'lucide-react';
import { TbCashRegister } from 'react-icons/tb';
import { getSessionReport, type CashDrawerSession } from '@/lib/posApi';

// Import management tab components
import { DashboardTab } from '../components/management/DashboardTab';
import { ReportsTab } from '../components/management/ReportsTab';
import { ItemsTab } from '../components/management/ItemsTab';
import { TrendReportsTab } from '../components/management/TrendReportsTab';

/**
 * Props for ManagementView component
 */
interface ManagementViewProps {
  /**
   * Callback to close management view and return to transaction view
   */
  onClose: () => void;

  /**
   * Current active cash drawer session ID (null if no session open)
   */
  currentSessionId: number | null;

  /**
   * Number of pending orders awaiting payment
   */
  pendingOrdersCount?: number;

  /**
   * Number of items in current order being created
   */
  currentOrderItemsCount?: number;

  /**
   * Callback when session is closed via Z-Report
   * Parent should refresh session state
   */
  onSessionClosed?: () => void;
}

/**
 * Management View Component
 *
 * Main administrative interface for POS system. Provides tabbed interface for:
 * - Dashboard: Session statistics and overview
 * - Reports: X-Report and Z-Report functionality
 * - Items: Product and category management
 *
 * @param props - Component props
 * @returns Management view element
 *
 * @example
 * ```tsx
 * <ManagementView
 *   onClose={() => setViewMode('transaction')}
 *   currentSessionId={cashDrawerSessionId}
 *   pendingOrdersCount={combinedOrders.length}
 *   currentOrderItemsCount={orderCart.items.length}
 *   onSessionClosed={handleSessionClosed}
 * />
 * ```
 */
export default function ManagementView({
  onClose,
  currentSessionId,
  pendingOrdersCount = 0,
  onSessionClosed,
  currentOrderItemsCount = 0,
}: ManagementViewProps) {
  // ============================================================================
  // STATE
  // ============================================================================

  // Active tab index
  const [activeTab, setActiveTab] = useState(0);

  // Session data (loaded via API when currentSessionId changes)
  const [sessionData, setSessionData] = useState<CashDrawerSession | null>(null);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  /**
   * Load session data when currentSessionId changes
   */
  useEffect(() => {
    if (currentSessionId) {
      loadSession();
    } else {
      // Clear session data when no session exists
      setSessionData(null);
    }
  }, [currentSessionId]);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  /**
   * Load current session data with statistics and payment breakdown
   */
  const loadSession = async () => {
    if (!currentSessionId) return;

    try {
      const response = await getSessionReport(currentSessionId);
      setSessionData(response.data);
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  };

  // ============================================================================
  // TAB CONFIGURATION
  // ============================================================================

  const tabs = [
    { name: 'Dashboard', icon: LayoutDashboard },
    { name: 'Session', icon: FileText },
    { name: 'Items & Categories', icon: Package },
    { name: 'Reports', icon: BarChart3 },
  ];

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex justify-between items-center mb-3 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">POS - Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {sessionData
              ? `Session #${sessionData.session_number} · ${sessionData.status.toUpperCase()}`
              : 'No Active Session'}
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-sm text-gray-500 dark:text-gray-400">Pending Orders</div>
            <div className="text-xl font-semibold text-amber-600 dark:text-amber-400">
              {pendingOrdersCount}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500 dark:text-gray-400">Current Order</div>
            <div className="text-xl font-semibold text-gray-900 dark:text-white">
              {currentOrderItemsCount} items
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Back to POS"
          >
            <TbCashRegister className="w-7 h-7" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-4 flex flex-col">
        {/* Custom Tabs Header */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            return (
              <button
                key={index}
                onClick={() => setActiveTab(index)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === index
                    ? 'border-primary-600 text-primary-600 dark:text-primary-500 dark:border-primary-500'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.name}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 0 && <DashboardTab session={sessionData} onRefresh={loadSession} />}
          {activeTab === 1 && (
            <ReportsTab
              session={sessionData}
              onRefresh={loadSession}
              onSessionClosed={onSessionClosed}
            />
          )}
          {activeTab === 2 && <ItemsTab />}
          {activeTab === 3 && <TrendReportsTab />}
        </div>
      </div>
    </div>
  );
}
