/**
 * Utility functions for currency formatting
 */

/**
 * Formats a number to Indian numbering system (lakhs and crores)
 * Example: 1234567 becomes "12,34,567"
 */
export const formatIndianNumber = (num: number): string => {
  const numStr = Math.abs(num).toString();
  const isNegative = num < 0;

  if (numStr.length <= 3) {
    return isNegative ? `-${numStr}` : numStr;
  }

  let result = '';
  let count = 0;

  // Process from right to left
  for (let i = numStr.length - 1; i >= 0; i--) {
    if (count === 3 || (count > 3 && (count - 3) % 2 === 0)) {
      result = ',' + result;
    }
    result = numStr[i] + result;
    count++;
  }

  return isNegative ? `-${result}` : result;
};

/**
 * Formats currency in Indian format with Rs. prefix
 */
export const formatIndianCurrency = (amount: number | string | null | undefined): string => {
  // Handle null, undefined, or invalid values
  if (amount === null || amount === undefined || amount === '') {
    return 'Rs. 0.00';
  }

  // Convert to number if it's a string
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  // Check if conversion resulted in NaN
  if (isNaN(numericAmount)) {
    return 'Rs. 0.00';
  }

  // Format to 2 decimal places
  const fixedAmount = numericAmount.toFixed(2);
  const [integerPart, decimalPart] = fixedAmount.split('.');

  // Format the integer part using Indian numbering
  const formattedInteger = formatIndianNumber(parseInt(integerPart));

  return `Rs. ${formattedInteger}.${decimalPart}`;
};
