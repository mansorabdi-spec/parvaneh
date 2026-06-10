-- Migration: Fix incorrect Shamsi dates in LicenseHistory table
-- Purpose: Convert incorrectly stored Gregorian dates to proper Shamsi dates
-- Date: 2025-12-24
-- Issue: Old records have dates like '1404/12/24' which are actually Gregorian dates (YYYY/MM/DD)
--        instead of proper Shamsi dates like '1404/10/03'

USE [parvaneh2]
GO

PRINT '========================================='
PRINT 'Starting LicenseHistory Shamsi Date Fix'
PRINT '========================================='
GO

-- Create a function to convert Gregorian date to Shamsi date
IF OBJECT_ID('dbo.fn_GregorianToShamsi', 'FN') IS NOT NULL
    DROP FUNCTION dbo.fn_GregorianToShamsi
GO

CREATE FUNCTION dbo.fn_GregorianToShamsi(@gregorianDate DATETIME2)
RETURNS NVARCHAR(10)
AS
BEGIN
    DECLARE @gYear INT = YEAR(@gregorianDate)
    DECLARE @gMonth INT = MONTH(@gregorianDate)
    DECLARE @gDay INT = DAY(@gregorianDate)
    
    DECLARE @jYear INT, @jMonth INT, @jDay INT
    DECLARE @gy INT, @gm INT, @gd INT
    DECLARE @gDayNo INT, @jDayNo INT, @jNp INT
    
    SET @gy = @gYear - 1600
    SET @gm = @gMonth - 1
    SET @gd = @gDay - 1
    
    SET @gDayNo = 365 * @gy + FLOOR((@gy + 3) / 4.0) - FLOOR((@gy + 99) / 100.0) + FLOOR((@gy + 399) / 400.0)
    
    -- Add days for months
    DECLARE @monthDays TABLE (MonthIndex INT, Days INT)
    INSERT INTO @monthDays VALUES (0, 31), (1, 28), (2, 31), (3, 30), (4, 31), (5, 30), 
                                   (6, 31), (7, 31), (8, 30), (9, 31), (10, 30), (11, 31)
    
    DECLARE @i INT = 0
    WHILE @i < @gm
    BEGIN
        SET @gDayNo = @gDayNo + (SELECT Days FROM @monthDays WHERE MonthIndex = @i)
        SET @i = @i + 1
    END
    
    -- Leap year adjustment
    IF @gm > 1 AND ((@gy % 4 = 0 AND @gy % 100 != 0) OR (@gy % 400 = 0))
        SET @gDayNo = @gDayNo + 1
    
    SET @gDayNo = @gDayNo + @gd
    SET @jDayNo = @gDayNo - 79
    
    SET @jNp = FLOOR(@jDayNo / 12053.0)
    SET @jDayNo = @jDayNo % 12053
    
    SET @jYear = 979 + 33 * @jNp + 4 * FLOOR(@jDayNo / 1461.0)
    SET @jDayNo = @jDayNo % 1461
    
    IF @jDayNo >= 366
    BEGIN
        SET @jYear = @jYear + FLOOR((@jDayNo - 1) / 365.0)
        SET @jDayNo = (@jDayNo - 1) % 365
    END
    
    IF @jDayNo < 186
    BEGIN
        SET @jMonth = 1 + FLOOR(@jDayNo / 31.0)
        SET @jDay = 1 + (@jDayNo % 31)
    END
    ELSE
    BEGIN
        SET @jMonth = 7 + FLOOR((@jDayNo - 186) / 30.0)
        SET @jDay = 1 + ((@jDayNo - 186) % 30)
    END
    
    RETURN CAST(@jYear AS NVARCHAR(4)) + '/' + 
           RIGHT('0' + CAST(@jMonth AS NVARCHAR(2)), 2) + '/' + 
           RIGHT('0' + CAST(@jDay AS NVARCHAR(2)), 2)
END
GO

PRINT 'Function fn_GregorianToShamsi created successfully'
GO

-- Create a function to add one year to Shamsi date
IF OBJECT_ID('dbo.fn_AddOneYearShamsi', 'FN') IS NOT NULL
    DROP FUNCTION dbo.fn_AddOneYearShamsi
GO

CREATE FUNCTION dbo.fn_AddOneYearShamsi(@shamsiDate NVARCHAR(10))
RETURNS NVARCHAR(10)
AS
BEGIN
    DECLARE @year INT, @month NVARCHAR(2), @day NVARCHAR(2)
    
    SET @year = CAST(LEFT(@shamsiDate, 4) AS INT)
    SET @month = SUBSTRING(@shamsiDate, 6, 2)
    SET @day = RIGHT(@shamsiDate, 2)
    
    SET @year = @year + 1
    
    RETURN CAST(@year AS NVARCHAR(4)) + '/' + @month + '/' + @day
END
GO

PRINT 'Function fn_AddOneYearShamsi created successfully'
GO

