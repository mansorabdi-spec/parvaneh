/**
 * Asan Pardakht PC-POS over HTTP, CSV protocol (asanpardakht_csv).
 * The terminal is the HTTP server. POST /api/v1 needs a pairing token.
 *
 * $<payload>*<HH>\r\n
 * Checksum is the XOR of every byte between "$" and "*".
 * The checksum marker is the last "*" because a masked PAN can contain asterisks.
 */

export class PcPosError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'PcPosError';
    this.status = status;
  }
}

const RESPONSE_MESSAGES = {
  '000': 'تراکنش موفق',
  '0': 'تراکنش موفق',
  '00': 'تراکنش موفق',
  '410': 'تراکنش انجام شده است اما چاپ رسید ناموفق بود',
  '600': 'تراکنش به بانک نرسید (لغو، کارت یا قطع ارتباط). مبلغی کم نشده و می‌توان دوباره تلاش کرد',
  '502': 'تراکنش توسط مشتری لغو شد',
};

const LIVE_STATES = new Set([
  'input',
  'confirmation',
  'card_presentation',
  'application_selection',
  'pin_entry',
  'processing',
]);

export function checksum(inner) {
  let x = 0;
  for (let i = 0; i < inner.length; i += 1) x ^= inner.charCodeAt(i);
  return (x & 0xff).toString(16).toUpperCase().padStart(2, '0');
}

export function buildFrame(inner) {
  if (!inner.endsWith(',')) {
    throw new PcPosError('فریم باید پیش از checksum با ویرگول تمام شود');
  }
  if (/[^\x20-\x7E]/.test(inner)) {
    throw new PcPosError('فریم PC-POS فقط می‌تواند کاراکتر ASCII باشد');
  }
  return `$${inner}*${checksum(inner)}\r\n`;
}

export function parseFrame(raw) {
  const text = String(raw ?? '').replace(/^\uFEFF/, '').trim();
  const match = text.match(/^\$(.*)\*([0-9A-Fa-f]{2})$/);
  if (!match) {
    return {
      ok: false,
      malformed: true,
      checksumValid: false,
      type: '',
      fields: [],
      inner: '',
      receivedChecksum: '',
      expectedChecksum: '',
    };
  }
  const inner = match[1];
  const receivedChecksum = match[2].toUpperCase();
  const expectedChecksum = checksum(inner);
  const fields = inner.split(',');
  if (fields.length && fields[fields.length - 1] === '') fields.pop();
  return {
    ok: expectedChecksum === receivedChecksum,
    malformed: false,
    checksumValid: expectedChecksum === receivedChecksum,
    type: fields[0] || '',
    fields,
    inner,
    receivedChecksum,
    expectedChecksum,
  };
}

function jsonResponseToParsed(json) {
  const rawType = String(json.type || '');
  const type = {
    buy: 'POSBUY',
    bill: 'POSBIL',
    status: 'POSSTA',
    cancel: 'POSCAN',
    busy: 'POSBSY',
  }[rawType] || rawType.toUpperCase();
  let fields;
  if (type === 'POSSTA') {
    fields = [type, json.state == null ? '' : String(json.state)];
    if (json.pin_digits != null && String(json.pin_digits) !== '') fields.push(String(json.pin_digits));
  } else if (type === 'POSCAN') {
    fields = [type, json.result == null ? '' : String(json.result)];
  } else if (type === 'POSBSY') {
    fields = [type];
  } else {
    const value = (key) => (json[key] == null ? '' : String(json[key]));
    fields = [
      type,
      value('response_code'),
      value('amount'),
      value('rrn'),
      value('stan'),
      value('date_time'),
      value('merchant_number'),
      value('terminal_id'),
      value('pan'),
      value('message_id'),
      value('bill_id'),
      value('payment_id'),
    ];
  }
  return {
    ok: true,
    malformed: false,
    checksumValid: true,
    type,
    fields,
    inner: '',
    receivedChecksum: '',
    expectedChecksum: '',
  };
}

export function parsePosPayload(raw) {
  const text = String(raw ?? '').replace(/^\uFEFF/, '').trim();
  if (text.startsWith('{')) {
    try {
      return jsonResponseToParsed(JSON.parse(text));
    } catch {
      return {
        ok: false,
        malformed: true,
        checksumValid: false,
        type: '',
        fields: [],
        inner: '',
        receivedChecksum: '',
        expectedChecksum: '',
      };
    }
  }
  return parseFrame(text);
}

