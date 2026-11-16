import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcpos-session-'));
process.env.PCPOS_SESSION_DIR = dir;

const { allocateMessageId, readSession, saveToken } = await import('./pcpos.session.js');
const { savePcPosSettings, getPcPosConfig } = await import('./pcpos.config.js');

const token = 'ab'.repeat(32);

test('the pairing token stays saved across payments and the same device address', () => {
  savePcPosSettings({ host: '192.168.100.25', port: 80 });
  saveToken(token, '192.168.100.25');

  assert.equal(getPcPosConfig().token, token);
  assert.equal(readSession().token, token);
  allocateMessageId();
  allocateMessageId();
  assert.equal(readSession().token, token);
  assert.equal(fs.existsSync(path.join(dir, 'pcpos-token.json')), true);

  const kept = savePcPosSettings({ host: '192.168.100.25', port: 80 });
  assert.equal(kept.paired, true);
  assert.equal(readSession().token, token);

  const changed = savePcPosSettings({ host: '192.168.100.26', port: 80 });
  assert.equal(changed.paired, false);
  assert.equal(readSession().token, undefined);
});
