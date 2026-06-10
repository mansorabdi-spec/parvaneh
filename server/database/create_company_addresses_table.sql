-- Create CompanyAddresses table for storing company address information
-- This table is similar to PersonResidences but for companies
-- Each company (identified by NationalId) can have multiple addresses

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CompanyAddresses]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[CompanyAddresses] (
    [AddressID] BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [NationalId] NVARCHAR(100) NOT NULL, -- شناسه ملی شرکت (FK to CompanyInfo)
    [ProvinceId] INT NULL, -- استان
    [CityId] INT NULL, -- شهر
    [MainStreet] NVARCHAR(200) NULL, -- خیابان اصلی
    [SideStreet] NVARCHAR(200) NULL, -- خیابان فرعی
    [District] NVARCHAR(100) NULL, -- محله
    [PostalCode] NVARCHAR(20) NULL, -- کد پستی
    [Plaque] NVARCHAR(50) NULL, -- پلاک
    [Unit] NVARCHAR(50) NULL, -- واحد
    [Address] NVARCHAR(500) NULL, -- آدرس کامل
    [CreatedAt] DATETIME2 NOT NULL DEFAULT(SYSUTCDATETIME()),
    [CreatedBy] NVARCHAR(100) NULL,
    [UpdatedAt] DATETIME2 NULL,
    [UpdatedBy] NVARCHAR(100) NULL,
    CONSTRAINT [FK_CompanyAddresses_CompanyInfo] FOREIGN KEY ([NationalId]) REFERENCES [dbo].[CompanyInfo]([NationalId]) ON DELETE CASCADE
  );

  -- Create index on NationalId for faster lookups
  CREATE INDEX [IX_CompanyAddresses_NationalId] ON [dbo].[CompanyAddresses]([NationalId]);
  
  PRINT 'CompanyAddresses table created successfully';
END
ELSE
BEGIN
  PRINT 'CompanyAddresses table already exists';
END
GO

PRINT '';
PRINT 'CompanyAddresses table setup completed successfully!';
