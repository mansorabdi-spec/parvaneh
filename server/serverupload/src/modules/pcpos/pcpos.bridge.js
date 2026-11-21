import crypto from 'crypto';
import { getPool, sql } from '../../lib/db.js';
import { getPcPosPublicSettings } from './pcpos.config.js';
import { updateTransaction } from './pcpos.store.js';

const ONLINE_MS = 15000;
let schemaReady = null;

export function bridgeModeEnabled() {
  return ['1', 'true', 'yes'].includes(String(process.env.PCPOS_USE_BRIDGE || '').trim().toLowerCase());
}

export function bridgeKeyOk(header) {
  const expected = String(process.env.PCPOS_BRIDGE_KEY || '');
  if (expected.length < 8) return false;
  const a = crypto.createHash('sha256').update(expected).digest();
  const b = crypto.createHash('sha256').update(String(header || '')).digest();
  return crypto.timingSafeEqual(a, b);
}

async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const pool = await getPool();
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name = 'PcPosJobs' AND xtype = 'U')
        BEGIN
          CREATE TABLE PcPosJobs (
            Id INT IDENTITY(1,1) PRIMARY KEY,
            Kind NVARCHAR(20) NOT NULL,
            Payload NVARCHAR(MAX) NOT NULL,
            Status NVARCHAR(20) NOT NULL,
            Result NVARCHAR(MAX) NULL,
            ErrorMessage NVARCHAR(500) NULL,
            RequestId BIGINT NULL,
            CreatedAt DATETIME NOT NULL CONSTRAINT DF_PcPosJobs_CreatedAt DEFAULT GETDATE(),
            UpdatedAt DATETIME NOT NULL CONSTRAINT DF_PcPosJobs_UpdatedAt DEFAULT GETDATE(),
            FinishedAt DATETIME NULL
          );
          CREATE INDEX IX_PcPosJobs_Status_Id ON PcPosJobs (Status, Id);
        END

        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name = 'PcPosBridgeStatus' AND xtype = 'U')
        BEGIN
          CREATE TABLE PcPosBridgeStatus (
            Id INT NOT NULL PRIMARY KEY,
            LastSeen DATETIME NOT NULL,
            Host NVARCHAR(253) NULL,
            Port INT NULL,
            Paired BIT NOT NULL CONSTRAINT DF_PcPosBridge_Paired DEFAULT 0
          );
        END
      `);
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function recordHeartbeat({ host, port, paired }) {
  await ensureSchema();
  const pool = await getPool();
  await pool.request()
    .input('Host', sql.NVarChar(253), host || null)
    .input('Port', sql.Int, Number.isInteger(Number(port)) ? Number(port) : null)
    .input('Paired', sql.Bit, paired ? 1 : 0)
    .query(`
      IF EXISTS (SELECT 1 FROM PcPosBridgeStatus WHERE Id = 1)
        UPDATE PcPosBridgeStatus
        SET LastSeen = GETDATE(), Host = @Host, Port = @Port, Paired = @Paired
        WHERE Id = 1;
      ELSE
        INSERT INTO PcPosBridgeStatus (Id, LastSeen, Host, Port, Paired)
        VALUES (1, GETDATE(), @Host, @Port, @Paired);
    `);
  await failStuckJobs();
}

async function readStatusRow() {
  await ensureSchema();
  const pool = await getPool();
  const result = await pool.request().query('SELECT TOP 1 * FROM PcPosBridgeStatus WHERE Id = 1');
  return result.recordset[0] || null;
}

export async function bridgeIsOnline() {
  if (!bridgeModeEnabled()) return true;
  const row = await readStatusRow();
  if (!row?.LastSeen) return false;
  return Date.now() - new Date(row.LastSeen).getTime() < ONLINE_MS;
}

function bridgeKeyReady() {
  return String(process.env.PCPOS_BRIDGE_KEY || '').trim().length >= 8;
}

export async function getPosConnectionView() {
  if (!bridgeModeEnabled()) {
    return {
      ...getPcPosPublicSettings(),
      bridge: false,
      online: true,
      lastSeen: null,
      bridgeKeyReady: bridgeKeyReady(),
    };
  }
  const row = await readStatusRow();
  const online = Boolean(row?.LastSeen) && Date.now() - new Date(row.LastSeen).getTime() < ONLINE_MS;
  return {
    host: row?.Host || '',
    port: row?.Port || '',
    paired: Boolean(row?.Paired),
    bridge: true,
    online,
    lastSeen: row?.LastSeen || null,
    bridgeKeyReady: bridgeKeyReady(),
  };
}

const OFFLINE_MESSAGE = 'رایانه کنار کارتخوان به سامانه وصل نیست. مبلغی ارسال نشده است.';

export function offlineResult() {
  return {
    ok: false,
    offline: true,
    outcome: 'failed',
    shouldRetry: true,
    shouldInquiry: false,
    needsPairing: false,
    message: OFFLINE_MESSAGE,
  };
}

export async function enqueueJob(kind, payload, requestId = null) {
  await ensureSchema();
  const pool = await getPool();
  const result = await pool.request()
    .input('Kind', sql.NVarChar(20), kind)
    .input('Payload', sql.NVarChar(sql.MAX), JSON.stringify(payload || {}))
    .input('RequestId', sql.BigInt, requestId ?? null)
    .query(`
      INSERT INTO PcPosJobs (Kind, Payload, Status, RequestId)
      OUTPUT INSERTED.Id
      VALUES (@Kind, @Payload, N'pending', @RequestId)
    `);
  return result.recordset[0].Id;
}

export async function findOpenPurchase(requestId) {
  await ensureSchema();
  const pool = await getPool();
  const result = await pool.request()
    .input('RequestId', sql.BigInt, requestId)
    .query(`
      SELECT TOP 1 Id, Status, Payload
      FROM PcPosJobs
      WHERE RequestId = @RequestId
        AND Kind = N'purchase'
        AND Status IN (N'pending', N'running')
      ORDER BY Id DESC
    `);
  return result.recordset[0] || null;
}

async function getJob(id) {
  await ensureSchema();
  const pool = await getPool();
  const result = await pool.request()
    .input('Id', sql.Int, id)
    .query('SELECT TOP 1 * FROM PcPosJobs WHERE Id = @Id');
  return result.recordset[0] || null;
}

export async function claimJob() {
  await ensureSchema();
  await failStuckJobs();
  const pool = await getPool();
  const result = await pool.request().query(`
    ;WITH nextJob AS (
      SELECT TOP (1) *
      FROM PcPosJobs WITH (ROWLOCK, READPAST, UPDLOCK)
      WHERE Status = N'pending'
      ORDER BY Id
    )
    UPDATE nextJob
    SET Status = N'running', UpdatedAt = GETDATE()
    OUTPUT INSERTED.Id, INSERTED.Kind, INSERTED.Payload, INSERTED.RequestId
  `);
  const row = result.recordset[0];
  if (!row) return null;
  let payload = {};
  try {
    payload = JSON.parse(row.Payload || '{}');
  } catch {
    payload = {};
  }
  return { id: row.Id, kind: row.Kind, payload, requestId: row.RequestId };
}

export async function completeJob(id, result) {
  await ensureSchema();
  const pool = await getPool();
  await pool.request()
    .input('Id', sql.Int, id)
    .input('Result', sql.NVarChar(sql.MAX), JSON.stringify(result ?? {}))
    .input('ErrorMessage', sql.NVarChar(500), result?.ok === false ? String(result.message || '').slice(0, 500) : null)
    .query(`
      UPDATE PcPosJobs
      SET Status = N'done',
          Result = @Result,
          ErrorMessage = @ErrorMessage,
          FinishedAt = GETDATE(),
          UpdatedAt = GETDATE()
      WHERE Id = @Id
    `);
}

export async function waitForJob(id, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const job = await getJob(id);
    if (!job) return { ok: false, message: 'درخواست پیدا نشد' };
    if (job.Status === 'done' || job.Status === 'failed') {
      try {
        return JSON.parse(job.Result || '{}');
      } catch {
        return { ok: false, message: job.ErrorMessage || 'پاسخ رایانه کنار کارتخوان قابل خواندن نیست' };
      }
    }
    await sleep(400);
  }
  return { ok: false, timedOut: true, message: 'رایانه کنار کارتخوان در مهلت مقرر پاسخ نداد' };
}

export async function runOnBridge(kind, payload, timeoutMs, requestId = null) {
  if (!(await bridgeIsOnline())) return offlineResult();
  const id = await enqueueJob(kind, payload, requestId);
  return waitForJob(id, timeoutMs);
}

async function failStuckJobs() {
  const pool = await getPool();
  const stuckPurchases = await pool.request().query(`
    SELECT Payload
    FROM PcPosJobs
    WHERE Status = N'running'
      AND Kind = N'purchase'
      AND UpdatedAt < DATEADD(SECOND, -210, GETDATE())
  `);
  await pool.request().query(`
    UPDATE PcPosJobs
    SET Status = N'failed',
        ErrorMessage = N'مهلت رایانه کنار کارتخوان تمام شد',
        Result = N'{"ok":false,"message":"مهلت رایانه کنار کارتخوان تمام شد"}',
        FinishedAt = GETDATE(),
        UpdatedAt = GETDATE()
    WHERE Status = N'running'
      AND Kind IN (N'settings', N'pair', N'confirm', N'inquiry')
      AND UpdatedAt < DATEADD(SECOND, -45, GETDATE());

    UPDATE PcPosJobs
    SET Status = N'failed',
        ErrorMessage = N'ارتباط رایانه کنار کارتخوان در میانه پرداخت قطع شد',
        Result = N'{"ok":false,"outcome":"unknown","shouldInquiry":true,"message":"ارتباط رایانه کنار کارتخوان در میانه پرداخت قطع شد"}',
        FinishedAt = GETDATE(),
        UpdatedAt = GETDATE()
    WHERE Status = N'running'
      AND Kind = N'purchase'
      AND UpdatedAt < DATEADD(SECOND, -210, GETDATE());
  `);
  for (const row of stuckPurchases.recordset) {
    try {
      const payload = JSON.parse(row.Payload || '{}');
      if (payload.transactionId) {
        await updateTransaction(payload.transactionId, {
          outcome: 'unknown',
          errorMessage: 'ارتباط رایانه کنار کارتخوان در میانه پرداخت قطع شد',
        });
      }
    } catch {
      // The payment row is updated on the next successful result.
    }
  }
}
