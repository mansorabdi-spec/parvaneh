-- Lookup tables for base data management
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[LookupCategory]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[LookupCategory] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [Key] NVARCHAR(100) NOT NULL UNIQUE,
    [Name] NVARCHAR(200) NOT NULL,
    [Description] NVARCHAR(500) NULL,
    [IsActive] BIT NOT NULL DEFAULT(1),
    [SortOrder] INT NOT NULL DEFAULT(0),
    [CreatedAt] DATETIME2 NOT NULL DEFAULT(SYSUTCDATETIME()),
    [CreatedBy] NVARCHAR(100) NULL,
    [UpdatedAt] DATETIME2 NULL,
    [UpdatedBy] NVARCHAR(100) NULL
  );
END
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[LookupValue]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[LookupValue] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [CategoryId] INT NOT NULL,
    [Code] NVARCHAR(100) NULL,
    [Name] NVARCHAR(200) NOT NULL,
    [NameEn] NVARCHAR(200) NULL,
    [Description] NVARCHAR(500) NULL,
    [ParentId] INT NULL,
    [IsActive] BIT NOT NULL DEFAULT(1),
    [SortOrder] INT NOT NULL DEFAULT(0),
    [ExtraJson] NVARCHAR(MAX) NULL,
    [ValidFrom] DATE NULL,
    [ValidTo] DATE NULL,
    [CreatedAt] DATETIME2 NOT NULL DEFAULT(SYSUTCDATETIME()),
    [CreatedBy] NVARCHAR(100) NULL,
    [UpdatedAt] DATETIME2 NULL,
    [UpdatedBy] NVARCHAR(100) NULL,
    CONSTRAINT [FK_LookupValue_Category] FOREIGN KEY ([CategoryId]) REFERENCES [dbo].[LookupCategory]([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_LookupValue_Parent] FOREIGN KEY ([ParentId]) REFERENCES [dbo].[LookupValue]([Id])
  );

  CREATE UNIQUE INDEX [UX_LookupValue_Category_Code] ON [dbo].[LookupValue]([CategoryId],[Code]) WHERE [Code] IS NOT NULL;
  CREATE UNIQUE INDEX [UX_LookupValue_Category_Name] ON [dbo].[LookupValue]([CategoryId],[Name]);
  CREATE INDEX [IX_LookupValue_Category_Sort] ON [dbo].[LookupValue]([CategoryId],[SortOrder]);
  CREATE INDEX [IX_LookupValue_Category_IsActive] ON [dbo].[LookupValue]([CategoryId],[IsActive]);
END
GO

-- Seed a few sample categories (idempotent)
IF NOT EXISTS (SELECT 1 FROM [dbo].[LookupCategory] WHERE [Key] = N'LicenseType')
  INSERT INTO [dbo].[LookupCategory]([Key],[Name],[SortOrder]) VALUES (N'LicenseType', N'نوع پروانه', 1);
IF NOT EXISTS (SELECT 1 FROM [dbo].[LookupCategory] WHERE [Key] = N'FuelType')
  INSERT INTO [dbo].[LookupCategory]([Key],[Name],[SortOrder]) VALUES (N'FuelType', N'نوع سوخت', 2);
IF NOT EXISTS (SELECT 1 FROM [dbo].[LookupCategory] WHERE [Key] = N'CompanyType')
  INSERT INTO [dbo].[LookupCategory]([Key],[Name],[SortOrder]) VALUES (N'CompanyType', N'نوع شرکت', 3);
IF NOT EXISTS (SELECT 1 FROM [dbo].[LookupCategory] WHERE [Key] = N'LicenseDocumentType')
  INSERT INTO [dbo].[LookupCategory]([Key],[Name],[SortOrder]) VALUES (N'LicenseDocumentType', N'نوع سند پروانه', 4);
GO
