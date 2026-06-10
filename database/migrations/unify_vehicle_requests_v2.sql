USE [parvaneh]
GO

-- =============================================
-- Migration: Unify VehicleRequests for All License Types (V2 - Idempotent)
-- Purpose: Support Activity, Employment, and Exploitation licenses
-- Date: 2025-10-15
-- =============================================

PRINT '========================================='
PRINT 'Starting migration: Unifying VehicleRequests table'
PRINT '========================================='
GO

-- Step 1: Add new columns if they don't exist
PRINT 'Step 1: Adding new columns (if not exists)...'
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.VehicleRequests') AND name = 'LicenseTypeId')
BEGIN
    ALTER TABLE [dbo].[VehicleRequests] ADD [LicenseTypeId] [int] NULL;
    PRINT '  ✓ Added LicenseTypeId column'
END
ELSE
    PRINT '  - LicenseTypeId column already exists'
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.VehicleRequests') AND name = 'OperationTypeId')
BEGIN
    ALTER TABLE [dbo].[VehicleRequests] ADD [OperationTypeId] [int] NULL;
    PRINT '  ✓ Added OperationTypeId column'
END
ELSE
    PRINT '  - OperationTypeId column already exists'
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.VehicleRequests') AND name = 'NationalCode')
BEGIN
    ALTER TABLE [dbo].[VehicleRequests] ADD [NationalCode] [nvarchar](20) NULL;
    PRINT '  ✓ Added NationalCode column'
END
ELSE
    PRINT '  - NationalCode column already exists'
GO

-- Step 2: Make VehicleID nullable
PRINT 'Step 2: Making VehicleID nullable...'
GO

-- Check if VehicleID is already nullable
IF EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('dbo.VehicleRequests') 
    AND name = 'VehicleID' 
    AND is_nullable = 0
)
BEGIN
    -- Drop existing foreign key constraint
    DECLARE @ConstraintName NVARCHAR(200);
    SELECT @ConstraintName = name
    FROM sys.foreign_keys
    WHERE parent_object_id = OBJECT_ID('dbo.VehicleRequests')
    AND referenced_object_id = OBJECT_ID('dbo.Vehicles');

    IF @ConstraintName IS NOT NULL
    BEGIN
        DECLARE @SQL NVARCHAR(500) = 'ALTER TABLE [dbo].[VehicleRequests] DROP CONSTRAINT [' + @ConstraintName + ']';
        EXEC sp_executesql @SQL;
        PRINT '  ✓ Dropped constraint: ' + @ConstraintName;
    END

    -- Alter VehicleID to allow NULL
    ALTER TABLE [dbo].[VehicleRequests] ALTER COLUMN [VehicleID] [bigint] NULL;
    PRINT '  ✓ VehicleID is now nullable'

    -- Re-add foreign key constraint
    IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_VehicleRequests_Vehicle')
    BEGIN
        ALTER TABLE [dbo].[VehicleRequests]
        WITH CHECK ADD CONSTRAINT [FK_VehicleRequests_Vehicle] FOREIGN KEY([VehicleID])
        REFERENCES [dbo].[Vehicles] ([VehicleID]);
        
        ALTER TABLE [dbo].[VehicleRequests] CHECK CONSTRAINT [FK_VehicleRequests_Vehicle];
        PRINT '  ✓ Re-added FK_VehicleRequests_Vehicle constraint'
    END
END
ELSE
    PRINT '  - VehicleID is already nullable'
GO

-- Step 3: Update existing records with default values
PRINT 'Step 3: Updating existing records with default license type...'
GO

-- Get the ID for "فعالیت" (Activity) license type from LicenseType category
DECLARE @ActivityLicenseTypeId INT;
DECLARE @LicenseTypeCategoryId INT;
DECLARE @OperationTypeCategoryId INT;

SELECT @LicenseTypeCategoryId = Id FROM LookupCategory WHERE [Key] = 'LicenseType';
SELECT @OperationTypeCategoryId = Id FROM LookupCategory WHERE [Key] = 'LicenseDocumentType';

SELECT @ActivityLicenseTypeId = Id 
FROM LookupValue 
WHERE Name = N'فعالیت' 
  AND CategoryId = @LicenseTypeCategoryId;

