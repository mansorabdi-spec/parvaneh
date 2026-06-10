USE [parvaneh]
GO

-- =============================================
-- Migration: Update Tariffs Table for Unified License System
-- Purpose: Add LicenseTypeId and OperationTypeId columns to support dynamic tariff calculation
-- Date: 2025-10-16
-- =============================================

PRINT 'Updating Tariffs table for unified license system...'
GO

-- Step 1: Add LicenseTypeId column if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Tariffs]') AND name = 'LicenseTypeId')
BEGIN
    ALTER TABLE [dbo].[Tariffs]
    ADD [LicenseTypeId] INT NULL;
    PRINT '  ✓ Added LicenseTypeId column'
END
ELSE
    PRINT '  - LicenseTypeId column already exists'
GO

-- Step 2: Add OperationTypeId column if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Tariffs]') AND name = 'OperationTypeId')
BEGIN
    ALTER TABLE [dbo].[Tariffs]
    ADD [OperationTypeId] INT NULL;
    PRINT '  ✓ Added OperationTypeId column'
END
ELSE
    PRINT '  - OperationTypeId column already exists'
GO

-- Step 3: Add foreign key constraints
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Tariffs_LicenseType')
BEGIN
    ALTER TABLE [dbo].[Tariffs]
    WITH CHECK ADD CONSTRAINT [FK_Tariffs_LicenseType] FOREIGN KEY([LicenseTypeId])
    REFERENCES [dbo].[LookupValue] ([Id]);
    
    ALTER TABLE [dbo].[Tariffs]
    CHECK CONSTRAINT [FK_Tariffs_LicenseType];
    
    PRINT '  ✓ Added FK_Tariffs_LicenseType constraint'
END
ELSE
    PRINT '  - FK_Tariffs_LicenseType already exists'
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Tariffs_OperationType')
BEGIN
    ALTER TABLE [dbo].[Tariffs]
    WITH CHECK ADD CONSTRAINT [FK_Tariffs_OperationType] FOREIGN KEY([OperationTypeId])
    REFERENCES [dbo].[LookupValue] ([Id]);
    
    ALTER TABLE [dbo].[Tariffs]
    CHECK CONSTRAINT [FK_Tariffs_OperationType];
    
    PRINT '  ✓ Added FK_Tariffs_OperationType constraint'
END
ELSE
    PRINT '  - FK_Tariffs_OperationType already exists'
GO

-- Step 4: Get the IDs for license types and operation types
DECLARE @ActivityLicenseTypeId INT
DECLARE @EmploymentLicenseTypeId INT
DECLARE @IssuanceOperationTypeId INT

SELECT @ActivityLicenseTypeId = Id FROM LookupValue WHERE Name = N'فعالیت' AND CategoryId = (SELECT Id FROM LookupCategory WHERE [Key] = 'LicenseType')
SELECT @EmploymentLicenseTypeId = Id FROM LookupValue WHERE Name = N'اشتغال' AND CategoryId = (SELECT Id FROM LookupCategory WHERE [Key] = 'LicenseType')
SELECT @IssuanceOperationTypeId = Id FROM LookupValue WHERE Name = N'صدور' AND CategoryId = (SELECT Id FROM LookupCategory WHERE [Key] = 'LicenseDocumentType')

PRINT '  📋 License Type IDs:'
PRINT '    Activity (فعالیت): ' + CAST(@ActivityLicenseTypeId AS NVARCHAR(10))
PRINT '    Employment (اشتغال): ' + CAST(@EmploymentLicenseTypeId AS NVARCHAR(10))
PRINT '  📋 Operation Type ID:'
PRINT '    Issuance (صدور): ' + CAST(@IssuanceOperationTypeId AS NVARCHAR(10))
GO

-- Step 5: Update existing tariffs to have LicenseTypeId and OperationTypeId
-- Assuming existing tariffs are for Activity License Issuance
DECLARE @ActivityLicenseTypeId INT
DECLARE @IssuanceOperationTypeId INT

