/**
 * Utility functions for date formatting and manipulation
 */

/**
 * Format a Date object to YYYY-MM-DD string for API compatibility
 * @param date - Date object to format
 * @returns Formatted date string or null if date is null/undefined
 */
export function formatDateForAPI(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toISOString().split('T')[0];
}

/**
 * Format a Date object to a readable string (e.g., "Jan 15, 2024")
 * @param date - Date object to format
 * @returns Formatted date string
 */
export function formatDateReadable(date: Date | null | undefined): string {
  if (!date) return '';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a Date object to a short string (e.g., "01/15/2024")
 * @param date - Date object to format
 * @returns Formatted date string
 */
export function formatDateShort(date: Date | null | undefined): string {
  if (!date) return '';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * Check if a date is within a date range (inclusive)
 * @param date - Date to check
 * @param startDate - Start of range
 * @param endDate - End of range
 * @returns True if date is within range
 */
export function isDateInRange(
  date: Date | null | undefined,
  startDate: Date | null | undefined,
  endDate: Date | null | undefined,
): boolean {
  if (!date) return false;

  const dateStr = formatDateForAPI(date);
  const startStr = formatDateForAPI(startDate);
  const endStr = formatDateForAPI(endDate);

  if (!dateStr) return false;
  if (startStr && dateStr < startStr) return false;
  if (endStr && dateStr > endStr) return false;

  return true;
}

/**
 * Get the start of day for a given date
 * @param date - Date object
 * @returns Date object set to start of day (00:00:00)
 */
export function getStartOfDay(date: Date): Date {
  const newDate = new Date(date);
  newDate.setHours(0, 0, 0, 0);
  return newDate;
}

/**
 * Get the end of day for a given date
 * @param date - Date object
 * @returns Date object set to end of day (23:59:59.999)
 */
export function getEndOfDay(date: Date): Date {
  const newDate = new Date(date);
  newDate.setHours(23, 59, 59, 999);
  return newDate;
}

/**
 * Parse a date string and return a Date object
 * @param dateString - Date string to parse
 * @returns Date object or null if invalid
 */
export function parseDate(dateString: string): Date | null {
  if (!dateString) return null;

  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Validate if a date string is in YYYY-MM-DD format
 * @param dateString - Date string to validate
 * @returns True if valid YYYY-MM-DD format
 */
export function isValidDateFormat(dateString: string): boolean {
  if (!dateString) return false;

  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;

  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

/**
 * Format a Date object or date string to Sri Lankan standard format (DD/MM/YYYY)
 * @param date - Date object, date string, or null/undefined
 * @returns Formatted date string in DD/MM/YYYY format or '-' if invalid
 */
export function formatDateSriLankan(date: Date | string | null | undefined): string {
  if (!date) return '-';

  let dateObj: Date;
  if (typeof date === 'string') {
    dateObj = new Date(date);
  } else {
    dateObj = date;
  }

  if (isNaN(dateObj.getTime())) return '-';

  // Format as DD/MM/YYYY (Sri Lankan standard)
  const day = dateObj.getDate().toString().padStart(2, '0');
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const year = dateObj.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Format a Date object or date string to Sri Lankan long format (e.g., "15 January 2024")
 * @param date - Date object, date string, or null/undefined
 * @returns Formatted date string in long format or '-' if invalid
 */
export function formatDateSriLankanLong(date: Date | string | null | undefined): string {
  if (!date) return '-';

  let dateObj: Date;
  if (typeof date === 'string') {
    dateObj = new Date(date);
  } else {
    dateObj = date;
  }

  if (isNaN(dateObj.getTime())) return '-';

  return dateObj.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
