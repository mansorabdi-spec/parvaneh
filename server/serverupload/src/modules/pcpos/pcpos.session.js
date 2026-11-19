import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dataDir = process.env.PCPOS_SESSION_DIR
  ? path.resolve(process.env.PCPOS_SESSION_DIR)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../data');

const sessionFile = path.join(dataDir, 'pcpos-session.json');
const tokenFile = path.join(dataDir, 'pcpos-token.json');

function readJson(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function readTokenRecord() {
  const saved = readJson(tokenFile);
  const token = String(saved.token || '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  return {
    token,
    pairedAt: saved.pairedAt || null,
    host: String(saved.host || '').trim(),
  };
}

function tokenMatchesHost(saved, host) {
  if (!saved) return false;
  return !saved.host || !host || saved.host === host;
}

export function readSession() {
  const session = readJson(sessionFile);
  const saved = readTokenRecord();
  const host = String(session.host || '').trim();
  if (tokenMatchesHost(saved, host)) {
    session.token = saved.token;
    if (saved.pairedAt) session.pairedAt = saved.pairedAt;
  }
  return session;
}

export function writeSession(session) {
  const next = { ...session };
  const saved = readTokenRecord();
  const host = String(next.host || '').trim();
  if (tokenMatchesHost(saved, host)) {
    next.token = saved.token;
    if (saved.pairedAt) next.pairedAt = saved.pairedAt;
  }
  writeJson(sessionFile, next);
}

export function allocateMessageId() {
  const session = readSession();
  const current = Number(session.messageSeq) || 0;
  const next = current >= 99999 ? 1 : current + 1;
  session.messageSeq = next;
  writeSession(session);
  return String(next);
}

export function saveToken(token, host) {
  const normalized = String(token || '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error('invalid pcpos token');
  }
  const session = readJson(sessionFile);
  const pairedAt = new Date().toISOString();
  const record = {
    token: normalized,
    pairedAt,
    host: String(host || session.host || '').trim(),
  };
  writeJson(tokenFile, record);
  session.token = normalized;
  session.pairedAt = pairedAt;
  writeJson(sessionFile, session);
  console.log(`[pcpos] pairing token saved host=${record.host || '-'} at=${pairedAt}`);
}

export function clearToken() {
  try {
    fs.unlinkSync(tokenFile);
  } catch {
    // The token file is already absent.
  }
  const session = readJson(sessionFile);
  delete session.token;
  delete session.pairedAt;
  writeJson(sessionFile, session);
}
