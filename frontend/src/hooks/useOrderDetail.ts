/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from 'react';
import { ordersAPI } from '@/lib/api';
import { getErrorMessage } from '@/utils/errorHandling';
import type { SalesOrder } from '@/types/orders';

interface UseOrderDetailReturn {
  order: SalesOrder | null;
  loading: boolean;
  error: string | null;
  handleRetry: () => void;
  refetchOrder: () => Promise<void>;
  setError: (error: string | null) => void;
}

export function useOrderDetail(orderId: string, isAuthenticated: boolean): UseOrderDetailReturn {
  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch order data
  const fetchOrder = useCallback(async () => {
    // Don't fetch if orderId is "new" (creating new order)
    if (!isAuthenticated || !orderId || orderId === 'new') {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await ordersAPI.getOrder(parseInt(orderId));
      setOrder(response.data);
    } catch (err) {
      const errorMessage = getErrorMessage(err as any);
      setError(errorMessage);
      console.error('[useOrderDetail] Error fetching order:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, orderId]);

  // Initial fetch
  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // Handle retry
  const handleRetry = () => {
    fetchOrder();
  };

  // Refetch order (for updates after actions)
  const refetchOrder = async () => {
    await fetchOrder();
  };

  return {
    order,
    loading,
    error,
    handleRetry,
    refetchOrder,
    setError,
  };
}
