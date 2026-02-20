/**
 * Utility functions for handling API errors and providing user-friendly messages
 */

export interface ApiError {
  code?: string;
  message?: string;
  response?: {
    status?: number;
    data?: {
      detail?: string;
      message?: string;
      error?: string;
      [key: string]: unknown;
    };
  };
}

/**
 * Get a user-friendly error message based on the error type
 * @param error - The error object from axios or fetch
 * @param defaultMessage - Default message to show if error type is unknown
 * @returns User-friendly error message
 */
export function getErrorMessage(
  error: ApiError,
  defaultMessage = 'An error occurred. Please try again.',
): string {
  // Network errors (server down, no internet, etc.)
  if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
    return 'Unable to connect to the server. Please check your internet connection and try again.';
  }

  // HTTP status code errors
  if (error.response?.status) {
    switch (error.response.status) {
      case 400:
        if (error.response.data) {
          const data = error.response.data as Record<string, unknown>;
          if (typeof data.detail === 'string') return data.detail;
          if (typeof data.message === 'string') return data.message;
          if (typeof data.error === 'string') return data.error;
          const fieldEntry = Object.entries(data).find(([, value]) => value);
          if (fieldEntry) {
            const [, value] = fieldEntry;
            if (Array.isArray(value)) {
              return value.filter((item) => typeof item === 'string').join(' ');
            }
            if (typeof value === 'string') return value;
          }
        }
        return 'Invalid request. Please check your input and try again.';
      case 401:
        return 'Your session has expired. Please log in again.';
      case 403:
        return 'You do not have permission to access this data.';
      case 404:
        return 'The requested data was not found.';
      case 408:
        return 'Request timeout. Please try again.';
      case 429:
        return 'Too many requests. Please wait a moment and try again.';
      case 500:
        return 'Server error occurred. Please try again later or contact support.';
      case 502:
        return 'Server is temporarily unavailable. Please try again later.';
      case 503:
        return 'Service is temporarily unavailable. Please try again later.';
      case 504:
        return 'Gateway timeout. Please try again.';
      default:
        if (error.response.status >= 500) {
          return 'Server error occurred. Please try again later.';
        } else if (error.response.status >= 400) {
          return 'Request failed. Please try again.';
        }
    }
  }

  // Server-provided error message
  if (error.response?.data?.detail) {
    return error.response.data.detail;
  }

  // Generic error messages
  if (error.response?.data?.message) {
    return error.response.data.message;
  }

  // Fallback to error message if available
  if (error.message) {
    return error.message;
  }

  return defaultMessage;
}

/**
 * Check if an error is a network error (server down, no internet)
 * @param error - The error object
 * @returns True if it's a network error
 */
export function isNetworkError(error: ApiError): boolean {
  return !!(
    error.code === 'ERR_NETWORK' ||
    error.message === 'Network Error' ||
    (error.message && error.message.includes('Network Error')) ||
    (error.message && error.message.includes('fetch')) ||
    (error.message && error.message.includes('Failed to fetch'))
  );
}

/**
 * Check if an error is a server error (5xx status codes)
 * @param error - The error object
 * @returns True if it's a server error
 */
export function isServerError(error: ApiError): boolean {
  return error.response?.status ? error.response.status >= 500 : false;
}

/**
 * Check if an error is an authentication error (401, 403)
 * @param error - The error object
 * @returns True if it's an authentication error
 */
export function isAuthError(error: ApiError): boolean {
  return error.response?.status === 401 || error.response?.status === 403;
}

/**
 * Get error severity level for UI styling
 * @param error - The error object
 * @returns 'error', 'warning', or 'info'
 */
export function getErrorSeverity(error: ApiError): 'error' | 'warning' | 'info' {
  if (isNetworkError(error) || isServerError(error)) {
    return 'error';
  }

  if (isAuthError(error)) {
    return 'warning';
  }

  return 'info';
}

/**
 * Get retry recommendation based on error type
 * @param error - The error object
 * @returns Retry recommendation message
 */
export function getRetryRecommendation(error: ApiError): string {
  if (isNetworkError(error)) {
    return 'Check your internet connection and try again.';
  }

  if (isServerError(error)) {
    return 'The server is experiencing issues. Please try again in a few minutes.';
  }

  if (isAuthError(error)) {
    return 'Please log in again to continue.';
  }

  return 'Please try again.';
}
