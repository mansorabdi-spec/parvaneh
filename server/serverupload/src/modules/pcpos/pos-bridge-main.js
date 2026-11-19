import { confirmPairing, readDeviceStatus, sendPurchaseToDevice, startPairing } from './pcpos.service.js';
import { getPcPosPublicSettings, savePcPosSettings } from './pcpos.config.js';

function serverUrl() {
  return String(process.env.PCPOS_SERVER_URL || '').trim().replace(/\/+$/, '');
}

function bridgeKey() {
  return String(process.env.PCPOS_BRIDGE_KEY || '');
}

async function postJson(path, body) {
  const response = await fetch(`${serverUrl()}${path}`, {
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
    const error = new Error(data.message || `پاسخ سرور ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
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

export async function main() {
  if (!serverUrl() || bridgeKey().length < 8) {
    console.log('آدرس سامانه و کلید مشترک در تنظیم رایانه کیوسک کامل نیست.');
    console.log('PCPOS_SERVER_URL');
    console.log('PCPOS_BRIDGE_KEY');
    process.exit(1);
  }
  console.log('برنامه اتصال کارتخوان روشن شد.');
  console.log(serverUrl());

  let lastBeat = 0;
  for (;;) {
    try {
      if (Date.now() - lastBeat > 5000) {
        await heartbeat();
        lastBeat = Date.now();
      }
      const { job } = await postJson('/api/pos-bridge/claim', {});
      if (!job) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
      console.log(`درخواست ${job.kind} شماره ${job.id}`);
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
      console.log(error.message || 'ارتباط با سامانه قطع شد');
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}
