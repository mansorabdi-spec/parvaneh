import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBillFrame,
  buildFrame,
  buildPairConfirmFrame,
  buildPurchaseFrame,
  buildStatusFrame,
  checksum,
  interpretPosResponse,
  parseFrame,
  parsePairToken,
} from './pcpos.protocol.js';

test('status frame is the CSV control message', () => {
  const frame = buildStatusFrame();
  assert.equal(frame, `$PCSTA,*${checksum('PCSTA,')}\r\n`);
  assert.equal(parseFrame(frame).checksumValid, true);
});

test('reference purchase frame uses application id 9999999999999999 and checksum 43', () => {
  const frame = buildPurchaseFrame({
    amount: 1500000,
    invoiceNumber: '1024',
    dateTime: '20260727103000',
    messageId: '7',
    applicationId: '9999999999999999',
  });
  assert.equal(frame, '$PCBUY,1500000,1024,20260727103000,7,0,9999999999999999,*43\r\n');
});

test('message id longer than 5 digits is rejected', () => {
  assert.throws(() => buildPurchaseFrame({
    amount: 1500000,
    invoiceNumber: '1024',
    dateTime: '20260727103000',
    messageId: '20261114120000123',
    applicationId: '9999999999999999',
  }), /شناسه پیام/);
});

test('application id longer than 16 characters is rejected', () => {
  assert.throws(() => buildPurchaseFrame({
    amount: 1000,
    invoiceNumber: '1',
    dateTime: '20260727103000',
    messageId: '1',
    applicationId: '12345678901234567',
  }), /شناسه برنامه/);
});

test('two-row sheba split matches checksum 68 and omits application id', () => {
  const frame = buildPurchaseFrame({
    amount: '1000000',
    invoiceNumber: '1025',
    dateTime: '20260727103500',
    messageId: '8',
    applicationId: null,
    splits: [
      { sheba: 'IR530140040000310011584961', amount: 700000 },
      { sheba: 'ir820170000000110325411001', amount: '300000' },
    ],
  });
  assert.equal(
    frame,
    '$PCBUY,1000000,1025,20260727103500,8,2,IR530140040000310011584961,700000,IR820170000000110325411001,300000,*68\r\n'
  );
});

test('split iban id is joined with a pipe', () => {
  const frame = buildPurchaseFrame({
    amount: '1000',
    invoiceNumber: '10',
    dateTime: '20261014153558',
    messageId: '1',
    applicationId: '9999999999999999',
    splits: [
      { sheba: 'IR530140040000310011584961', ibanId: '1', amount: 700 },
      { sheba: 'IR820540102680020817909002', amount: 300 },
    ],
  });
  const parsed = parseFrame(frame);
  assert.equal(parsed.checksumValid, true);
  assert.match(frame, /IR530140040000310011584961\|1,700,IR820540102680020817909002,300,/);
});

test('split amounts must equal the purchase amount', () => {
  assert.throws(() => buildPurchaseFrame({
    amount: 1000,
    invoiceNumber: '1',
    dateTime: '20260727103500',
    messageId: '1',
    applicationId: null,
    splits: [{ sheba: 'IR530140040000310011584961', amount: 1001 }],
  }), /تسهیم/);
});

test('bill request keeps the documented field order', () => {
  const request = buildBillFrame({
    dateTime: '20260921120239',
    messageId: '4',
    billId: '2015488004616',
    paymentId: '1040433',
  });
  assert.equal(request, '$PCBIL,20260921120239,4,1,2015488004616,1040433,*50\r\n');

  const sample = '$POSBIL,0,10000,073592639938,77,20260921120317,4999181,6324568,610433DDDDDD4055,4,2015488004616,0000001040433,*3C\r\n';
  const parsed = parseFrame(sample);
  assert.equal(parsed.checksumValid, true);
  const result = interpretPosResponse(parsed, { expectedType: 'POSBIL', expectedMessageId: '4' });
  assert.equal(result.outcome, 'success');
  assert.equal(result.amount, '10000');
  assert.equal(result.dateTime, '20260921120317');
  assert.equal(result.billId, '2015488004616');
  assert.equal(result.paymentId, '0000001040433');
});

test('pairing confirm frame and token response', () => {
  const frame = buildPairConfirmFrame('123456');
  assert.equal(frame, `$123456,*${checksum('123456,')}\r\n`);
  const token = 'a'.repeat(64);
  const body = buildFrame(`${token},`);
  assert.equal(parsePairToken(body), token);
});

test('masked PAN does not steal the checksum asterisk', () => {
  const inner = 'POSBUY,00,1500000,000000123456,000789,20260727103012,12345678,87654321,6037********1234,7,';
  const frame = buildFrame(inner);
  const parsed = parseFrame(frame);
  assert.equal(parsed.checksumValid, true);
  assert.equal(parsed.fields[8], '6037********1234');
  assert.equal(parsed.fields[9], '7');
  const result = interpretPosResponse(parsed, { expectedType: 'POSBUY', expectedMessageId: '7' });
  assert.equal(result.outcome, 'success');
  assert.equal(result.rrn, '000000123456');
});

test('approved response code is three digits', () => {
  const inner = 'POSBUY,000,000000001000,123456789012,000123,20261014153602,000000004999182,05832963,603799DDDDDD1234,1,';
  const result = interpretPosResponse(parseFrame(buildFrame(inner)), {
    expectedType: 'POSBUY',
    expectedMessageId: '1',
  });
  assert.equal(result.outcome, 'success');
  assert.equal(result.amount, '000000001000');
  assert.equal(result.stan, '000123');
});

test('response 600 means nothing was charged and payment can be sent again', () => {
  const inner = 'POSBUY,600,1500000,1,2,20260727103012,3,4,603799DDDDDD1234,7,';
  const result = interpretPosResponse(parseFrame(buildFrame(inner)), {
    expectedType: 'POSBUY',
    expectedMessageId: '7',
  });
  assert.equal(result.outcome, 'cancelled');
  assert.equal(result.shouldInquiry, false);
  assert.equal(result.shouldRetry, true);
});

test('print failure still counts as a completed payment', () => {
  const inner = 'POSBUY,410,1500000,1,2,20260727103012,3,4,6037********1234,7,';
  const result = interpretPosResponse(parseFrame(buildFrame(inner)), { expectedType: 'POSBUY', expectedMessageId: '7' });
  assert.equal(result.outcome, 'success');
  assert.equal(result.printFailed, true);
});

test('a bad checksum is not treated as success', () => {
  const result = interpretPosResponse(parseFrame('$POSBUY,00,1500000,1,2,20260727103012,3,4,6037********1234,7,*00\r\n'), {
    expectedType: 'POSBUY',
    expectedMessageId: '7',
  });
  assert.equal(result.checksumValid, false);
  assert.equal(result.outcome, 'unknown');
  assert.equal(result.shouldInquiry, true);
});

test('busy and status frames are recognized', () => {
  const busy = interpretPosResponse(parseFrame(buildFrame('POSBSY,')), {});
  assert.equal(busy.outcome, 'failed');
  assert.equal(busy.shouldRetry, true);
  const status = interpretPosResponse(parseFrame(buildFrame('POSSTA,card_presentation,')), {});
  assert.equal(status.state, 'card_presentation');
  assert.equal(status.live, true);
});
