/**
 * React hooks for Accounting Module API
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  AccountCategory,
  ChartOfAccount,
  ChartOfAccountList,
  JournalEntry,
  JournalEntryList,
  FiscalPeriod,
  BankTransaction,
  CashBookReport,
  BankAccountOption,
  ARAgingReport,
  APAgingReport,
  ProfitLossReport,
  TrialBalanceReport,
  BalanceSheetReport,
  CreateJournalEntry,
  CreateBankTransaction,
  CreateChartOfAccount,
  UpdateChartOfAccount,
  CreateFiscalPeriod,
  CashDepositPayload,
} from '@/types/accounting';

// ==============================================================================
// Chart of Accounts Hooks
// ==============================================================================

export const useChartOfAccounts = (params?: {
  active?: boolean;
  category?: number;
  search?: string;
}) => {
  return useQuery<ChartOfAccountList[]>({
    queryKey: ['chart-of-accounts', params],
    queryFn: async () => {
      const { data } = await api.get('/accounting/chart-of-accounts/', { params });
      if (Array.isArray(data)) {
        return data;
      }
      if (data && Array.isArray(data.results)) {
        return data.results;
      }
      return [];
    },
  });
};

export const useAccountCategories = () => {
  return useQuery<AccountCategory[]>({
    queryKey: ['account-categories'],
    queryFn: async () => {
      const { data } = await api.get('/accounting/account-categories/');
      if (Array.isArray(data)) {
        return data;
      }
      if (data && Array.isArray(data.results)) {
        return data.results;
      }
      return [];
    },
  });
};

export const useChartOfAccount = (id: number) => {
  return useQuery<ChartOfAccount>({
    queryKey: ['chart-of-accounts', id],
    queryFn: async () => {
      const { data } = await api.get(`/accounting/chart-of-accounts/${id}/`);
      return data;
    },
    enabled: !!id,
  });
};

export const useCreateChartOfAccount = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateChartOfAccount) => {
      const { data } = await api.post('/accounting/chart-of-accounts/', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
    },
  });
};

export const useUpdateChartOfAccount = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: UpdateChartOfAccount }) => {
      const { data } = await api.put(`/accounting/chart-of-accounts/${id}/`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
    },
  });
};

export const useAccountBalance = (id: number) => {
  return useQuery({
    queryKey: ['chart-of-accounts', id, 'balance'],
    queryFn: async () => {
      const { data } = await api.get(`/accounting/chart-of-accounts/${id}/balance/`);
      return data;
    },
    enabled: !!id,
  });
};

export const useAccountTransactions = (
  id: number,
  params?: {
    start_date?: string;
    end_date?: string;
  },
) => {
  return useQuery({
    queryKey: ['chart-of-accounts', id, 'transactions', params],
    queryFn: async () => {
      const { data } = await api.get(`/accounting/chart-of-accounts/${id}/transactions/`, {
        params,
      });
      return data;
    },
    enabled: !!id,
  });
};

// ==============================================================================
// Journal Entries Hooks
// ==============================================================================

export const useJournalEntries = (params?: {
  entry_type?: 'system' | 'manual';
  source_type?: string;
  is_posted?: boolean;
  is_reversed?: boolean;
  start_date?: string;
  end_date?: string;
  search?: string;
}) => {
  return useQuery<JournalEntryList[]>({
    queryKey: ['journal-entries', params],
    queryFn: async () => {
      const { data } = await api.get('/accounting/journal-entries/', { params });
      if (Array.isArray(data)) {
        return data;
      }
      if (data && Array.isArray(data.results)) {
        return data.results;
      }
      return [];
    },
  });
};

export const useJournalEntry = (id: number) => {
  return useQuery<JournalEntry>({
    queryKey: ['journal-entries', id],
    queryFn: async () => {
      const { data } = await api.get(`/accounting/journal-entries/${id}/`);
      return data;
    },
    enabled: !!id,
  });
};

export const useCreateJournalEntry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entry: CreateJournalEntry) => {
      const { data } = await api.post('/accounting/journal-entries/', entry);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
    },
  });
};

export const usePostJournalEntry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post(`/accounting/journal-entries/${id}/post/`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
    },
  });
};

export const useReverseJournalEntry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      reversal_date,
      description,
    }: {
      id: number;
      reversal_date?: string;
      description?: string;
    }) => {
      const { data } = await api.post(`/accounting/journal-entries/${id}/reverse/`, {
        reversal_date,
        description,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
    },
  });
};

// ==============================================================================
// Fiscal Periods Hooks
// ==============================================================================

export const useFiscalPeriods = (params?: { status?: 'open' | 'closed' | 'locked' }) => {
  return useQuery<FiscalPeriod[]>({
    queryKey: ['fiscal-periods', params],
    queryFn: async () => {
      const { data } = await api.get('/accounting/fiscal-periods/', { params });
      return data;
    },
  });
};

export const useFiscalPeriod = (id: number) => {
  return useQuery<FiscalPeriod>({
    queryKey: ['fiscal-periods', id],
    queryFn: async () => {
      const { data } = await api.get(`/accounting/fiscal-periods/${id}/`);
      return data;
    },
    enabled: !!id,
  });
};

export const useCreateFiscalPeriod = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateFiscalPeriod) => {
      const { data } = await api.post('/accounting/fiscal-periods/', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiscal-periods'] });
    },
  });
};

export const useCloseFiscalPeriod = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post(`/accounting/fiscal-periods/${id}/close/`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiscal-periods'] });
    },
  });
};

export const useLockFiscalPeriod = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post(`/accounting/fiscal-periods/${id}/lock/`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiscal-periods'] });
    },
  });
};

// ==============================================================================
// Bank Transactions Hooks
// ==============================================================================

export const useBankTransactions = (params?: {
  transaction_type?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
}) => {
  return useQuery<BankTransaction[]>({
    queryKey: ['bank-transactions', params],
    queryFn: async () => {
      const { data } = await api.get('/accounting/bank-transactions/', { params });
      return data;
    },
  });
};

export const useBankTransaction = (id: number) => {
  return useQuery<BankTransaction>({
    queryKey: ['bank-transactions', id],
    queryFn: async () => {
      const { data } = await api.get(`/accounting/bank-transactions/${id}/`);
      return data;
    },
    enabled: !!id,
  });
};

export const useCreateBankTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (transaction: CreateBankTransaction) => {
      const { data } = await api.post('/accounting/bank-transactions/', transaction);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
    },
  });
};

export const useApproveBankTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post(`/accounting/bank-transactions/${id}/approve/`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
    },
  });
};

export const useRejectBankTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post(`/accounting/bank-transactions/${id}/reject/`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
    },
  });
};

export const useBankAccounts = () => {
  return useQuery<BankAccountOption[]>({
    queryKey: ['bank-accounts'],
    queryFn: async () => {
      const { data } = await api.get('/accounting/bank-accounts/');
      if (Array.isArray(data)) {
        return data;
      }
      if (data && Array.isArray(data.results)) {
        return data.results;
      }
      return [];
    },
  });
};

export const useCreateCashDeposit = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CashDepositPayload) => {
      const { data } = await api.post('/accounting/cash/deposit/', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports', 'cash-book'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
    },
  });
};

// ==============================================================================
// Reports Hooks
// ==============================================================================

export const useCashBookReport = (
  params: {
    start_date: string;
    end_date: string;
    cash_account?: string;
  },
  options?: { enabled?: boolean },
) => {
  return useQuery<CashBookReport>({
    queryKey: ['reports', 'cash-book', params],
    queryFn: async () => {
      const { data } = await api.get('/accounting/reports/cash-book/', { params });
      return data;
    },
    enabled: (options?.enabled ?? true) && !!params.start_date && !!params.end_date,
  });
};

export const useARAgingReport = (
  params?: { as_of_date?: string },
  options?: { enabled?: boolean },
) => {
  return useQuery<ARAgingReport>({
    queryKey: ['reports', 'ar-aging', params],
    queryFn: async () => {
      const { data } = await api.get('/accounting/reports/ar-aging/', { params });
      return data;
    },
    enabled: options?.enabled ?? true,
  });
};

export const useAPAgingReport = (
  params?: { as_of_date?: string },
  options?: { enabled?: boolean },
) => {
  return useQuery<APAgingReport>({
    queryKey: ['reports', 'ap-aging', params],
    queryFn: async () => {
      const { data } = await api.get('/accounting/reports/ap-aging/', { params });
      return data;
    },
    enabled: options?.enabled ?? true,
  });
};

export const useProfitLossReport = (
  params: { start_date: string; end_date: string },
  options?: { enabled?: boolean },
) => {
  return useQuery<ProfitLossReport>({
    queryKey: ['reports', 'profit-loss', params],
    queryFn: async () => {
      const { data } = await api.get('/accounting/reports/profit-loss/', { params });
      return data;
    },
    enabled: (options?.enabled ?? true) && !!params.start_date && !!params.end_date,
  });
};

export const useTrialBalanceReport = (
  params?: { as_of_date?: string },
  options?: { enabled?: boolean },
) => {
  return useQuery<TrialBalanceReport>({
    queryKey: ['reports', 'trial-balance', params],
    queryFn: async () => {
      const { data } = await api.get('/accounting/reports/trial-balance/', { params });
      return data;
    },
    enabled: options?.enabled ?? true,
  });
};

export const useBalanceSheetReport = (
  params?: { as_of_date?: string },
  options?: { enabled?: boolean },
) => {
  return useQuery<BalanceSheetReport>({
    queryKey: ['reports', 'balance-sheet', params],
    queryFn: async () => {
      const { data } = await api.get('/accounting/reports/balance-sheet/', { params });
      return data;
    },
    enabled: options?.enabled ?? true,
  });
};
