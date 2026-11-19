import { PcPosError } from './pcpos.protocol.js';
import { clearToken, readSession, writeSession } from './pcpos.session.js';

function readTimeout() {
  const requested = Number(process.env.PCPOS_TIMEOUT_MS ?? 180000);
  if (!Number.isFinite(requested)) return 180000;
  // The terminal keeps the HTTP response open until the customer finishes on the device.
  return Math.min(240000, Math.max(180000, Math.trunc(requested)));
}

function readPort(value) {
  const port = Number(value ?? 80);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return 80;
  return port;
}

function isValidHost(host) {
  if (!host || host.length > 253 || /[\s/]/.test(host) || host.includes('://')) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    return host.split('.').every((part) => Number(part) >= 0 && Number(part) <= 255);
  }
  return /^[A-Za-z0-9.-]+$/.test(host);
}

export function getPcPosConfig() {
  const saved = readSession();
  const applicationId = process.env.PCPOS_APPLICATION_ID;
  const host = String(saved.host || process.env.PCPOS_HOST || '').trim();
  const portSource = saved.port || process.env.PCPOS_PORT || 80;
  return {
    host,
    port: readPort(portSource),
    timeoutMs: readTimeout(),
    applicationId: applicationId == null ? '9999999999999999' : String(applicationId).trim(),
    token: String(saved.token || process.env.PCPOS_TOKEN || '').trim(),
  };
}

export function getPcPosPublicSettings() {
  const config = getPcPosConfig();
  return {
    host: config.host,
    port: config.port,
    paired: Boolean(config.token),
  };
}

export function savePcPosSettings({ host, port }) {
  const nextHost = String(host ?? '').trim();
  const nextPort = Number(port);
  if (!isValidHost(nextHost)) {
    throw new PcPosError('آی‌پی کارتخوان نامعتبر است');
  }
  if (!Number.isInteger(nextPort) || nextPort < 1 || nextPort > 65535) {
    throw new PcPosError('پورت کارتخوان نامعتبر است');
  }
  const session = readSession();
  const hostChanged = String(session.host || '') !== nextHost;
  if (hostChanged) clearToken();
  const stored = readSession();
  stored.host = nextHost;
  stored.port = nextPort;
  if (hostChanged) {
    delete stored.token;
    delete stored.pairedAt;
  }
  writeSession(stored);
  return getPcPosPublicSettings();
}

export function assertPcPosConfigured(config = getPcPosConfig()) {
  if (!config.host) {
    const error = new PcPosError('آی‌پی کارتخوان وارد نشده است. در صفحهٔ کیوسک آی‌پی و پورت HTTP دستگاه را ذخیره کنید', 503);
    throw error;
  }
  return config;
}

export function forgetPcPosToken() {
  clearToken();
}
