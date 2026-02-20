'use client';

import React, { useState } from 'react';
import { Boxes, FolderTree, Ruler } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import InventoryItemsTab from '@/components/inventory/InventoryItemsTab';
import InventoryCategoriesTab from '@/components/inventory/InventoryCategoriesTab';
import InventoryUnitsTab from '@/components/inventory/InventoryUnitsTab';

type TabId = 'items' | 'categories' | 'units';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  component: React.ComponentType;
}

const tabs: Tab[] = [
  {
    id: 'items',
    label: 'Inventory Items',
    icon: Boxes,
    component: InventoryItemsTab,
  },
  {
    id: 'categories',
    label: 'Inventory Categories',
    icon: FolderTree,
    component: InventoryCategoriesTab,
  },
  {
    id: 'units',
    label: 'Units of Measure',
    icon: Ruler,
    component: InventoryUnitsTab,
  },
];

export default function MainStockPage() {
  const [activeTab, setActiveTab] = useState<TabId>('items');

  const activeTabData = tabs.find((tab) => tab.id === activeTab);
  const ActiveComponent = activeTabData?.component || InventoryItemsTab;

  return (
    <DashboardLayout>
      <div className="p-2">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Inventory - Main Stock
          </h1>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="border-b border-gray-200 dark:border-gray-600">
            <nav className="flex space-x-8 px-4" aria-label="Tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                      isActive
                        ? 'border-primary-500 text-primary-600 dark:text-primary-400 dark:border-primary-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                  >
                    <Icon className="w-5 h-5 mr-2" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div>
            <ActiveComponent />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
