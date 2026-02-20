import React from 'react';
import { getErrorSeverity } from '@/utils/errorHandling';

interface ErrorBannerProps {
  error: string | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  title?: string;
  showRetry?: boolean;
  showDismiss?: boolean;
}

/**
 * Reusable error banner component for displaying API errors
 */
export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  error,
  onRetry,
  onDismiss,
  title = 'An error occurred',
  showRetry = true,
  showDismiss = true,
}) => {
  if (!error) return null;

  // Determine styling based on error type (if we can parse it)
  const severity = getErrorSeverity({ message: error });

  const getBannerStyles = () => {
    switch (severity) {
      case 'error':
        return {
          container: 'bg-red-50 border-red-200',
          icon: 'text-red-400',
          title: 'text-red-800',
          message: 'text-red-700',
          retryButton: 'text-red-700 bg-red-100 hover:bg-red-200 focus:ring-red-500',
        };
      case 'warning':
        return {
          container: 'bg-yellow-50 border-yellow-200',
          icon: 'text-yellow-400',
          title: 'text-yellow-800',
          message: 'text-yellow-700',
          retryButton: 'text-yellow-700 bg-yellow-100 hover:bg-yellow-200 focus:ring-yellow-500',
        };
      default:
        return {
          container: 'bg-primary-50 border-primary-200',
          icon: 'text-primary-400',
          title: 'text-primary-800',
          message: 'text-primary-700',
          retryButton:
            'text-primary-700 bg-primary-100 hover:bg-primary-200 focus:ring-primary-500',
        };
    }
  };

  const styles = getBannerStyles();

  return (
    <div className={`border rounded-lg p-4 mb-4 ${styles.container}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg
            className={`h-5 w-5 ${styles.icon}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className={`text-sm font-medium ${styles.title}`}>{title}</h3>
          <div className={`mt-2 text-sm ${styles.message}`}>
            <p>{error}</p>
          </div>
          <div className="mt-4 flex space-x-3">
            {showRetry && onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md ${styles.retryButton} focus:outline-none focus:ring-2 focus:ring-offset-2`}
              >
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Try Again
              </button>
            )}
            {showDismiss && onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorBanner;
