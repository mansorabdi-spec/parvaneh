/**
 * Utility functions for Shamsi (Jalali/Persian) date calculations
 */

/**
 * Get current Shamsi date in YYYY/MM/DD format
 * @returns {string} Current Shamsi date (e.g., '1403/09/15')
 */
export function getCurrentShamsiDate() {
  const now = new Date();
  return gregorianToShamsi(now);
}

/**
 * Add one year to a Shamsi date
 * @param {string} shamsiDate - Shamsi date in format 'YYYY/MM/DD' (e.g., '1403/09/15')
 * @returns {string} New Shamsi date one year later (e.g., '1404/09/15')
 */
export function addOneYearShamsi(shamsiDate) {
  if (!shamsiDate || typeof shamsiDate !== 'string') {
    throw new Error('Invalid Shamsi date format');
  }

  const parts = shamsiDate.split('/');
  if (parts.length !== 3) {
    throw new Error('Shamsi date must be in format YYYY/MM/DD');
  }

  const year = parseInt(parts[0], 10);
  const month = parts[1];
  const day = parts[2];

  if (isNaN(year)) {
    throw new Error('Invalid year in Shamsi date');
  }

  const newYear = year + 1;
  return `${newYear}/${month}/${day}`;
}

/**
 * Convert Gregorian date to Shamsi date
 * @param {Date} gregorianDate - JavaScript Date object
 * @returns {string} Shamsi date in format 'YYYY/MM/DD'
 */
export function gregorianToShamsi(gregorianDate) {
  const gYear = gregorianDate.getFullYear();
  const gMonth = gregorianDate.getMonth() + 1;
  const gDay = gregorianDate.getDate();

  let jYear, jMonth, jDay;

  const gy = gYear - 1600;
  const gm = gMonth - 1;
  const gd = gDay - 1;

  let gDayNo = 365 * gy + Math.floor((gy + 3) / 4) - Math.floor((gy + 99) / 100) + Math.floor((gy + 399) / 400);

  for (let i = 0; i < gm; ++i) {
    gDayNo += [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][i];
  }

  if (gm > 1 && ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0))) {
    ++gDayNo;
  }

  gDayNo += gd;

  let jDayNo = gDayNo - 79;

  const jNp = Math.floor(jDayNo / 12053);
  jDayNo %= 12053;

  jYear = 979 + 33 * jNp + 4 * Math.floor(jDayNo / 1461);
  jDayNo %= 1461;

  if (jDayNo >= 366) {
    jYear += Math.floor((jDayNo - 1) / 365);
    jDayNo = (jDayNo - 1) % 365;
  }

  if (jDayNo < 186) {
    jMonth = 1 + Math.floor(jDayNo / 31);
    jDay = 1 + (jDayNo % 31);
  } else {
    jMonth = 7 + Math.floor((jDayNo - 186) / 30);
    jDay = 1 + ((jDayNo - 186) % 30);
  }

  const month = jMonth.toString().padStart(2, '0');
  const day = jDay.toString().padStart(2, '0');

  return `${jYear}/${month}/${day}`;
}

/**
 * Compare two Shamsi dates
 * @param {string} date1 - First Shamsi date in format 'YYYY/MM/DD'
 * @param {string} date2 - Second Shamsi date in format 'YYYY/MM/DD'
 * @returns {number} -1 if date1 < date2, 0 if equal, 1 if date1 > date2
 */
export function compareShamsiDates(date1, date2) {
  const parts1 = date1.split('/').map(p => parseInt(p, 10));
  const parts2 = date2.split('/').map(p => parseInt(p, 10));

  for (let i = 0; i < 3; i++) {
    if (parts1[i] < parts2[i]) return -1;
    if (parts1[i] > parts2[i]) return 1;
  }

  return 0;
}

/**
 * Check if a license has expired
 * @param {string} expiryDate - Expiry date in Shamsi format 'YYYY/MM/DD'
 * @returns {boolean} True if expired, false otherwise
 */
export function isLicenseExpired(expiryDate) {
  const currentDate = getCurrentShamsiDate();
  return compareShamsiDates(currentDate, expiryDate) > 0;
}

/**
 * Calculate validity duration in months between two Shamsi dates
 * @param {string} startDate - Start date in format 'YYYY/MM/DD'
 * @param {string} endDate - End date in format 'YYYY/MM/DD'
 * @returns {number} Number of months (approximate)
 */
export function calculateMonthsDifference(startDate, endDate) {
  const start = startDate.split('/').map(p => parseInt(p, 10));
  const end = endDate.split('/').map(p => parseInt(p, 10));

  const yearDiff = end[0] - start[0];
  const monthDiff = end[1] - start[1];

  return yearDiff * 12 + monthDiff;
}

/**
 * Convert Shamsi date to Gregorian date
 * @param {string} shamsiDate - Shamsi date in format 'YYYY/MM/DD' (e.g., '1402/11/25')
 * @returns {Date} JavaScript Date object
 */
export function shamsiToGregorian(shamsiDate) {
  if (!shamsiDate || typeof shamsiDate !== 'string') {
    throw new Error('Invalid Shamsi date format');
  }

  const normalized = shamsiDate
    .trim()
    .replace(/[۰-۹]/g, d => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)])
    .replace(/[٠-٩]/g, d => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])
    .replace(/-/g, '/');

  const parts = normalized.split('/');
  if (parts.length !== 3) {
    throw new Error('Shamsi date must be in format YYYY/MM/DD');
  }

  const jYear = parseInt(parts[0], 10);
  const jMonth = parseInt(parts[1], 10);
  const jDay = parseInt(parts[2], 10);

  if (isNaN(jYear) || isNaN(jMonth) || isNaN(jDay)) {
    throw new Error('Invalid Shamsi date components');
  }

  let gYear, gMonth, gDay;

  const jy = jYear - 979;
  const jm = jMonth - 1;
  const jd = jDay - 1;

  let jDayNo = 365 * jy + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4);

  for (let i = 0; i < jm; ++i) {
    jDayNo += i < 6 ? 31 : 30;
  }

  jDayNo += jd;

  let gDayNo = jDayNo + 79;

  const gy = 1600 + 400 * Math.floor(gDayNo / 146097);
  gDayNo %= 146097;

  let leap = true;
  if (gDayNo >= 36525) {
    gDayNo--;
    const gy2 = Math.floor(gDayNo / 36524);
    gDayNo %= 36524;

    if (gDayNo >= 365) {
      gDayNo++;
    }
    
    gYear = gy + gy2 * 100;
  } else {
    gYear = gy;
  }

  const gy3 = Math.floor(gDayNo / 1461);
  gDayNo %= 1461;

  if (gDayNo >= 366) {
    leap = false;
    gDayNo--;
    const gy4 = Math.floor(gDayNo / 365);
    gDayNo %= 365;
    gYear += gy3 * 4 + gy4;
  } else {
    gYear += gy3 * 4;
  }

  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  
  for (gMonth = 0; gMonth < 12; gMonth++) {
    if (gDayNo < monthDays[gMonth]) {
      break;
    }
    gDayNo -= monthDays[gMonth];
  }

  gDay = gDayNo + 1;

  return new Date(gYear, gMonth, gDay);
}
