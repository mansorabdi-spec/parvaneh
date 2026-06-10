# License Issuance and Expiry Date Feature

## Overview

This feature implements automatic tracking of license issuance and expiry dates in the **LicenseHistory** table. All licenses issued through the system have a **1-year validity period** from the date of issuance, calculated using the Shamsi (Persian) calendar.

## Database Schema

### LicenseHistory Table

The `LicenseHistory` table stores all license issuance, renewal, revocation, and cancellation events with the following key fields:

- **IssueDate** (NVARCHAR(10)): License issuance date in Shamsi format (e.g., '1403/09/15')
- **ExpiryDate** (NVARCHAR(10)): License expiry date in Shamsi format (e.g., '1404/09/15')
- **ValidityDurationMonths** (INT): Validity duration in months (always 12 for 1 year)
- **Status** (NVARCHAR(20)): License status ('Active', 'Expired', 'Revoked', 'Cancelled')
- **EventType** (NVARCHAR(50)): Event type ('Issued', 'Renewed', 'Revoked', 'Cancelled')

**Note:** Gregorian date fields (`IssueDateGregorian`, `ExpiryDateGregorian`) have been removed as the system only works with Shamsi dates.

### Migration

To remove the Gregorian date fields, run the migration:

```sql
-- File: server/migrations/remove_gregorian_dates_from_license_history.sql
ALTER TABLE [dbo].[LicenseHistory]
DROP COLUMN [IssueDateGregorian], [ExpiryDateGregorian];
```

## Implementation

### 1. Shamsi Date Utilities

**File:** `server/src/utils/shamsiDateUtils.js`

Provides utility functions for Shamsi date calculations:

- **`getCurrentShamsiDate()`**: Returns current date in Shamsi format (e.g., '1403/09/15')
- **`addOneYearShamsi(shamsiDate)`**: Adds exactly 1 year to a Shamsi date
- **`gregorianToShamsi(gregorianDate)`**: Converts JavaScript Date to Shamsi format
- **`compareShamsiDates(date1, date2)`**: Compares two Shamsi dates
- **`isLicenseExpired(expiryDate)`**: Checks if a license has expired
- **`calculateMonthsDifference(startDate, endDate)`**: Calculates months between two dates

### 2. License History Logger

**File:** `server/src/utils/licenseHistoryLogger.js`

Updated to work with Shamsi dates only:

```javascript
import { logLicenseHistory, calculateExpiryDate } from '../utils/licenseHistoryLogger.js';

// Log license issuance
await logLicenseHistory({
  requestId: 123,
  trackingNo: '100-1234',
  licenseTypeId: 65,
  licenseTypeName: 'پروانه فعالیت',
  operationTypeId: 1,
  operationTypeName: 'صدور',
  eventType: 'Issued',
  vehicleId: 456,
  nationalCode: '1234567890',
  companyNationalId: null,
  issueDate: '1403/09/15',        // Shamsi date
  expiryDate: '1404/09/15',       // Shamsi date (1 year later)
  validityDurationMonths: 12,
  status: 'Active',
  issuedByUserId: 1,
  issuedByUsername: 'admin',
  issuedByRole: 'کارشناس صدور پروانه',
  notes: 'License issued via workflow approval',
  metadata: { workflowStepId: 789 }
});
```

### 3. Workflow Controller Integration

**File:** `server/src/controllers/workflow.controller.js`

When a license request is approved (Status = 'Approved'), the system automatically:

1. Gets the current Shamsi date as the issue date
2. Calculates the expiry date (issue date + 1 year)
3. Logs the license to `LicenseHistory` table

```javascript
import { getCurrentShamsiDate, addOneYearShamsi } from '../utils/shamsiDateUtils.js';

// When license is approved
const issueDate = getCurrentShamsiDate();           // '1403/09/15'
const expiryDate = addOneYearShamsi(issueDate);     // '1404/09/15'

await logLicenseHistory({
  // ... other fields
  issueDate: issueDate,
  expiryDate: expiryDate,
  validityDurationMonths: 12,
  status: 'Active'
});
```

## Workflow Integration

