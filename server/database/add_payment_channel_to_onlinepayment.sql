-- Distinguishes internet gateway payments from POS payments,
-- and marks payments that were started on the kiosk page.
-- PaymentChannel: Internet | Pos
-- ViaKiosk: 1 = kiosk, 0 = elsewhere

IF COL_LENGTH(N'dbo.OnlinePayment', N'PaymentChannel') IS NULL
BEGIN
  ALTER TABLE dbo.OnlinePayment
  ADD PaymentChannel NVARCHAR(20) NOT NULL
    CONSTRAINT DF_OnlinePayment_PaymentChannel DEFAULT N'Internet';
END
GO

IF COL_LENGTH(N'dbo.OnlinePayment', N'ViaKiosk') IS NULL
BEGIN
  ALTER TABLE dbo.OnlinePayment
  ADD ViaKiosk BIT NOT NULL
    CONSTRAINT DF_OnlinePayment_ViaKiosk DEFAULT 0;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'IX_OnlinePayment_PaymentChannel'
    AND object_id = OBJECT_ID(N'dbo.OnlinePayment')
)
BEGIN
  CREATE INDEX IX_OnlinePayment_PaymentChannel
    ON dbo.OnlinePayment (PaymentChannel, ViaKiosk);
END
GO

UPDATE dbo.OnlinePayment
SET PaymentChannel = N'Pos',
    ViaKiosk = 1
WHERE Description LIKE N'پرداخت با دستگاه پوز%';
GO
