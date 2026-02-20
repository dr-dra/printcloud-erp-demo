/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios';
import { getToken, removeToken } from './auth';
import { debugLog, debugWarn } from '@/utils/logger';

// Security configuration
const API_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// Create axios instance with base URL and security settings
// Note: baseURL should end with / and url should not start with / for proper joining in Axios
const baseApiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
export const api = axios.create({
  baseURL: baseApiUrl.endsWith('/') ? baseApiUrl : `${baseApiUrl}/`,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest', // CSRF protection
  },
  // Security settings
  withCredentials: false, // Don't send cookies with requests
});

// Log the API configuration
debugLog('[API] Base URL:', baseApiUrl);

// Helper to get refresh token
const getRefreshToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('refreshToken');
};

// Security helper: Sanitize request data
const sanitizeRequestData = (data: unknown): unknown => {
  if (!data || typeof data !== 'object') return data;

  // Remove sensitive fields from logging
  const sanitized = { ...data } as Record<string, unknown>;
  if (sanitized.password) sanitized.password = '[REDACTED]';
  if (sanitized.refresh) sanitized.refresh = '[REDACTED]';
  if (sanitized.access) sanitized.access = '[REDACTED]';

  return sanitized;
};

// Request interceptor with security enhancements
api.interceptors.request.use(
  (config) => {
    // Fix for absolute paths in config.url overriding baseURL path
    if (config.url?.startsWith('/')) {
      config.url = config.url.substring(1);
    }

    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add request ID for tracking (removed to avoid CORS issues)
    // config.headers['X-Request-ID'] = Math.random().toString(36).substring(7);

    // Log request (sanitized)
    if (process.env.NODE_ENV === 'development') {
      debugLog('[API Request]', {
        method: config.method?.toUpperCase(),
        url: config.url,
        data: sanitizeRequestData(config.data),
        headers: {
          ...config.headers,
          Authorization: config.headers.Authorization ? 'Bearer [REDACTED]' : undefined,
        },
      });
    }

    return config;
  },
  (error) => {
    console.error('[API Request Error]', error);
    return Promise.reject(error);
  },
);

// Helper to detect authentication-related errors (vs permission errors)
const isAuthenticationError = (error: any): boolean => {
  const detail = error.response?.data?.detail;
  if (!detail) return false;

  // Common DRF authentication error messages
  const authErrorPatterns = [
    'Authentication credentials were not provided',
    'Given token not valid for any token type',
    'Token is invalid or expired',
    'User not found',
    'token_not_valid',
    'Invalid token',
    'Signature has expired',
  ];

  const detailStr = typeof detail === 'string' ? detail : JSON.stringify(detail);
  return authErrorPatterns.some((pattern) =>
    detailStr.toLowerCase().includes(pattern.toLowerCase()),
  );
};

// Response interceptor with refresh logic and security enhancements
let isRefreshing = false;

interface QueueItem {
  resolve: (value: string | null) => void;
  reject: (error: unknown) => void;
}

