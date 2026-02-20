import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';

// Types for the hook
export interface PageInitializationConfig {
  // DOM measurement configuration
  rowHeight?: number;
  minRows?: number;
  maxRows?: number;
  padding?: number;

  // Auto-calculation configuration
  enableAutoCalculation?: boolean;
  defaultRowsPerPage?: number;

  // Timing configuration
  initializationDelay?: number;
  resizeDebounceDelay?: number;

  // Callback functions
  onInitializationComplete?: () => void;
  onError?: (error: Error) => void;
}

export interface PageInitializationState {
  // Core states
  isClient: boolean;
  pageReady: boolean;
  loading: boolean;
  error: string | null;

  // Row calculation states
  rowsPerPage: number | 'auto';
  calculatedRowsPerPage: number;
  isAutoCalculated: boolean;

  // DOM refs for measurement
  topNavRef: React.RefObject<HTMLDivElement | null>;
  titleRef: React.RefObject<HTMLDivElement | null>;
  filterBarRef: React.RefObject<HTMLDivElement | null>;
  paginationRef: React.RefObject<HTMLDivElement | null>;
  tableRef: React.RefObject<HTMLDivElement | null>;
}

export interface PageInitializationActions {
  // Row management
  setRowsPerPage: (value: number | 'auto') => void;
  recalculateRows: () => void;

  // State management
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  resetPage: () => void;

  // Utility functions
  calculateOptimalRows: () => number;
}

export type UsePageInitializationReturn = PageInitializationState & PageInitializationActions;

// Default configuration
const DEFAULT_CONFIG: Required<PageInitializationConfig> = {
  rowHeight: 90,
  minRows: 5,
  maxRows: 40,
  padding: 32,
  enableAutoCalculation: true,
  defaultRowsPerPage: 10,
  initializationDelay: 100,
  resizeDebounceDelay: 150,
  onInitializationComplete: () => {},
  onError: () => {},
};

/**
 * Reusable hook for page initialization with authentication, DOM measurement, and state management
 *
 * @param config - Configuration options for the page initialization
 * @returns Object containing state and actions for page management
 *
 * @example
 * ```typescript
 * const {
 *   pageReady,
 *   loading,
 *   calculatedRowsPerPage,
 *   setRowsPerPage,
 *   recalculateRows
 * } = usePageInitialization({
 *   rowHeight: 80,
 *   minRows: 3,
 *   maxRows: 50,
 *   onInitializationComplete: () => console.log('Page ready!')
 * });
 *
 * // Use in data fetching
 * useEffect(() => {
 *   if (pageReady && !loading) {
 *     fetchData(calculatedRowsPerPage);
 *   }
 * }, [pageReady, loading, calculatedRowsPerPage]);
 * ```
 */
