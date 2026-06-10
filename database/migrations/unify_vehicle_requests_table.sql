USE [parvaneh]
GO

-- =============================================
-- Migration: Unify VehicleRequests for All License Types
-- Purpose: Support Activity, Employment, and Exploitation licenses
-- Date: 2025-10-15
-- =============================================

PRINT 'Starting migration: Unifying VehicleRequests table for all license types...'
GO

-- Step 1: Add new columns for license type and operation
PRINT 'Step 1: Adding new columns...'
GO

-- Add LicenseType column (references LookupValue for license types: اشتغال, فعالیت, بهره برداری)
ALTER TABLE [dbo].[VehicleRequests]
ADD [LicenseTypeId] [int] NULL;
GO

-- Add OperationType column (references LookupValue for operations: صدور, تمدید, اصلاح, etc.)
ALTER TABLE [dbo].[VehicleRequests]
ADD [OperationTypeId] [int] NULL;
GO

-- Add NationalCode for employment/exploitation licenses (person-based licenses)
ALTER TABLE [dbo].[VehicleRequests]
ADD [NationalCode] [nvarchar](20) NULL;
GO

-- Step 2: Make VehicleID nullable (not all licenses need a vehicle)
PRINT 'Step 2: Making VehicleID nullable for non-vehicle licenses...'
GO

-- Drop existing foreign key constraint (find actual constraint name)
DECLARE @ConstraintName NVARCHAR(200);
SELECT @ConstraintName = name
FROM sys.foreign_keys
WHERE parent_object_id = OBJECT_ID('dbo.VehicleRequests')
AND referenced_object_id = OBJECT_ID('dbo.Vehicles');

IF @ConstraintName IS NOT NULL
BEGIN
    DECLARE @SQL NVARCHAR(500) = 'ALTER TABLE [dbo].[VehicleRequests] DROP CONSTRAINT [' + @ConstraintName + ']';
    EXEC sp_executesql @SQL;
    PRINT 'Dropped constraint: ' + @ConstraintName;
END
GO

-- Alter VehicleID to allow NULL
ALTER TABLE [dbo].[VehicleRequests]
ALTER COLUMN [VehicleID] [bigint] NULL;
GO

-- Re-add foreign key constraint
ALTER TABLE [dbo].[VehicleRequests]
WITH CHECK ADD CONSTRAINT [FK_VehicleRequests_Vehicle] FOREIGN KEY([VehicleID])
REFERENCES [dbo].[Vehicles] ([VehicleID]);
GO

ALTER TABLE [dbo].[VehicleRequests]
CHECK CONSTRAINT [FK_VehicleRequests_Vehicle];
GO

-- Step 3: Update existing records to set default license type (Activity)
PRINT 'Step 3: Updating existing records with default license type...'
GO

-- Get the ID for "فعالیت" (Activity) license type from LookupValue
DECLARE @ActivityLicenseTypeId INT;
SELECT @ActivityLicenseTypeId = Id 
FROM LookupValue 
WHERE Name = N'فعالیت' AND CategoryId = (SELECT Id FROM LookupCategory WHERE CategoryName = 'LicenseDocumentType');

-- Get the ID for "صدور" (Issuance) operation type from LookupValue
DECLARE @IssuanceOperationTypeId INT;
SELECT @IssuanceOperationTypeId = Id 
FROM LookupValue 
WHERE Name = N'صدور' AND CategoryId = (SELECT Id FROM LookupCategory WHERE CategoryName = 'LicenseDocumentType');

-- Debug: Print the IDs found
PRINT 'Activity License Type ID: ' + ISNULL(CAST(@ActivityLicenseTypeId AS NVARCHAR), 'NULL');
PRINT 'Issuance Operation Type ID: ' + ISNULL(CAST(@IssuanceOperationTypeId AS NVARCHAR), 'NULL');

-- If IDs not found, use a fallback approach (get first available values)
IF @ActivityLicenseTypeId IS NULL
BEGIN
    SELECT TOP 1 @ActivityLicenseTypeId = Id FROM LookupValue WHERE CategoryId = (SELECT Id FROM LookupCategory WHERE CategoryName = 'LicenseDocumentType');
    PRINT 'Using fallback Activity License Type ID: ' + CAST(@ActivityLicenseTypeId AS NVARCHAR);
END

IF @IssuanceOperationTypeId IS NULL
BEGIN
    SELECT TOP 1 @IssuanceOperationTypeId = Id FROM LookupValue WHERE CategoryId = (SELECT Id FROM LookupCategory WHERE CategoryName = 'LicenseDocumentType');
    PRINT 'Using fallback Issuance Operation Type ID: ' + CAST(@IssuanceOperationTypeId AS NVARCHAR);
