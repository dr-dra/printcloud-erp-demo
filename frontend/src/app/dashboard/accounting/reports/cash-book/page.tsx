'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { Spinner } from 'flowbite-react';

export default function CashBookReportPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/accounting/cash');
  }, [router]);

  return (
    <DashboardLayout>
      <div className="flex items-center justify-center py-16">
        <Spinner size="xl" />
        <span className="ml-3 text-lg text-gray-600 dark:text-gray-400">
          Redirecting to Cash Book...
        </span>
      </div>
    </DashboardLayout>
  );
}
