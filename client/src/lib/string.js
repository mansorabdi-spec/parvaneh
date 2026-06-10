/**
 * Normalize Persian/Arabic digits to English digits
 * @param {string} str - The string to normalize
 * @returns {string} String with normalized digits
 */
export const normalizeDigits = (str) => {
  if (str === null || str === undefined) return '';
  
  return String(str)
    .replace(/[٠-٩]/g, d => d.charCodeAt(0) - 1632) // Arabic-indic digits
    .replace(/[۰-۹]/g, d => d.charCodeAt(0) - 1776); // Persian digits
};

/**
 * Convert Persian/Arabic numbers to English numbers
 * @param {string} str - The string to convert
 * @returns {string} String with English digits
 */
export const toEnglishDigits = (str) => {
  if (str === null || str === undefined) return '';
  
  const persianNumbers = [/۰/g, /۱/g, /۲/g, /۳/g, /۴/g, /۵/g, /۶/g, /۷/g, /۸/g, /۹/g];
  const arabicNumbers = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g];
  let result = String(str);
  
  for (let i = 0; i < 10; i++) {
    result = result.replace(persianNumbers[i], i).replace(arabicNumbers[i], i);
  }
  
  return result;
};

/**
 * Convert English numbers to Persian numbers
 * @param {string} str - The string to convert
 * @returns {string} String with Persian digits
 */
export const toPersianDigits = (str) => {
  if (str === null || str === undefined) return '';
  
  const englishNumbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const persianNumbers = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  
  return String(str).split('')
    .map(char => {
      const index = englishNumbers.indexOf(char);
      return index !== -1 ? persianNumbers[index] : char;
    })
    .join('');
};

/**
 * Truncate a string to a specified length and add ellipsis if needed
 * @param {string} str - The string to truncate
 * @param {number} maxLength - Maximum length before truncation
 * @param {string} [ellipsis='...'] - The ellipsis string to append
 * @returns {string} Truncated string with ellipsis if needed
 */
export const truncate = (str, maxLength, ellipsis = '...') => {
  if (typeof str !== 'string' || !str) return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + ellipsis;
};
