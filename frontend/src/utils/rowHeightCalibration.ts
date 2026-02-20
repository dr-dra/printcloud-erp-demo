import React from 'react';

/**
 * Utility for calibrating and measuring actual DataTable row heights
 * Use this in development to verify your rowHeight configuration is accurate
 */

export interface RowMeasurement {
  actualRowHeight: number;
  tableHeaderHeight: number;
  cardPadding: number;
  totalUsedHeight: number;
  availableHeight: number;
  recommendedRowHeight: number;
}

/**
 * Measures actual row heights in a DataTable component
 * Call this from your page component to get real measurements
 *
 * @param tableRef - Ref to the table container element
 * @param sampleRows - Number of rows to measure for averaging (default: 3)
 * @returns Measurement data and recommendations
 */
export const measureTableRowHeight = (
  tableRef: React.RefObject<HTMLElement>,
  sampleRows: number = 3,
): RowMeasurement | null => {
  if (!tableRef.current) {
    console.warn('[Row Calibration] Table ref not available');
    return null;
  }

  try {
    const table = tableRef.current.querySelector('table');
    const card = tableRef.current.closest('.bg-white, .dark\\:bg-gray-800');

    if (!table) {
      console.warn('[Row Calibration] Table element not found');
      return null;
    }

    // Measure table header
    const headerRow = table.querySelector('thead tr');
    const tableHeaderHeight = headerRow ? headerRow.getBoundingClientRect().height : 32;

    // Measure sample data rows
    const dataRows = Array.from(table.querySelectorAll('tbody tr')).slice(0, sampleRows);

    if (dataRows.length === 0) {
      console.warn('[Row Calibration] No data rows found for measurement');
      return null;
    }

    // Calculate average row height
    const rowHeights = dataRows.map((row) => row.getBoundingClientRect().height);
    const actualRowHeight = Math.round(
      rowHeights.reduce((sum, height) => sum + height, 0) / rowHeights.length,
    );

    // Measure card padding
    let cardPadding = 48; // Default estimate
    if (card) {
      const cardStyles = window.getComputedStyle(card);
      const paddingTop = parseInt(cardStyles.paddingTop, 10) || 0;
      const paddingBottom = parseInt(cardStyles.paddingBottom, 10) || 0;
      cardPadding = paddingTop + paddingBottom;
    }

    // Calculate total used height (approximation)
    const totalUsedHeight =
      tableHeaderHeight +
      cardPadding +
      32 + // General page padding
      100; // Estimated space for nav, title, filters, pagination

    const availableHeight = window.innerHeight - totalUsedHeight;

    // Recommend a row height (round to nearest 5 for cleaner config)
    const recommendedRowHeight = Math.round(actualRowHeight / 5) * 5;

    const measurement: RowMeasurement = {
      actualRowHeight,
      tableHeaderHeight,
      cardPadding,
      totalUsedHeight,
      availableHeight,
      recommendedRowHeight,
    };

    // Log detailed measurement for debugging
    console.group('[Row Height Calibration]');
    console.log('Measured row heights:', rowHeights);
    console.log('Average row height:', actualRowHeight);
    console.log('Table header height:', tableHeaderHeight);
    console.log('Card padding:', cardPadding);
    console.log('Estimated total used height:', totalUsedHeight);
    console.log('Available height for rows:', availableHeight);
    console.log('Recommended rowHeight config:', recommendedRowHeight);
    console.log('Estimated rows that would fit:', Math.floor(availableHeight / actualRowHeight));
    console.groupEnd();

    return measurement;
  } catch (error) {
    console.error('[Row Calibration] Measurement failed:', error);
    return null;
  }
};

/**
 * React hook for automatic row height calibration
 * Use this in development to automatically log measurements
 */
export const useRowHeightCalibration = (
  tableRef: React.RefObject<HTMLElement>,
  enabled: boolean = typeof process !== 'undefined' && process.env.NODE_ENV === 'development',
) => {
  React.useEffect(() => {
    if (!enabled || !tableRef.current) return;

    // Wait for table to render with data
    const timer = setTimeout(() => {
      measureTableRowHeight(tableRef);
    }, 1000);

    return () => clearTimeout(timer);
  }, [tableRef, enabled]);
};
