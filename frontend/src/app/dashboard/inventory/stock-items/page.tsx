'use client';

import React, { useState } from 'react';
import { Package, FolderTree } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import FinishGoodsTab from '@/components/inventory/FinishGoodsTab';
import CategoriesTab from '@/components/inventory/CategoriesTab';

type TabId = 'finish-goods' | 'categories';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  component: React.ComponentType;
}

const tabs: Tab[] = [
  {
    id: 'finish-goods',
    label: 'Finish Goods',
    icon: Package,
    component: FinishGoodsTab,
  },
  {
    id: 'categories',
    label: 'Finish Goods Categories',
    icon: FolderTree,
    component: CategoriesTab,
  },
];

export default function StockItemsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('finish-goods');

  const activeTabData = tabs.find((tab) => tab.id === activeTab);
  const ActiveComponent = activeTabData?.component || FinishGoodsTab;

  return (
    <DashboardLayout>
      <div className="p-2">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Sales - Finish Goods
          </h1>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          {/* Custom Tabs with Underline Style */}
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

          {/* Tab Content */}
          <div>
            <ActiveComponent />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
