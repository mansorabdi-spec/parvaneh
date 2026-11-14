import { getPool, sql } from '../../lib/db.js';

let schemaReady = null;

async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const pool = await getPool();
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='PcPosTransactions' AND xtype='U')
        BEGIN
          CREATE TABLE PcPosTransactions (
            Id INT IDENTITY(1,1) PRIMARY KEY,
            Kind NVARCHAR(20) NOT NULL,
            MessageId NVARCHAR(32) NOT NULL,
            InvoiceNumber NVARCHAR(64) NULL,
            Amount BIGINT NULL,
            RequestFrame NVARCHAR(MAX) NOT NULL,
            ResponseFrame NVARCHAR(MAX) NULL,
            ResponseCode NVARCHAR(16) NULL,
            Outcome NVARCHAR(20) NOT NULL,
            Rrn NVARCHAR(64) NULL,
            Stan NVARCHAR(64) NULL,
            PanMasked NVARCHAR(64) NULL,
            MerchantId NVARCHAR(64) NULL,
            TerminalId NVARCHAR(64) NULL,
            PosDateTime NVARCHAR(20) NULL,
            RequestId BIGINT NULL,
            RelatedTransactionId INT NULL,
            ResolvedByInquiry BIT NOT NULL CONSTRAINT DF_PcPos_ResolvedByInquiry DEFAULT 0,
            DeviceAccepted BIT NOT NULL CONSTRAINT DF_PcPos_DeviceAccepted DEFAULT 0,
            ErrorMessage NVARCHAR(500) NULL,
            CreatedAt DATETIME NOT NULL CONSTRAINT DF_PcPos_CreatedAt DEFAULT GETDATE(),
            UpdatedAt DATETIME NOT NULL CONSTRAINT DF_PcPos_UpdatedAt DEFAULT GETDATE()
          );
          CREATE INDEX IX_PcPosTransactions_Outcome_CreatedAt
            ON PcPosTransactions (Outcome, CreatedAt DESC);
        END

        IF COL_LENGTH('PcPosTransactions', 'DeviceAccepted') IS NULL
        BEGIN
          ALTER TABLE PcPosTransactions ADD DeviceAccepted BIT NOT NULL
            CONSTRAINT DF_PcPos_DeviceAccepted DEFAULT 0;
        END

        IF COL_LENGTH('PcPosTransactions', 'RequestId') IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM sys.columns c
            JOIN sys.types t ON c.user_type_id = t.user_type_id
            WHERE c.object_id = OBJECT_ID('PcPosTransactions')
              AND c.name = 'RequestId'
              AND t.name = 'int'
          )
        BEGIN
          ALTER TABLE PcPosTransactions ALTER COLUMN RequestId BIGINT NULL;
        END
      `);
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

function toAmount(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isSafeInteger(number)) return null;
  return number;
}

export async function insertTransaction(row) {
  await ensureSchema();
  const pool = await getPool();
  const result = await pool.request()
    .input('Kind', sql.NVarChar(20), row.kind)
    .input('MessageId', sql.NVarChar(32), row.messageId)
    .input('InvoiceNumber', sql.NVarChar(64), row.invoiceNumber ?? null)
    .input('Amount', sql.BigInt, toAmount(row.amount))
    .input('RequestFrame', sql.NVarChar(sql.MAX), row.requestFrame)
    .input('Outcome', sql.NVarChar(20), row.outcome)
    .input('RequestId', sql.BigInt, row.requestId ?? null)
    .input('RelatedTransactionId', sql.Int, row.relatedTransactionId ?? null)
    .query(`
      INSERT INTO PcPosTransactions (
        Kind, MessageId, InvoiceNumber, Amount, RequestFrame, Outcome, RequestId, RelatedTransactionId
      )
      OUTPUT INSERTED.Id
      VALUES (
        @Kind, @MessageId, @InvoiceNumber, @Amount, @RequestFrame, @Outcome, @RequestId, @RelatedTransactionId
      )
    `);
  return result.recordset[0].Id;
}

export async function updateTransaction(id, row) {
  await ensureSchema();
  const pool = await getPool();
  await pool.request()
    .input('Id', sql.Int, id)
    .input('ResponseFrame', sql.NVarChar(sql.MAX), row.responseFrame ?? null)
    .input('ResponseCode', sql.NVarChar(16), row.responseCode ?? null)
    .input('Outcome', sql.NVarChar(20), row.outcome)
    .input('Rrn', sql.NVarChar(64), row.rrn ?? null)
    .input('Stan', sql.NVarChar(64), row.stan ?? null)
    .input('PanMasked', sql.NVarChar(64), row.pan ?? null)
    .input('MerchantId', sql.NVarChar(64), row.merchantId ?? null)
    .input('TerminalId', sql.NVarChar(64), row.terminalId ?? null)
    .input('PosDateTime', sql.NVarChar(20), row.dateTime ?? null)
    .input('Amount', sql.BigInt, toAmount(row.amount))
    .input('ErrorMessage', sql.NVarChar(500), row.errorMessage ?? null)
    .input('ResolvedByInquiry', sql.Bit, row.resolvedByInquiry ? 1 : 0)
    .input('TouchDeviceAccepted', sql.Bit, Object.prototype.hasOwnProperty.call(row, 'deviceAccepted') ? 1 : 0)
    .input('DeviceAccepted', sql.Bit, row.deviceAccepted ? 1 : 0)
    .query(`
      UPDATE PcPosTransactions
      SET ResponseFrame = @ResponseFrame,
          ResponseCode = @ResponseCode,
          Outcome = @Outcome,
          Rrn = @Rrn,
          Stan = @Stan,
          PanMasked = @PanMasked,
          MerchantId = @MerchantId,
          TerminalId = @TerminalId,
          PosDateTime = @PosDateTime,
          Amount = COALESCE(@Amount, Amount),
          ErrorMessage = @ErrorMessage,
          ResolvedByInquiry = CASE WHEN @ResolvedByInquiry = 1 THEN 1 ELSE ResolvedByInquiry END,
          DeviceAccepted = CASE WHEN @TouchDeviceAccepted = 1 THEN @DeviceAccepted ELSE DeviceAccepted END,
          UpdatedAt = GETDATE()
      WHERE Id = @Id
    `);
}

export async function getTransaction(id) {
  await ensureSchema();
  const pool = await getPool();
  const result = await pool.request()
    .input('Id', sql.Int, id)
    .query('SELECT TOP 1 * FROM PcPosTransactions WHERE Id = @Id');
  return result.recordset[0] || null;
}

export async function getLatestPurchaseByRequestId(requestId) {
  await ensureSchema();
  const pool = await getPool();
  const result = await pool.request()
    .input('RequestId', sql.BigInt, requestId)
    .query(`
      SELECT TOP 1 *
      FROM PcPosTransactions
      WHERE RequestId = @RequestId AND Kind = N'purchase'
      ORDER BY Id DESC
    `);
  return result.recordset[0] || null;
}

export async function getLatestDeviceTransaction() {
  await ensureSchema();
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT TOP 1 *
    FROM PcPosTransactions
    WHERE Kind IN (N'purchase', N'bill')
    ORDER BY Id DESC
  `);
  return result.recordset[0] || null;
}

