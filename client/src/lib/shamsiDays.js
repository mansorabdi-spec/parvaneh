const JALALI_LEAP_REMAINDERS = [1, 5, 9, 13, 17, 22, 26, 30]

const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']
const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']
const englishDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

function toEnglishDigits(value) {
  let result = String(value)
  persianDigits.forEach((digit, i) => {
    result = result.replace(new RegExp(digit, 'g'), englishDigits[i])
  })
  arabicDigits.forEach((digit, i) => {
    result = result.replace(new RegExp(digit, 'g'), englishDigits[i])
  })
  return result
}

export function isJalaliLeapYear(year) {
  const remainder = ((year % 33) + 33) % 33
  return JALALI_LEAP_REMAINDERS.includes(remainder)
}

export function jalaliToDayNumber(year, month, day) {
  const completedYears = year - 1
  const cycles = Math.floor(completedYears / 33)
  const remainder = completedYears % 33
  let leapsInRemainder = 0
  for (let y = 1; y <= remainder; y++) {
    if (isJalaliLeapYear(y)) leapsInRemainder++
  }

  const monthLengths = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, isJalaliLeapYear(year) ? 30 : 29]
  let dayOfYear = day
  for (let m = 0; m < month - 1; m++) {
    dayOfYear += monthLengths[m]
  }

  return cycles * 12053 + remainder * 365 + leapsInRemainder + dayOfYear
}

export function parseShamsiDate(value) {
  if (!value) return null
  const english = toEnglishDigits(String(value).trim())
  const match = english.match(/(\d{1,4})\D+(\d{1,2})\D+(\d{1,2})/)
  if (!match) return null

  let year = parseInt(match[1], 10)
  let month = parseInt(match[2], 10)
  let day = parseInt(match[3], 10)

  if (year <= 31 && day > 31) {
    const swappedYear = day
    day = year
    year = swappedYear
  }

  if ([year, month, day].some(n => Number.isNaN(n))) return null
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1200) return null
  return { year, month, day }
}

export function getTodayShamsiParts() {
  const todayShamsi = new Date().toLocaleDateString('fa-IR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  return parseShamsiDate(todayShamsi)
}

export function getDaysUntilShamsiExpiry(expiryDate) {
  const expiry = parseShamsiDate(expiryDate)
  const today = getTodayShamsiParts()
  if (!expiry || !today) return null
  return jalaliToDayNumber(expiry.year, expiry.month, expiry.day)
    - jalaliToDayNumber(today.year, today.month, today.day)
}

export function canRenewByExpiry(expiryDate, windowDays = 10) {
  const days = getDaysUntilShamsiExpiry(expiryDate)
  return days !== null && days <= windowDays
}
