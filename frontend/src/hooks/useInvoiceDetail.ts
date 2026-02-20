/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from 'react';
import { invoicesAPI } from '@/lib/api';
import { getErrorMessage } from '@/utils/errorHandling';
import type { SalesInvoice } from '@/types/invoices';

interface UseInvoiceDetailReturn {
  invoice: SalesInvoice | null;
  loading: boolean;
  error: string | null;
  handleRetry: () => void;
  refetchInvoice: () => Promise<void>;
  setInvoice: (invoice: SalesInvoice | null) => void;
  setError: (error: string | null) => void;
}

export function useInvoiceDetail(
  invoiceId: string,
  isAuthenticated: boolean,
): UseInvoiceDetailReturn {
  const [invoice, setInvoice] = useState<SalesInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoice = useCallback(async () => {
    if (!isAuthenticated || !invoiceId || invoiceId === 'new') {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await invoicesAPI.getInvoice(parseInt(invoiceId));
      console.log('[useInvoiceDetail] API response:', {
        invoice_number: response.data.invoice_number,
        customer_detail: response.data.customer_detail,
        customer_name: response.data.customer_name,
      });
      setInvoice(response.data);
    } catch (err) {
      const errorMessage = getErrorMessage(err as any);
      setError(errorMessage);
      console.error('[useInvoiceDetail] Error fetching invoice:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, invoiceId]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  const handleRetry = () => {
    fetchInvoice();
  };

  const refetchInvoice = async () => {
    await fetchInvoice();
  };

  return {
    invoice,
    loading,
    error,
    handleRetry,
    refetchInvoice,
    setInvoice,
    setError,
  };
}
