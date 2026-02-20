import { useState, useEffect, useCallback } from 'react';

/**
 * Hook for managing row highlight animation
 *
 * Usage:
 * const { highlightedRowId, setHighlight, clearHighlight } = useRowHighlight();
 *
 * Then pass highlightedRowId to DataTable and apply animation based on idColumn
 */
interface UseRowHighlightOptions {
  duration?: number; // Duration in milliseconds (default: 2500)
}

export function useRowHighlight(options: UseRowHighlightOptions = {}) {
  const { duration = 2500 } = options;

  const [highlightedRowId, setHighlightedRowId] = useState<number | string | null>(null);
  const [highlightTimeout, setHighlightTimeout] = useState<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Set highlight for a specific row
  const setHighlight = useCallback(
    (rowId: number | string) => {
      // Clear previous timeout if exists
      if (highlightTimeout) {
        clearTimeout(highlightTimeout);
      }

      // Set the new highlight
      setHighlightedRowId(rowId);

      // Schedule clearing the highlight after duration
      const timeout = setTimeout(() => {
        setHighlightedRowId(null);
      }, duration);

      setHighlightTimeout(timeout);
    },
    [duration, highlightTimeout],
  );

  // Manually clear highlight
  const clearHighlight = useCallback(() => {
    if (highlightTimeout) {
      clearTimeout(highlightTimeout);
    }
    setHighlightedRowId(null);
  }, [highlightTimeout]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (highlightTimeout) {
        clearTimeout(highlightTimeout);
      }
    };
  }, [highlightTimeout]);

  return {
    highlightedRowId,
    setHighlight,
    clearHighlight,
  };
}
