SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Tariffs]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[Tariffs] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [Code] AS ([Id]) PERSISTED, -- simple code equals Id
    [LicenseType] NVARCHAR(200) NOT NULL,
    [DocTypeId] INT NOT NULL,
    [FromDate] NVARCHAR(20) NULL,
    [ToDate] NVARCHAR(20) NULL,
    [FromTon] NVARCHAR(50) NULL,
    [ToTon] NVARCHAR(50) NULL,
    [Amount] INT NOT NULL,
    [Year] NVARCHAR(10) NOT NULL,
    [Description] NVARCHAR(500) NULL,
    [CreatedAt] DATETIME2 NOT NULL DEFAULT(SYSUTCDATETIME()),
    [UpdatedAt] DATETIME2 NULL,
    CONSTRAINT [FK_Tariffs_DocType] FOREIGN KEY ([DocTypeId]) REFERENCES [dbo].[LookupValue]([Id])
  );
  CREATE INDEX [IX_Tariffs_DocType] ON [dbo].[Tariffs]([DocTypeId]);
END
GO
