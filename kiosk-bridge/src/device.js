import http from 'http';
import { assertPcPosConfigured, getPcPosConfig } from './pcpos.config.js';
import {
  PcPosError,
  buildPairConfirmFrame,
  buildPurchaseFrame,
  buildStatusFrame,
  formatDateTime,
  interpretPosResponse,
  isCompletePosBody,
  isLivePosState,
  parsePairToken,
  parsePosPayload,
} from './pcpos.protocol.js';
import { allocateMessageId, saveToken } from './pcpos.session.js';

let deviceBusy = false;

function endpoint(config, path = '/api/v1') {
  return `http://${config.host}:${config.port}${path}`;
}

function portHint(config, lead) {
  return `${lead} آدرس فعلی ${config.host}:${config.port} است.`;
}

function transportFailure(error, config) {
  const code = error.code || '';
  const timedOut = code === 'ECONNABORTED' || code === 'ETIMEDOUT' || code === 'ERR_CANCELED';
  const notDelivered = ['ECONNREFUSED', 'ENOTFOUND', 'EHOSTUNREACH', 'EAI_AGAIN', 'EADDRNOTAVAIL'].includes(code);
  if (notDelivered) {
    return {
      transportError: true,
      unknown: false,
      shouldInquiry: false,
      shouldRetry: true,
      unreachable: true,
      timedOut: false,
      message: portHint(config, 'ارتباط با کارتخوان برقرار نشد.'),
    };
  }
  return {
    transportError: true,
    unknown: true,
    shouldInquiry: true,
    shouldRetry: false,
    unreachable: false,
    timedOut,
    message: timedOut
      ? portHint(config, 'مهلت پاسخ کارتخوان تمام شد.')
      : 'ارتباط با کارتخوان وسط کار قطع شد.',
  };
}

function pairingRequired() {
  return {
    outcome: 'failed',
    needsPairing: true,
    checksumValid: false,
    shouldInquiry: false,
    shouldRetry: false,
    printFailed: false,
    responseCode: '',
    message: 'برنامه هنوز با کارتخوان جفت نشده است. کد شش‌رقمی روی دستگاه را وارد کنید. مبلغی ارسال نشده است.',
  };
}

function postFrame(frame, config, options = {}) {
  const timeoutMs = options.timeoutMs ?? config.timeoutMs;
  const payload = frame == null ? null : Buffer.from(String(frame), 'utf8');
  const headers = {
    Connection: 'close',
    Accept: 'text/plain, application/json',
    'Accept-Encoding': 'identity',
  };
  if (payload) {
    headers['Content-Type'] = 'text/plain';
    headers['Content-Length'] = payload.length;
  } else {
    headers['Content-Length'] = 0;
  }
  if (options.auth !== false && config.token) headers.Authorization = `Bearer ${config.token}`;

  return new Promise((resolve) => {
    let settled = false;
    let timedOut = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      req.destroy();
      resolve(result);
    };
    const req = http.request({
      protocol: 'http:',
      hostname: config.host,
      port: config.port,
      path: options.path || '/api/v1',
      method: 'POST',
      headers,
      agent: false,
    });
    const timer = setTimeout(() => {
      timedOut = true;
      const error = new Error('timeout');
      error.code = 'ETIMEDOUT';
      finish(transportFailure(error, config));
    }, timeoutMs);
    req.on('response', (res) => {
      const chunks = [];
      res.on('data', (chunk) => {
        chunks.push(chunk);
        const text = Buffer.concat(chunks).toString('utf8');
        if (isCompletePosBody(text)) finish({ httpStatus: res.statusCode, body: text.trim() });
      });
      res.on('end', () => {
        finish({ httpStatus: res.statusCode, body: Buffer.concat(chunks).toString('utf8') });
      });
      res.on('error', (error) => {
        if (timedOut) error.code = 'ETIMEDOUT';
        finish(transportFailure(error, config));
      });
    });
    req.on('error', (error) => {
      if (timedOut) error.code = 'ETIMEDOUT';
      finish(transportFailure(error, config));
    });
    req.end(payload || undefined);
  });
}

function httpDecision(transport) {
  const status = transport.httpStatus;
  if (status === 200) return null;
  if (status === 401) {
    return {
      outcome: 'failed',
      needsPairing: true,
      shouldInquiry: false,
      shouldRetry: false,
      message: 'کارتخوان این برنامه را نمی‌شناسد. دوباره کد جفت‌سازی را وارد کنید. مبلغی ارسال نشده است.',
    };
  }
  if (status === 400) {
    return {
      outcome: 'failed',
      shouldInquiry: false,
      shouldRetry: true,
      message: 'کارتخوان درخواست را رد کرد و خریدی شروع نشد. می‌توان دوباره تلاش کرد.',
    };
  }
  if (status === 409) {
    return {
      outcome: 'failed',
      shouldInquiry: false,
      shouldRetry: true,
      message: 'کارتخوان مشغول است. صفحه اصلی دستگاه، بدون پیام، باید باز باشد.',
    };
  }
  if (status === 415) {
    return {
      outcome: 'failed',
      shouldInquiry: false,
      shouldRetry: false,
      message: 'پروتکل دستگاه درست نیست. در تنظیم کارتخوان، پروتکل متنی شرکت را انتخاب کنید.',
    };
  }
  if (status === 500) {
    return {
      outcome: 'unknown',
      shouldInquiry: true,
      shouldRetry: false,
      deviceAccepted: true,
      message: 'تراکنش تمام شد ولی دستگاه نتیجه‌ای نفرستاد. خرید را دوباره نفرستید و رسید را نگاه کنید.',
    };
  }
  return {
    outcome: 'failed',
    shouldInquiry: false,
    shouldRetry: true,
    message: `کارتخوان درخواست را نپذیرفت. خریدی شروع نشد.`,
  };
}