-- Get the ID for "صدور" (Issuance) operation type from LicenseDocumentType category
DECLARE @IssuanceOperationTypeId INT;
SELECT @IssuanceOperationTypeId = Id 
FROM LookupValue 
WHERE Name = N'صدور'
  AND CategoryId = @OperationTypeCategoryId;

PRINT '  LicenseType Category ID: ' + ISNULL(CAST(@LicenseTypeCategoryId AS NVARCHAR), 'NULL');
PRINT '  OperationType Category ID: ' + ISNULL(CAST(@OperationTypeCategoryId AS NVARCHAR), 'NULL');
PRINT '  Activity License Type ID: ' + ISNULL(CAST(@ActivityLicenseTypeId AS NVARCHAR), 'NULL');
PRINT '  Issuance Operation Type ID: ' + ISNULL(CAST(@IssuanceOperationTypeId AS NVARCHAR), 'NULL');

-- If specific values not found, use first available from respective categories
IF @ActivityLicenseTypeId IS NULL
BEGIN
    SELECT TOP 1 @ActivityLicenseTypeId = Id 
    FROM LookupValue 
    WHERE CategoryId = @LicenseTypeCategoryId 
    ORDER BY Id;
    PRINT '  Using fallback Activity License Type ID: ' + ISNULL(CAST(@ActivityLicenseTypeId AS NVARCHAR), 'NULL');
END

IF @IssuanceOperationTypeId IS NULL
BEGIN
    SELECT TOP 1 @IssuanceOperationTypeId = Id 
    FROM LookupValue 
    WHERE CategoryId = @OperationTypeCategoryId 
    ORDER BY Id;
    PRINT '  Using fallback Issuance Operation Type ID: ' + ISNULL(CAST(@IssuanceOperationTypeId AS NVARCHAR), 'NULL');
END

-- Update records that don't have license type set
DECLARE @UpdatedCount INT;
UPDATE [dbo].[VehicleRequests]
SET 
    [LicenseTypeId] = @ActivityLicenseTypeId,
    [OperationTypeId] = @IssuanceOperationTypeId
WHERE [LicenseTypeId] IS NULL OR [OperationTypeId] IS NULL;

SET @UpdatedCount = @@ROWCOUNT;
PRINT '  ✓ Updated ' + CAST(@UpdatedCount AS NVARCHAR) + ' existing records'
GO

-- Step 4: Make new columns NOT NULL (drop indexes first if they exist)
PRINT 'Step 4: Making new columns NOT NULL...'
GO

-- Check and alter LicenseTypeId
IF EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('dbo.VehicleRequests') 
    AND name = 'LicenseTypeId' 
    AND is_nullable = 1
)
BEGIN
    -- Drop dependent indexes temporarily
    IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_VehicleRequests_LicenseType' AND object_id = OBJECT_ID('dbo.VehicleRequests'))
        DROP INDEX [IX_VehicleRequests_LicenseType] ON [dbo].[VehicleRequests];
    
    IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_VehicleRequests_TrackingNo' AND object_id = OBJECT_ID('dbo.VehicleRequests'))
        DROP INDEX [IX_VehicleRequests_TrackingNo] ON [dbo].[VehicleRequests];
    
    ALTER TABLE [dbo].[VehicleRequests] ALTER COLUMN [LicenseTypeId] [int] NOT NULL;
    PRINT '  ✓ LicenseTypeId is now NOT NULL'
END
ELSE
    PRINT '  - LicenseTypeId is already NOT NULL'
GO

-- Check and alter OperationTypeId
IF EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('dbo.VehicleRequests') 
    AND name = 'OperationTypeId' 
    AND is_nullable = 1
)
BEGIN
    -- Drop dependent indexes temporarily if not already dropped
    IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_VehicleRequests_OperationType' AND object_id = OBJECT_ID('dbo.VehicleRequests'))
        DROP INDEX [IX_VehicleRequests_OperationType] ON [dbo].[VehicleRequests];
    
    IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_VehicleRequests_TrackingNo' AND object_id = OBJECT_ID('dbo.VehicleRequests'))
        DROP INDEX [IX_VehicleRequests_TrackingNo] ON [dbo].[VehicleRequests];
    
    ALTER TABLE [dbo].[VehicleRequests] ALTER COLUMN [OperationTypeId] [int] NOT NULL;
    PRINT '  ✓ OperationTypeId is now NOT NULL'
