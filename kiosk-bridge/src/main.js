import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { confirmPairing, readDeviceStatus, sendPurchaseToDevice, startPairing } from './device.js';
import { getPcPosPublicSettings, savePcPosSettings } from './pcpos.config.js';

function loadEnv(file) {
  let text = '';
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return;
  }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) process.env[key] = value;
  }
}

loadEnv(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env'));

function serverUrl() {
  return String(process.env.PCPOS_SERVER_URL || '').trim().replace(/\/+$/, '');
}

function bridgeKey() {
  return String(process.env.PCPOS_BRIDGE_KEY || '');
}

async function postJson(apiPath, body) {
  const response = await fetch(`${serverUrl()}${apiPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Pos-Bridge-Key': bridgeKey(),
    },
    body: JSON.stringify(body || {}),
  });
  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text.slice(0, 240) };
    }
  }
  if (!response.ok) {
    throw new Error(data.message || `پاسخ سامانه پذیرفته نشد. کد ${response.status}`);
  }
  return data;
}

function linkError(error) {
  const code = error.cause?.code || '';
  if (code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'EHOSTUNREACH') {
    return 'درگاه این آدرس از بیرون باز نیست.';
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return 'نام سامانه پیدا نشد.';
  }
  if (code === 'ETIMEDOUT' || code === 'UND_ERR_CONNECT_TIMEOUT' || error.name === 'TimeoutError') {
    return 'مهلت رسیدن به سامانه تمام شد.';
  }
  if (String(code).includes('CERT') || code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
    return 'گواهی امن آدرس سامانه قبول نشد.';
  }
  if (code === 'EPROTO' || code === 'ERR_SSL_WRONG_VERSION_NUMBER') {
    return 'این آدرس پاسخ امن نمی‌دهد. شماره درگاه داخلی را در آدرس ننویسید.';
  }
  return 'ارتباط با سامانه برقرار نشد.';
}

async function heartbeat() {
  const settings = getPcPosPublicSettings();
  await postJson('/api/pos-bridge/heartbeat', {
    host: settings.host,
    port: settings.port,
    paired: settings.paired,
  });
}

async function perform(job) {
  if (job.kind === 'settings') {
    const saved = savePcPosSettings({ host: job.payload.host, port: job.payload.port });
    return {
      ok: true,
      ...saved,
      message: saved.paired
        ? 'آدرس کارتخوان ذخیره شد. توکن جفت‌سازی سر جایش ماند.'
        : 'آدرس کارتخوان ذخیره شد. یک بار کد جفت‌سازی را وارد کنید.',
    };
  }
  if (job.kind === 'pair') return startPairing();
  if (job.kind === 'confirm') return confirmPairing(job.payload.code);
  if (job.kind === 'purchase') return sendPurchaseToDevice(job.payload);
  if (job.kind === 'inquiry') return { ok: true, status: await readDeviceStatus() };
  return { ok: false, message: 'نوع درخواست شناخته نشد' };
}

async function main() {
  if (!serverUrl() || bridgeKey().length < 8) {
    console.log('آدرس سامانه یا کلید مشترک در فایل تنظیم کامل نیست.');
    process.exit(1);
  }
  console.log('برنامه اتصال کارتخوان روشن شد.');
  console.log(serverUrl());
  try {
    const address = new URL(serverUrl());
    if (address.port === '4000' || address.port === '4001') {
      console.log('این درگاه فقط داخل سرور است. آدرس عمومی سایت را بدون شماره درگاه بنویسید.');
    }
  } catch {
    console.log('آدرس سامانه قابل خواندن نیست.');
  }
  let lastBeat = 0;
  let announced = false;
  for (;;) {
    try {
      if (Date.now() - lastBeat > 5000) {
        await heartbeat();
        lastBeat = Date.now();
        if (!announced) {
          announced = true;
          console.log('سامانه پاسخ داد.');
        }
      }
      const { job } = await postJson('/api/pos-bridge/claim', {});
      if (!job) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
      let result;
      try {
        result = await perform(job);
      } catch (error) {
        result = {
          ok: false,
          outcome: 'failed',
          shouldRetry: true,
          shouldInquiry: false,
          message: error.message || 'ارتباط با کارتخوان قطع شد',
        };
      }
      await postJson(`/api/pos-bridge/jobs/${job.id}/result`, {
        kind: job.kind,
        payload: job.payload,
        result,
      });
      await heartbeat();
      lastBeat = Date.now();
    } catch (error) {
      console.log(error.message && error.message !== 'fetch failed' ? error.message : linkError(error));
      if (error.cause?.code) console.log(error.cause.code);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

await main();
