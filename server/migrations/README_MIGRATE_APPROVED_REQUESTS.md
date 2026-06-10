# Migrate Approved VehicleRequests to LicenseHistory - Guide

## Overview

This migration script transfers **1951 approved records** from the `VehicleRequests` table to the `LicenseHistory` table. The script ensures that `HistoryID` values are assigned in proper chronological order based on when licenses were completed/created.

## Problem Statement

The `VehicleRequests` table contains 1951 records with `Status='Approved'` that represent issued licenses, but these records are not yet tracked in the `LicenseHistory` table. The `LicenseHistory` table is used for:
- License lifecycle tracking (issuance, renewal, revocation)
- Historical reporting and statistics
- Audit trails for license operations
- Expiry date monitoring

## Solution

The migration script performs the following operations:

### 1. **Chronological Ordering**
- Records are inserted based on `CompletedAt` date (or `CreatedAt` if `CompletedAt` is NULL)
- Earlier licenses get lower `HistoryID` values
- Maintains historical accuracy in the database

### 2. **Data Mapping**
The script maps data from `VehicleRequests` to `LicenseHistory`:

| VehicleRequests Field | LicenseHistory Field | Transformation |
|----------------------|---------------------|----------------|
| RequestID | RequestID | Direct copy |
| TrackingNo | TrackingNo | Direct copy |
| LicenseTypeId | LicenseTypeId | Direct copy |
| - | LicenseTypeName | Lookup from LookupValue table |
| OperationTypeId | OperationTypeId | Direct copy |
| - | OperationTypeName | Lookup from LookupValue table |
| - | EventType | 'Issued' or 'Renewed' based on operation type |
| VehicleID | VehicleID | Direct copy |
| NationalCode | NationalCode | Direct copy |
| CompanyNationalId | CompanyNationalId | Direct copy |
| CompletedAt/CreatedAt | IssueDate | Converted to Shamsi format |
| - | ExpiryDate | IssueDate + 1 year (Shamsi) |
| - | ValidityDurationMonths | Set to 12 months |
| Status='Approved' | Status='Active' | Mapped status |
| - | IssuedByUserId | From final workflow step approver |
| - | IssuedByUsername | From Users table |
| - | IssuedByRole | From ApprovalFlowRoles table |

### 3. **Workflow Integration**
- Identifies the final approver from `RequestWorkflowSteps` table
- Uses the highest `StepOrder` with `Status='Approved'`
- Stores workflow metadata in JSON format

### 4. **Date Conversion**
- Uses `fn_GregorianToShamsi()` function to convert dates
- Uses `fn_AddOneYearShamsi()` to calculate expiry dates
- All dates stored in format: `YYYY/MM/DD` (e.g., `1404/10/03`)

## Prerequisites

**IMPORTANT:** You must run the Shamsi date fix migration first!

```sql
-- Run this first:
fix_license_history_shamsi_dates.sql
```

This creates the required helper functions:
- `fn_GregorianToShamsi`
- `fn_AddOneYearShamsi`

The migration script will check for these functions and exit with an error if they don't exist.

## How to Run

### Step 1: Backup Your Database

Before running any migration, create a full database backup:

```sql
-- Create database backup
BACKUP DATABASE [parvaneh2] 
TO DISK = 'C:\Backups\parvaneh2_before_migration_20251224.bak'
WITH FORMAT, INIT, NAME = 'Full Database Backup Before Migration';
```

### Step 2: Review the Script

Open the migration script and review:
- The verification queries at the beginning
- The data transformation logic
- The rollback instructions at the end

### Step 3: Execute the Migration

```bash
# From SQL Server Management Studio or Azure Data Studio:
# 1. Open: migrate_approved_requests_to_license_history.sql
# 2. Connect to database: parvaneh2
# 3. Execute the entire script (F5)
```

### Step 4: Monitor the Output

The script provides detailed output:
- Count of approved requests to migrate
- Existing records in LicenseHistory
- Sample of records being migrated
- Progress messages during execution
- Verification results after completion
- Summary statistics by license type

### Expected Output

```
=========================================================================
Starting Migration: Approved VehicleRequests to LicenseHistory
=========================================================================

Helper functions verified successfully

Total Approved VehicleRequests: 1951

Existing records in LicenseHistory: 186

Sample of approved requests NOT yet in LicenseHistory (first 10):
...

Total records to migrate: 1765

Backup table created: LicenseHistory_Backup_Migration_20251224

Current max HistoryID: 186
New records will start from: 187

...

Successfully inserted 1765 records into LicenseHistory
Transaction committed successfully

Verification Results:
--------------------
Total records in LicenseHistory after migration: 1951
Records migrated in this operation: 1765

SUCCESS: All approved requests have been migrated to LicenseHistory

Migration Completed Successfully!
```

