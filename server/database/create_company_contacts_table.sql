-- Create CompanyContacts table for storing company contact information
-- This table is similar to PersonContacts but for companies
-- Each company (identified by NationalId) can have multiple contact methods

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CompanyContacts]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[CompanyContacts] (
    [ContactID] BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [NationalId] NVARCHAR(100) NOT NULL, -- شناسه ملی شرکت (FK to CompanyInfo)
    [Type] NVARCHAR(20) NOT NULL, -- نوع تماس (mobile|phone|email|fax)
    [Value] NVARCHAR(255) NOT NULL, -- مقدار (شماره یا ایمیل)
    [IsActive] BIT NOT NULL DEFAULT(1), -- فعال بودن
    [CreatedAt] DATETIME2 NOT NULL DEFAULT(SYSUTCDATETIME()),
    [CreatedBy] NVARCHAR(100) NULL,
    [UpdatedAt] DATETIME2 NULL,
    [UpdatedBy] NVARCHAR(100) NULL,
    CONSTRAINT [FK_CompanyContacts_CompanyInfo] FOREIGN KEY ([NationalId]) REFERENCES [dbo].[CompanyInfo]([NationalId]) ON DELETE CASCADE
  );

  -- Create index on NationalId for faster lookups
  CREATE INDEX [IX_CompanyContacts_NationalId] ON [dbo].[CompanyContacts]([NationalId]);
  
  PRINT 'CompanyContacts table created successfully';
END
ELSE
BEGIN
  PRINT 'CompanyContacts table already exists';
END
GO

PRINT '';
PRINT 'CompanyContacts table setup completed successfully!';