### When License is Approved

The license history is automatically logged when:

1. **Final workflow step is approved** (Status changes to 'Approved')
2. **CompletedAt timestamp is set**

The system:
- Determines event type ('Issued' or 'Renewed' based on operation type)
- Calculates issue and expiry dates
- Inserts record into `LicenseHistory` table with status 'Active'

### License Types Supported

All three license types are supported:

1. **Activity License (پروانه فعالیت)**: For individuals (حقیقی) and companies (حقوقی)
2. **Exploitation License (پروانه بهره‌برداری)**: For companies
3. **Employment License (پروانه اشتغال)**: For individuals

## Querying License Data

### Get Active Licenses

```sql
SELECT 
  RequestID,
  TrackingNo,
  LicenseTypeName,
  IssueDate,
  ExpiryDate,
  Status,
  IssuedByUsername
FROM LicenseHistory
WHERE Status = 'Active'
AND EventType = 'Issued'
ORDER BY CreatedAt DESC;
```

### Check if License is Expired

```javascript
import { isLicenseExpired } from '../utils/shamsiDateUtils.js';

const expiryDate = '1403/09/15';
if (isLicenseExpired(expiryDate)) {
  console.log('License has expired');
}
```

### Get License History for a Request

```sql
SELECT 
  EventType,
  IssueDate,
  ExpiryDate,
  Status,
  IssuedByUsername,
  CreatedAt,
  Notes
FROM LicenseHistory
WHERE RequestID = @RequestID
ORDER BY CreatedAt DESC;
```

## Future Enhancements

### Automatic Expiry Status Update

Consider implementing a scheduled job to automatically update license status from 'Active' to 'Expired' when the expiry date is reached:

```javascript
// Example: Daily cron job
async function updateExpiredLicenses() {
  const currentDate = getCurrentShamsiDate();
  
  await pool.request()
    .input('CurrentDate', sql.NVarChar(10), currentDate)
    .query(`
      UPDATE LicenseHistory
      SET Status = 'Expired'
      WHERE Status = 'Active'
      AND ExpiryDate < @CurrentDate
    `);
}
```

### License Renewal Workflow

When implementing license renewal:

1. Check if original license exists in `LicenseHistory`
2. Verify it's not expired or revoked
3. Create new entry with `EventType = 'Renewed'`
4. Calculate new expiry date (renewal date + 1 year)

## API Endpoints

### Check License Validity (Public)

**Endpoint:** `GET /api/workflow/verify/:trackingNo`

Returns license details including issue and expiry dates from `LicenseHistory`.

### Get License History

**Endpoint:** `GET /api/license-history/:requestId`

Returns all historical events for a specific license request.

## Testing

### Test Scenarios

1. **Issue Activity License**: Verify license history is created with correct dates
2. **Issue Exploitation License**: Verify company-based license tracking
3. **Issue Employment License**: Verify person-based license tracking
4. **Date Calculation**: Verify 1-year expiry calculation is accurate
5. **Shamsi Calendar**: Test with various Shamsi dates (leap years, month boundaries)

### Sample Test Data

```javascript
// Test: Issue date 1403/12/29 (last day of year)
const issueDate = '1403/12/29';
const expiryDate = addOneYearShamsi(issueDate);
// Expected: '1404/12/29'

// Test: Issue date 1403/06/31 (last day of month)
const issueDate2 = '1403/06/31';
const expiryDate2 = addOneYearShamsi(issueDate2);
// Expected: '1404/06/31'
```

## Notes

- All dates are stored in Shamsi format (YYYY/MM/DD)
- Validity period is fixed at 12 months (1 year)
- License history is immutable (no updates, only inserts)
- Status changes create new history entries
- Gregorian dates are not stored or used in calculations

## Related Files

- `server/migrations/remove_gregorian_dates_from_license_history.sql`
- `server/src/utils/shamsiDateUtils.js`
- `server/src/utils/licenseHistoryLogger.js`
- `server/src/controllers/workflow.controller.js`
- `DATABASE_SCHEMA_REFERENCE.md` (LicenseHistory table definition)
