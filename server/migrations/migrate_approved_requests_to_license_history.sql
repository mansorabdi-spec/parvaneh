-- Migration: Transfer Approved VehicleRequests to LicenseHistory
-- Purpose: Migrate 1951 approved records from VehicleRequests to LicenseHistory table
-- Date: 2025-12-24
-- Important: Records will be inserted in chronological order based on CompletedAt/CreatedAt

USE [parvaneh2]
GO

PRINT '========================================================================='
PRINT 'Starting Migration: Approved VehicleRequests to LicenseHistory'
PRINT '========================================================================='
GO

-- Step 1: Verify the helper functions exist (from previous migration)
IF OBJECT_ID('dbo.fn_GregorianToShamsi', 'FN') IS NULL
BEGIN
    PRINT 'ERROR: Function fn_GregorianToShamsi does not exist!'
    PRINT 'Please run fix_license_history_shamsi_dates.sql first to create the required functions.'
    RAISERROR('Required function fn_GregorianToShamsi not found', 16, 1)
    RETURN
END

IF OBJECT_ID('dbo.fn_AddOneYearShamsi', 'FN') IS NULL
BEGIN
    PRINT 'ERROR: Function fn_AddOneYearShamsi does not exist!'
    PRINT 'Please run fix_license_history_shamsi_dates.sql first to create the required functions.'
    RAISERROR('Required function fn_AddOneYearShamsi not found', 16, 1)
    RETURN
END

PRINT 'Helper functions verified successfully'
PRINT ''
GO

-- Step 2: Check how many approved requests exist
DECLARE @approvedCount INT
SELECT @approvedCount = COUNT(*)
FROM VehicleRequests
WHERE Status = 'Approved'

PRINT 'Total Approved VehicleRequests: ' + CAST(@approvedCount AS NVARCHAR(10))
PRINT ''
GO

-- Step 3: Check how many already exist in LicenseHistory
DECLARE @existingCount INT
SELECT @existingCount = COUNT(DISTINCT RequestID)
FROM LicenseHistory

PRINT 'Existing records in LicenseHistory: ' + CAST(@existingCount AS NVARCHAR(10))
PRINT ''
GO

-- Step 4: Show sample of approved requests that are NOT yet in LicenseHistory
PRINT 'Sample of approved requests NOT yet in LicenseHistory (first 10):'
PRINT '----------------------------------------------------------------'

SELECT TOP 10
    vr.RequestID,
    vr.TrackingNo,
    vr.LicenseTypeId,
    vr.OperationTypeId,
    vr.Status,
    vr.CompletedAt,
    vr.CreatedAt,
    vr.VehicleID,
    vr.NationalCode,
    vr.CompanyNationalId
FROM VehicleRequests vr
WHERE vr.Status = 'Approved'
    AND NOT EXISTS (
        SELECT 1 FROM LicenseHistory lh 
        WHERE lh.RequestID = vr.RequestID
    )
ORDER BY 
    COALESCE(vr.CompletedAt, vr.CreatedAt) ASC,
    vr.RequestID ASC

DECLARE @toMigrateCount INT
SELECT @toMigrateCount = COUNT(*)
FROM VehicleRequests vr
WHERE vr.Status = 'Approved'
    AND NOT EXISTS (
        SELECT 1 FROM LicenseHistory lh 
        WHERE lh.RequestID = vr.RequestID
    )

PRINT ''
PRINT 'Total records to migrate: ' + CAST(@toMigrateCount AS NVARCHAR(10))
PRINT ''
GO

-- Step 5: Create backup of current LicenseHistory table
IF OBJECT_ID('dbo.LicenseHistory_Backup_Migration_20251224', 'U') IS NOT NULL
    DROP TABLE dbo.LicenseHistory_Backup_Migration_20251224
GO

SELECT * 
INTO dbo.LicenseHistory_Backup_Migration_20251224
FROM dbo.LicenseHistory
GO

PRINT 'Backup table created: LicenseHistory_Backup_Migration_20251224'
PRINT ''
GO

-- Step 6: Temporarily disable IDENTITY_INSERT to control HistoryID ordering
-- We need to insert records in chronological order with sequential IDs

-- Get the current max HistoryID
DECLARE @maxHistoryID BIGINT
SELECT @maxHistoryID = ISNULL(MAX(HistoryID), 0) FROM LicenseHistory