## Verification Queries

### 1. Check Total Counts

```sql
-- Count approved requests
SELECT COUNT(*) AS ApprovedRequests
FROM VehicleRequests
WHERE Status = 'Approved'

-- Count license history records
SELECT COUNT(*) AS HistoryRecords
FROM LicenseHistory

-- They should match after migration
```

### 2. Verify Chronological Ordering

```sql
-- Check if HistoryID is in chronological order
SELECT 
    HistoryID,
    TrackingNo,
    IssueDate,
    CreatedAt,
    LAG(CreatedAt) OVER (ORDER BY HistoryID) AS PrevCreatedAt
FROM LicenseHistory
WHERE CreatedAt < LAG(CreatedAt) OVER (ORDER BY HistoryID)

-- Should return 0 rows if ordering is correct
```

### 3. Check Migrated Records

```sql
-- View migrated records
SELECT 
    HistoryID,
    RequestID,
    TrackingNo,
    LicenseTypeName,
    EventType,
    IssueDate,
    ExpiryDate,
    Status,
    IssuedByRole
FROM LicenseHistory
WHERE Notes LIKE '%Migrated from approved VehicleRequests%'
ORDER BY HistoryID
```

### 4. Verify Date Conversions

```sql
-- Check Shamsi date format
SELECT 
    HistoryID,
    TrackingNo,
    IssueDate,
    ExpiryDate,
    CreatedAt
FROM LicenseHistory
WHERE Notes LIKE '%Migrated from approved VehicleRequests%'
    AND (
        IssueDate NOT LIKE '[0-9][0-9][0-9][0-9]/[0-9][0-9]/[0-9][0-9]'
        OR ExpiryDate NOT LIKE '[0-9][0-9][0-9][0-9]/[0-9][0-9]/[0-9][0-9]'
    )

-- Should return 0 rows if all dates are properly formatted
```

### 5. Check for Missing Records

```sql
-- Find approved requests not in LicenseHistory
SELECT 
    vr.RequestID,
    vr.TrackingNo,
    vr.Status,
    vr.LicenseTypeId,
    vr.CompletedAt
FROM VehicleRequests vr
WHERE vr.Status = 'Approved'
    AND NOT EXISTS (
        SELECT 1 FROM LicenseHistory lh 
        WHERE lh.RequestID = vr.RequestID
    )

-- Should return 0 rows after successful migration
```

### 6. Statistics by License Type

```sql
-- Summary by license type
SELECT 
    LicenseTypeName,
    COUNT(*) AS TotalRecords,
    COUNT(CASE WHEN EventType = 'Issued' THEN 1 END) AS IssuedCount,
    COUNT(CASE WHEN EventType = 'Renewed' THEN 1 END) AS RenewedCount,
    MIN(IssueDate) AS EarliestIssue,
    MAX(IssueDate) AS LatestIssue
FROM LicenseHistory
WHERE Notes LIKE '%Migrated from approved VehicleRequests%'
GROUP BY LicenseTypeName
ORDER BY TotalRecords DESC
```

## Safety Features

### 1. Backup Table
- Automatic backup: `LicenseHistory_Backup_Migration_20251224`
- Contains all records before migration
- Can be used for rollback

### 2. Transaction Protection
- All inserts wrapped in a transaction
- Automatic rollback if insert count doesn't match expected
- Verifies record count before committing

### 3. Duplicate Prevention
- Checks for existing records before migration
- Only migrates records not already in LicenseHistory
- Uses `NOT EXISTS` clause to prevent duplicates

### 4. Validation Checks
- Verifies helper functions exist before starting
- Counts records at each step
- Validates chronological ordering after migration
- Checks for missing records

## Rollback Procedures

### Option 1: Delete Migrated Records Only

```sql
-- Remove only the migrated records
BEGIN TRANSACTION

DELETE FROM LicenseHistory 
WHERE Notes LIKE '%Migrated from approved VehicleRequests%'

-- Verify count
SELECT COUNT(*) FROM LicenseHistory

-- If correct, commit
COMMIT TRANSACTION
-- Or rollback
-- ROLLBACK TRANSACTION
```

### Option 2: Full Restore from Backup