-- Show records that will be updated (for verification)
PRINT ''
PRINT 'Records with incorrect Shamsi dates (will be fixed):'
PRINT '----------------------------------------------------'

SELECT 
    HistoryID,
    TrackingNo,
    IssueDate AS CurrentIssueDate,
    ExpiryDate AS CurrentExpiryDate,
    dbo.fn_GregorianToShamsi(CreatedAt) AS CorrectIssueDate,
    dbo.fn_AddOneYearShamsi(dbo.fn_GregorianToShamsi(CreatedAt)) AS CorrectExpiryDate,
    CreatedAt
FROM LicenseHistory
WHERE 
    -- Identify records where the date looks suspicious
    -- Shamsi month should typically be between 01-12, and day patterns differ from Gregorian
    (
        -- Check if IssueDate month is > 12 (impossible in Shamsi calendar)
        CAST(SUBSTRING(IssueDate, 6, 2) AS INT) > 12
        OR
        -- Check if the date matches the CreatedAt date pattern (YYYY/MM/DD from Gregorian)
        (
            SUBSTRING(IssueDate, 6, 2) = RIGHT('0' + CAST(MONTH(CreatedAt) AS VARCHAR(2)), 2)
            AND SUBSTRING(IssueDate, 9, 2) = RIGHT('0' + CAST(DAY(CreatedAt) AS VARCHAR(2)), 2)
        )
    )
ORDER BY HistoryID

DECLARE @recordCount INT
SELECT @recordCount = COUNT(*)
FROM LicenseHistory
WHERE 
    (
        CAST(SUBSTRING(IssueDate, 6, 2) AS INT) > 12
        OR
        (
            SUBSTRING(IssueDate, 6, 2) = RIGHT('0' + CAST(MONTH(CreatedAt) AS VARCHAR(2)), 2)
            AND SUBSTRING(IssueDate, 9, 2) = RIGHT('0' + CAST(DAY(CreatedAt) AS VARCHAR(2)), 2)
        )
    )

PRINT ''
PRINT 'Total records to be fixed: ' + CAST(@recordCount AS NVARCHAR(10))
PRINT ''
GO

-- Backup the data before making changes
IF OBJECT_ID('dbo.LicenseHistory_Backup_20251224', 'U') IS NOT NULL
    DROP TABLE dbo.LicenseHistory_Backup_20251224
GO

SELECT * 
INTO dbo.LicenseHistory_Backup_20251224
FROM dbo.LicenseHistory
GO

PRINT 'Backup table LicenseHistory_Backup_20251224 created successfully'
PRINT ''
GO

-- Update the incorrect records
BEGIN TRANSACTION

DECLARE @updatedCount INT = 0

UPDATE LicenseHistory
SET 
    IssueDate = dbo.fn_GregorianToShamsi(CreatedAt),
    ExpiryDate = dbo.fn_AddOneYearShamsi(dbo.fn_GregorianToShamsi(CreatedAt)),
    UpdatedAt = SYSUTCDATETIME()
WHERE 
    (
        CAST(SUBSTRING(IssueDate, 6, 2) AS INT) > 12
        OR
        (
            SUBSTRING(IssueDate, 6, 2) = RIGHT('0' + CAST(MONTH(CreatedAt) AS VARCHAR(2)), 2)
            AND SUBSTRING(IssueDate, 9, 2) = RIGHT('0' + CAST(DAY(CreatedAt) AS VARCHAR(2)), 2)
        )
    )

SET @updatedCount = @@ROWCOUNT

PRINT 'Updated ' + CAST(@updatedCount AS NVARCHAR(10)) + ' records with correct Shamsi dates'

-- Show sample of updated records
PRINT ''
PRINT 'Sample of updated records:'
PRINT '--------------------------'

SELECT TOP 10
    HistoryID,
    TrackingNo,
    IssueDate AS NewIssueDate,
    ExpiryDate AS NewExpiryDate,
    CreatedAt,
    UpdatedAt
FROM LicenseHistory
WHERE UpdatedAt IS NOT NULL
ORDER BY UpdatedAt DESC

COMMIT TRANSACTION

PRINT ''
PRINT '========================================='
PRINT 'LicenseHistory Shamsi Date Fix Completed'
PRINT '========================================='
PRINT ''
PRINT 'Summary:'
PRINT '- Backup table created: LicenseHistory_Backup_20251224'
PRINT '- Records updated: ' + CAST(@updatedCount AS NVARCHAR(10))
PRINT '- Helper functions created: fn_GregorianToShamsi, fn_AddOneYearShamsi'
PRINT ''
PRINT 'To verify the fix, compare records in LicenseHistory with LicenseHistory_Backup_20251224'
PRINT ''
GO

-- Optional: Drop the helper functions after use (uncomment if you want to keep them)
-- DROP FUNCTION IF EXISTS dbo.fn_GregorianToShamsi
-- DROP FUNCTION IF EXISTS dbo.fn_AddOneYearShamsi
-- GO

PRINT 'Migration completed successfully!'
GO
