'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function InventorySuppliersRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/suppliers');
  }, [router]);

  return null;
}
