'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '@/lib/api';
import { useRouter, usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { Toast } from 'flowbite-react';
import { debugLog, debugWarn } from '@/utils/logger';

// Security constants
const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes before expiry

// Define the User interface for type safety
export interface User {
  id: number; // User's unique ID
  email: string; // User's email address
  username: string | null; // Username (can be null)
  role: string; // User's role (e.g., 'production')
  theme: string; // User's theme preference (e.g., 'dark', 'light')
  last_login?: string; // Last login timestamp
  is_active?: boolean; // User account status
  // Printer preferences
  default_a4_printer?: string; // Default printer for A4 documents
  default_a5_printer?: string; // Default printer for A5 documents
  default_pos_printer?: string; // Default thermal printer for POS
  // UI preferences
  grid_rows_per_page?: number | null; // Number of rows per page in grid views (1-100, null for auto)
  sidebar_behavior?: 'overlay' | 'push'; // Sidebar behavior preference (overlay or push content)
  // Profile data
  profile_picture?: string | null; // User's profile picture URL
  display_name?: string | null; // User's display name from employee record
}

// Define the AuthContext interface - what data and functions will be available
interface AuthContextType {
  user: User | null; // Current user data (null if not authenticated)
  loading: boolean; // Loading state for auth operations
  login: (email: string, password: string) => Promise<boolean>; // Login function
  logout: () => void; // Logout function
  isAuthenticated: boolean; // Boolean indicating if user is authenticated
  refreshUserData: () => Promise<void>; // Refresh user data
  updateProfilePicture: (profilePictureUrl: string) => void; // Update profile picture
}

// Create the React context with undefined as initial value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Custom hook to use the auth context - provides type safety and error handling
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Token validation helper
const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiryTime = payload.exp * 1000; // Convert to milliseconds
    const currentTime = Date.now();
    return currentTime >= expiryTime;
  } catch {
    return true; // If we can't parse the token, consider it expired
  }
};

// Helper function to check if a path is public (doesn't require authentication)
const isPublicPath = (pathname: string) => {
  const publicPaths = [
    '/login',
    '/forgot-password',
    '/reset-password',
    '/', // Root path
  ];

  // Check for exact matches or if the path starts with a public path
  return publicPaths.some(
    (path) =>
      pathname === path ||
      pathname.startsWith('/reset-password/') ||
      pathname.startsWith('/forgot-password/') ||
      pathname.startsWith('/shared/'), // Allow shared quotation links
  );
};

