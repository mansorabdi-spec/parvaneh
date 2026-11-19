import test from 'node:test';
import assert from 'node:assert/strict';
import { bridgeKeyOk, bridgeModeEnabled } from './pcpos.bridge.js';

test('bridge mode follows the server switch', () => {
  const previous = process.env.PCPOS_USE_BRIDGE;
  process.env.PCPOS_USE_BRIDGE = '1';
  assert.equal(bridgeModeEnabled(), true);
  process.env.PCPOS_USE_BRIDGE = '0';
  assert.equal(bridgeModeEnabled(), false);
  process.env.PCPOS_USE_BRIDGE = previous;
});

test('the shared key must match and be long enough', () => {
  const previous = process.env.PCPOS_BRIDGE_KEY;
  process.env.PCPOS_BRIDGE_KEY = 'short';
  assert.equal(bridgeKeyOk('short'), false);
  process.env.PCPOS_BRIDGE_KEY = 'kiosk-bridge-secret';
  assert.equal(bridgeKeyOk('kiosk-bridge-secret'), true);
  assert.equal(bridgeKeyOk('other-secret-value'), false);
  process.env.PCPOS_BRIDGE_KEY = previous;
});