let failedQueue: QueueItem[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Retry mechanism for failed requests
const retryRequest = async (config: unknown, retryCount = 0): Promise<unknown> => {
  try {
    return await api(config);
  } catch (error: unknown) {
    const axiosError = error as { response?: { status?: number } };
    if (
      retryCount < MAX_RETRIES &&
      axiosError.response?.status &&
      axiosError.response.status >= 500
    ) {
      debugWarn(`[API] Retrying request (${retryCount + 1}/${MAX_RETRIES})`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
      return retryRequest(config, retryCount + 1);
    }
    throw error;
  }
};

api.interceptors.response.use(
  (response) => {
    // Log successful response (sanitized)
    if (process.env.NODE_ENV === 'development') {
      debugLog('[API Response]', {
        status: response.status,
        url: response.config.url,
        method: response.config.method?.toUpperCase(),
        data: response.data,
      });
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Temporarily disable error logging to prevent console spam
    // TODO: Re-enable with better error handling when needed

    // Handle both 401 errors and authentication-related 403 errors
    const status = error.response?.status;
    const isAuthError = status === 401 || (status === 403 && isAuthenticationError(error));

    // Only handle auth errors and avoid infinite retry loops
    if (error.response && isAuthError && !originalRequest._retry) {
      // Log when detecting auth-related 403s for debugging
      if (status === 403 && isAuthenticationError(error)) {
        debugLog('[API] Detected authentication-related 403, attempting token refresh');
      }
      // Don't retry authentication requests (login, refresh, etc.) or shared public endpoints
      if (originalRequest.url?.includes('/auth/') || originalRequest.url?.includes('/shared/')) {
        return Promise.reject(error);
      }
      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = 'Bearer ' + token;
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        debugWarn('[API] No refresh token available, redirecting to login');
        removeToken();
        // Use router.push instead of window.location for better UX
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      try {
        const response = await api.post('/auth/jwt/refresh/', { refresh: refreshToken });

        const newAccessToken = response.data.access;
        const newRefreshToken = response.data.refresh; // ✅ NEW

        localStorage.setItem('accessToken', newAccessToken);
        localStorage.setItem('refreshToken', newRefreshToken); // ✅ FIXED

        api.defaults.headers.common['Authorization'] = 'Bearer ' + newAccessToken;
        processQueue(null, newAccessToken);

        return api(originalRequest);
      } catch (err) {
        const axiosError = err as {
          response?: { status?: number; data?: { detail?: string } };
          message?: string;
        };
        const errorStatus = axiosError?.response?.status;
        const errorMessage = axiosError?.response?.data?.detail || axiosError?.message;

        if (errorStatus === 401 || errorMessage?.includes('token')) {
          // Refresh token expired - show user-friendly message
          debugLog('[API] Session expired - redirecting to login');
          processQueue(err, null);
          removeToken();

          // Clear any error toasts and show session expired message
          if (typeof window !== 'undefined') {
            // Use timeout to ensure any existing toasts are cleared
            setTimeout(() => {
              // You can add a session expired toast here if needed
              window.location.href = '/login';
            }, 100);
          }
        } else {
          // Network or server error - log but handle gracefully
          debugWarn('[API] Token refresh failed due to network/server issue:', {
            status: errorStatus,
            message: errorMessage,
          });
          processQueue(err, null);
        }

        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    // Handle legitimate permission denials (non-auth 403s) - reject immediately
    if (status === 403 && !isAuthenticationError(error)) {
      return Promise.reject(error);
    }

    // Handle other errors
    if (error.response?.status >= 500) {
      console.error('[API] Server error, attempting retry');
      return retryRequest(originalRequest);
    }

    // For other errors, just reject without additional logging to avoid console spam
    return Promise.reject(error);
  },
);

// Auth API endpoints - Updated for Djoser with security enhancements
export const authAPI = {
  // Djoser JWT login endpoint
  login: (email: string, password: string) => api.post('/auth/jwt/create/', { email, password }),

  // Djoser registration endpoint
  register: (data: { email: string; password: string; first_name: string; last_name: string }) =>
    api.post('/auth/users/', data),

  // Djoser password reset endpoint
  forgotPassword: (email: string) => api.post('/auth/users/reset_password/', { email }),

  // Djoser password reset confirm endpoint
  resetPassword: (data: { uid: string; token: string; new_password: string }) =>
    api.post('/auth/users/reset_password_confirm/', data),

  // Logout (Djoser doesn't have a logout endpoint for JWT, just clear tokens)
  logout: () => Promise.resolve(),

  // Djoser JWT refresh endpoint
  refreshToken: (refresh: string) => api.post('/auth/jwt/refresh/', { refresh }),

  // Djoser JWT verify endpoint
  verifyToken: (token: string) => api.post('/auth/jwt/verify/', { token }),
};

// Security utility functions
export const securityUtils = {
  // Validate token format
  isValidToken: (token: string): boolean => {
    if (!token || typeof token !== 'string') return false;
    const parts = token.split('.');
    return parts.length === 3;
  },

  // Get token expiry time
  getTokenExpiry: (token: string): Date | null => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return new Date(payload.exp * 1000);
    } catch {
      return null;
    }
  },

  // Check if token is expired
  isTokenExpired: (token: string): boolean => {
    const expiry = securityUtils.getTokenExpiry(token);
    if (!expiry) return true;
    return Date.now() >= expiry.getTime();
  },

  // Sanitize sensitive data
  sanitizeData: sanitizeRequestData,
};

// Orders API endpoints
export const ordersAPI = {
  // List orders with filters
  getOrders: (params?: Record<string, unknown>) => api.get('/sales/orders/', { params }),

  // Get single order by ID
  getOrder: (id: number) => api.get(`/sales/orders/${id}/`),

  // Create new order
  createOrder: (data: unknown) => api.post('/sales/orders/create/', data),

  // Update existing order
  updateOrder: (id: number, data: unknown) => api.put(`/sales/orders/${id}/edit/`, data),

  // Get next available order number
  getNextOrderNumber: () => api.get('/sales/orders/next-number/'),

  // Convert quotation to order
  convertQuotationToOrder: (quotationId: number) =>
    api.post(`/sales/orders/convert-quotation/${quotationId}/`),

  // Clone an existing order
  cloneOrder: (id: number) => api.post(`/sales/orders/${id}/clone/`),

  // Transition order status
  transitionOrderStatus: (id: number, data: { status: string; message?: string }) =>
    api.post(`/sales/orders/${id}/transition/`, data),

  // Generate order PDF
  getOrderPDF: (id: number) => api.get(`/sales/orders/${id}/pdf/`, { responseType: 'blob' }),

  // Send order email
  sendOrderEmail: (id: number, emailData: unknown) =>
    api.post(`/sales/orders/${id}/email/`, emailData),

  // Send order via WhatsApp
  sendOrderWhatsApp: (id: number, whatsappData: unknown) =>
    api.post(`/sales/orders/${id}/whatsapp/`, whatsappData),

  // Print order
  printOrder: (orderId: number, printData?: unknown) =>
    api.post(`/sales/orders/${orderId}/print/`, printData),

  // Generate share link
  generateShareLink: (id: number, data?: { expires_days?: number }) =>
    api.post(`/sales/orders/${id}/generate-share-link/`, data),

  // Order payments (advances)
  recordPayment: (orderId: number, paymentData: unknown) =>
    api.post(`/sales/orders/${orderId}/payments/create/`, paymentData),
  clearCheque: (paymentId: number, data?: { cleared_date?: string }) =>
    api.post(`/sales/orders/payments/${paymentId}/clear-cheque/`, data || {}),
  voidPayment: (paymentId: number, data: { void_reason: string }) =>
    api.post(`/sales/orders/payments/${paymentId}/void/`, data),
  getOrderPaymentReceipt: (paymentId: number) =>
    api.get(`/sales/orders/payments/${paymentId}/receipt-pdf/`, { responseType: 'blob' }),

  // Upload attachment
  uploadAttachment: (orderId: number, formData: FormData) =>
    api.post(`/sales/orders/${orderId}/attachments/upload/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  // Download attachment
  downloadAttachment: (attachmentId: number) =>
    api.get(`/sales/orders/attachments/${attachmentId}/download/`),
};

export const invoicesAPI = {
  // List invoices with filters
  getInvoices: (params?: Record<string, unknown>) => api.get('/sales/invoices/', { params }),

  // Get single invoice by ID
  getInvoice: (id: number) => api.get(`/sales/invoices/${id}/`),

  // Create new invoice
  createInvoice: (data: unknown) => api.post('/sales/invoices/create/', data),

  // Update existing invoice
  updateInvoice: (id: number, data: unknown) => api.put(`/sales/invoices/${id}/edit/`, data),

  // Get next available invoice number
  getNextInvoiceNumber: () => api.get('/sales/invoices/next-number/'),

  // Convert order to invoice
  convertOrderToInvoice: (orderId: number) => api.post(`/sales/invoices/convert-order/${orderId}/`),

  // Record a payment against an invoice
  recordPayment: (id: number, paymentData: unknown) =>
    api.post(`/sales/invoices/${id}/record-payment/`, paymentData),

  // Clear a cheque payment
  clearCheque: (paymentId: number, data?: { cleared_date?: string }) =>
    api.post(`/sales/invoices/payments/${paymentId}/clear-cheque/`, data || {}),

  // Void a payment
  voidPayment: (paymentId: number, data: { reason: string }) =>
    api.post(`/sales/invoices/payments/${paymentId}/void/`, data),

  // Generate invoice PDF
  getInvoicePDF: (id: number) => api.get(`/sales/invoices/${id}/pdf/`, { responseType: 'blob' }),

  // Send invoice email
  sendInvoiceEmail: (id: number, emailData?: unknown) =>
    api.post(`/sales/invoices/${id}/email/`, emailData || {}),

  // Send invoice via WhatsApp
  sendInvoiceWhatsApp: (id: number, whatsappData?: unknown) =>
    api.post(`/sales/invoices/${id}/whatsapp/`, whatsappData || {}),

  // Print invoice
  printInvoice: (id: number) => api.post(`/sales/invoices/${id}/print/`, {}),

  // Void invoice
  voidInvoice: (id: number) => api.post(`/sales/invoices/${id}/void/`, {}),
};

export const purchaseOrdersAPI = {
  // List purchase orders with filters
  getPurchaseOrders: (params?: Record<string, unknown>) =>
    api.get('/purchases/orders/', { params }),

  // Get single purchase order
  getPurchaseOrder: (id: number) => api.get(`/purchases/orders/${id}/`),

  // Create purchase order
  createPurchaseOrder: (data: unknown) => api.post('/purchases/orders/', data),

  // Update purchase order
  updatePurchaseOrder: (id: number, data: unknown) => api.put(`/purchases/orders/${id}/`, data),

  // Recalculate totals
  recalculatePurchaseOrder: (id: number) => api.post(`/purchases/orders/${id}/recalculate/`),

  // Get next available PO number
  getNextPurchaseOrderNumber: () => api.get('/purchases/orders/next-number/'),

  // Generate PO PDF
  getPurchaseOrderPDF: (id: number) =>
    api.get(`/purchases/orders/${id}/pdf/`, { responseType: 'blob' }),

  // Send PO email
  sendPurchaseOrderEmail: (id: number, emailData?: unknown) =>
    api.post(`/purchases/orders/${id}/email/`, emailData || {}),

  // Send PO via WhatsApp
  sendPurchaseOrderWhatsApp: (id: number, whatsappData?: unknown) =>
    api.post(`/purchases/orders/${id}/whatsapp/`, whatsappData || {}),

  // Print PO
  printPurchaseOrder: (id: number, printData?: unknown) =>
    api.post(`/purchases/orders/${id}/print/`, printData || {}),

  // Status actions
  sendPurchaseOrder: (id: number) => api.post(`/purchases/orders/${id}/send/`),
  confirmPurchaseOrder: (id: number) => api.post(`/purchases/orders/${id}/confirm/`),
  cancelPurchaseOrder: (id: number) => api.post(`/purchases/orders/${id}/cancel/`),
};

// Accounting API endpoints
export const accountingAPI = {
  // Get deposit accounts (Cash, Bank, Cheques Received)
  getDepositAccounts: () =>
    api.get('/accounting/chart-of-accounts/', {
      params: {
        account_code__in: '1000,1010,1040',
      },
    }),

  // Get bank accounts only (for payment deposit selection)
  getBankAccounts: () => api.get('/accounting/bank-accounts/'),

  // Get all chart of accounts
  getChartOfAccounts: (params?: Record<string, unknown>) =>
    api.get('/accounting/chart-of-accounts/', { params }),
};

export const coreAPI = {
  createBugReport: (formData: FormData) =>
    api.post('/core/bug-reports/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};
