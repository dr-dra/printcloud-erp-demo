'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { Card, Alert } from 'flowbite-react';
import { BarChart2, Info } from 'lucide-react';

export default function InventoryReportsPage() {
  return (
    <DashboardLayout>
      <div className="p-2">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Inventory - Reports
          </h1>
        </div>

        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-md">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-full">
                <BarChart2 className="w-8 h-8 text-gray-600 dark:text-gray-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Inventory Reports
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Stock valuation, wastage analysis, and job material consumption reports will
                  appear here.
                </p>
              </div>
              <Alert color="info" className="w-full">
                <Info className="h-4 w-4 mr-2" />
                <span className="text-sm">
                  <strong>Coming Soon!</strong> Report dashboards are planned for the next phase.
                </span>
              </Alert>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
