/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from 'react';
import { DateRange } from '@/types/dateRange';

export interface ListPageState {
  currentPage: number;
  searchQuery: string;
  dateRange?: DateRange;
  pageSize: number;
  timestamp: number;
  // Additional filters can be added here as needed
  [key: string]: any;
}

export interface UseNavigationStateReturn {
  saveListState: (listType: string, state: Omit<ListPageState, 'timestamp'>) => void;
  getListState: (listType: string) => ListPageState | null;
  clearListState: (listType: string) => void;
}

// Session storage key prefix
const SESSION_KEY_PREFIX = 'listState_';

// State expiration time (30 minutes)
const STATE_EXPIRATION_MS = 30 * 60 * 1000;

/**
 * Hook for managing navigation state between list and detail pages
 * Uses sessionStorage to preserve pagination state invisibly to the user
 */
export function useNavigationState(): UseNavigationStateReturn {
  const getStorageKey = useCallback((listType: string) => {
    return `${SESSION_KEY_PREFIX}${listType}`;
  }, []);

  const saveListState = useCallback(
    (listType: string, state: Omit<ListPageState, 'timestamp'>) => {
      if (typeof window === 'undefined') return;

      try {
        const stateWithTimestamp = {
          ...state,
          timestamp: Date.now(),
        };

        const key = getStorageKey(listType);
        sessionStorage.setItem(key, JSON.stringify(stateWithTimestamp));

        console.log(`[NavigationState] Saved state for ${listType}:`, stateWithTimestamp);
      } catch (error) {
        console.warn(`[NavigationState] Failed to save state for ${listType}:`, error);
      }
    },
    [getStorageKey],
  );

  const getListState = useCallback(
    (listType: string): ListPageState | null => {
      if (typeof window === 'undefined') return null;

      try {
        const key = getStorageKey(listType);
        const stored = sessionStorage.getItem(key);

        if (!stored) return null;

        const state: ListPageState = JSON.parse(stored);

        // Check if state has expired
        if (Date.now() - state.timestamp > STATE_EXPIRATION_MS) {
          console.log(`[NavigationState] State expired for ${listType}, clearing...`);
          sessionStorage.removeItem(key);
          return null;
        }

        console.log(`[NavigationState] Restored state for ${listType}:`, state);
        return state;
      } catch (error) {
        console.warn(`[NavigationState] Failed to get state for ${listType}:`, error);
        return null;
      }
    },
    [getStorageKey],
  );

  const clearListState = useCallback(
    (listType: string) => {
      if (typeof window === 'undefined') return;

      try {
        const key = getStorageKey(listType);
        sessionStorage.removeItem(key);
        console.log(`[NavigationState] Cleared state for ${listType}`);
      } catch (error) {
        console.warn(`[NavigationState] Failed to clear state for ${listType}:`, error);
      }
    },
    [getStorageKey],
  );

  return {
    saveListState,
    getListState,
    clearListState,
  };
}
