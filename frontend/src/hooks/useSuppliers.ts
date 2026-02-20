/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * React hooks for Suppliers & Purchases Module API
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  Supplier,
  SupplierList,
  PurchaseOrder,
  PurchaseOrderList,
  SupplierBill,
  SupplierBillList,
  BillPayment,
  BillScan,
  CreateSupplier,
  CreatePurchaseOrder,
  CreateSupplierBill,
  CreateBillPayment,
} from '@/types/suppliers';

// ==============================================================================
// Suppliers Hooks
// ==============================================================================

export const useSuppliers = (params?: { is_active?: boolean; search?: string }) => {
  // Convert is_active to active for backend compatibility
  const backendParams: Record<string, any> = {};

  if (params?.is_active !== undefined) {
    backendParams.active = String(params.is_active);
  }
  if (params?.search) {
    backendParams.search = params.search;
  }

  return useQuery<SupplierList[]>({
    queryKey: ['suppliers', params],
    queryFn: async () => {
      const { data } = await api.get('/suppliers/', {
        params: Object.keys(backendParams).length > 0 ? backendParams : undefined,
      });
      // Extract results from paginated response
      return data.results || data;
    },
  });
};

export const useSupplier = (id: number) => {
  return useQuery<Supplier>({
    queryKey: ['suppliers', id],
    queryFn: async () => {
      const { data } = await api.get(`/suppliers/${id}/`);
      return data;
    },
    enabled: !!id,
  });
};

export const useCreateSupplier = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (supplier: CreateSupplier) => {
      const { data } = await api.post('/suppliers/', supplier);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
};

export const useUpdateSupplier = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...supplier }: Partial<Supplier> & { id: number }) => {
      const { data } = await api.put(`/suppliers/${id}/`, supplier);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
};

export const useDeleteSupplier = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.delete(`/suppliers/${id}/`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
};

// ==============================================================================
// Supplier Contacts Hooks
// ==============================================================================

export const useCreateSupplierContact = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (contact: {
      supplier: number;
      name: string;
      phone: string;
      is_primary: boolean;
    }) => {
      const { data } = await api.post('/suppliers/contacts/', contact);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
};

export const useUpdateSupplierContact = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...contact
    }: {
      id: number;
      name: string;
      phone: string;
      is_primary: boolean;
    }) => {
      const { data } = await api.put(`/suppliers/contacts/${id}/`, contact);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
};

export const useDeleteSupplierContact = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/suppliers/contacts/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
};

export const useSupplierBalance = (id: number) => {
  return useQuery({
    queryKey: ['suppliers', id, 'balance'],
    queryFn: async () => {
      const { data } = await api.get(`/suppliers/${id}/balance/`);
      return data;
    },
    enabled: !!id,
  });
};

// ==============================================================================
// Purchase Orders Hooks
// ==============================================================================

export const usePurchaseOrders = (params?: {
  supplier?: number;
  status?: string;
  search?: string;
  start_date?: string;
  end_date?: string;
}) => {
  return useQuery<PurchaseOrderList[]>({
    queryKey: ['purchase-orders', params],
    queryFn: async () => {
      const { data } = await api.get('/purchases/orders/', { params });
      return data;
    },
  });
};

export const usePurchaseOrder = (id: number) => {
  return useQuery<PurchaseOrder>({
    queryKey: ['purchase-orders', id],
    queryFn: async () => {
      const { data } = await api.get(`/purchases/orders/${id}/`);
      return data;
    },
    enabled: !!id,
  });
};

export const useCreatePurchaseOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (order: CreatePurchaseOrder) => {
      const { data } = await api.post('/purchases/orders/', order);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
  });
};

export const useUpdatePurchaseOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...order }: Partial<PurchaseOrder> & { id: number }) => {
      const { data } = await api.put(`/purchases/orders/${id}/`, order);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
  });
};

export const useSendPurchaseOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post(`/purchases/orders/${id}/send/`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
  });
};

export const useConfirmPurchaseOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post(`/purchases/orders/${id}/confirm/`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
  });
};

export const useCancelPurchaseOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.delete(`/purchases/orders/${id}/`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
  });
};

// ==============================================================================
// Supplier Bills Hooks
// ==============================================================================

export const useSupplierBills = (params?: {
  supplier?: number;
  status?: string;
  search?: string;
  start_date?: string;
  end_date?: string;
}) => {
  return useQuery<SupplierBillList[]>({
    queryKey: ['supplier-bills', params],
    queryFn: async () => {
      const { data } = await api.get('/purchases/bills/', { params });
      return data.results || data;
    },
  });
};

export const useSupplierBill = (id: number) => {
  return useQuery<SupplierBill>({
    queryKey: ['supplier-bills', id],
    queryFn: async () => {
      const { data } = await api.get(`/purchases/bills/${id}/`);
      return data;
    },
    enabled: !!id,
  });
};

export const useCreateSupplierBill = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (bill: CreateSupplierBill) => {
      const { data } = await api.post('/purchases/bills/', bill);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-bills'] });
    },
  });
};

export const useApproveSupplierBill = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post(`/purchases/bills/${id}/approve/`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-bills'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
    },
  });
};

export const useBillPayments = (billId: number) => {
  return useQuery<BillPayment[]>({
    queryKey: ['supplier-bills', billId, 'payments'],
    queryFn: async () => {
      const { data } = await api.get(`/purchases/bills/${billId}/payments/`);
      return data;
    },
    enabled: !!billId,
  });
};

export const useCreateBillPayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ billId, payment }: { billId: number; payment: CreateBillPayment }) => {
      const { data } = await api.post(`/purchases/bills/${billId}/payments/`, payment);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-bills'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
    },
  });
};

export const useMarkChequeCleared = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (paymentId: number) => {
      const { data } = await api.post(`/purchases/payments/${paymentId}/mark_cheque_cleared/`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-bills'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
    },
  });
};

// ==============================================================================
// Bill Scanning (AI Extraction) Hooks
// ==============================================================================

export const useUploadBillScan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const { data } = await api.post('/purchases/bill-scans/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bill-scans'] });
    },
  });
};

export const useBillScan = (id: number | null) => {
  return useQuery<BillScan>({
    queryKey: ['bill-scans', id],
    queryFn: async () => {
      const { data } = await api.get(`/purchases/bill-scans/${id}/`);
      console.log('[useBillScan] API Response:', data);
      return data;
    },
    enabled: !!id,
    staleTime: 0, // Always fetch fresh data
    gcTime: 0, // Don't cache
    refetchInterval: (query) => {
      const data = query.state.data;
      console.log('[useBillScan] Checking refetch interval for status:', data?.processing_status);
      // Auto-poll every 3 seconds while processing
      if (data?.processing_status === 'processing' || data?.processing_status === 'pending') {
        return 3000;
      }
      return false;
    },
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
};

export const useUpdateBillScan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<BillScan> }) => {
      const { data } = await api.patch(`/purchases/bill-scans/${id}/`, updates);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bill-scans', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['bill-scans'] });
    },
  });
};

export const useCreateBillFromScan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ scanId, billData }: { scanId: number; billData: CreateSupplierBill }) => {
      const { data } = await api.post(`/purchases/bill-scans/${scanId}/create-bill/`, billData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-bills'] });
      queryClient.invalidateQueries({ queryKey: ['bill-scans'] });
    },
  });
};
