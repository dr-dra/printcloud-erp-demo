/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Session Management Hook for POS System
 *
 * This hook manages cash drawer sessions for the Accounting/Cashier POS interface.
 * It handles session lifecycle: opening, checking status, and force-closing stale sessions.
 *
 * Features:
 * - Load current active session
 * - Open new cash drawer sessions
 * - Force close stale sessions (from previous days)
 * - Fetch last closed session for reference
 * - Session validation and status checking
 *
 * Extracted from:
 * - Accounting POS: accounting/page.tsx (lines 85-211, 325-395)
 *
 * @module useSessionManagement
 */

'use client';

import { useState, useCallback } from 'react';
import {
  getOpenCashDrawerSession,
  createCashDrawerSession,
  getLastClosedSession,
  forceCloseSession,
  type CashDrawerSession,
  type LastClosedSession,
} from '@/lib/posApi';
import { toast } from 'sonner';

/**
 * Return type of the useSessionManagement hook
 */
export interface UseSessionManagementReturn {
  // Session state
  currentSession: CashDrawerSession | null;
  cashDrawerSessionId: number | null;
  lastClosedSession: LastClosedSession | null;
  isLoadingSession: boolean;

  // Operations
  loadCashDrawerSession: () => Promise<void>;
  handleOpenDrawer: (openingBalance: string, openingNotes?: string) => Promise<boolean>;
  handleForceCloseOldSession: (actualBalance: string, closingNotes: string) => Promise<boolean>;
}

/**
 * Hook for managing cash drawer sessions in POS
 *
 * This hook handles the complete session lifecycle:
 * 1. Check for existing open session
 * 2. Detect stale sessions (from previous days)
 * 3. Open new sessions
 * 4. Force close old sessions
 *
 * @param selectedLocation - The current POS location ID
 * @returns Object containing session state and management functions
 *
 * @example
 * ```tsx
 * function AccountingPOS() {
 *   const {
 *     currentSession,
 *     cashDrawerSessionId,
 *     isLoadingSession,
 *     loadCashDrawerSession,
 *     handleOpenDrawer
 *   } = useSessionManagement(1);
 *
 *   useEffect(() => {
 *     loadCashDrawerSession();
 *   }, []);
 *
 *   if (!cashDrawerSessionId) {
 *     return <OpenSessionView onOpen={handleOpenDrawer} />;
 *   }
 *
 *   return <POSInterface />;
 * }
 * ```
 */