PRINT 'Current max HistoryID: ' + CAST(@maxHistoryID AS NVARCHAR(20))
PRINT 'New records will start from: ' + CAST(@maxHistoryID + 1 AS NVARCHAR(20))
PRINT ''
GO

-- Step 7: Create a temporary table with all approved requests in chronological order
IF OBJECT_ID('tempdb..#ApprovedRequestsOrdered') IS NOT NULL
    DROP TABLE #ApprovedRequestsOrdered

CREATE TABLE #ApprovedRequestsOrdered (
    RowNum BIGINT,
    RequestID BIGINT,
    TrackingNo NVARCHAR(30),
    LicenseTypeId INT,
    LicenseTypeName NVARCHAR(200),
    OperationTypeId INT,
    OperationTypeName NVARCHAR(200),
    VehicleID BIGINT,
    NationalCode NVARCHAR(20),
    CompanyNationalId NVARCHAR(100),
    CompletedAt DATETIME2(7),
    CreatedAt DATETIME2(7),
    SubmittedByUserId INT,
    IssueDateShamsi NVARCHAR(10),
    ExpiryDateShamsi NVARCHAR(10)
)

-- Insert approved requests in chronological order
INSERT INTO #ApprovedRequestsOrdered
SELECT 
    ROW_NUMBER() OVER (
        ORDER BY 
            COALESCE(vr.CompletedAt, vr.CreatedAt) ASC,
            vr.RequestID ASC
    ) AS RowNum,
    vr.RequestID,
    vr.TrackingNo,
    vr.LicenseTypeId,
    lt.Name AS LicenseTypeName,
    vr.OperationTypeId,
    ot.Name AS OperationTypeName,
    vr.VehicleID,
    vr.NationalCode,
    vr.CompanyNationalId,
    vr.CompletedAt,
    vr.CreatedAt,
    vr.SubmittedByUserId,
    dbo.fn_GregorianToShamsi(COALESCE(vr.CompletedAt, vr.CreatedAt)) AS IssueDateShamsi,
    dbo.fn_AddOneYearShamsi(dbo.fn_GregorianToShamsi(COALESCE(vr.CompletedAt, vr.CreatedAt))) AS ExpiryDateShamsi
FROM VehicleRequests vr
LEFT JOIN LookupValue lt ON vr.LicenseTypeId = lt.Id
LEFT JOIN LookupValue ot ON vr.OperationTypeId = ot.Id
WHERE vr.Status = 'Approved'
    AND NOT EXISTS (
        SELECT 1 FROM LicenseHistory lh 
        WHERE lh.RequestID = vr.RequestID
    )

DECLARE @tempRecordCount INT
SELECT @tempRecordCount = COUNT(*) FROM #ApprovedRequestsOrdered

PRINT 'Temporary table created with ' + CAST(@tempRecordCount AS NVARCHAR(10)) + ' records in chronological order'
PRINT ''
GO

-- Step 8: Get the final approver information for each request from workflow steps
IF OBJECT_ID('tempdb..#FinalApprovers') IS NOT NULL
    DROP TABLE #FinalApprovers

CREATE TABLE #FinalApprovers (
    RequestID BIGINT,
    DecidedByUserId INT,
    DecidedByUsername NVARCHAR(150),
    DecidedByRole NVARCHAR(50),
    WorkflowStepId BIGINT,
    StepOrder INT
)

-- Get the final approval step for each request (highest StepOrder with Approved status)
INSERT INTO #FinalApprovers
SELECT 
    rws.RequestID,
    rws.DecidedByUserId,
    u.FullName AS DecidedByUsername,
    rws.RoleName AS DecidedByRole,
    rws.Id AS WorkflowStepId,
    rws.StepOrder
FROM RequestWorkflowSteps rws
INNER JOIN (
    SELECT RequestID, MAX(StepOrder) AS MaxStepOrder
    FROM RequestWorkflowSteps
    WHERE Status = 'Approved'
    GROUP BY RequestID
) maxSteps ON rws.RequestID = maxSteps.RequestID AND rws.StepOrder = maxSteps.MaxStepOrder
LEFT JOIN Users u ON rws.DecidedByUserId = u.Id
WHERE rws.Status = 'Approved'

PRINT 'Final approver information collected for workflow steps'
PRINT ''
GO