export async function listTransactions({ outcome, kind, limit }) {
  await ensureSchema();
  const pool = await getPool();
  const request = pool.request()
    .input('Outcome', sql.NVarChar(20), outcome || null)
    .input('Kind', sql.NVarChar(20), kind || null)
    .input('Limit', sql.Int, limit);
  const result = await request.query(`
    SELECT TOP (@Limit) *
    FROM PcPosTransactions
    WHERE (@Outcome IS NULL OR Outcome = @Outcome)
      AND (@Kind IS NULL OR Kind = @Kind)
    ORDER BY Id DESC
  `);
  return result.recordset;
}

export function mapTransaction(row) {
  if (!row) return null;
  return {
    id: row.Id,
    kind: row.Kind,
    messageId: row.MessageId,
    invoiceNumber: row.InvoiceNumber,
    amount: row.Amount == null ? null : String(row.Amount),
    requestFrame: row.RequestFrame,
    responseFrame: row.ResponseFrame,
    responseCode: row.ResponseCode,
    outcome: row.Outcome,
    rrn: row.Rrn,
    stan: row.Stan,
    pan: row.PanMasked,
    merchantId: row.MerchantId,
    terminalId: row.TerminalId,
    dateTime: row.PosDateTime,
    requestId: row.RequestId,
    relatedTransactionId: row.RelatedTransactionId,
    resolvedByInquiry: Boolean(row.ResolvedByInquiry),
    errorMessage: row.ErrorMessage,
    createdAt: row.CreatedAt,
    updatedAt: row.UpdatedAt,
  };
}
