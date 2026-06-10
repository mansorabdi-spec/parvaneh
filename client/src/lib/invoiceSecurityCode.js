/**
 * کد امنیتی فاکتور — فرمول ثابت برای تأیید دستی توسط ادمین
 *
 * ورودی‌ها (همان‌طور که روی فاکتور چاپ شده):
 *   - شماره پیگیری
 *   - مبلغ کل (ریال، عدد صحیح)
 *   - کد ملی یا شناسه ملی خریدار
 *   - اجزای پلاک (در صورت وجود)
 *
 * خروجی: XXXXXX-YY  (۶ رقم + خط تیره + ۲ رقم کنترل)
 */

function digitSum(value) {
  return String(value ?? '')
    .replace(/\D/g, '')
    .split('')
    .reduce((sum, d) => sum + Number(d), 0)
}

function normalizeAmount(amount) {
  return Math.round(Math.abs(Number(amount) || 0))
}

function plateContribution(vehicle) {
  if (!vehicle) return 0
  const parts = [
    vehicle.PlateSerial2,
    vehicle.PlateThreeDigits,
    vehicle.PlateRegion2
  ]
  const digits = digitSum(parts.join(''))
  const letter = String(vehicle.PlateLetter || '').trim()
  const letterCode = letter ? letter.charCodeAt(0) % 100 : 0
  return digits + letterCode
}

/**
 * @param {{ trackingNo: string, totalAmount: number, nationalId: string, vehicle?: object }} params
 * @returns {string} e.g. "482917-63" or "" if insufficient data
 */
export function computeInvoiceSecurityCode({ trackingNo, totalAmount, nationalId, vehicle }) {
  const tracking = String(trackingNo || '').trim()
  const national = String(nationalId || '').trim()
  const amount = normalizeAmount(totalAmount)

  if (!tracking || !national || amount <= 0) return ''

  const A = digitSum(tracking)
  const B = digitSum(national)
  const C = amount % 1000
  const P = plateContribution(vehicle)

  const core = (A * 7 + B * 13 + C * 17 + P * 3) % 1_000_000
  const coreStr = String(core).padStart(6, '0')

  const trackingDigits = tracking.replace(/\D/g, '')
  const trackingTail = digitSum(trackingDigits.slice(-4))
  const check = (digitSum(coreStr) + trackingTail) % 97
  const checkStr = String(check).padStart(2, '0')

  return `${coreStr}-${checkStr}`
}

/** مراحل فرمول برای نمایش به ادمین */
export const INVOICE_SECURITY_FORMULA_STEPS = [
  'A = مجموع ارقام شماره پیگیری',
  'B = مجموع ارقام کد ملی / شناسه ملی خریدار',
  'C = سه رقم آخر مبلغ کل (ریال)',
  'P = مجموع ارقام پلاک + (کد حرف پلاک mod 100)؛ اگر پلاک نباشد P=0',
  'هسته = (A×7 + B×13 + C×17 + P×3) mod 1,000,000 → ۶ رقم با صفر از چپ',
  'رقم کنترل = (مجموع ارقام هسته + مجموع ارقام ۴ رقم آخر پیگیری) mod 97 → ۲ رقم',
  'کد امنیتی = هسته + «-» + رقم کنترل'
]
