import http from 'http';
import { assertPcPosConfigured, getPcPosConfig } from './pcpos.config.js';
import {
  PcPosError,
  buildBillFrame,
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
import {
  getTransaction,
  insertTransaction,
  mapTransaction,
  updateTransaction,
} from './pcpos.store.js';

let deviceBusy = false;
let activeRequestId = null;

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

async function withDevice(work, requestId = null) {
  if (deviceBusy) {
    throw new PcPosError('دستگاه POS در حال انجام تراکنش دیگری است. تا مشخص شدن نتیجهٔ همان تراکنش صبر کنید', 409);
  }
  deviceBusy = true;
  activeRequestId = requestId == null ? null : String(requestId);
  try {
    return await work();
  } finally {
    deviceBusy = false;
    activeRequestId = null;
  }
}

export function paymentInProgress(requestId) {
  if (!deviceBusy) return false;
  if (requestId == null || activeRequestId == null) return true;
  return String(activeRequestId) === String(requestId);
}

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

export function postFrame(frame, config, options = {}) {
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
    if (options.signal) {
      if (options.signal.aborted) {
        req.destroy();
      } else {
        options.signal.addEventListener('abort', () => req.destroy(), { once: true });
      }
    }
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

  const parsed = parsePosPayload(transport.body);
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
    errorMessage: interpreted.printFailed
      ? interpreted.message
      : (interpreted.outcome === 'success' ? null : interpreted.message),
    deviceAccepted: deviceAccepted || interpreted.outcome === 'success',
  });
  return { ...interpreted, httpStatus: transport.httpStatus, responseFrame: transport.body };
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

export async function startPurchase(input) {
  const config = assertPcPosConfigured();
  if (!config.token) return { result: pairingRequired() };

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

  if (deviceBusy) {
    throw new PcPosError('دستگاه POS در حال انجام تراکنش دیگری است. تا مشخص شدن نتیجهٔ همان تراکنش صبر کنید', 409);
  }
  deviceBusy = true;
  activeRequestId = input.requestId == null ? null : String(input.requestId);
  let transactionId;
  try {
    transactionId = await insertTransaction({
      kind: 'purchase',
      messageId,
      invoiceNumber: String(input.invoiceNumber),
      amount: input.amount,
      requestFrame,
      outcome: 'pending',
      requestId: input.requestId ?? null,
    });
    await updateTransaction(transactionId, {
      outcome: 'pending',
      deviceAccepted: true,
      errorMessage: 'منتظر پایان کار روی کارتخوان',
    });
  } catch (error) {
    deviceBusy = false;
    activeRequestId = null;
    throw error;
  }

  const completion = (async () => {
    const expect = { expectedType: 'POSBUY', expectedMessageId: messageId };
    const details = {
      transactionId,
      messageId,
      invoiceNumber: String(input.invoiceNumber),
      dateTime,
      requestFrame,
      target: endpoint(config),
    };
    try {
      console.log(`[pcpos] purchase sent messageId=${messageId} amount=${input.amount} target=${endpoint(config)} auth=${config.token ? 'yes' : 'no'}`);
      const transport = await postFrame(requestFrame, config);
      const result = await settle(transactionId, transport, expect, { deviceAccepted: !transport.unreachable });
      logResult('purchase', messageId, result);
      return publicResult(result, details);
    } catch (error) {
      const message = error.message || 'پرداخت روی کارتخوان ناتمام ماند';
      await updateTransaction(transactionId, { outcome: 'failed', errorMessage: message }).catch(() => {});
      return {
        outcome: 'failed',
        message,
        transactionId,
        shouldInquiry: false,
        shouldRetry: true,
        responseCode: '',
      };
    } finally {
      deviceBusy = false;
      activeRequestId = null;
    }
  })();

  return {
    result: {
      outcome: 'pending',
      transactionId,
      message: 'مبلغ به کارتخوان ارسال شد. کارت را بکشید و رمز را وارد کنید.',
      shouldInquiry: false,
      shouldRetry: false,
      responseCode: '',
    },
    completion,
  };
}

export async function purchase(input) {
  const started = await startPurchase(input);
  if (!started.completion) return started.result;
  return started.completion;
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
  const details = {
    messageId,
    invoiceNumber: String(input.invoiceNumber),
    dateTime,
    requestFrame,
    target: endpoint(config),
  };

  return withDevice(async () => {
    console.log(`[pcpos] bridge purchase messageId=${messageId} amount=${input.amount} target=${endpoint(config)}`);
    const transport = await postFrame(requestFrame, config);
    if (transport.transportError) {
      const unknown = transport.unknown && !transport.unreachable;
      return {
        outcome: unknown ? 'unknown' : 'failed',
        checksumValid: false,
        shouldInquiry: unknown,
        shouldRetry: !unknown,
        printFailed: false,
        responseCode: '',
        message: transport.message,
        ...details,
      };
    }
    const rejected = httpDecision(transport);
    if (rejected) {
      return {
        ...rejected,
        checksumValid: false,
        printFailed: false,
        responseCode: rejected.responseCode || '',
        responseFrame: transport.body,
        needsPairing: Boolean(rejected.needsPairing),
        ...details,
      };
    }
    const parsed = parsePosPayload(transport.body);
    if (parsed.checksumValid && parsed.type === 'POSBSY') {
      return {
        outcome: 'failed',
        checksumValid: false,
        shouldInquiry: false,
        shouldRetry: true,
        printFailed: false,
        responseCode: '',
        responseFrame: transport.body,
        message: 'کارتخوان مشغول است. صفحه اصلی دستگاه را باز کنید و دوباره تلاش کنید.',
        ...details,
      };
    }
    const interpreted = interpretPosResponse(parsed, expect);
    return { ...interpreted, httpStatus: transport.httpStatus, responseFrame: transport.body, ...details };
  }, input.requestId);
}