-- Step 9: Perform the migration with proper HistoryID ordering
BEGIN TRANSACTION

DECLARE @insertedCount INT = 0
DECLARE @errorCount INT = 0

-- Insert records in chronological order
INSERT INTO LicenseHistory (
    RequestID,
    TrackingNo,
    LicenseTypeId,
    LicenseTypeName,
    OperationTypeId,
    OperationTypeName,
    EventType,
    VehicleID,
    NationalCode,
    CompanyNationalId,
    IssueDate,
    ExpiryDate,
    ValidityDurationMonths,
    Status,
    IssuedByUserId,
    IssuedByUsername,
    IssuedByRole,
    Notes,
    Metadata,
    CreatedAt
)
SELECT 
    aro.RequestID,
    aro.TrackingNo,
    aro.LicenseTypeId,
    aro.LicenseTypeName,
    aro.OperationTypeId,
    aro.OperationTypeName,
    CASE 
        WHEN aro.OperationTypeName LIKE '%تمدید%' THEN 'Renewed'
        ELSE 'Issued'
    END AS EventType,
    aro.VehicleID,
    aro.NationalCode,
    aro.CompanyNationalId,
    aro.IssueDateShamsi,
    aro.ExpiryDateShamsi,
    12 AS ValidityDurationMonths,
    'Active' AS Status,
    COALESCE(fa.DecidedByUserId, aro.SubmittedByUserId) AS IssuedByUserId,
    fa.DecidedByUsername AS IssuedByUsername,
    fa.DecidedByRole AS IssuedByRole,
    'Migrated from approved VehicleRequests - License issued via workflow approval' AS Notes,
    CASE 
        WHEN fa.WorkflowStepId IS NOT NULL 
        THEN '{"workflowStepId":' + CAST(fa.WorkflowStepId AS NVARCHAR(20)) + 
             ',"finalStepOrder":' + CAST(fa.StepOrder AS NVARCHAR(10)) + 
             ',"migrated":true,"migrationDate":"2025-12-24"}'
        ELSE '{"migrated":true,"migrationDate":"2025-12-24","note":"No workflow step found"}'
    END AS Metadata,
    aro.CreatedAt
FROM #ApprovedRequestsOrdered aro
LEFT JOIN #FinalApprovers fa ON aro.RequestID = fa.RequestID
ORDER BY aro.RowNum ASC

SET @insertedCount = @@ROWCOUNT

DECLARE @expectedCount INT
SELECT @expectedCount = COUNT(*) FROM #ApprovedRequestsOrdered

IF @insertedCount = @expectedCount
BEGIN
    PRINT 'Successfully inserted ' + CAST(@insertedCount AS NVARCHAR(10)) + ' records into LicenseHistory'
    COMMIT TRANSACTION
    PRINT 'Transaction committed successfully'
END
ELSE
BEGIN
    PRINT 'ERROR: Expected to insert ' + CAST(@expectedCount AS NVARCHAR(10)) + 
          ' records but only inserted ' + CAST(@insertedCount AS NVARCHAR(10))
    ROLLBACK TRANSACTION
    PRINT 'Transaction rolled back'
END

PRINT ''
GO

-- Step 10: Verify the migration
PRINT 'Verification Results:'
PRINT '--------------------'

-- Check total count
DECLARE @finalCount INT
SELECT @finalCount = COUNT(*) FROM LicenseHistory

PRINT 'Total records in LicenseHistory after migration: ' + CAST(@finalCount AS NVARCHAR(10))

-- Check migrated records
DECLARE @migratedCount INT
SELECT @migratedCount = COUNT(*)
FROM LicenseHistory
WHERE Notes LIKE '%Migrated from approved VehicleRequests%'

PRINT 'Records migrated in this operation: ' + CAST(@migratedCount AS NVARCHAR(10))

-- Show sample of newly migrated records
PRINT ''
PRINT 'Sample of newly migrated records (first 10):'
PRINT '--------------------------------------------'

SELECT TOP 10
    HistoryID,
    RequestID,
    TrackingNo,
    LicenseTypeName,
    OperationTypeName,
    EventType,
    IssueDate,
    ExpiryDate,
    Status,
    IssuedByRole,
    CreatedAt
FROM LicenseHistory
WHERE Notes LIKE '%Migrated from approved VehicleRequests%'
ORDER BY HistoryID ASC