END
ELSE
    PRINT '  - OperationTypeId is already NOT NULL'
GO

-- Step 5: Add foreign key constraints
PRINT 'Step 5: Adding foreign key constraints...'
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_VehicleRequests_LicenseType')
BEGIN
    ALTER TABLE [dbo].[VehicleRequests]
    WITH CHECK ADD CONSTRAINT [FK_VehicleRequests_LicenseType] FOREIGN KEY([LicenseTypeId])
    REFERENCES [dbo].[LookupValue] ([Id]);
    
    ALTER TABLE [dbo].[VehicleRequests] CHECK CONSTRAINT [FK_VehicleRequests_LicenseType];
    PRINT '  ✓ Added FK_VehicleRequests_LicenseType'
END
ELSE
    PRINT '  - FK_VehicleRequests_LicenseType already exists'
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_VehicleRequests_OperationType')
BEGIN
    ALTER TABLE [dbo].[VehicleRequests]
    WITH CHECK ADD CONSTRAINT [FK_VehicleRequests_OperationType] FOREIGN KEY([OperationTypeId])
    REFERENCES [dbo].[LookupValue] ([Id]);
    
    ALTER TABLE [dbo].[VehicleRequests] CHECK CONSTRAINT [FK_VehicleRequests_OperationType];
    PRINT '  ✓ Added FK_VehicleRequests_OperationType'
END
ELSE
    PRINT '  - FK_VehicleRequests_OperationType already exists'
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_VehicleRequests_Person')
BEGIN
    ALTER TABLE [dbo].[VehicleRequests]
    WITH CHECK ADD CONSTRAINT [FK_VehicleRequests_Person] FOREIGN KEY([NationalCode])
    REFERENCES [dbo].[Persons] ([NationalCode]);
    
    ALTER TABLE [dbo].[VehicleRequests] CHECK CONSTRAINT [FK_VehicleRequests_Person];
    PRINT '  ✓ Added FK_VehicleRequests_Person'
END
ELSE
    PRINT '  - FK_VehicleRequests_Person already exists'
GO

-- Step 6: Add check constraint
PRINT 'Step 6: Adding business logic constraints...'
GO

IF NOT EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_VehicleRequests_VehicleOrPerson')
BEGIN
    ALTER TABLE [dbo].[VehicleRequests]
    ADD CONSTRAINT [CK_VehicleRequests_VehicleOrPerson] 
    CHECK (([VehicleID] IS NOT NULL) OR ([NationalCode] IS NOT NULL));
    PRINT '  ✓ Added CK_VehicleRequests_VehicleOrPerson'
END
ELSE
    PRINT '  - CK_VehicleRequests_VehicleOrPerson already exists'
GO

-- Step 7: Create indexes
PRINT 'Step 7: Creating indexes for performance...'
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_VehicleRequests_LicenseType')
BEGIN
    CREATE NONCLUSTERED INDEX [IX_VehicleRequests_LicenseType]
    ON [dbo].[VehicleRequests] ([LicenseTypeId])
    INCLUDE ([Status], [CreatedAt]);
    PRINT '  ✓ Created IX_VehicleRequests_LicenseType'
END
ELSE
    PRINT '  - IX_VehicleRequests_LicenseType already exists'
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_VehicleRequests_OperationType')
BEGIN
    CREATE NONCLUSTERED INDEX [IX_VehicleRequests_OperationType]
    ON [dbo].[VehicleRequests] ([OperationTypeId])
    INCLUDE ([Status], [CreatedAt]);
    PRINT '  ✓ Created IX_VehicleRequests_OperationType'
END
ELSE
    PRINT '  - IX_VehicleRequests_OperationType already exists'
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_VehicleRequests_NationalCode')
BEGIN
    CREATE NONCLUSTERED INDEX [IX_VehicleRequests_NationalCode]
    ON [dbo].[VehicleRequests] ([NationalCode])
    WHERE [NationalCode] IS NOT NULL;
    PRINT '  ✓ Created IX_VehicleRequests_NationalCode'
