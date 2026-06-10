USE [parvaneh]
GO

-- Check LookupCategory columns
PRINT '=== LookupCategory Columns ==='
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'LookupCategory'
ORDER BY ORDINAL_POSITION
GO

-- Check Tariffs columns
PRINT ''
PRINT '=== Tariffs Columns ==='
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Tariffs'
ORDER BY ORDINAL_POSITION
GO

-- Check if LicenseTypeId and OperationTypeId exist in Tariffs
PRINT ''
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Tariffs]') AND name = 'LicenseTypeId')
    PRINT '✓ LicenseTypeId column EXISTS in Tariffs'
ELSE
    PRINT '✗ LicenseTypeId column DOES NOT EXIST in Tariffs'

IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Tariffs]') AND name = 'OperationTypeId')
    PRINT '✓ OperationTypeId column EXISTS in Tariffs'
ELSE
    PRINT '✗ OperationTypeId column DOES NOT EXIST in Tariffs'
GO

-- Show sample data from Tariff record #6
PRINT ''
PRINT '=== Tariff Record #6 ==='
SELECT * FROM Tariffs WHERE Id = 6
GO
