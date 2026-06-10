-- Create CompanyInfo table for storing company information for exploitation licenses
-- This table stores company-specific data for exploitation license requests
-- NationalId (شناسه ملی) is the unique primary key for companies

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CompanyInfo]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[CompanyInfo] (
    [NationalId] NVARCHAR(100) NOT NULL PRIMARY KEY, -- شناسه ملی (unique identifier for companies)
    [NationalCode] NVARCHAR(50) NOT NULL, -- کد ملی صاحب شرکت (owner's national code)
    [RegistrationNo] NVARCHAR(100) NOT NULL, -- شماره ثبت
    [CompanyTypeId] INT NULL, -- نوع شرکت ثبت شده (from LookupValue - TypeOfRegisteredCompany)
    [CompanyName] NVARCHAR(500) NOT NULL, -- نام شرکت
    [WorkshopName] NVARCHAR(500) NULL, -- کد کارگاه بیمه
    [BusinessLicenseNo] NVARCHAR(100) NULL, -- شماره پروانه کسب
    [EconomicCode] NVARCHAR(100) NULL, -- کد اقتصادی
    [MainActivity] NVARCHAR(500) NULL, -- فعالیت اصلی
    [ActivityFieldId] INT NULL, -- رسته فعالیت (from LookupValue)
    [TonnageRateId] INT NULL, -- نرخ تناژ (from LookupValue)
    [RegistrationDate] NVARCHAR(50) NULL, -- تاریخ ثبت (Jalali)
    [BusinessLicenseValidFrom] NVARCHAR(50) NULL, -- اعتبار جواز کسب از تاریخ (Jalali)
    [BusinessLicenseValidTo] NVARCHAR(50) NULL, -- تا تاریخ (Jalali)
    [ParentCompanyId] INT NULL, -- شرکت پایرو (reference to lookup)
    [CreatedAt] DATETIME2 NOT NULL DEFAULT(SYSUTCDATETIME()),
    [CreatedBy] NVARCHAR(100) NULL,
    [UpdatedAt] DATETIME2 NULL,
    [UpdatedBy] NVARCHAR(100) NULL,
    CONSTRAINT [FK_CompanyInfo_CompanyType] FOREIGN KEY ([CompanyTypeId]) REFERENCES [dbo].[LookupValue]([Id]),
    CONSTRAINT [FK_CompanyInfo_ActivityField] FOREIGN KEY ([ActivityFieldId]) REFERENCES [dbo].[LookupValue]([Id]),
    CONSTRAINT [FK_CompanyInfo_TonnageRate] FOREIGN KEY ([TonnageRateId]) REFERENCES [dbo].[LookupValue]([Id])
  );

  -- Create index on NationalCode for faster lookups
  CREATE INDEX [IX_CompanyInfo_NationalCode] ON [dbo].[CompanyInfo]([NationalCode]);
  CREATE INDEX [IX_CompanyInfo_RegistrationNo] ON [dbo].[CompanyInfo]([RegistrationNo]);
  
  PRINT 'CompanyInfo table created successfully';
END
ELSE
BEGIN
  PRINT 'CompanyInfo table already exists';
END
GO

-- Add lookup categories for company-related fields if they don't exist
IF NOT EXISTS (SELECT 1 FROM [dbo].[LookupCategory] WHERE [Key] = N'ActivityField')
BEGIN
  INSERT INTO [dbo].[LookupCategory]([Key],[Name],[SortOrder]) 
  VALUES (N'ActivityField', N'رسته فعالیت', 100);
  PRINT 'Added ActivityField lookup category';
END

IF NOT EXISTS (SELECT 1 FROM [dbo].[LookupCategory] WHERE [Key] = N'ParentCompany')
BEGIN
  INSERT INTO [dbo].[LookupCategory]([Key],[Name],[SortOrder]) 
  VALUES (N'ParentCompany', N'شرکت پایرو', 101);
  PRINT 'Added ParentCompany lookup category';
END

IF NOT EXISTS (SELECT 1 FROM [dbo].[LookupCategory] WHERE [Key] = N'TonnageRate')
BEGIN
  INSERT INTO [dbo].[LookupCategory]([Key],[Name],[SortOrder]) 
  VALUES (N'TonnageRate', N'نرخ تناژ', 102);
  PRINT 'Added TonnageRate lookup category';
END

IF NOT EXISTS (SELECT 1 FROM [dbo].[LookupCategory] WHERE [Key] = N'TypeOfRegisteredCompany')
BEGIN
  INSERT INTO [dbo].[LookupCategory]([Key],[Name],[SortOrder]) 
  VALUES (N'TypeOfRegisteredCompany', N'نوع شرکت ثبت شده', 103);
  PRINT 'Added TypeOfRegisteredCompany lookup category';
END

PRINT '';
PRINT 'CompanyInfo table setup completed successfully!';