function readStatus(transport) {
  if (!transport || transport.transportError) return { kind: 'unreachable' };
  if (transport.httpStatus === 401) return { kind: 'unauthorized' };
  if (transport.httpStatus === 409) return { kind: 'busy' };
  if (transport.httpStatus !== 200) return { kind: 'http', status: transport.httpStatus, body: transport.body };
  const parsed = parsePosPayload(transport.body);
  if (!parsed.checksumValid) return { kind: 'bad-frame', body: transport.body };
  if (parsed.type === 'POSBSY') return { kind: 'busy', body: transport.body };
  if (parsed.type === 'POSSTA') {
    const state = parsed.fields[1] || '';
    return { kind: 'state', state, live: isLivePosState(state), body: transport.body };
  }
  return { kind: 'other', body: transport.body };
}

async function withDevice(work) {
  if (deviceBusy) {
    throw new PcPosError('کارتخوان مشغول پرداخت دیگری است. تا پایان همان کار صبر کنید', 409);
  }
  deviceBusy = true;
  try {
    return await work();
  } finally {
    deviceBusy = false;
  }
}

export async function sendPurchaseToDevice(input) {
  const config = assertPcPosConfigured();
  if (!config.token) return pairingRequired();
  const messageId = input.messageId || allocateMessageId();
  const dateTime = formatDateTime();
  const hasSplits = Array.isArray(input.splits) && input.splits.length > 0;
  let applicationId = null;
  if (input.applicationId != null && String(input.applicationId).trim() !== '') {
    applicationId = String(input.applicationId).trim();
  } else if (input.applicationId == null && !hasSplits) {
    applicationId = config.applicationId || null;
  }
  const requestFrame = buildPurchaseFrame({
    amount: input.amount,
    invoiceNumber: input.invoiceNumber,
    dateTime,
    messageId,
    splits: input.splits || [],
    applicationId,
  });
  const expect = { expectedType: 'POSBUY', expectedMessageId: messageId };
  return withDevice(async () => {
    const transport = await postFrame(requestFrame, config);
    if (transport.transportError) {
      const unknown = transport.unknown && !transport.unreachable;
      return {
        outcome: unknown ? 'unknown' : 'failed',
        shouldInquiry: unknown,
        shouldRetry: !unknown,
        printFailed: false,
        responseCode: '',
        message: transport.message,
        messageId,
        requestFrame,
      };
    }
    const rejected = httpDecision(transport);
    if (rejected) {
      return {
        ...rejected,
        printFailed: false,
        responseCode: '',
        responseFrame: transport.body,
        needsPairing: Boolean(rejected.needsPairing),
        messageId,
        requestFrame,
      };
    }
    const parsed = parsePosPayload(transport.body);
    if (parsed.checksumValid && parsed.type === 'POSBSY') {
      return {
        outcome: 'failed',
        shouldInquiry: false,
        shouldRetry: true,
        printFailed: false,
        responseCode: '',
        responseFrame: transport.body,
        message: 'کارتخوان مشغول است. صفحه اصلی دستگاه را باز کنید و دوباره تلاش کنید.',
        messageId,
        requestFrame,
      };
    }
    const interpreted = interpretPosResponse(parsed, expect);
    return { ...interpreted, responseFrame: transport.body, messageId, requestFrame };
  });
}

export async function readDeviceStatus() {
  const config = getPcPosConfig();
  if (!config.host || !config.token) return { kind: 'unauthorized', host: config.host || '', port: config.port };
  const transport = await postFrame(buildStatusFrame(), config, { timeoutMs: 12000 });
  const status = readStatus(transport);
  return { ...status, host: config.host, port: config.port, body: transport.body || '' };
}

export async function startPairing() {
  const config = assertPcPosConfigured();
  const transport = await postFrame(null, config, { path: '/api/v1/pair', auth: false, timeoutMs: 12000 });
  if (transport.transportError) return { ok: false, message: transport.message };
  if (transport.httpStatus === 200) {
    return { ok: true, message: 'کد شش‌رقمی روی کارتخوان آمده است. همان را اینجا وارد کنید. حدود ۳۰ ثانیه فرصت دارید.' };
  }
  if (transport.httpStatus === 409) {
    return { ok: false, message: 'کارتخوان آماده جفت‌سازی نیست. صفحه اصلی دستگاه باید باز و بدون پیام باشد.' };
  }
  return { ok: false, message: 'شروع جفت‌سازی ناموفق بود.' };
}

export async function confirmPairing(code) {
  const config = assertPcPosConfigured();
  const frame = buildPairConfirmFrame(code);
  const transport = await postFrame(frame, config, { path: '/api/v1/pair/confirm', auth: false, timeoutMs: 12000 });
  if (transport.transportError) return { ok: false, message: transport.message };
  if (transport.httpStatus === 401) {
    return { ok: false, message: 'کد قبول نشد. روی دستگاه دوباره کد بگیرید و همان را وارد کنید.' };
  }
  if (transport.httpStatus !== 200) return { ok: false, message: 'تأیید جفت‌سازی ناموفق بود.' };
  const token = parsePairToken(transport.body);
  if (!token) return { ok: false, message: 'پاسخ جفت‌سازی قابل خواندن نیست.' };
  saveToken(token, config.host);
  return {
    ok: true,
    paired: true,
    message: 'کارتخوان جفت شد و توکن ذخیره شد. تا وقتی همین دستگاه باشد، لازم نیست دوباره جفت کنید.',
  };
}