export async function readDeviceStatus() {
  const config = getPcPosConfig();
  if (!config.host || !config.token) return { kind: 'unauthorized', host: config.host || '', port: config.port };
  const transport = await postFrame(buildStatusFrame(), config, { timeoutMs: 12000 });
  const status = readStatus(transport);
  return {
    ...status,
    host: config.host,
    port: config.port,
    body: transport.body || '',
  };
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
      } else if (related && !live) {
        outcome = 'failed';
        shouldRetry = true;
        message = accepted
          ? 'کارتخوان آزاد است و این خرید روی آن باز نیست. اگر رسیدی چاپ نشده، دوباره پرداخت کنید.'
          : 'کارتخوان خریدی در حال انجام ندارد. ارسال قبلی به دستگاه نرسیده و می‌توانید دوباره پرداخت کنید.';
        await updateTransaction(related.Id, {
          outcome: 'failed',
          errorMessage: message,
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

export async function applyDeviceStatus(input, status) {
  const related = input.transactionId ? await getTransaction(input.transactionId) : null;
  if (input.transactionId && !related) throw new PcPosError('تراکنش مورد نظر برای استعلام پیدا نشد', 404);
  if (related && !['unknown', 'pending'].includes(related.Outcome)) {
    throw new PcPosError('فقط تراکنش نامعلوم را استعلام کنید. این تراکنش نتیجه نهایی دارد', 409);
  }
  const messageId = allocateMessageId();
  const requestFrame = buildStatusFrame();
  const transactionId = await insertTransaction({
    kind: 'inquiry',
    messageId,
    requestFrame,
    outcome: 'pending',
    relatedTransactionId: related?.Id ?? null,
  });
  const body = status?.body || '';
  let result;
  if (!status || status.kind === 'unauthorized') {
    result = await applyDecision(transactionId, {
      needsPairing: true,
      outcome: 'failed',
      shouldRetry: false,
      shouldInquiry: false,
      responseFrame: body,
      message: 'کارتخوان این برنامه را نمی‌شناسد. دوباره کد جفت‌سازی را وارد کنید.',
    });
  } else if (status.kind === 'unreachable') {
    result = await applyDecision(transactionId, {
      outcome: 'failed',
      shouldRetry: true,
      shouldInquiry: false,
      message: 'استعلام به کارتخوان نرسید.',
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
    } else if (related && !live) {
      outcome = 'failed';
      shouldRetry = true;
      message = accepted
        ? 'کارتخوان آزاد است و این خرید روی آن باز نیست. اگر رسیدی چاپ نشده، دوباره پرداخت کنید.'
        : 'کارتخوان خریدی در حال انجام ندارد. ارسال قبلی به دستگاه نرسیده و می‌توانید دوباره پرداخت کنید.';
      await updateTransaction(related.Id, {
        outcome: 'failed',
        errorMessage: message,
        resolvedByInquiry: true,
      });
    }
    result = await applyDecision(transactionId, {
      outcome: outcome === 'status' ? 'failed' : outcome,
      shouldRetry,
      shouldInquiry,
      responseFrame: body,
      message,
    });
    if (outcome === 'status') result.outcome = 'status';
    result.state = status.state;
  } else {
    result = await applyDecision(transactionId, {
      outcome: 'failed',
      shouldRetry: true,
      shouldInquiry: false,
      responseFrame: body,
      message: 'پاسخ وضعیت کارتخوان قابل استفاده نیست.',
    });
  }
  return publicResult(result, {
    transactionId,
    messageId,
    requestFrame,
    appliedTo: related?.Id ?? null,
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
  saveToken(token, config.host);
  return {
    ok: true,
    paired: true,
    message: 'کارتخوان جفت شد و توکن ذخیره شد. تا وقتی همین دستگاه باشد، لازم نیست دوباره جفت کنید.',
  };
}

async function deviceHasLivePayment() {
  const config = getPcPosConfig();
  if (!config.host || !config.token) return false;
  const transport = await postFrame(buildStatusFrame(), config, { timeoutMs: 8000 });
  const status = readStatus(transport);
  return status.kind === 'state' && status.live;
}

export async function releaseStalePurchase(transaction) {
  if (!transaction || !['pending', 'unknown'].includes(transaction.Outcome)) {
    return { active: false, released: false };
  }
  if (paymentInProgress(transaction.RequestId)) {
    return { active: true, released: false };
  }
  if (!deviceBusy && await deviceHasLivePayment()) {
    return { active: true, released: false };
  }
  const accepted = Boolean(transaction.DeviceAccepted);
  await updateTransaction(transaction.Id, {
    outcome: 'failed',
    errorMessage: 'این پرداخت روی کارتخوان باز نبود و قفل پرونده برداشته شد',
    resolvedByInquiry: true,
  });
  return { active: false, released: true, accepted };
}

export async function getStoredTransaction(id) {
  return mapTransaction(await getTransaction(id));
}
