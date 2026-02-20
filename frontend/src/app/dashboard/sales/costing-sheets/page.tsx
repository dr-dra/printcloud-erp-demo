'use client';

import { useRouter } from 'next/navigation';
import PageTemplate from '@/components/PageTemplate';

export default function CostingSheetsPage() {
  const router = useRouter();

  const handleCreateCostingSheet = () => {
    router.push('/dashboard/sales/costing-sheets/new');
  };

  return (
    <PageTemplate
      title="Costing Sheets"
      description="Calculate and manage project costs"
      buttonText="Create Costing Sheet"
      onButtonClick={handleCreateCostingSheet}
    >
      <div className="text-center py-12">
        <div className="text-gray-500 dark:text-gray-400 mb-4">
          <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No costing sheets yet
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          Create your first costing sheet to start calculating project costs
        </p>
        <button
          onClick={handleCreateCostingSheet}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <svg className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Your First Costing Sheet
        </button>
      </div>
    </PageTemplate>
  );
}