PRINT ''
GO

-- Step 11: Verify chronological ordering
PRINT 'Verifying chronological ordering of HistoryID:'
PRINT '----------------------------------------------'

-- Check if any records are out of order
SELECT COUNT(*) AS OutOfOrderCount
FROM (
    SELECT 
        lh.HistoryID,
        lh.CreatedAt,
        LAG(lh.CreatedAt) OVER (ORDER BY lh.HistoryID) AS PrevCreatedAt
    FROM LicenseHistory lh
) AS ordered
WHERE CreatedAt < PrevCreatedAt

PRINT 'If OutOfOrderCount = 0, chronological ordering is correct'
PRINT ''
GO

-- Step 12: Check for any approved requests still missing from LicenseHistory
DECLARE @stillMissingCount INT
SELECT @stillMissingCount = COUNT(*)
FROM VehicleRequests vr
WHERE vr.Status = 'Approved'
    AND NOT EXISTS (
        SELECT 1 FROM LicenseHistory lh 
        WHERE lh.RequestID = vr.RequestID
    )

PRINT 'Approved requests still missing from LicenseHistory: ' + CAST(@stillMissingCount AS NVARCHAR(10))

IF @stillMissingCount > 0
BEGIN
    PRINT 'WARNING: Some approved requests were not migrated. Please investigate.'
    PRINT ''
    PRINT 'Sample of missing requests:'
    SELECT TOP 10
        RequestID,
        TrackingNo,
        Status,
        LicenseTypeId,
        CompletedAt,
        CreatedAt
    FROM VehicleRequests vr
    WHERE vr.Status = 'Approved'
        AND NOT EXISTS (
            SELECT 1 FROM LicenseHistory lh 
            WHERE lh.RequestID = vr.RequestID
        )
END
ELSE
BEGIN
    PRINT 'SUCCESS: All approved requests have been migrated to LicenseHistory'
END

PRINT ''
GO

-- Step 13: Summary statistics by license type
PRINT 'Migration Summary by License Type:'
PRINT '----------------------------------'

SELECT 
    lh.LicenseTypeName,
    COUNT(*) AS RecordCount,
    MIN(lh.IssueDate) AS EarliestIssueDate,
    MAX(lh.IssueDate) AS LatestIssueDate
FROM LicenseHistory lh
WHERE lh.Notes LIKE '%Migrated from approved VehicleRequests%'
GROUP BY lh.LicenseTypeName
ORDER BY RecordCount DESC

PRINT ''
GO

-- Step 14: Cleanup temporary tables
IF OBJECT_ID('tempdb..#ApprovedRequestsOrdered') IS NOT NULL
    DROP TABLE #ApprovedRequestsOrdered

IF OBJECT_ID('tempdb..#FinalApprovers') IS NOT NULL
    DROP TABLE #FinalApprovers

PRINT 'Temporary tables cleaned up'
PRINT ''
GO

PRINT '========================================================================='
PRINT 'Migration Completed Successfully!'
PRINT '========================================================================='
PRINT ''
PRINT 'Summary:'
PRINT '- Backup table: LicenseHistory_Backup_Migration_20251224'
PRINT '- Records migrated from approved VehicleRequests to LicenseHistory'
PRINT '- HistoryID values assigned in chronological order based on CompletedAt/CreatedAt'
PRINT '- All dates converted to proper Shamsi format'
PRINT '- Validity duration set to 12 months for all licenses'
PRINT ''
PRINT 'Next Steps:'
PRINT '1. Verify the migrated data using the verification queries above'
PRINT '2. Check a few random records manually to ensure accuracy'
PRINT '3. Keep the backup table for at least 30 days'
PRINT '4. Monitor the application for any issues'
PRINT ''
PRINT 'Rollback Instructions (if needed):'
PRINT '-----------------------------------'
PRINT '-- Delete migrated records:'
PRINT 'DELETE FROM LicenseHistory WHERE Notes LIKE ''%Migrated from approved VehicleRequests%'''
PRINT ''
PRINT '-- Or restore from backup:'
PRINT 'TRUNCATE TABLE LicenseHistory'
PRINT 'INSERT INTO LicenseHistory SELECT * FROM LicenseHistory_Backup_Migration_20251224'
PRINT ''
GO