export function formatDateTime(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function normalizeAmount(value, label = 'مبلغ') {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new PcPosError(`${label} باید عدد صحیح ریال و بدون جداکننده باشد`);
    }
    value = String(value);
  }
  const text = String(value ?? '').trim();
  if (!/^[1-9]\d{0,11}$/.test(text)) {
    throw new PcPosError(`${label} باید عدد صحیح ریال، حداکثر ۱۲ رقم و بدون جداکننده باشد`);
  }
  return text;
}

export function normalizeSheba(value) {
  const text = String(value ?? '').trim().toUpperCase();
  if (!/^IR\d{24}$/.test(text)) {
    throw new PcPosError('شماره شبا باید با IR و ۲۴ رقم، بدون فاصله و بدون خط تیره باشد');
  }
  return text;
}

function assertText(value, label, max) {
  const text = String(value ?? '').trim();
  if (!text || text.length > max || /[ ;,|$*]/.test(text) || /[^\x21-\x7E]/.test(text)) {
    throw new PcPosError(`${label} نامعتبر است`);
  }
  return text;
}

function assertMessageId(value) {
  const id = assertText(value, 'شناسه پیام', 5);
  if (!/^\d{1,5}$/.test(id)) throw new PcPosError('شناسه پیام باید عدد و حداکثر ۵ رقم باشد');
  return id;
}

export function buildPurchaseFrame({
  amount,
  invoiceNumber,
  dateTime,
  messageId,
  splits = [],
  applicationId = null,
}) {
  const amountText = normalizeAmount(amount);
  const invoice = assertText(invoiceNumber, 'شماره فاکتور', 30);
  const when = assertText(dateTime, 'زمان درخواست', 14);
  if (!/^\d{14}$/.test(when)) throw new PcPosError('زمان درخواست باید با قالب YYYYMMDDHHMMSS باشد');
  const id = assertMessageId(messageId);

  const rows = splits.map((row) => {
    const sheba = normalizeSheba(row.sheba || row.iban);
    const ibanId = row.ibanId ?? row.iban_id;
    const iban = ibanId != null && String(ibanId).trim() !== ''
      ? `${sheba}|${assertText(ibanId, 'شناسه شبا', 30)}`
      : sheba;
    return {
      iban,
      amount: normalizeAmount(row.amount, 'مبلغ تسهیم'),
    };
  });
  if (rows.length > 10) throw new PcPosError('حداکثر ۱۰ ردیف تسهیم مجاز است');
  const total = BigInt(amountText);
  const splitSum = rows.reduce((sum, row) => sum + BigInt(row.amount), 0n);
  if (rows.length && splitSum !== total) {
    throw new PcPosError('جمع مبالغ تسهیم باید دقیقاً برابر مبلغ تراکنش باشد');
  }

  let inner = `PCBUY,${amountText},${invoice},${when},${id},${rows.length},`;
  for (const row of rows) inner += `${row.iban},${row.amount},`;
  if (applicationId != null && String(applicationId).trim() !== '') {
    const appId = assertText(applicationId, 'شناسه برنامه', 16);
    inner += `${appId},`;
  }
  return buildFrame(inner);
}

export function buildStatusFrame() {
  return buildFrame('PCSTA,');
}

export function buildCancelFrame() {
  return buildFrame('PCCAN,');
}

export function buildPairConfirmFrame(code) {
  const text = String(code ?? '').trim();
  if (!/^\d{6}$/.test(text)) throw new PcPosError('کد جفت‌سازی باید ۶ رقم باشد');
  return buildFrame(`${text},`);
}

export function parsePairToken(raw) {
  const parsed = parseFrame(raw);
  const token = parsed.checksumValid ? String(parsed.fields[0] || '') : '';
  if (!/^[0-9a-f]{64}$/i.test(token)) return '';
  return token.toLowerCase();
}

export function buildBillFrame({ dateTime, messageId, billId, paymentId }) {
  const when = assertText(dateTime, 'زمان درخواست', 14);
  if (!/^\d{14}$/.test(when)) throw new PcPosError('زمان درخواست باید با قالب YYYYMMDDHHMMSS باشد');
  const id = assertMessageId(messageId);
  const bill = String(billId ?? '').trim();
  const payment = String(paymentId ?? '').trim();
  if (!/^\d{6,13}$/.test(bill)) throw new PcPosError('شناسه قبض باید ۶ تا ۱۳ رقم باشد');
  if (!/^\d{6,13}$/.test(payment)) throw new PcPosError('شناسه پرداخت باید ۶ تا ۱۳ رقم باشد');
  return buildFrame(`PCBIL,${when},${id},1,${bill},${payment},`);
}

