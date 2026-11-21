import { getPool } from './db.js';

let ready = null;

/**
 * PaymentChannel: Internet | Pos
 * ViaKiosk: 1 when the payment was started from the kiosk page
 */
export async function ensureOnlinePaymentChannel(existingPool) {
  if (!ready) {
    ready = (async () => {
      const pool = existingPool || await getPool();
      const exists = await pool.request().query(`
        SELECT OBJECT_ID(N'dbo.OnlinePayment', N'U') AS TableId
      `);
      if (!exists.recordset[0]?.TableId) return;

      await pool.request().query(`
        IF COL_LENGTH(N'dbo.OnlinePayment', N'PaymentChannel') IS NULL
        BEGIN
          ALTER TABLE dbo.OnlinePayment
          ADD PaymentChannel NVARCHAR(20) NOT NULL
            CONSTRAINT DF_OnlinePayment_PaymentChannel DEFAULT N'Internet';
        END

        IF COL_LENGTH(N'dbo.OnlinePayment', N'ViaKiosk') IS NULL
        BEGIN
          ALTER TABLE dbo.OnlinePayment
          ADD ViaKiosk BIT NOT NULL
            CONSTRAINT DF_OnlinePayment_ViaKiosk DEFAULT 0;
        END
      `);

      await pool.request().query(`
        IF NOT EXISTS (
          SELECT 1 FROM sys.indexes
          WHERE name = N'IX_OnlinePayment_PaymentChannel'
            AND object_id = OBJECT_ID(N'dbo.OnlinePayment')
        )
        BEGIN
          CREATE INDEX IX_OnlinePayment_PaymentChannel
            ON dbo.OnlinePayment (PaymentChannel, ViaKiosk);
        END

        UPDATE dbo.OnlinePayment
        SET PaymentChannel = N'Pos',
            ViaKiosk = 1
        WHERE Description LIKE N'پرداخت با دستگاه پوز%';

        UPDATE dbo.OnlinePayment
        SET PaymentChannel = N'Internet'
        WHERE PaymentChannel IS NULL;

        UPDATE dbo.OnlinePayment
        SET ViaKiosk = 0
        WHERE ViaKiosk IS NULL;
      `);
    })().catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}