// Main AuthProvider component that wraps the app and provides authentication state
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // State management for authentication
  const [user, setUser] = useState<User | null>(null); // Current user data
  const [loading, setLoading] = useState(true); // Loading state

  const router = useRouter(); // Next.js router for navigation
  const pathname = usePathname(); // Get current pathname
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Helper to show toast
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMsg(msg);
    setToastType(type);
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Function to refresh user data (simplified - profile picture now managed by useProfilePicture hook)
  const refreshUserData = async (): Promise<void> => {
    try {
      // Get basic user data
      const userResponse = await api.get('/auth/users/me/');
      setUser(userResponse.data);
    } catch (error) {
      console.error('[Auth] Failed to refresh user data:', error);
      // Don't logout here, just log the error
    }
  };

  // Proactive token refresh - refresh tokens before they expire
  useEffect(() => {
    const checkAndRefreshToken = async () => {
      if (typeof window === 'undefined') return;
      const token = localStorage.getItem('accessToken');
      const refreshToken = localStorage.getItem('refreshToken');

      if (!token || !refreshToken) return;

      try {
        // Parse token to get expiry
        const payload = JSON.parse(atob(token.split('.')[1]));
        const expiryTime = payload.exp * 1000;
        const currentTime = Date.now();
        const timeUntilExpiry = expiryTime - currentTime;

        // If token expires in less than 5 minutes, refresh it proactively
        if (timeUntilExpiry > 0 && timeUntilExpiry < TOKEN_REFRESH_THRESHOLD) {
          debugLog('[Auth] Token expiring soon, refreshing proactively...', {
            expiresIn: Math.round(timeUntilExpiry / 1000 / 60) + ' minutes',
          });

          try {
            const refreshResponse = await authAPI.refreshToken(refreshToken);
            const { access, refresh } = refreshResponse.data;

            localStorage.setItem('accessToken', access);
            if (refresh) {
              localStorage.setItem('refreshToken', refresh);
            }

            debugLog('[Auth] Token refreshed proactively');
          } catch (refreshError) {
            debugWarn('[Auth] Proactive token refresh failed:', refreshError);
            // If refresh fails, user will be logged out on next API call
          }
        }
      } catch {
        // Token parsing error - ignore
      }
    };

    // Check token every minute
    const interval = setInterval(checkAndRefreshToken, 60 * 1000);

    // Run immediately on mount
    checkAndRefreshToken();

    return () => clearInterval(interval);
  }, []);

  // Session recovery - refresh tokens when page becomes visible after long inactivity
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (typeof window === 'undefined') return;
      // Only handle when page becomes visible
      if (document.visibilityState !== 'visible') return;

      const token = localStorage.getItem('accessToken');
      const refreshToken = localStorage.getItem('refreshToken');

      if (!token || !refreshToken) return;

      try {
        // Check if token is expired or close to expiring
        const payload = JSON.parse(atob(token.split('.')[1]));
        const expiryTime = payload.exp * 1000;
        const currentTime = Date.now();

        // If token is expired or expires in less than 10 minutes, refresh immediately
        if (currentTime >= expiryTime || expiryTime - currentTime < 10 * 60 * 1000) {
          debugLog('[Auth] Page became visible with expired/expiring token, refreshing...');

          try {
            const refreshResponse = await authAPI.refreshToken(refreshToken);
            const { access, refresh } = refreshResponse.data;

            localStorage.setItem('accessToken', access);
            if (refresh) {
              localStorage.setItem('refreshToken', refresh);
            }

            debugLog('[Auth] Token refreshed after page became visible');

            // Refresh user data with new token
            const userResponse = await api.get('/auth/users/me/');
            setUser(userResponse.data);
          } catch (refreshError) {
            debugWarn('[Auth] Session recovery failed:', refreshError);
            // User will be redirected to login on next API call
          }
        }
      } catch {
        // Token parsing error - ignore
      }
    };

    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      if (typeof window !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, []);

  // Function to update profile picture in local state (legacy - now handled by useProfilePicture hook)
  const updateProfilePicture = (_profilePictureUrl: string) => {
    // This function is kept for backward compatibility but profile pictures are now
    // managed by the useProfilePicture hook with localStorage caching
    debugLog(
      '[Auth] updateProfilePicture called - profile pictures now managed by useProfilePicture hook',
    );
  };

  // SECTION 1: INITIAL AUTHENTICATION CHECK
  // This effect runs on app load and checks if user is already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      if (typeof window === 'undefined') {
        setLoading(false);
        return;
      }

      // Check if current path is public and doesn't require authentication
      if (isPublicPath(pathname)) {
        debugLog('[Auth] Public path detected, skipping auth check:', pathname);
        setLoading(false);
        return;
      }

      // Get tokens from localStorage (persistent storage)
      const token = localStorage.getItem('accessToken');
      const refreshToken = localStorage.getItem('refreshToken');
      debugLog('[Auth] Checking authentication...', {
        hasAccessToken: !!token,
        hasRefreshToken: !!refreshToken,
        accessTokenLength: token?.length || 0,
        refreshTokenLength: refreshToken?.length || 0,
        // Add token format inspection (first 20 chars for debugging)
        accessTokenStart: token ? `${token.substring(0, 20)}...` : 'none',
        refreshTokenStart: refreshToken ? `${refreshToken.substring(0, 20)}...` : 'none',
      });

      if (token) {
        // Check if token is expired before making API call
        if (isTokenExpired(token)) {
          debugLog('[Auth] Access token is expired, attempting refresh...');
          const refreshToken = localStorage.getItem('refreshToken');
          if (refreshToken) {
            try {
              const refreshResponse = await authAPI.refreshToken(refreshToken);
              const { access, refresh } = refreshResponse.data;

              if (refresh) {
                localStorage.setItem('refreshToken', refresh);
              }
              localStorage.setItem('accessToken', access);

              // Fetch user data with new token
              const userResponse = await api.get('/auth/users/me/');
              setUser(userResponse.data);
              debugLog('[Auth] Token refreshed and user data fetched');
              setLoading(false);
              return;
            } catch (refreshError) {
              debugWarn('[Auth] Token refresh failed:', refreshError);
              // Continue with logout
            }
          }
        }

        try {
          debugLog('[Auth] Access token found, verifying with backend...');
          // Step 1: Verify the access token is still valid with the backend
          await authAPI.verifyToken(token);
          debugLog('[Auth] Token verified successfully!');

          // Step 2: If token is valid, fetch the current user's data
          debugLog('[Auth] Fetching user data...');
          const userResponse = await api.get('/auth/users/me/');
          debugLog('[Auth] Raw user response:', userResponse.data);
          debugLog('[Auth] User data fetched successfully:', {
            email: userResponse.data.email,
            username: userResponse.data.username,
            role: userResponse.data.role,
            theme: userResponse.data.theme,
            // Add more fields for debugging
            fullResponse: userResponse.data,
          });
          setUser(userResponse.data);
        } catch (error) {
          // If token verification fails (401, 403, etc.), clear tokens and redirect to login
          debugWarn('[Auth] Authentication check failed:', {
            error: error,
            status: (error as any)?.response?.status,
            statusText: (error as any)?.response?.statusText,
            data: (error as any)?.response?.data,
            message: (error as any)?.message,
            // Add more detailed error information
            responseHeaders: (error as any)?.response?.headers,
            requestConfig: {
              url: (error as any)?.config?.url,
              method: (error as any)?.config?.method,
              hasAuthHeader: !!(error as any)?.config?.headers?.Authorization,
            },
          });

          // Log the actual error object separately for debugging (but as warn, not error)
          debugWarn('[Auth] Full error object:', error);
          debugWarn('[Auth] Error response data:', (error as any)?.response?.data);
          debugWarn('[Auth] Error message:', (error as any)?.message);

          // Try to refresh the token before giving up
          const refreshToken = localStorage.getItem('refreshToken');
          if (refreshToken && (error as any)?.response?.status === 401) {
            debugLog('[Auth] Token expired, attempting manual refresh...');
            try {
              const refreshResponse = await authAPI.refreshToken(refreshToken);
              const { access, refresh } = refreshResponse.data;

              debugLog('[Auth] Manual token refresh successful!');

              // Store new tokens
              if (refresh) {
                localStorage.setItem('refreshToken', refresh);
              }
              localStorage.setItem('accessToken', access);

              // Fetch user data with new token
              const userResponse = await api.get('/auth/users/me/');
              setUser(userResponse.data);
              debugLog('[Auth] User data fetched after manual refresh');
              setLoading(false);
              return; // Don't logout, we successfully refreshed
            } catch (refreshError) {
              debugWarn('[Auth] Manual token refresh failed:', refreshError);
              // Continue with logout if refresh fails
            }
          }

          debugLog('[Auth] Clearing tokens and redirecting to login...');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          setUser(null);
          router.replace('/login');
        }
      } else {
        // No access token found, redirect to login page
        debugLog('[Auth] No access token found, redirecting to login...');
        setUser(null);
        router.replace('/login');
      }
      setLoading(false); // Mark auth check as complete
    };

    // Run the authentication check with a small delay to avoid race conditions
    const timer = setTimeout(() => {
      checkAuth();
    }, 100);

    // SECTION 2: CROSS-TAB SYNCHRONIZATION
    // Listen for localStorage changes from other browser tabs
    // This ensures if user logs out in one tab, all tabs are logged out
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'accessToken' && !event.newValue) {
        debugLog('[Auth] Access token removed in another tab, logging out...');
        setUser(null);
        // Only redirect if not on a public path
        if (!isPublicPath(pathname)) {
          router.replace('/login');
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorage);
    }

    // Cleanup: remove event listener when component unmounts
    return () => {
      clearTimeout(timer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', handleStorage);
      }
    };
  }, [router, pathname]);

  // SECTION 3: AUTOMATIC TOKEN REFRESH
  // This effect sets up automatic token refresh every 3.5 hours
  // JWT tokens expire after 4 hours, so we refresh at 3.5 hours for office use
  useEffect(() => {
    if (typeof window === 'undefined') return;

    debugLog('[Auth] Setting up automatic token refresh every 3.5 hours (office system)...');

    const interval = setInterval(
      async () => {
        if (typeof window === 'undefined') return;
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          debugLog('[Auth] No refresh token available for automatic refresh');
          return;
        }

        try {
          debugLog('[Auth] Attempting to refresh access token...');
          // Call the refresh token endpoint to get a new access token
          const response = await authAPI.refreshToken(refreshToken);
          const { access, refresh } = response.data;

          debugLog('[Auth] Token refresh successful:', {
            newAccessTokenLength: access?.length || 0,
            newRefreshTokenProvided: !!refresh,
          });

          // Store the new tokens
          // Note: Some backends return a new refresh token (token rotation), others don't
          if (refresh) {
            localStorage.setItem('refreshToken', refresh);
            debugLog('[Auth] Updated refresh token');
          }
          localStorage.setItem('accessToken', access);
          debugLog('[Auth] Updated access token');
        } catch (err) {
          // If refresh fails, the refresh token might be expired
          // Handle this gracefully without showing user-facing errors
          const errorStatus = (err as any)?.response?.status;
          const errorMessage = (err as any)?.response?.data?.detail || (err as any)?.message;

          if (errorStatus === 401 || errorMessage?.includes('token')) {
            // Refresh token is expired - this is expected after long inactivity
            debugLog(
              '[Auth] Refresh token expired during automatic refresh - user will need to login on next interaction',
            );

            // Clear tokens silently to ensure clean state
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            setUser(null);

            // Don't redirect immediately - let user continue until they make a request
            // The next API call will handle the redirect to login
          } else {
            // Network error or other issue - log but don't show to user
            debugWarn('[Auth] Automatic token refresh failed (network/server issue):', {
              status: errorStatus,
              message: errorMessage,
            });
            // Don't clear tokens for network errors - retry on next interval
          }
        }
      },
      210 * 60 * 1000, // 3.5 hours in milliseconds (210 minutes)
    );

    // Cleanup: clear interval when component unmounts
    return () => {
      debugLog('[Auth] Clearing token refresh interval');
      clearInterval(interval);
    };
  }, []);

  // SECTION 4: LOGIN FUNCTION WITH SECURITY ENHANCEMENTS
  // Handles user login with email and password
  const login = async (email: string, password: string): Promise<boolean> => {
    if (typeof window === 'undefined') return false;

    try {
      debugLog('[Auth] Attempting login for:', email);
      setLoading(true);

      // Step 1: Send login credentials to backend
      debugLog('[Auth] Sending login request for:', email);
      const response = await authAPI.login(email, password);
      const { access, refresh } = response.data;
      debugLog('[Auth] Login response received successfully');

      debugLog('[Auth] Login successful:', {
        accessTokenLength: access?.length || 0,
        refreshTokenLength: refresh?.length || 0,
      });

      // Step 2: Store tokens in localStorage for persistence
      localStorage.setItem('accessToken', access);
      localStorage.setItem('refreshToken', refresh);
      debugLog('[Auth] Tokens stored in localStorage');

      // Step 3: Fetch user data to populate the user state
      debugLog('[Auth] Fetching user data after login...');
      const userResponse = await api.get('/auth/users/me/');
      debugLog('[Auth] Raw user response after login:', userResponse.data);
      debugLog('[Auth] User data fetched:', {
        email: userResponse.data.email,
        username: userResponse.data.username,
        role: userResponse.data.role,
        theme: userResponse.data.theme,
        // Add more fields for debugging
        fullResponse: userResponse.data,
      });
      setUser(userResponse.data);

      // Step 4: Show success message and return true
      showToast('Successfully logged in!');
      return true;
    } catch (error: unknown) {
      // Handle login errors (invalid credentials, network issues, etc.)

      // Extract error message from backend response or use default
      const errorResponse = (error as any)?.response;
      const message =
        errorResponse?.data?.detail ||
        errorResponse?.data?.non_field_errors?.[0] ||
        errorResponse?.data?.email?.[0] ||
        errorResponse?.data?.password?.[0] ||
        (error as any).message ||
        'Login failed';

      // Show appropriate error message to user
      if (message && message !== 'Login failed') {
        showToast(message, 'error');
      } else {
        showToast('Invalid credentials. Please try again.', 'error');
      }
      return false;
    } finally {
      setLoading(false); // Always stop loading regardless of success/failure
    }
  };

  // SECTION 5: LOGOUT FUNCTION
  // Handles user logout and cleanup
  const logout = async () => {
    if (typeof window === 'undefined') return;

    try {
      debugLog('[Auth] Attempting logout...');
      // Step 1: Call backend logout endpoint (optional - for server-side cleanup)
      await authAPI.logout();
      debugLog('[Auth] Logout API call successful');
    } catch (_error) {
      // Even if backend logout fails, we still clear local state
      console.error('[Auth] Logout API call failed:', _error);
    } finally {
      // Step 2: Always clear local authentication state
      debugLog('[Auth] Clearing tokens and user state...');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);

      // Step 3: Redirect to login page
      router.replace('/login');
      showToast('Successfully logged out!');
      debugLog('[Auth] Logout completed');
    }
  };

  // SECTION 6: CONTEXT VALUE
  // Create the value object that will be provided to consumers
  const value: AuthContextType = {
    user, // Current user data
    loading, // Loading state
    login, // Login function
    logout, // Logout function
    isAuthenticated: !!user, // Boolean derived from user state
    refreshUserData, // Function to refresh user data
    updateProfilePicture, // Function to update profile picture
  };

  // Provide the context value to all child components
  return (
    <AuthContext.Provider value={value}>
      {children}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50">
          <Toast>
            <div
              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${toastType === 'success' ? 'bg-green-100 text-green-500 dark:bg-green-800 dark:text-green-200' : 'bg-red-100 text-red-500 dark:bg-red-800 dark:text-red-200'}`}
            >
              {/* Icon */}
              {toastType === 'success' ? (
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <div className="ml-3 text-sm font-normal">{toastMsg}</div>
            <button
              onClick={() => setToastMsg(null)}
              className="ml-2 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
              aria-label="Close"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </Toast>
        </div>
      )}
    </AuthContext.Provider>
  );
};
