# Fix LicenseHistory Shamsi Dates - Migration Guide

## Problem Description

Approximately 185 records in the `LicenseHistory` table have incorrect Shamsi dates. The dates were stored in the format that looks like Shamsi (YYYY/MM/DD) but actually contains Gregorian date values.

### Example of Incorrect Data:
```
HistoryID: 185
IssueDate: 1404/12/24  (WRONG - this is actually 2025-12-24 in Gregorian)
ExpiryDate: 1405/12/24 (WRONG)
CreatedAt: 2025-12-24 10:16:43
```

### Example of Correct Data:
```
HistoryID: 186
IssueDate: 1404/10/03  (CORRECT - proper Shamsi conversion)
ExpiryDate: 1405/10/03 (CORRECT)
CreatedAt: 2025-12-24 14:29:54
```

## Root Cause

Old records were created before the proper Shamsi date conversion utility (`shamsiDateUtils.js`) was implemented. The system was storing Gregorian dates directly into Shamsi date fields.

## Solution

The migration script `fix_license_history_shamsi_dates.sql` performs the following:

1. **Creates Helper Functions:**
   - `fn_GregorianToShamsi`: Converts Gregorian datetime to Shamsi format
   - `fn_AddOneYearShamsi`: Adds one year to a Shamsi date

2. **Identifies Incorrect Records:**
   - Records where month > 12 (impossible in Shamsi calendar)
   - Records where the date pattern matches the CreatedAt Gregorian date

3. **Creates Backup:**
   - All data is backed up to `LicenseHistory_Backup_20251224` before any changes

4. **Updates Records:**
   - Converts `CreatedAt` timestamp to proper Shamsi date
   - Updates both `IssueDate` and `ExpiryDate` fields
   - Sets `UpdatedAt` timestamp for tracking

## How to Run

### Step 1: Review Records to be Fixed

Before running the full script, you can check which records will be affected:

```sql
SELECT 
    HistoryID,
    TrackingNo,
    IssueDate AS CurrentIssueDate,
    ExpiryDate AS CurrentExpiryDate,
    CreatedAt
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
ORDER BY HistoryID
```

### Step 2: Run the Migration Script

Execute the script in SQL Server Management Studio or Azure Data Studio:

```bash
# From SQL Server Management Studio:
# 1. Open the file: fix_license_history_shamsi_dates.sql
# 2. Ensure you're connected to the correct database (parvaneh2)
# 3. Execute the script (F5)
```

### Step 3: Verify the Results

The script will output:
- List of records to be fixed
- Total count of records
- Confirmation of backup creation
- Number of updated records
- Sample of updated records

### Step 4: Verify Data Integrity

Compare before and after:

```sql
-- Check a specific record before and after
SELECT 
    b.HistoryID,
    b.TrackingNo,
    b.IssueDate AS OldIssueDate,
    b.ExpiryDate AS OldExpiryDate,
    n.IssueDate AS NewIssueDate,
    n.ExpiryDate AS NewExpiryDate,
    n.CreatedAt
FROM LicenseHistory_Backup_20251224 b
JOIN LicenseHistory n ON b.HistoryID = n.HistoryID
WHERE n.UpdatedAt IS NOT NULL
ORDER BY n.UpdatedAt DESC
```

## Safety Features

1. **Backup Table:** Complete backup created before any changes
2. **Transaction:** All updates wrapped in a transaction
3. **Verification Queries:** Shows records before and after update
4. **UpdatedAt Tracking:** Modified records are marked with timestamp

## Rollback (If Needed)

If something goes wrong, you can restore from backup:

```sql
-- Rollback to original data
BEGIN TRANSACTION

UPDATE LicenseHistory
SET 
    IssueDate = b.IssueDate,
    ExpiryDate = b.ExpiryDate,
    UpdatedAt = NULL
FROM LicenseHistory l
JOIN LicenseHistory_Backup_20251224 b ON l.HistoryID = b.HistoryID
WHERE l.UpdatedAt IS NOT NULL

COMMIT TRANSACTION
```

## Post-Migration

After successful migration:

1. **Verify Sample Records:** Check 5-10 random records manually
2. **Test Application:** Ensure license history displays correctly
3. **Monitor Logs:** Check for any date-related errors
4. **Keep Backup:** Retain `LicenseHistory_Backup_20251224` for at least 30 days

## Helper Functions

The script creates two SQL functions that remain in the database:

- `dbo.fn_GregorianToShamsi(@gregorianDate DATETIME2) RETURNS NVARCHAR(10)`
- `dbo.fn_AddOneYearShamsi(@shamsiDate NVARCHAR(10)) RETURNS NVARCHAR(10)`

These can be used for future date conversions if needed. To remove them:

```sql
DROP FUNCTION IF EXISTS dbo.fn_GregorianToShamsi
DROP FUNCTION IF EXISTS dbo.fn_AddOneYearShamsi
```

## Expected Results

- **~185 records** will be updated with correct Shamsi dates
- **IssueDate** will reflect the proper Shamsi conversion of CreatedAt
- **ExpiryDate** will be IssueDate + 1 year in Shamsi calendar
- All dates will be in format: `YYYY/MM/DD` (e.g., `1404/10/03`)

## Notes

- The script is idempotent - running it multiple times won't cause issues
- Only records with incorrect dates are updated
- Records created after the fix (with correct dates) are not affected
- The conversion algorithm matches the one used in `shamsiDateUtils.js`

## Contact

If you encounter any issues during migration, check:
1. Database connection and permissions
2. Backup table creation success
3. Transaction commit status
4. Error messages in SQL output

---
**Migration Date:** 2025-12-24  
**Script Version:** 1.0  
**Database:** parvaneh2  
**Table:** LicenseHistory
