'use client';

import React from 'react';
import { Card, Alert } from 'flowbite-react';
import { Ruler, Info } from 'lucide-react';

export default function UnitsTab() {
  return (
    <div className="p-4">
      <div className="flex items-center justify-center min-h-96">
        <Card className="max-w-md">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-full">
              <Ruler className="w-8 h-8 text-gray-600 dark:text-gray-400" />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Units Management
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                This section will allow you to manage units of measurement for your inventory items.
              </p>
            </div>

            <Alert color="info" className="w-full">
              <Info className="h-4 w-4 mr-2" />
              <span className="text-sm">
                <strong>Coming Soon!</strong> Units management functionality will be available in a
                future update.
              </span>
            </Alert>
          </div>
        </Card>
      </div>
    </div>
  );
}
