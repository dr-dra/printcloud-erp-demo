/**
 * React hooks for Suppliers and Bill Scans
 * 
 * Uses React Query for data fetching and caching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';  // Axios instance
import {
  Supplier,
  SupplierBill,
  BillScan,
  BillPayment,
  CreateSupplierBill
} from '@/types/suppliers';

// =============================================================================
// Supplier Hooks
// =============================================================================

export const useSuppliers = (filters?: { is_active?: boolean }) => {
  return useQuery({
    queryKey: ['suppliers', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.is_active !== undefined) {
        params.append('is_active', filters.is_active.toString());
      }
      const response = await api.get(`/suppliers/?${params.toString()}`);
      return response.data as Supplier[];
    }
  });
};

export const useSupplier = (id: number | null) => {
  return useQuery({
    queryKey: ['supplier', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await api.get(`/suppliers/${id}/`);
      return response.data as Supplier;
    },
    enabled: !!id
  });
};

// =============================================================================
// Supplier Bill Hooks
// =============================================================================

export const useSupplierBills = (filters?: { status?: string; supplier?: number }) => {
  return useQuery({
    queryKey: ['supplierBills', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.supplier) params.append('supplier', filters.supplier.toString());
      const response = await api.get(`/purchases/bills/?${params.toString()}`);
      return response.data as SupplierBill[];
    }
  });
};

export const useSupplierBill = (id: number | null) => {
  return useQuery({
    queryKey: ['supplierBill', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await api.get(`/purchases/bills/${id}/`);
      return response.data as SupplierBill;
    },
    enabled: !!id
  });
};

export const useCreateSupplierBill = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (billData: CreateSupplierBill) => {
      const response = await api.post('/purchases/bills/', billData);
      return response.data as SupplierBill;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplierBills'] });
    }
  });
};

// =============================================================================
// Bill Scan Hooks (AI-Powered Bill Extraction)
// =============================================================================

export const useUploadBillScan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/purchases/bill-scans/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data as BillScan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billScans'] });
    }
  });
};

export const useBillScan = (id: number | null) => {
  return useQuery({
    queryKey: ['billScan', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await api.get(`/purchases/bill-scans/${id}/`);
      return response.data as BillScan;
    },
    enabled: !!id,
    // Auto-poll every 3 seconds while processing
    refetchInterval: (data) => {
      if (data?.processing_status === 'processing' || data?.processing_status === 'pending') {
        return 3000;  // 3 seconds
      }
      return false;  // Don't poll if completed/failed
    }
  });
};

export const useUpdateBillScan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<BillScan> }) => {
      const response = await api.patch(`/purchases/bill-scans/${id}/`, data);
      return response.data as BillScan;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['billScan', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['billScans'] });
    }
  });
};

export const useCreateBillFromScan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ scanId, billData }: { scanId: number; billData: any }) => {
      const response = await api.post(
        `/purchases/bill-scans/${scanId}/create-bill/`,
        billData
      );
      return response.data as SupplierBill;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billScans'] });
      queryClient.invalidateQueries({ queryKey: ['supplierBills'] });
    }
  });
};

// =============================================================================
// Bill Payment Hooks
// =============================================================================

export const useBillPayments = (billId: number | null) => {
  return useQuery({
    queryKey: ['billPayments', billId],
    queryFn: async () => {
      if (!billId) return [];
      const response = await api.get(`/purchases/bills/${billId}/payments/`);
      return response.data as BillPayment[];
    },
    enabled: !!billId
  });
};

export const useCreateBillPayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ billId, paymentData }: { billId: number; paymentData: any }) => {
      const response = await api.post(
        `/purchases/bills/${billId}/payments/`,
        paymentData
      );
      return response.data as BillPayment;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['billPayments', variables.billId] });
      queryClient.invalidateQueries({ queryKey: ['supplierBill', variables.billId] });
      queryClient.invalidateQueries({ queryKey: ['supplierBills'] });
    }
  });
};