SELECT @ActivityLicenseTypeId = Id FROM LookupValue WHERE Name = N'فعالیت' AND CategoryId = (SELECT Id FROM LookupCategory WHERE [Key] = 'LicenseType')
SELECT @IssuanceOperationTypeId = Id FROM LookupValue WHERE Name = N'صدور' AND CategoryId = (SELECT Id FROM LookupCategory WHERE [Key] = 'LicenseDocumentType')

UPDATE [dbo].[Tariffs]
SET 
    LicenseTypeId = @ActivityLicenseTypeId,
    OperationTypeId = @IssuanceOperationTypeId
WHERE LicenseTypeId IS NULL AND OperationTypeId IS NULL;

PRINT '  ✓ Updated existing tariffs with Activity License + Issuance operation'
GO

-- Step 6: Insert sample Employment License tariffs (if they don't exist)
DECLARE @EmploymentLicenseTypeId INT
DECLARE @IssuanceOperationTypeId INT

SELECT @EmploymentLicenseTypeId = Id FROM LookupValue WHERE Name = N'اشتغال' AND CategoryId = (SELECT Id FROM LookupCategory WHERE [Key] = 'LicenseType')
SELECT @IssuanceOperationTypeId = Id FROM LookupValue WHERE Name = N'صدور' AND CategoryId = (SELECT Id FROM LookupCategory WHERE [Key] = 'LicenseDocumentType')

-- Insert Employment License tariffs for different capacity ranges
IF NOT EXISTS (SELECT * FROM Tariffs WHERE LicenseTypeId = @EmploymentLicenseTypeId AND FromTon = 0 AND ToTon = 5)
BEGIN
    INSERT INTO [dbo].[Tariffs] (LicenseTypeId, OperationTypeId, FromTon, ToTon, Amount, Description)
    VALUES (@EmploymentLicenseTypeId, @IssuanceOperationTypeId, 0, 5, 3430000, N'تعرفه صدور پروانه اشتغال - 0 تا 5 تن');
    PRINT '  ✓ Inserted Employment tariff: 0-5 tons'
END

IF NOT EXISTS (SELECT * FROM Tariffs WHERE LicenseTypeId = @EmploymentLicenseTypeId AND FromTon = 5 AND ToTon = 10)
BEGIN
    INSERT INTO [dbo].[Tariffs] (LicenseTypeId, OperationTypeId, FromTon, ToTon, Amount, Description)
    VALUES (@EmploymentLicenseTypeId, @IssuanceOperationTypeId, 5, 10, 4500000, N'تعرفه صدور پروانه اشتغال - 5 تا 10 تن');
    PRINT '  ✓ Inserted Employment tariff: 5-10 tons'
END

IF NOT EXISTS (SELECT * FROM Tariffs WHERE LicenseTypeId = @EmploymentLicenseTypeId AND FromTon = 10 AND ToTon = 20)
BEGIN
    INSERT INTO [dbo].[Tariffs] (LicenseTypeId, OperationTypeId, FromTon, ToTon, Amount, Description)
    VALUES (@EmploymentLicenseTypeId, @IssuanceOperationTypeId, 10, 20, 6200000, N'تعرفه صدور پروانه اشتغال - 10 تا 20 تن');
    PRINT '  ✓ Inserted Employment tariff: 10-20 tons'
END

IF NOT EXISTS (SELECT * FROM Tariffs WHERE LicenseTypeId = @EmploymentLicenseTypeId AND FromTon = 20 AND ToTon = 999)
BEGIN
    INSERT INTO [dbo].[Tariffs] (LicenseTypeId, OperationTypeId, FromTon, ToTon, Amount, Description)
    VALUES (@EmploymentLicenseTypeId, @IssuanceOperationTypeId, 20, 999, 8500000, N'تعرفه صدور پروانه اشتغال - بیش از 20 تن');
    PRINT '  ✓ Inserted Employment tariff: 20+ tons'
END
GO

PRINT '✅ Migration completed successfully!'
PRINT 'Tariffs table now supports unified license system with LicenseTypeId and OperationTypeId'
GO
