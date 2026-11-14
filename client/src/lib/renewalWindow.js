import { api } from './api.js'

export const RENEWAL_WINDOW_CATEGORY_KEY = 'RenewalWindowDays'
export const DEFAULT_RENEWAL_WINDOW_DAYS = 10

const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']
const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']

export function toEnglishDigits(value) {
  let result = String(value ?? '')
  persianDigits.forEach((digit, i) => {
    result = result.replace(new RegExp(digit, 'g'), String(i))
  })
  arabicDigits.forEach((digit, i) => {
    result = result.replace(new RegExp(digit, 'g'), String(i))
  })
  return result
}

export function readRenewalWindowDays(values, fallback = DEFAULT_RENEWAL_WINDOW_DAYS) {
  const list = Array.isArray(values) ? values : []
  const row = list.find(v => v.IsActive === true || v.IsActive === 1) || list[0]
  if (!row) return fallback
  const parsed = parseInt(toEnglishDigits(row.Code).trim(), 10)
  if (!Number.isInteger(parsed) || parsed < 0) return fallback
  return parsed
}

export async function loadRenewalWindowDays() {
  try {
    const { data } = await api.get('/api/lookups/values', {
      params: { categoryKey: RENEWAL_WINDOW_CATEGORY_KEY, active: true }
    })
    return readRenewalWindowDays(data)
  } catch {
    return DEFAULT_RENEWAL_WINDOW_DAYS
  }
}