END

-- Update all existing records
UPDATE [dbo].[VehicleRequests]
SET 
    [LicenseTypeId] = @ActivityLicenseTypeId,
    [OperationTypeId] = @IssuanceOperationTypeId
WHERE [LicenseTypeId] IS NULL;
GO

-- Step 4: Make new columns NOT NULL after populating data
PRINT 'Step 4: Making new columns NOT NULL...'
GO

ALTER TABLE [dbo].[VehicleRequests]
ALTER COLUMN [LicenseTypeId] [int] NOT NULL;
GO

ALTER TABLE [dbo].[VehicleRequests]
ALTER COLUMN [OperationTypeId] [int] NOT NULL;
GO

-- Step 5: Add foreign key constraints
PRINT 'Step 5: Adding foreign key constraints...'
GO

-- Foreign key to LookupValue for LicenseType
ALTER TABLE [dbo].[VehicleRequests]
WITH CHECK ADD CONSTRAINT [FK_VehicleRequests_LicenseType] FOREIGN KEY([LicenseTypeId])
REFERENCES [dbo].[LookupValue] ([Id]);
GO

ALTER TABLE [dbo].[VehicleRequests]
CHECK CONSTRAINT [FK_VehicleRequests_LicenseType];
GO

-- Foreign key to LookupValue for OperationType
ALTER TABLE [dbo].[VehicleRequests]
WITH CHECK ADD CONSTRAINT [FK_VehicleRequests_OperationType] FOREIGN KEY([OperationTypeId])
REFERENCES [dbo].[LookupValue] ([Id]);
GO

ALTER TABLE [dbo].[VehicleRequests]
CHECK CONSTRAINT [FK_VehicleRequests_OperationType];
GO

-- Foreign key to Persons for NationalCode (for employment/exploitation licenses)
ALTER TABLE [dbo].[VehicleRequests]
WITH CHECK ADD CONSTRAINT [FK_VehicleRequests_Person] FOREIGN KEY([NationalCode])
REFERENCES [dbo].[Persons] ([NationalCode]);
GO

ALTER TABLE [dbo].[VehicleRequests]
CHECK CONSTRAINT [FK_VehicleRequests_Person];
GO

-- Step 6: Add check constraint to ensure either VehicleID or NationalCode is provided
PRINT 'Step 6: Adding business logic constraints...'
GO

ALTER TABLE [dbo].[VehicleRequests]
ADD CONSTRAINT [CK_VehicleRequests_VehicleOrPerson] 
CHECK (([VehicleID] IS NOT NULL) OR ([NationalCode] IS NOT NULL));
GO

-- Step 7: Create indexes for performance
PRINT 'Step 7: Creating indexes for performance...'
GO

CREATE NONCLUSTERED INDEX [IX_VehicleRequests_LicenseType]
ON [dbo].[VehicleRequests] ([LicenseTypeId])
INCLUDE ([Status], [CreatedAt]);
GO

CREATE NONCLUSTERED INDEX [IX_VehicleRequests_OperationType]
ON [dbo].[VehicleRequests] ([OperationTypeId])
INCLUDE ([Status], [CreatedAt]);
GO

CREATE NONCLUSTERED INDEX [IX_VehicleRequests_NationalCode]
ON [dbo].[VehicleRequests] ([NationalCode])
WHERE [NationalCode] IS NOT NULL;
GO

CREATE NONCLUSTERED INDEX [IX_VehicleRequests_TrackingNo]
ON [dbo].[VehicleRequests] ([TrackingNo])
INCLUDE ([Status], [LicenseTypeId], [OperationTypeId]);
GO

-- Step 8: Add helpful view for unified requests
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
    
    -- Operation Type Info
    r.OperationTypeId,
    ot.Name AS OperationTypeName,
    
    -- Person Info (for employment/exploitation)
    p.FirstName,
    p.LastName,
    p.FatherName,
    
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

PRINT '✅ Migration completed successfully!'
PRINT 'VehicleRequests table now supports unified license management:'
PRINT '  - Activity licenses (پروانه فعالیت)'
PRINT '  - Employment licenses (پروانه اشتغال)'
PRINT '  - Exploitation licenses (پروانه بهره برداری)'
PRINT ''
PRINT 'New columns added:'
PRINT '  - LicenseTypeId: Type of license'
PRINT '  - OperationTypeId: Operation being performed (صدور, تمدید, etc.)'
PRINT '  - NationalCode: For person-based licenses'
PRINT ''
PRINT 'View created: vw_UnifiedRequests for easy querying'
GO
