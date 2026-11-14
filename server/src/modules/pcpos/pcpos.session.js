import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const sessionFile = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../data/pcpos-session.json'
);

export function readSession() {
  try {
    const parsed = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function writeSession(session) {
  fs.mkdirSync(path.dirname(sessionFile), { recursive: true });
  const { token, ...rest } = session;
  const stored = { ...rest };
  if (token) stored.token = token;
  fs.writeFileSync(sessionFile, JSON.stringify(stored, null, 2));
}

export function allocateMessageId() {
  const session = readSession();
  const current = Number(session.messageSeq) || 0;
  const next = current >= 99999 ? 1 : current + 1;
  session.messageSeq = next;
  writeSession(session);
  return String(next);
}

export function saveToken(token) {
  const session = readSession();
  session.token = token;
  session.pairedAt = new Date().toISOString();
  writeSession(session);
}

export function clearToken() {
  const session = readSession();
  delete session.token;
  delete session.pairedAt;
  writeSession(session);
}