export const usePageInitialization = (
  config: PageInitializationConfig = {},
): UsePageInitializationReturn => {
  // Merge config with defaults
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // Auth context
  const { loading: authLoading, isAuthenticated, user } = useAuth();

  // Core states
  const [isClient, setIsClient] = useState(false);
  const [pageReady, setPageReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Row calculation states
  const [rowsPerPage, setRowsPerPageState] = useState<number | 'auto'>('auto');
  const [calculatedRowsPerPage, setCalculatedRowsPerPage] = useState(
    finalConfig.defaultRowsPerPage,
  );
  const [isAutoCalculated, setIsAutoCalculated] = useState(finalConfig.enableAutoCalculation);

  // DOM refs for measurement
  const topNavRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const filterBarRef = useRef<HTMLDivElement>(null);
  const paginationRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // Set client-side state after hydration
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Calculate optimal rows per page based on viewport height and UI elements
  const calculateOptimalRows = useCallback(() => {
    // Check if we're in the browser environment
    if (typeof window === 'undefined') return finalConfig.defaultRowsPerPage;

    const { rowHeight, minRows, maxRows, padding } = finalConfig;
    let usedHeight = 0;

    // Dashboard Layout Heights (more accurate)
    usedHeight += 56; // Top navigation bar (py-3)
    usedHeight += 56; // Content margin-top (mt-14)
    usedHeight += 16; // Dashboard content padding (p-2 × 2 = 8px + 8px)

    // Page Container Heights
    usedHeight += 4; // Page container padding (p-1 = 4px)

    // Title Section (measured more accurately)
    usedHeight += 60; // Title: text-2xl (~32px) + mb-4 (16px) + extra spacing = 60px

    // Spacing between sections
    usedHeight += 48; // space-y-3 creates 12px gaps × 4 sections + extra margins = 48px

    // Measure actual DOM elements (these should be smaller now)
    if (topNavRef.current) usedHeight += topNavRef.current.offsetHeight;
    if (titleRef.current) usedHeight += Math.max(0, titleRef.current.offsetHeight - 44); // Subtract what we already counted
    if (filterBarRef.current) usedHeight += filterBarRef.current.offsetHeight;
    if (paginationRef.current) usedHeight += paginationRef.current.offsetHeight;

    // Table-specific heights (reduced for better fit)
    usedHeight += 40; // Table header height (py-1 + text-xs + border)
    usedHeight += 24; // Table card padding (reduced from 32px)
    usedHeight += 60; // Pagination controls area (reduced from 70px)

    // General padding and buffer (reduced for better fit)
    usedHeight += padding; // General page padding (default 32px)
    usedHeight += 40; // Increased safety buffer (from 30px to 40px)

    // Calculate available height and optimal rows
    const availableHeight = window.innerHeight - usedHeight;
    const optimalRows = Math.floor(availableHeight / rowHeight);

    // Clamp to min/max values
    const result = Math.max(minRows, Math.min(maxRows, optimalRows));

    // Debug logging for calibration
    if (typeof window !== 'undefined' && window.console) {
      console.debug('[Row Calculation - Detailed Breakdown]', {
        windowHeight: window.innerHeight,
        '1_dashboardNav': 56,
        '2_contentMargin': 56,
        '3_dashboardPadding': 16,
        '4_pageContainer': 4,
        '5_titleSection': 60,
        '6_sectionSpacing': 48,
        '7_tableHeader': 40,
        '8_tableCardPadding': 24,
        '9_paginationArea': 60,
        '10_generalPadding': padding,
        '11_safetyBuffer': 40,
        estimatedFixedHeight: 56 + 56 + 16 + 4 + 60 + 48 + 40 + 24 + 60 + padding + 40,
        actualTotalUsedHeight: usedHeight,
        availableHeight,
        rowHeight,
        calculatedRows: optimalRows,
        finalRows: result,
        targetRows: '9-10 rows expected',
      });
    }

    return result;
  }, [finalConfig]);

  // Unified initialization effect - coordinates auth, calculation, and readiness
  useEffect(() => {
    // Only proceed if we're authenticated and client-side
    if (!isAuthenticated || !isClient) return;

    const initializePage = async () => {
      try {
        setLoading(true);
        setError(null);

        // Step 1: Determine rows per page based on user preference and current setting
        let targetRowsPerPage: number;
        let calculatedIsAutoCalculated: boolean;

        if (rowsPerPage === 'auto' && finalConfig.enableAutoCalculation) {
          // Check if user has a saved preference (from useAuth context)
          if (user?.grid_rows_per_page && typeof user.grid_rows_per_page === 'number') {
            // Use user's preference
            targetRowsPerPage = user.grid_rows_per_page;
            calculatedIsAutoCalculated = false;
            console.debug(
              '[usePageInitialization] Using user preference for rows per page:',
              user.grid_rows_per_page,
            );
          } else {
            // Small delay to ensure DOM is ready for auto-calculation
            await new Promise((resolve) => setTimeout(resolve, finalConfig.initializationDelay));
            targetRowsPerPage = calculateOptimalRows();
            calculatedIsAutoCalculated = true;
            console.debug(
              '[usePageInitialization] Using auto-calculated rows per page:',
              targetRowsPerPage,
            );
          }
        } else if (rowsPerPage !== 'auto') {
          // Manual value set
          targetRowsPerPage = rowsPerPage;
          calculatedIsAutoCalculated = false;
        } else {
          // Auto is enabled but calculation failed, use default
          targetRowsPerPage = finalConfig.defaultRowsPerPage;
          calculatedIsAutoCalculated = true;
        }

        setCalculatedRowsPerPage(targetRowsPerPage);
        setIsAutoCalculated(calculatedIsAutoCalculated);

        // Step 2: Mark page as ready
        setPageReady(true);
        setLoading(false);

        // Step 3: Call completion callback
        finalConfig.onInitializationComplete();
      } catch (error) {
        console.warn('[usePageInitialization] Initialization error:', error);

        // Fallback to default values
        setCalculatedRowsPerPage(finalConfig.defaultRowsPerPage);
        setPageReady(true);
        setLoading(false);
        setError('Failed to initialize page properly');

        // Call error callback
        finalConfig.onError(error as Error);
      }
    };

    initializePage();
  }, [
    isAuthenticated,
    authLoading,
    isClient,
    rowsPerPage,
    user,
    calculateOptimalRows,
    finalConfig,
  ]);

  // Handle window resize for auto calculation
  useEffect(() => {
    if (!isClient || rowsPerPage !== 'auto' || !finalConfig.enableAutoCalculation) return;

    const handleResize = () => {
      const optimalRows = calculateOptimalRows();
      setCalculatedRowsPerPage(optimalRows);
    };

    // Debounce resize events
    let timeoutId: ReturnType<typeof setTimeout>;
    const debouncedResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleResize, finalConfig.resizeDebounceDelay);
    };

    window.addEventListener('resize', debouncedResize);
    return () => {
      window.removeEventListener('resize', debouncedResize);
      clearTimeout(timeoutId);
    };
  }, [isClient, rowsPerPage, calculateOptimalRows, finalConfig]);

  // Action functions
  const setRowsPerPage = useCallback(
    (value: number | 'auto') => {
      setRowsPerPageState(value);
      setIsAutoCalculated(value === 'auto');

      // If switching to auto, check user preference first, then recalculate
      if (value === 'auto' && finalConfig.enableAutoCalculation) {
        if (user?.grid_rows_per_page && typeof user.grid_rows_per_page === 'number') {
          // Use user's preference
          setCalculatedRowsPerPage(user.grid_rows_per_page);
          setIsAutoCalculated(false); // Not truly auto-calculated, but user preference
        } else {
          // Fall back to auto-calculation
          const optimalRows = calculateOptimalRows();
          setCalculatedRowsPerPage(optimalRows);
        }
      } else if (value !== 'auto') {
        setCalculatedRowsPerPage(value);
      }
    },
    [calculateOptimalRows, finalConfig.enableAutoCalculation, user],
  );

  const recalculateRows = useCallback(() => {
    if (rowsPerPage === 'auto' && finalConfig.enableAutoCalculation) {
      if (user?.grid_rows_per_page && typeof user.grid_rows_per_page === 'number') {
        // Use user's preference
        setCalculatedRowsPerPage(user.grid_rows_per_page);
        setIsAutoCalculated(false);
      } else {
        // Fall back to auto-calculation
        const optimalRows = calculateOptimalRows();
        setCalculatedRowsPerPage(optimalRows);
        setIsAutoCalculated(true);
      }
    }
  }, [rowsPerPage, calculateOptimalRows, finalConfig.enableAutoCalculation, user]);

  const resetPage = useCallback(() => {
    setPageReady(false);
    setLoading(true);
    setError(null);
    setRowsPerPageState('auto');
    setCalculatedRowsPerPage(finalConfig.defaultRowsPerPage);
    setIsAutoCalculated(finalConfig.enableAutoCalculation);
  }, [finalConfig.defaultRowsPerPage, finalConfig.enableAutoCalculation]);

  // Return state and actions
  return {
    // State
    isClient,
    pageReady,
    loading: loading || authLoading,
    error,
    rowsPerPage,
    calculatedRowsPerPage,
    isAutoCalculated,

    // Refs
    topNavRef,
    titleRef,
    filterBarRef,
    paginationRef,
    tableRef,

    // Actions
    setRowsPerPage,
    recalculateRows,
    setLoading,
    setError,
    resetPage,
    calculateOptimalRows,
  };
};
