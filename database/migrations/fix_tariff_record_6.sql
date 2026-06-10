USE [parvaneh]
GO

-- =============================================
-- Fix Tariff Record #6 - Add LicenseTypeId and OperationTypeId
-- Purpose: Update existing tariff record to include proper license and operation type IDs
-- Date: 2025-10-16
-- =============================================

PRINT 'Fixing Tariff Record #6...'
GO

-- Get the IDs for Employment License and Issuance Operation
DECLARE @EmploymentLicenseTypeId INT
DECLARE @IssuanceOperationTypeId INT

SELECT @EmploymentLicenseTypeId = Id 
FROM LookupValue 
WHERE Name = N'اشتغال' 
  AND CategoryId = (SELECT Id FROM LookupCategory WHERE [Key] = 'LicenseType')

SELECT @IssuanceOperationTypeId = Id 
FROM LookupValue 
WHERE Name = N'صدور' 
  AND CategoryId = (SELECT Id FROM LookupCategory WHERE [Key] = 'LicenseDocumentType')

PRINT '  📋 Found IDs:'
PRINT '    Employment License Type ID: ' + CAST(ISNULL(@EmploymentLicenseTypeId, -1) AS NVARCHAR(10))
PRINT '    Issuance Operation Type ID: ' + CAST(ISNULL(@IssuanceOperationTypeId, -1) AS NVARCHAR(10))

-- Check if the tariff record exists
IF EXISTS (SELECT * FROM Tariffs WHERE Id = 6)
BEGIN
    PRINT '  ✓ Tariff record #6 found'
    
    -- Show current values
    SELECT 
        '  Current values:' as Info,
        Id, 
        LicenseType, 
        DocTypeId, 
        FromTon,
        ToTon,
        Amount
    FROM Tariffs 
    WHERE Id = 6
    
    -- Check if LicenseTypeId column exists
    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Tariffs]') AND name = 'LicenseTypeId')
    BEGIN
        -- Update the record with new columns
        UPDATE Tariffs
        SET 
            LicenseTypeId = @EmploymentLicenseTypeId,
            OperationTypeId = @IssuanceOperationTypeId
        WHERE Id = 6
        
        PRINT '  ✅ Updated tariff record #6 with LicenseTypeId and OperationTypeId'
        
        -- Show updated values
        SELECT 
            '  Updated values:' as Info,
            Id, 
            LicenseType, 
            DocTypeId, 
            LicenseTypeId, 
            OperationTypeId,
            FromTon,
            ToTon,
            Amount
        FROM Tariffs 
        WHERE Id = 6
    END
    ELSE
    BEGIN
        PRINT '  ⚠️ LicenseTypeId and OperationTypeId columns do not exist in Tariffs table!'
        PRINT '  ⚠️ Please run the migration script: update_tariffs_table_for_unified_system.sql first'
    END
END
ELSE
BEGIN
    PRINT '  ⚠️ Tariff record #6 not found!'
END
GO

PRINT '✅ Fix completed!'
GO