export function useSessionManagement(selectedLocation: number | null): UseSessionManagementReturn {
  // ========================================================================
  // STATE
  // ========================================================================

  /**
   * Current session object (if any open session exists)
   * Includes session details, balances, and status
   */
  const [currentSession, setCurrentSession] = useState<CashDrawerSession | null>(null);

  /**
   * Current session ID for active session
   * null = no active session, number = active session ID
   *
   * This is the key state that determines if POS operations can proceed
   */
  const [cashDrawerSessionId, setCashDrawerSessionId] = useState<number | null>(null);

  /**
   * Last closed session data (for reference when opening new session)
   * Shows previous session's totals, variance, etc.
   */
  const [lastClosedSession, setLastClosedSession] = useState<LastClosedSession | null>(null);

  /**
   * Loading state while fetching session data
   */
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  // ========================================================================
  // LOAD CASH DRAWER SESSION
  // ========================================================================

  /**
   * Load the current cash drawer session status
   *
   * This function performs the following checks:
   * 1. Check if there's an open session for the current user/location
   * 2. If no open session: Fetch last closed session for reference
   * 3. If open session exists: Check if it's stale (from previous day)
   * 4. If stale: Block operations and require force close
   * 5. If fresh: Allow normal operations
   *
   * State Updates:
   * - Sets currentSession if one exists
   * - Sets cashDrawerSessionId to null if no session or stale session
   * - Sets cashDrawerSessionId to session.id if fresh active session
   * - Sets lastClosedSession if no current session
   *
   * @example
   * ```tsx
   * useEffect(() => {
   *   loadCashDrawerSession();
   * }, [selectedLocation]);
   * ```
   */
  const loadCashDrawerSession = useCallback(async () => {
    if (!selectedLocation) {
      setIsLoadingSession(false);
      return;
    }

    setIsLoadingSession(true);

    try {
      // STEP 1: Check for open session
      const sessionResponse = await getOpenCashDrawerSession();

      if (sessionResponse.status === 204 || !sessionResponse.data) {
        // NO OPEN SESSION FOUND
        console.log('[useSessionManagement] No open session found');
        setCashDrawerSessionId(null);
        setCurrentSession(null);

        // Fetch last closed session for display in "Open Session" view
        try {
          const lastSessionResponse = await getLastClosedSession(selectedLocation);
          if (lastSessionResponse.data) {
            setLastClosedSession(lastSessionResponse.data);
            console.log('[useSessionManagement] Last closed session loaded');
          }
        } catch {
          console.log('[useSessionManagement] No previous session found');
          setLastClosedSession(null);
        }

        return;
      }

      // OPEN SESSION EXISTS
      const session = sessionResponse.data;
      setCurrentSession(session);

      console.log('[useSessionManagement] Session loaded:', {
        session_number: session.session_number,
        is_stale: session.is_stale,
        opened_at: session.opened_at,
        location_id: session.location_id,
      });

      // STEP 2: Check if session is stale
      if (session.is_stale) {
        // STALE SESSION (from previous day/shift)
        // Block operations and require force close
        console.warn('[useSessionManagement] Stale session detected:', session.session_number);
        console.warn('[useSessionManagement] Session details:', session);
        setCashDrawerSessionId(null); // Block operations
        toast.warning('Previous session must be closed before continuing');
      } else {
        // ACTIVE SESSION (from today)
        // Allow normal operations
        setCashDrawerSessionId(session.id);
        console.log('[useSessionManagement] Active session loaded:', session.session_number);
      }
    } catch (error: any) {
      console.error('[useSessionManagement] Failed to load session:', error);
      toast.error('Failed to load session information');
      setCashDrawerSessionId(null);
      setCurrentSession(null);
    } finally {
      setIsLoadingSession(false);
    }
  }, [selectedLocation]);

  // ========================================================================
  // OPEN NEW SESSION
  // ========================================================================

  /**
   * Open a new cash drawer session
   *
   * This creates a new session with the specified opening balance.
   * The session is tied to:
   * - Current location
   * - Current user (from authentication)
   * - Current date/time
   *
   * @param openingBalance - Starting cash amount (as string from input)
   * @param openingNotes - Optional notes about opening (e.g., denomination breakdown)
   * @returns true if successful, false if failed
   *
   * @example
   * ```tsx
   * const handleOpen = async () => {
   *   const success = await handleOpenDrawer("5000.00", "Float: 10x500 notes");
   *   if (success) {
   *     console.log('Session opened successfully');
   *   }
   * };
   * ```
   */
  const handleOpenDrawer = useCallback(
    async (
      openingBalance: string,
      openingNotes: string = 'Opened via POS Payments View',
    ): Promise<boolean> => {
      // VALIDATION
      if (!selectedLocation) {
        toast.error('Please select a location first');
        return false;
      }

      if (!openingBalance) {
        toast.error('Please enter an opening balance');
        return false;
      }

      setIsLoadingSession(true);

      try {
        // Create new session via API
        const response = await createCashDrawerSession({
          location_id: selectedLocation,
          opening_balance: parseFloat(openingBalance),
          opening_notes: openingNotes,
        });

        // Update state with new session
        const newSession = response.data;
        setCashDrawerSessionId(newSession.id);
        setCurrentSession(newSession);

        console.log('[useSessionManagement] Session opened:', newSession.session_number);
        toast.success('Cash drawer opened successfully!');

        return true;
      } catch (error: any) {
        console.error('[useSessionManagement] Failed to open session:', error);
        toast.error(error.response?.data?.error || 'Failed to open cash drawer');
        return false;
      } finally {
        setIsLoadingSession(false);
      }
    },
    [selectedLocation],
  );

  // ========================================================================
  // FORCE CLOSE STALE SESSION
  // ========================================================================

  /**
   * Force close a stale session from a previous day/shift
   *
   * This is used when:
   * - A session was left open overnight
   * - System crashed before proper close
   * - User forgot to close session
   *
   * Requires:
   * - Actual cash count (physical drawer count)
   * - Detailed notes explaining why session wasn't closed properly
   *
   * After force close, the user can open a new session.
   *
   * @param actualBalance - Physical cash counted in drawer
   * @param closingNotes - Required explanation (min 10 characters)
   * @returns true if successful, false if failed
   *
   * @example
   * ```tsx
   * const handleForceClose = async () => {
   *   const success = await handleForceCloseOldSession(
   *     "4875.50",
   *     "Session left open overnight due to power outage"
   *   );
   *   if (success) {
   *     // Can now open new session
   *   }
   * };
   * ```
   */
  const handleForceCloseOldSession = useCallback(
    async (actualBalance: string, closingNotes: string): Promise<boolean> => {
      // VALIDATION
      if (!currentSession) {
        toast.error('No session to close');
        return false;
      }

      if (!actualBalance) {
        toast.error('Please enter the actual cash counted');
        return false;
      }

      if (!closingNotes || closingNotes.trim().length < 10) {
        toast.error('Please provide detailed closing notes (minimum 10 characters)');
        return false;
      }

      setIsLoadingSession(true);

      try {
        // Force close the old session
        await forceCloseSession(currentSession.id, {
          actual_balance: parseFloat(actualBalance),
          closing_notes: closingNotes,
        });

        toast.success('Old session closed successfully');

        // Reset session state
        setCurrentSession(null);
        setCashDrawerSessionId(null);

        // Reload session data (will show "Open Session" view)
        await loadCashDrawerSession();

        return true;
      } catch (error: any) {
        console.error('[useSessionManagement] Failed to force close session:', error);
        toast.error(error.response?.data?.error || 'Failed to close old session');
        return false;
      } finally {
        setIsLoadingSession(false);
      }
    },
    [currentSession, loadCashDrawerSession],
  );

  // ========================================================================
  // RETURN
  // ========================================================================

  return {
    // State
    currentSession,
    cashDrawerSessionId,
    lastClosedSession,
    isLoadingSession,

    // Operations
    loadCashDrawerSession,
    handleOpenDrawer,
    handleForceCloseOldSession,
  };
}