export function classifyResponse(code) {
  const responseCode = String(code ?? '').trim();
  if (/^0+$/.test(responseCode)) {
    return {
      outcome: 'success',
      responseCode,
      shouldInquiry: false,
      shouldRetry: false,
      printFailed: false,
      message: RESPONSE_MESSAGES['000'],
    };
  }
  if (responseCode === '410') {
    return {
      outcome: 'success',
      responseCode,
      shouldInquiry: false,
      shouldRetry: false,
      printFailed: true,
      message: RESPONSE_MESSAGES['410'],
    };
  }
  if (responseCode === '600' || responseCode === '502') {
    return {
      outcome: 'cancelled',
      responseCode,
      shouldInquiry: false,
      shouldRetry: true,
      printFailed: false,
      message: RESPONSE_MESSAGES[responseCode] || RESPONSE_MESSAGES['600'],
    };
  }
  return {
    outcome: 'failed',
    responseCode,
    shouldInquiry: false,
    shouldRetry: true,
    printFailed: false,
    message: responseCode ? `تراکنش ناموفق است. کد پاسخ: ${responseCode}` : 'کد پاسخ در پیام دستگاه نیست',
  };
}

function purchaseLikeBody(fields) {
  return {
    responseCode: fields[1] || '',
    amount: fields[2] || '',
    rrn: fields[3] || '',
    stan: fields[4] || '',
    dateTime: fields[5] || '',
    merchantId: fields[6] || '',
    terminalId: fields[7] || '',
    pan: fields[8] || '',
    messageId: fields[9] || '',
    billId: fields[10] || '',
    paymentId: fields[11] || '',
  };
}

export function isLivePosState(state) {
  return LIVE_STATES.has(state);
}

export function interpretPosResponse(parsed, { expectedType, expectedMessageId } = {}) {
  if (!parsed || parsed.malformed || !parsed.checksumValid) {
    return {
      outcome: 'unknown',
      checksumValid: false,
      shouldInquiry: true,
      shouldRetry: false,
      printFailed: false,
      responseCode: '',
      message: parsed?.malformed
        ? 'پاسخ دستگاه قالب فریم PC-POS را ندارد'
        : 'Checksum پاسخ نامعتبر است',
    };
  }

  if (parsed.type === 'POSBSY') {
    return {
      outcome: 'failed',
      checksumValid: true,
      shouldInquiry: false,
      shouldRetry: true,
      printFailed: false,
      responseCode: '',
      message: 'کارتخوان مشغول است. صفحهٔ اصلی دستگاه را باز کنید و دوباره تلاش کنید',
    };
  }

  if (parsed.type === 'POSSTA') {
    const state = parsed.fields[1] || '';
    return {
      outcome: 'status',
      checksumValid: true,
      shouldInquiry: false,
      shouldRetry: false,
      printFailed: false,
      responseCode: '',
      state,
      pinDigits: state === 'pin_entry' ? (parsed.fields[2] || '') : '',
      live: isLivePosState(state),
      message: `وضعیت دستگاه: ${state || 'نامشخص'}`,
    };
  }

  if (parsed.type === 'POSCAN') {
    return {
      outcome: 'status',
      checksumValid: true,
      shouldInquiry: false,
      shouldRetry: false,
      printFailed: false,
      responseCode: '',
      cancelResult: parsed.fields[1] || '',
      message: `نتیجه لغو: ${parsed.fields[1] || 'نامشخص'}`,
    };
  }

  if (expectedType && parsed.type !== expectedType) {
    return {
      outcome: 'unknown',
      checksumValid: true,
      shouldInquiry: true,
      shouldRetry: false,
      printFailed: false,
      responseCode: parsed.fields[1] || '',
      message: `نوع پاسخ ${parsed.type || 'نامشخص'} است و ${expectedType} انتظار می‌رفت`,
    };
  }

  const body = purchaseLikeBody(parsed.fields);
  const classified = classifyResponse(body.responseCode);
  if (expectedMessageId && body.messageId && body.messageId !== String(expectedMessageId)) {
    return {
      ...body,
      outcome: 'unknown',
      checksumValid: true,
      shouldInquiry: true,
      shouldRetry: false,
      printFailed: false,
      message: 'شناسه پیام پاسخ با شناسه درخواست یکی نیست',
    };
  }
  return { ...body, ...classified, checksumValid: true };
}
