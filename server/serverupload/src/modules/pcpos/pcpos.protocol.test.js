import http from 'node:http';
import assert from 'node:assert/strict';
import test from 'node:test';
import { postFrame } from './pcpos.service.js';
import {
  buildBillFrame,
  buildFrame,
  buildPairConfirmFrame,
  buildPurchaseFrame,
  buildStatusFrame,
  checksum,
  displayedPaymentReady,
  interpretPosResponse,
  isCompletePosBody,
  parseFrame,
  parsePairToken,
  parsePosPayload,
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
  assert.equal(parsePairToken(JSON.stringify({ token: token.toUpperCase() })), token);
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

test('the terminal result is read even if it leaves the connection open', async () => {
  const frame = '$POSBUY,000,11000,123456789012,000123,20261114184500,4999182,05832963,603799******1234,1,*43\r\n';
  const server = http.createServer((req, res) => {
    req.resume();
    res.writeHead(200, { Connection: 'keep-alive' });
    res.write(frame);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address();
    const result = await postFrame('$PCBUY,11000,1,20261114184500,1,0,9999999999999999,*00\r\n', {
      host: '127.0.0.1',
      port,
      timeoutMs: 3000,
      token: '',
    });
    assert.equal(result.httpStatus, 200);
    assert.match(result.body, /^\$POSBUY,/);
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('a purchase body is complete only when the checksum is at the end', () => {
  const frame = '$POSBUY,000,0000000011000,123456789012,000123,20261114184500,4999182,05832963,603799******1234,1,*43\r\n';
  assert.equal(isCompletePosBody(frame.slice(0, 40)), false);
  assert.equal(isCompletePosBody(frame), true);
  assert.equal(isCompletePosBody('{"type":"buy","response_code":"000"}'), true);
  assert.equal(isCompletePosBody('{"type":"buy"'), false);
});

test('the live Postman buy response is an approved payment', () => {
  const raw = '$POSBUY,000,000000003000,075806939059,010172,20261115131219,000000005647121,06555945,610433DDDDDD0990,11,*06\r\n';
  const parsed = parseFrame(raw);
  assert.equal(parsed.checksumValid, true);
  const result = interpretPosResponse(parsed, { expectedType: 'POSBUY', expectedMessageId: '11' });
  assert.equal(result.outcome, 'success');
  assert.equal(result.responseCode, '000');
  assert.equal(result.amount, '000000003000');
  assert.equal(result.rrn, '075806939059');
  assert.equal(result.stan, '010172');
  assert.equal(result.terminalId, '06555945');
  assert.equal(result.pan, '610433DDDDDD0990');
  assert.equal(result.messageId, '11');
});

test('json buy response is a successful payment', () => {
  const raw = '{"type":"buy","response_code":"000","amount":"0000009295000","rrn":"123456789012","stan":"000123","date_time":"20261114162400","merchant_number":"4999182","terminal_id":"05832963","pan":"603799DDDDDD1234","message_id":"1"}';
  const result = interpretPosResponse(parsePosPayload(raw), { expectedType: 'POSBUY', expectedMessageId: '1' });
  assert.equal(result.outcome, 'success');
  assert.equal(result.rrn, '123456789012');
  assert.equal(result.amount, '0000009295000');
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

test('a result left on the display is done even when the receipt is not printed', () => {
  const start = 1_000_000;
  assert.equal(displayedPaymentReady([
    { state: 'card_presentation', at: start },
    { state: 'pin_entry', at: start + 1000 },
    { state: 'processing', at: start + 2000 },
  ], start + 5000), false);
  assert.equal(displayedPaymentReady([
    { state: 'pin_entry', at: start },
    { state: 'processing', at: start + 1000 },
  ], start + 13_000), true);
  assert.equal(displayedPaymentReady([
    { state: 'processing', at: start },
    { state: 'busy', at: start + 3000 },
  ], start + 5000), true);
  assert.equal(displayedPaymentReady([
    { state: 'busy', at: start },
  ], start + 10_000), false);
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