```sql
-- Restore entire table from backup
BEGIN TRANSACTION

-- Clear current data
TRUNCATE TABLE LicenseHistory

-- Restore from backup
INSERT INTO LicenseHistory 
SELECT * FROM LicenseHistory_Backup_Migration_20251224

-- Verify count
SELECT COUNT(*) FROM LicenseHistory

COMMIT TRANSACTION
```

### Option 3: Database Restore

If you created a full database backup:

```sql
-- Restore entire database
USE master
GO

RESTORE DATABASE [parvaneh2]
FROM DISK = 'C:\Backups\parvaneh2_before_migration_20251224.bak'
WITH REPLACE
GO
```

## Post-Migration Tasks

### 1. Verify Application Functionality
- Test license history display pages
- Check license expiry calculations
- Verify statistics and reports
- Test license renewal workflows

### 2. Monitor Performance
- Check query performance on LicenseHistory table
- Monitor index usage
- Watch for any slow queries

### 3. Update Statistics

```sql
-- Update table statistics for better query performance
UPDATE STATISTICS LicenseHistory WITH FULLSCAN
```

### 4. Rebuild Indexes (Optional)

```sql
-- Rebuild indexes if needed
ALTER INDEX ALL ON LicenseHistory REBUILD
```

### 5. Keep Backup
- Retain `LicenseHistory_Backup_Migration_20251224` for at least 30 days
- Document the migration date and record counts
- Store backup in a safe location

## Troubleshooting

### Issue: Helper Functions Not Found

**Error:** `Required function fn_GregorianToShamsi not found`

**Solution:** Run the prerequisite migration first:
```sql
-- Execute this script first:
fix_license_history_shamsi_dates.sql
```

### Issue: Insert Count Mismatch

**Error:** `Expected to insert X records but only inserted Y`

**Cause:** Some records may have failed validation or foreign key constraints

**Solution:**
1. Check the error messages in SQL output
2. Verify foreign key relationships (Users, Vehicles, etc.)
3. Check for NULL values in required fields
4. Run verification queries to identify problematic records

### Issue: Duplicate Records

**Error:** Violation of UNIQUE constraint on RequestID

**Cause:** Records already exist in LicenseHistory

**Solution:**
- The script automatically checks for duplicates
- If error occurs, verify the `NOT EXISTS` clause is working
- Check if backup was restored incorrectly

### Issue: Date Format Errors

**Error:** Invalid Shamsi date format

**Cause:** Date conversion function returned unexpected format

**Solution:**
1. Verify helper functions are working correctly
2. Check for NULL or invalid dates in VehicleRequests
3. Test date conversion manually:
```sql
SELECT dbo.fn_GregorianToShamsi(GETDATE())
```

## Technical Details

### HistoryID Assignment

The script uses `ROW_NUMBER()` with `ORDER BY` to ensure sequential IDs:

```sql
ROW_NUMBER() OVER (
    ORDER BY 
        COALESCE(vr.CompletedAt, vr.CreatedAt) ASC,
        vr.RequestID ASC
) AS RowNum
```

This ensures:
- Earlier completed licenses get lower IDs
- If completion dates are identical, lower RequestID gets lower HistoryID
- Maintains chronological integrity

### Workflow Approver Detection

The script finds the final approver using:

```sql
SELECT RequestID, MAX(StepOrder) AS MaxStepOrder
FROM RequestWorkflowSteps
WHERE Status = 'Approved'
GROUP BY RequestID
```

This identifies the last person who approved each request.

### Metadata Storage

Workflow information is stored as JSON:

```json
{
  "workflowStepId": 27950,
  "finalStepOrder": 4,
  "migrated": true,
  "migrationDate": "2025-12-24"
}
```

## Expected Results

After successful migration:

- **Total Records:** 1951 (or more if new approvals occurred)
- **Migrated Records:** ~1765 (approved requests not previously in history)
- **Date Format:** All dates in Shamsi format (YYYY/MM/DD)
- **Status:** All migrated records have Status='Active'
- **Validity:** All licenses have 12-month validity
- **Ordering:** HistoryID increases chronologically

## Notes

- The script is **idempotent** - safe to run multiple times
- Only migrates records not already in LicenseHistory
- Does not modify VehicleRequests table
- Creates comprehensive audit trail in Notes field
- Preserves all workflow metadata

## Contact & Support

If you encounter issues:

1. Review the verification queries above
2. Check SQL Server error logs
3. Verify database permissions
4. Ensure all foreign key references are valid
5. Contact database administrator if needed

---

**Migration Date:** 2025-12-24  
**Script Version:** 1.0  
**Database:** parvaneh2  
**Tables:** VehicleRequests → LicenseHistory  
**Records:** ~1951 approved licenses