END
ELSE
    PRINT '  - IX_VehicleRequests_NationalCode already exists'
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_VehicleRequests_TrackingNo')
BEGIN
    CREATE NONCLUSTERED INDEX [IX_VehicleRequests_TrackingNo]
    ON [dbo].[VehicleRequests] ([TrackingNo])
    INCLUDE ([Status], [LicenseTypeId], [OperationTypeId]);
    PRINT '  ✓ Created IX_VehicleRequests_TrackingNo'
END
ELSE
    PRINT '  - IX_VehicleRequests_TrackingNo already exists'
GO

-- Step 8: Create or replace unified view
PRINT 'Step 8: Creating unified requests view...'
GO

IF OBJECT_ID('dbo.vw_UnifiedRequests', 'V') IS NOT NULL
    DROP VIEW [dbo].[vw_UnifiedRequests];
GO

CREATE VIEW [dbo].[vw_UnifiedRequests]
AS
SELECT 
    r.RequestID,
    r.TrackingNo,
    r.Status,
    r.CreatedAt,
    r.CompletedAt,
    r.VehicleID,
    r.NationalCode,
    
    -- License Type Info
    r.LicenseTypeId,
    lt.Name AS LicenseTypeName,
    lt.Code AS LicenseTypeCode,
    
    -- Operation Type Info
    r.OperationTypeId,
    ot.Name AS OperationTypeName,
    ot.Code AS OperationTypeCode,
    
    -- Person Info (for employment/exploitation)
    p.FirstName,
    p.LastName,
    p.FatherName,
    CONCAT(p.FirstName, ' ', p.LastName) AS PersonFullName,
    
    -- Vehicle Info (for activity)
    v.VIN,
    v.ChassisNo,
    v.EngineNo,
    
    -- Financial Info
    r.OriginalAmount,
    r.DiscountAmount,
    r.FinalAmount,
    r.DiscountStatus,
    
    -- Workflow Info
    r.CurrentStepOrder,
    r.HasDeficiency,
    r.DeficiencySenderStepOrder,
    
    -- User Info
    r.SubmittedByUserId,
    u.FullName AS SubmittedByUserName
    
FROM [dbo].[VehicleRequests] r
LEFT JOIN [dbo].[LookupValue] lt ON lt.Id = r.LicenseTypeId
LEFT JOIN [dbo].[LookupValue] ot ON ot.Id = r.OperationTypeId
LEFT JOIN [dbo].[Persons] p ON p.NationalCode = r.NationalCode
LEFT JOIN [dbo].[Vehicles] v ON v.VehicleID = r.VehicleID
LEFT JOIN [dbo].[Users] u ON u.Id = r.SubmittedByUserId;
GO

PRINT '  ✓ Created vw_UnifiedRequests view'
GO

PRINT '========================================='
PRINT '✅ Migration completed successfully!'
PRINT '========================================='
PRINT 'VehicleRequests table now supports unified license management:'
PRINT '  - Activity licenses (پروانه فعالیت)'
PRINT '  - Employment licenses (پروانه اشتغال)'
PRINT '  - Exploitation licenses (پروانه بهره برداری)'
PRINT ''
PRINT 'New columns added:'
PRINT '  - LicenseTypeId: Type of license'
PRINT '  - OperationTypeId: Operation being performed'
PRINT '  - NationalCode: For person-based licenses'
PRINT ''
PRINT 'View created: vw_UnifiedRequests for easy querying'
PRINT '========================================='
GO

-- Verification query
PRINT 'Verification: Checking table structure...'
GO

SELECT 
    'VehicleRequests' AS TableName,
    COUNT(*) AS TotalRecords,
    SUM(CASE WHEN LicenseTypeId IS NOT NULL THEN 1 ELSE 0 END) AS WithLicenseType,
    SUM(CASE WHEN OperationTypeId IS NOT NULL THEN 1 ELSE 0 END) AS WithOperationType,
    SUM(CASE WHEN VehicleID IS NOT NULL THEN 1 ELSE 0 END) AS WithVehicle,
    SUM(CASE WHEN NationalCode IS NOT NULL THEN 1 ELSE 0 END) AS WithNationalCode
FROM VehicleRequests;
GO
