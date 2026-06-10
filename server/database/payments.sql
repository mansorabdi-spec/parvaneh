SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[OnlinePayment]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[OnlinePayment] (
    [Id] BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [VehicleID] BIGINT NOT NULL,
    [TrackingNo] NVARCHAR(30) NOT NULL,
    [Amount] INT NOT NULL,
    [UserId] BIGINT NULL,
    [PayedBit] BIT NOT NULL DEFAULT(0),
    [Description] NVARCHAR(MAX) NULL,
    [Status] NVARCHAR(50) NOT NULL DEFAULT('Initiated'),
    [GatewayRef] NVARCHAR(100) NULL,
    [GatewayAuthority] NVARCHAR(100) NULL,
    [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    [PaidAt] DATETIME2 NULL
  );
  CREATE INDEX IX_OnlinePayment_TrackingNo ON [dbo].[OnlinePayment]([TrackingNo]);
  CREATE INDEX IX_OnlinePayment_VehicleID ON [dbo].[OnlinePayment]([VehicleID]);
END
GO
