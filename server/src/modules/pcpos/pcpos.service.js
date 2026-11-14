import axios from 'axios';
import { assertPcPosConfigured, forgetPcPosToken, getPcPosConfig } from './pcpos.config.js';
import {
  PcPosError,
  buildBillFrame,
  buildPairConfirmFrame,
  buildPurchaseFrame,
  buildStatusFrame,
  formatDateTime,
  interpretPosResponse,
  isLivePosState,
  parseFrame,
  parsePairToken,
} from './pcpos.protocol.js';
import { allocateMessageId, saveToken } from './pcpos.session.js';
import {
  getTransaction,
  insertTransaction,
  mapTransaction,
  updateTransaction,
} from './pcpos.store.js';

let deviceBusy = false;

const STATE_TEXT = {
  idle: 'آزاد',
  busy: 'مشغول',
  input: 'در حال ورود اطلاعات',
  confirmation: 'در حال تأیید قبض',
  card_presentation: 'منتظر کارت',
  application_selection: 'در حال انتخاب برنامه کارت',
  pin_entry: 'در حال ورود رمز',
  processing: 'در حال پردازش',
};

async function withDevice(work) {
  if (deviceBusy) {
    throw new PcPosError('دستگاه POS در حال انجام تراکنش دیگری است. تا مشخص شدن نتیجهٔ همان تراکنش صبر کنید', 409);
  }
  deviceBusy = true;
  try {
    return await work();
  } finally {
    deviceBusy = false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function endpoint(config, path = '/api/v1') {
  return `http://${config.host}:${config.port}${path}`;
}

function portHint(config, lead) {
  return `${lead} آدرس فعلی ${config.host}:${config.port} است. پورت را از تنظیمات HTTP خود کارتخوان بخوانید. در راهنمای شرکت نمونهٔ پورت ۱۷۰۰۰ است؛ پورت ۸۰ معمولاً سرویس PC-POS نیست و مبلغ روی دستگاه نمی‌آید.`;
}

function transportFailure(error, config) {
  const code = error.code || '';
  const timedOut = code === 'ECONNABORTED' || code === 'ETIMEDOUT' || code === 'ERR_CANCELED' || axios.isCancel?.(error);
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

async function postFrame(frame, config, options = {}) {
  const timeoutMs = options.timeoutMs ?? config.timeoutMs;
  const headers = {};
  if (frame != null) headers['Content-Type'] = 'text/plain; charset=utf-8';
  if (options.auth !== false && config.token) headers.Authorization = `Bearer ${config.token}`;
  try {
    const response = await axios.post(endpoint(config, options.path || '/api/v1'), frame == null ? undefined : frame, {
      headers,
      responseType: 'text',
      timeout: timeoutMs,
      signal: options.signal,
      maxRedirects: 0,
      transformRequest: [(data) => (data == null ? data : data)],
      transformResponse: [(data) => (typeof data === 'string' || data == null ? (data ?? '') : String(data))],
      validateStatus: () => true,
    });
    const body = typeof response.data === 'string' ? response.data : String(response.data ?? '');
    return { httpStatus: response.status, body };
  } catch (error) {
    return transportFailure(error, config);
  }
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
      message: 'کارتخوان مشغول است. صفحهٔ اصلی دستگاه، بدون پیام، باید باز باشد.',
    };
  }
  if (status === 415) {
    return {
      outcome: 'failed',
      shouldInquiry: false,
      shouldRetry: false,
      message: 'پروتکل دستگاه CSV نیست. در تنظیمات PC-POS پروتکل را Asanpardakht CSV بگذارید.',
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
    message: `کارتخوان کد HTTP ${status} داد و خریدی شروع نشد.`,
  };
}

async function applyDecision(id, decision) {
  if (decision.needsPairing) forgetPcPosToken();
  await updateTransaction(id, {
    outcome: decision.outcome,
    responseFrame: decision.responseFrame || null,
    responseCode: decision.responseCode || null,
    errorMessage: decision.outcome === 'success' ? null : decision.message,
    deviceAccepted: Boolean(decision.deviceAccepted),
  });
  return {
    outcome: decision.outcome,
    checksumValid: false,
    shouldInquiry: Boolean(decision.shouldInquiry),
    shouldRetry: Boolean(decision.shouldRetry),
    printFailed: false,
    needsPairing: Boolean(decision.needsPairing),
    responseCode: decision.responseCode || '',
    message: decision.message,
  };
}

async function settle(id, transport, expect, { deviceAccepted = false } = {}) {
  if (transport.transportError) {
    const unknown = deviceAccepted || (transport.unknown && !transport.unreachable);
    const message = deviceAccepted
      ? 'دستگاه خرید را نشان داده بود ولی مهلت پاسخ تمام شد. خرید را دوباره نفرستید. اگر کارت کشیده شده، رسید را نگاه کنید و استعلام بگیرید.'
      : transport.message;
    await updateTransaction(id, {
      outcome: unknown ? 'unknown' : 'failed',
      errorMessage: message,
      deviceAccepted,
    });
    return {
      outcome: unknown ? 'unknown' : 'failed',
      checksumValid: false,
      shouldInquiry: unknown,
      shouldRetry: !unknown,
      printFailed: false,
      responseCode: '',
      message,
    };
  }

  const rejected = httpDecision(transport);
  if (rejected) return applyDecision(id, { ...rejected, responseFrame: transport.body });

  const parsed = parseFrame(transport.body);
  if (parsed.checksumValid && parsed.type === 'POSBSY') {
    return applyDecision(id, {
      outcome: 'failed',
      shouldInquiry: false,
      shouldRetry: true,
      responseFrame: transport.body,
      message: 'کارتخوان مشغول است. صفحهٔ اصلی دستگاه را باز کنید و دوباره تلاش کنید.',
    });
  }

  const interpreted = interpretPosResponse(parsed, expect);
  await updateTransaction(id, {
    outcome: interpreted.outcome,
    responseFrame: transport.body,
    responseCode: interpreted.responseCode || null,
    rrn: interpreted.rrn || null,
    stan: interpreted.stan || null,
    pan: interpreted.pan || null,
    merchantId: interpreted.merchantId || null,
    terminalId: interpreted.terminalId || null,
    dateTime: interpreted.dateTime || null,
    amount: interpreted.amount || null,
    errorMessage: interpreted.outcome === 'success' ? null : interpreted.message,
    deviceAccepted: deviceAccepted || interpreted.outcome === 'success',
  });
  return { ...interpreted, httpStatus: transport.httpStatus, responseFrame: transport.body };
}

function readStatus(transport) {
  if (!transport || transport.transportError) return { kind: 'unreachable' };
  if (transport.httpStatus === 401) return { kind: 'unauthorized' };
  if (transport.httpStatus === 409) return { kind: 'busy' };
  if (transport.httpStatus !== 200) return { kind: 'http', status: transport.httpStatus, body: transport.body };
  const parsed = parseFrame(transport.body);
  if (!parsed.checksumValid) return { kind: 'bad-frame', body: transport.body };
  if (parsed.type === 'POSBSY') return { kind: 'busy', body: transport.body };
  if (parsed.type === 'POSSTA') {
    const state = parsed.fields[1] || '';
    return { kind: 'state', state, live: isLivePosState(state), body: transport.body };
  }
  return { kind: 'other', body: transport.body };
}

async function watchDevice(config, buyPromise, getBuy) {
  const race = (ms) => Promise.race([
    buyPromise.then((transport) => ({ done: true, transport })),
    sleep(ms).then(() => ({ done: false })),
  ]);

  let raced = await race(3000);
  if (raced.done || getBuy()) return { transport: raced.transport || getBuy() };

  let status = readStatus(await postFrame(buildStatusFrame(), config, { timeoutMs: 8000 }));
  if (getBuy()) return { transport: getBuy() };
  if (status.kind === 'unauthorized') {
    return {
      abort: true,
      override: {
        needsPairing: true,
        outcome: 'failed',
        shouldRetry: false,
        shouldInquiry: false,
        responseFrame: status.body,
        message: 'کارتخوان این برنامه را نمی‌شناسد. دوباره کد جفت‌سازی را وارد کنید. مبلغی ارسال نشده است.',
      },
    };
  }
  if (status.kind === 'state' && status.live) return { deviceAccepted: true };
  if (status.kind === 'unreachable') {
    return {
      abort: true,
      override: {
        outcome: 'failed',
        shouldRetry: true,
        shouldInquiry: false,
        message: portHint(config, 'کارتخوان به درخواست خرید جواب نداد و مبلغ را نشان نداد.'),
      },
    };
  }

  raced = await race(5000);
  if (raced.done || getBuy()) return { transport: raced.transport || getBuy() };
  status = readStatus(await postFrame(buildStatusFrame(), config, { timeoutMs: 8000 }));
  if (getBuy()) return { transport: getBuy() };
  if (status.kind === 'state' && status.live) return { deviceAccepted: true };
  if (status.kind === 'unauthorized') {
    return {
      abort: true,
      override: {
        needsPairing: true,
        outcome: 'failed',
        shouldRetry: false,
        shouldInquiry: false,
        message: 'کارتخوان این برنامه را نمی‌شناسد. دوباره کد جفت‌سازی را وارد کنید. مبلغی ارسال نشده است.',
      },
    };
  }
  const busy = status.kind === 'busy' || status.state === 'busy';
  return {
    abort: true,
    override: {
      outcome: 'failed',
      shouldRetry: true,
      shouldInquiry: false,
      responseFrame: status.body,
      message: busy
        ? 'کارتخوان مشغول بود و مبلغ این خرید را نشان نداد. صفحهٔ اصلی دستگاه را باز کنید و دوباره تلاش کنید.'
        : 'دستگاه مبلغ را نشان نداد و خریدی شروع نکرد. می‌توانید دوباره تلاش کنید. پورت HTTP را از تنظیمات PC-POS خود کارتخوان بردارید؛ نمونهٔ راهنمای شرکت ۱۷۰۰۰ است.',
    },
  };
}

function logResult(kind, messageId, result) {
  console.log(`[pcpos] ${kind} messageId=${messageId} outcome=${result.outcome} code=${result.responseCode || '-'}`);
}

function publicResult(result, extra) {
  const { messageId: responseMessageId, ...rest } = result;
  return {
    ...rest,
    ...extra,
    responseMessageId: responseMessageId || null,
  };
}

export async function purchase(input) {
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

  return withDevice(async () => {
    const transactionId = await insertTransaction({
      kind: 'purchase',
      messageId,
      invoiceNumber: String(input.invoiceNumber),
      amount: input.amount,
      requestFrame,
      outcome: 'pending',
      requestId: input.requestId ?? null,
    });
    const buyAbort = new AbortController();
    let buyTransport = null;
    const buyPromise = postFrame(requestFrame, config, { signal: buyAbort.signal }).then((transport) => {
      buyTransport = transport;
      return transport;
    });
    const probe = await watchDevice(config, buyPromise, () => buyTransport);
    if (probe.deviceAccepted) {
      await updateTransaction(transactionId, { outcome: 'pending', deviceAccepted: true });
    }
    if (probe.abort) buyAbort.abort();
    const transport = probe.transport || await buyPromise;
    const answerArrived = probe.override && transport && !transport.transportError && transport.httpStatus === 200;
    const result = probe.override && !answerArrived
      ? await applyDecision(transactionId, probe.override)
      : await settle(transactionId, transport, {
        expectedType: 'POSBUY',
        expectedMessageId: messageId,
      }, { deviceAccepted: Boolean(probe.deviceAccepted) });
    logResult('purchase', messageId, result);
    return publicResult(result, {
      transactionId,
      messageId,
      invoiceNumber: String(input.invoiceNumber),
      dateTime,
      requestFrame,
      target: endpoint(config),
    });
  });
}

export async function payBill(input) {
  const config = assertPcPosConfigured();
  if (!config.token) return pairingRequired();
  const dateTime = formatDateTime();
  const messageId = input.messageId || allocateMessageId();
  let billId = input.billId;
  let paymentId = input.paymentId;
  if ((!billId || !paymentId) && Array.isArray(input.fields) && input.fields.length === 4) {
    billId = input.fields[2];
    paymentId = input.fields[3];
  }
  const requestFrame = buildBillFrame({
    dateTime,
    messageId: input.messageId || (Array.isArray(input.fields) ? input.fields[0] : messageId),
    billId,
    paymentId,
  });
  const storedMessageId = input.messageId || (Array.isArray(input.fields) ? String(input.fields[0]) : messageId);

  return withDevice(async () => {
    const transactionId = await insertTransaction({
      kind: 'bill',
      messageId: storedMessageId,
      amount: null,
      requestFrame,
      outcome: 'pending',
      requestId: input.requestId ?? null,
    });
    const transport = await postFrame(requestFrame, config);
    const result = await settle(transactionId, transport, { expectedType: 'POSBIL', expectedMessageId: storedMessageId });
    logResult('bill', storedMessageId, result);
    return publicResult(result, {
      transactionId,
      messageId: storedMessageId,
      dateTime,
      requestFrame,
      target: endpoint(config),
    });
  });
}

function stateMessage(state) {
  return STATE_TEXT[state] || state || 'نامشخص';
}

export async function inquiry(input = {}) {
  const config = assertPcPosConfigured();
  if (!config.token) return pairingRequired();
  const messageId = input.messageId || allocateMessageId();
  const requestFrame = buildStatusFrame();
  const related = input.transactionId ? await getTransaction(input.transactionId) : null;
  if (input.transactionId && !related) throw new PcPosError('تراکنش مورد نظر برای استعلام پیدا نشد', 404);
  if (related && !['unknown', 'pending'].includes(related.Outcome)) {
    throw new PcPosError('فقط تراکنش نامعلوم را استعلام کنید. این تراکنش نتیجهٔ نهایی دارد', 409);
  }

  return withDevice(async () => {
    const transactionId = await insertTransaction({
      kind: 'inquiry',
      messageId,
      requestFrame,
      outcome: 'pending',
      relatedTransactionId: related?.Id ?? null,
    });
    const transport = await postFrame(requestFrame, config, { timeoutMs: 12000 });
    const status = readStatus(transport);
    let result;

    if (status.kind === 'unauthorized') {
      result = await applyDecision(transactionId, {
        needsPairing: true,
        outcome: 'failed',
        shouldRetry: false,
        shouldInquiry: false,
        responseFrame: transport.body,
        message: 'کارتخوان این برنامه را نمی‌شناسد. دوباره کد جفت‌سازی را وارد کنید.',
      });
    } else if (status.kind === 'unreachable') {
      result = await applyDecision(transactionId, {
        outcome: 'failed',
        shouldRetry: true,
        shouldInquiry: false,
        message: portHint(config, 'استعلام به کارتخوان نرسید.'),
      });
    } else if (status.kind === 'state') {
      const accepted = Boolean(related?.DeviceAccepted);
      const live = status.live;
      let outcome = 'status';
      let shouldRetry = false;
      let shouldInquiry = false;
      let message = `وضعیت کارتخوان: ${stateMessage(status.state)}.`;
      if (related && live) {
        outcome = 'unknown';
        shouldInquiry = true;
        message = `خرید هنوز روی دستگاه باز است (${stateMessage(status.state)}). خرید را از نو نفرستید و بعد از تمام شدن کارت، دوباره استعلام بگیرید.`;
      } else if (related && !live && accepted) {
        outcome = 'unknown';
        message = 'دستگاه الان آزاد است. اگر رسید پرداخت چاپ شده، خرید را تکرار نکنید. اگر رسیدی چاپ نشده، نتیجه نامعلوم مانده و باید همان رسید دستگاه بررسی شود.';
      } else if (related && !live) {
        outcome = 'failed';
        shouldRetry = true;
        message = 'کارتخوان خریدی در حال انجام ندارد. ارسال قبلی به دستگاه نرسیده و می‌توانید دوباره پرداخت کنید.';
        await updateTransaction(related.Id, {
          outcome: 'failed',
          errorMessage: message,
          deviceAccepted: false,
          resolvedByInquiry: true,
        });
      }
      result = await applyDecision(transactionId, {
        outcome: outcome === 'status' ? 'failed' : outcome,
        shouldRetry,
        shouldInquiry,
        responseFrame: transport.body,
        message,
      });
      if (outcome === 'status') result.outcome = 'status';
      result.state = status.state;
    } else {
      result = await applyDecision(transactionId, {
        outcome: 'failed',
        shouldRetry: true,
        shouldInquiry: false,
        responseFrame: transport.body,
        message: 'پاسخ وضعیت کارتخوان قابل استفاده نیست. پروتکل دستگاه باید Asanpardakht CSV باشد.',
      });
    }

    logResult('inquiry', messageId, result);
    return publicResult(result, {
      transactionId,
      messageId,
      requestFrame,
      target: endpoint(config),
      appliedTo: related?.Id ?? null,
    });
  });
}

export async function startPairing() {
  const config = assertPcPosConfigured();
  const transport = await postFrame(null, config, { path: '/api/v1/pair', auth: false, timeoutMs: 12000 });
  if (transport.transportError) {
    return { ok: false, message: transport.message };
  }
  if (transport.httpStatus === 200) {
    return { ok: true, message: 'کد شش‌رقمی روی کارتخوان آمده است. همان را اینجا وارد کنید. حدود ۳۰ ثانیه فرصت دارید.' };
  }
  if (transport.httpStatus === 409) {
    return { ok: false, message: 'کارتخوان آمادهٔ جفت‌سازی نیست. صفحهٔ اصلی دستگاه باید باز و بدون پیام باشد.' };
  }
  return { ok: false, message: `شروع جفت‌سازی ناموفق بود. کد HTTP ${transport.httpStatus}.` };
}

export async function confirmPairing(code) {
  const config = assertPcPosConfigured();
  const frame = buildPairConfirmFrame(code);
  const transport = await postFrame(frame, config, { path: '/api/v1/pair/confirm', auth: false, timeoutMs: 12000 });
  if (transport.transportError) return { ok: false, message: transport.message };
  if (transport.httpStatus === 401) {
    return { ok: false, message: 'کد قبول نشد. روی دستگاه دوباره کد بگیرید و همان را وارد کنید.' };
  }
  if (transport.httpStatus !== 200) {
    return { ok: false, message: `تأیید جفت‌سازی ناموفق بود. کد HTTP ${transport.httpStatus}.` };
  }
  const token = parsePairToken(transport.body);
  if (!token) return { ok: false, message: 'پاسخ جفت‌سازی قابل خواندن نیست.' };
  saveToken(token);
  return { ok: true, paired: true, message: 'کارتخوان جفت شد. حالا پرداخت را بزنید.' };
}

export async function getStoredTransaction(id) {
  return mapTransaction(await getTransaction(id));
}
