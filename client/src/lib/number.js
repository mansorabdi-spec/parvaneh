/**
 * Format a number with comma separators
 * @param {number|string} num - The number to format
 * @param {number} [decimals=0] - Number of decimal places
 * @returns {string} Formatted number string
 */
export const formatNumber = (num, decimals = 0) => {
  if (num === null || num === undefined) return '0';
  
  const number = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(number)) return '0';
  
  return number.toLocaleString('fa-IR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: true
  });
};

/**
 * Parse a number-like string into a number
 * @param {string|number} value - The value to parse
 * @returns {number} Parsed number or 0 if invalid
 */
export const parseNumberLike = (value) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  
  // Remove non-numeric characters except decimal point and minus
  const numericString = String(value)
    .replace(/[^0-9.-]/g, '') // Keep only digits, decimal point, and minus
    .replace(/[^0-9-]/g, '.'); // Replace any remaining non-numeric (except minus) with decimal point
  
  const parsed = parseFloat(numericString);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Format a number as Rial currency
 * @param {number|string} amount - The amount in Rial
 * @returns {string} Formatted currency string
 */
export const formatRial = (amount) => {
  return `${formatNumber(amount, 0)} ریال`;
};

/**
 * Format a number as Toman currency (Rial / 10)
 * @param {number|string} amount - The amount in Rial
 * @param {boolean} [showCurrency=true] - Whether to append the currency symbol
 * @returns {string} Formatted currency string
 */
export const formatToman = (amount, showCurrency = true) => {
  const toman = parseNumberLike(amount) / 10;
  const formatted = formatNumber(toman, 0);
  return showCurrency ? `${formatted} تومان` : formatted;
};
