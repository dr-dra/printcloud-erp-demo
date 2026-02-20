import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface SalesDashboardResponse {
  statistics: {
    total_customers: number;
    total_costing_sheets: number;
  };
  recent_activity: {
    costing_sheets: Array<{
      id: number;
      project_name: string | null;
      customer_name: string | null;
      created_at: string;
    }>;
    customers: Array<{
      id: number;
      name: string;
      customer_type: string;
      created_at: string;
    }>;
  };
}

export interface ReminderSummary {
  overdue: number;
  due_today: number;
  upcoming_7_days: number;
  total_active: number;
}

export interface StockItem {
  id: number;
  sku: string;
  product_name: string | null;
  category?: string | number | null;
  total_stock: number;
  needs_reorder: boolean;
}

export interface SupplierBill {
  id: number;
  bill_number: string;
  internal_reference: string;
  supplier_name: string;
  bill_date: string;
  due_date: string;
  status: string;
  total: string;
  balance_due: string;
}

export interface POSSessionReport {
  id: number;
  session_number: string;
  opened_at: string;
  status: string;
  opening_balance: string;
  expected_balance: string;
  payment_breakdown: {
    cash: number;
    card: number;
    lanka_qr: number;
    account: number;
    other: number;
  };
  stats: {
    completed_orders: number;
    pending_orders: number;
  };
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface SalesPipelineCounts {
  costings: number;
  quotations: number;
  orders: number;
  invoices: number;
}

export interface TopCustomerSpend {
  name: string;
  total: number;
  invoiceCount: number;
}

export interface StockMovementTrend {
  labels: string[];
  purchase: number[];
  sale: number[];
  adjustment: number[];
}

export interface ProfitTrend {
  labels: string[];
  values: number[];
}

const getListCount = (data: unknown): number => {
  if (Array.isArray(data)) {
    return data.length;
  }
  if (data && typeof data === 'object') {
    const record = data as { count?: number; results?: unknown[] };
    if (typeof record.count === 'number') {
      return record.count;
    }
    if (Array.isArray(record.results)) {
      return record.results.length;
    }
  }
  return 0;
};

export const useSalesDashboard = (enabled = true) => {
  return useQuery<SalesDashboardResponse>({
    queryKey: ['dashboard', 'sales'],
    queryFn: async () => {
      const { data } = await api.get('/sales/dashboard/');
      return data;
    },
    enabled,
  });
};

export const useReminderSummary = (enabled = true) => {
  return useQuery<ReminderSummary>({
    queryKey: ['dashboard', 'reminders', 'summary'],
    queryFn: async () => {
      const { data } = await api.get('/reminders/summary/');
      return data;
    },
    enabled,
  });
};

export const useInventoryReorderItems = (params?: { page_size?: number }, enabled = true) => {
  return useQuery<PaginatedResponse<StockItem>>({
    queryKey: ['dashboard', 'inventory', 'reorder', params],
    queryFn: async () => {
      const { data } = await api.get('/inventory/stock-items/', {
        params: { ...params, needs_reorder: true },
      });
      return data;
    },
    enabled,
  });
};

export const useOverdueBills = (params?: { page_size?: number }, enabled = true) => {
  return useQuery<PaginatedResponse<SupplierBill>>({
    queryKey: ['dashboard', 'purchases', 'overdue', params],
    queryFn: async () => {
      const { data } = await api.get('/purchases/bills/', {
        params: { ...params, overdue: true },
      });
      return data;
    },
    enabled,
  });
};

export const usePosOpenSessionReport = (enabled = true) => {
  return useQuery<POSSessionReport | null>({
    queryKey: ['dashboard', 'pos', 'open-session-report'],
    queryFn: async () => {
      const openResponse = await api.get('/pos/cash-drawer-sessions/open/');
      if (openResponse.status === 204 || !openResponse.data) {
        return null;
      }

      const sessionId = openResponse.data.id;
      const { data } = await api.get(`/pos/cash-drawer-sessions/${sessionId}/report/`);
      return data;
    },
    enabled,
  });
};

export const useSalesPipelineCounts = (enabled = true) => {
  return useQuery<SalesPipelineCounts>({
    queryKey: ['dashboard', 'sales', 'pipeline'],
    queryFn: async () => {
      const [costings, quotations, orders, invoices] = await Promise.all([
        api.get('/sales/costing/', { params: { page_size: 1 } }),
        api.get('/sales/quotations/', { params: { page_size: 1 } }),
        api.get('/sales/orders/', { params: { page_size: 1 } }),
        api.get('/sales/invoices/', { params: { page_size: 1 } }),
      ]);

      return {
        costings: getListCount(costings.data),
        quotations: getListCount(quotations.data),
        orders: getListCount(orders.data),
        invoices: getListCount(invoices.data),
      };
    },
    enabled,
  });
};

export const useTopCustomersByInvoice = (params?: { page_size?: number }, enabled = true) => {
  return useQuery<TopCustomerSpend[]>({
    queryKey: ['dashboard', 'sales', 'top-customers', params],
    queryFn: async () => {
      const { data } = await api.get('/sales/invoices/', {
        params: { page_size: params?.page_size ?? 200 },
      });

      const items = Array.isArray(data?.results) ? data.results : data;
      const totals = new Map<string, { total: number; count: number }>();

      if (Array.isArray(items)) {
        items.forEach((invoice) => {
          const name = invoice.customer_name || 'Unknown';
          const amount = parseFloat(invoice.net_total || '0') || 0;
          const current = totals.get(name) || { total: 0, count: 0 };
          current.total += amount;
          current.count += 1;
          totals.set(name, current);
        });
      }

      return Array.from(totals.entries())
        .map(([name, info]) => ({
          name,
          total: info.total,
          invoiceCount: info.count,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
    },
    enabled,
  });
};

export const useStockMovementTrend = (enabled = true) => {
  return useQuery<StockMovementTrend>({
    queryKey: ['dashboard', 'inventory', 'stock-movement-trend'],
    queryFn: async () => {
      const { data } = await api.get('/inventory/stock-movements/', {
        params: { page_size: 200 },
      });
      const items = Array.isArray(data?.results) ? data.results : data;

      const today = new Date();
      const labels: string[] = [];
      const purchase: number[] = [];
      const sale: number[] = [];
      const adjustment: number[] = [];

      for (let i = 29; i >= 0; i -= 1) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        labels.push(date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }));
        purchase.push(0);
        sale.push(0);
        adjustment.push(0);
      }

      if (Array.isArray(items)) {
        items.forEach((movement) => {
          const createdAt = movement.created_at ? new Date(movement.created_at) : null;
          if (!createdAt || isNaN(createdAt.getTime())) {
            return;
          }

          const diffDays = Math.floor((today.getTime() - createdAt.getTime()) / 86400000);
          if (diffDays < 0 || diffDays > 29) {
            return;
          }

          const index = 29 - diffDays;
          if (movement.movement_type === 'purchase') {
            purchase[index] += 1;
          } else if (movement.movement_type === 'sale') {
            sale[index] += 1;
          } else {
            adjustment[index] += 1;
          }
        });
      }

      return { labels, purchase, sale, adjustment };
    },
    enabled,
  });
};

export const useMonthlyProfitTrend = (enabled = true) => {
  return useQuery<ProfitTrend>({
    queryKey: ['dashboard', 'accounting', 'profit-trend'],
    queryFn: async () => {
      const today = new Date();
      const months = Array.from({ length: 6 }, (_, index) => {
        const date = new Date(today.getFullYear(), today.getMonth() - (5 - index), 1);
        return date;
      });

      const requests = months.map((date) => {
        const startDate = new Date(date.getFullYear(), date.getMonth(), 1);
        const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);

        const start = startDate.toISOString().split('T')[0];
        const end = endDate.toISOString().split('T')[0];

        return api
          .get('/accounting/reports/profit-loss/', {
            params: { start_date: start, end_date: end },
          })
          .then((response) => response.data);
      });

      const results = await Promise.all(requests);

      return {
        labels: months.map((date) => date.toLocaleDateString('en-US', { month: 'short' })),
        values: results.map((report) => parseFloat(report?.net_profit || '0') || 0),
      };
    },
    enabled,
  });
};
