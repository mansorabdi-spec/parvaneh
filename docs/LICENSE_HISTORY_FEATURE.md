# License History Feature Documentation

## Overview

The License History feature automatically tracks and records all license lifecycle events including issuance, renewal, and revocation. This provides a complete audit trail of all licenses in the system with issue dates, expiry dates, and status tracking.

## Database Schema

### LicenseHistory Table

The `LicenseHistory` table stores all license lifecycle events:

| Field | Type | Description |
|-------|------|-------------|
| HistoryID | BIGINT | Primary key, auto-increment |
| RequestID | BIGINT | Foreign key to VehicleRequests |
| TrackingNo | NVARCHAR(30) | Tracking number of the request |
| LicenseTypeId | INT | License type ID |
| LicenseTypeName | NVARCHAR(200) | License type name (cached) |
| OperationTypeId | INT | Operation type ID (صدور/تمدید) |
| OperationTypeName | NVARCHAR(200) | Operation type name (cached) |
| EventType | NVARCHAR(50) | Event type: 'Issued', 'Renewed', 'Revoked', 'Cancelled' |
| VehicleID | BIGINT | Vehicle ID (null for employment licenses) |
| NationalCode | NVARCHAR(20) | National code for individuals |
| CompanyNationalId | NVARCHAR(100) | Company national ID for legal entities |
| IssueDate | NVARCHAR(10) | Issue date in Shamsi format (e.g., '1403/09/29') |
| ExpiryDate | NVARCHAR(10) | Expiry date in Shamsi format |
| IssueDateGregorian | DATETIME2 | Issue date in Gregorian format for querying |
| ExpiryDateGregorian | DATETIME2 | Expiry date in Gregorian format for querying |
| ValidityDurationMonths | INT | Validity duration in months (e.g., 12) |
| Status | NVARCHAR(20) | License status: 'Active', 'Expired', 'Revoked', 'Cancelled' |
| IssuedByUserId | INT | User ID who issued the license |
| IssuedByUsername | NVARCHAR(150) | Username who issued the license |
| IssuedByRole | NVARCHAR(50) | Role who issued the license |
| RevokedByUserId | INT | User ID who revoked the license (if applicable) |
| RevokedByUsername | NVARCHAR(150) | Username who revoked the license |
| RevokedAt | DATETIME2 | Revocation timestamp |
| RevocationReason | NVARCHAR(2000) | Reason for revocation |
| Notes | NVARCHAR(MAX) | Additional notes |
| Metadata | NVARCHAR(MAX) | JSON metadata for additional information |
| CreatedAt | DATETIME2 | Record creation timestamp |
| UpdatedAt | DATETIME2 | Record update timestamp |

### Indexes

The following indexes are created for optimal query performance:

- `IX_LicenseHistory_RequestID` - For querying by request
- `IX_LicenseHistory_TrackingNo` - For querying by tracking number
- `IX_LicenseHistory_EventType` - For filtering by event type
- `IX_LicenseHistory_Status` - For filtering by status
- `IX_LicenseHistory_VehicleID` - For querying by vehicle
- `IX_LicenseHistory_NationalCode` - For querying by person

### Foreign Keys

- `FK_LicenseHistory_VehicleRequests` - Links to VehicleRequests table
- `FK_LicenseHistory_IssuedByUser` - Links to Users table (issuer)
- `FK_LicenseHistory_RevokedByUser` - Links to Users table (revoker)
- `FK_LicenseHistory_Vehicle` - Links to Vehicles table

## Backend Implementation

### Controller: `licensehistory.controller.js`

**Functions:**

1. **createLicenseHistory(req, res, next)**
   - Creates a new license history record
   - Endpoint: `POST /api/license-history`
   - Requires authentication

2. **getLicenseHistoryByRequest(req, res, next)**
   - Gets all history records for a specific request
   - Endpoint: `GET /api/license-history/request/:requestId`
   - Requires authentication

3. **getLicenseHistoryByTracking(req, res, next)**
   - Gets all history records for a tracking number
   - Endpoint: `GET /api/license-history/tracking/:trackingNo`
   - Requires authentication

4. **getAllLicenseHistory(req, res, next)**
   - Gets all license history with filters and pagination
   - Endpoint: `GET /api/license-history/all`
   - Query parameters: eventType, status, licenseTypeId, fromDate, toDate, page, limit
   - Requires authentication

5. **getLicenseHistoryStatistics(req, res, next)**
   - Gets comprehensive statistics about license history
   - Endpoint: `GET /api/license-history/statistics`
   - Returns: total counts, breakdown by license type, recent activity
   - Requires authentication

6. **revokeLicense(req, res, next)**
   - Revokes a license by updating its status
   - Endpoint: `PUT /api/license-history/revoke/:historyId`
   - Requires authentication

7. **getActiveLicensesByVehicle(req, res, next)**
   - Gets all active licenses for a specific vehicle
   - Endpoint: `GET /api/license-history/vehicle/:vehicleId/active`
   - Requires authentication

8. **getActiveLicensesByPerson(req, res, next)**
   - Gets all active licenses for a specific person
   - Endpoint: `GET /api/license-history/person/:nationalCode/active`
   - Requires authentication

9. **updateExpiringLicenses(req, res, next)**
   - Updates status of expired licenses to 'Expired'
   - Endpoint: `POST /api/license-history/update-expiring`
   - Should be run periodically (e.g., daily cron job)
   - Requires authentication

### Utility: `licenseHistoryLogger.js`

**Functions:**

1. **logLicenseHistory(params)**
   - Main function to log license history events
   - Called automatically when licenses are approved
   - Parameters: requestId, trackingNo, licenseTypeId, eventType, issueDate, expiryDate, etc.

2. **calculateExpiryDate(issueDate, validityMonths)**
   - Calculates expiry date based on issue date and validity duration
   - Uses Shamsi calendar
   - Default validity: 12 months

3. **shamsiToGregorian(shamsiDate)**
   - Converts Shamsi date to approximate Gregorian date
   - Used for database querying and filtering

## Automatic License Logging

### Workflow Integration

The license history is automatically logged when a license is approved in the workflow. This happens in the `makeDecision` function in `workflow.controller.js`:

**Trigger:** When the final workflow step is approved and request status becomes 'Approved'

**Process:**
1. Transaction commits the approval
2. System fetches request details (tracking number, license type, etc.)
3. Determines event type ('Issued' or 'Renewed' based on operation type)
4. Calculates issue date (current Shamsi date)
5. Calculates expiry date (issue date + 12 months)
6. Logs to LicenseHistory table with status 'Active'
7. Records issuer information (user ID, username, role)

**Error Handling:** If logging fails, the error is logged but doesn't affect the approval process.

## Frontend Implementation

### Admin Page: `AdminLicenseHistory.jsx`

**Location:** `/admin/license-history`

**Features:**

1. **Statistics Dashboard**
   - Total records
   - Total issued licenses
   - Total renewed licenses
   - Total active licenses

2. **Filters**
   - Event type (Issued, Renewed, Revoked, Cancelled)
   - Status (Active, Expired, Revoked, Cancelled)
   - License type
   - Date range (from/to in Shamsi format)

3. **License History Table**
   - Tracking number
   - License type
   - Operation type
   - Event type (with color-coded badges)
   - Issue date
   - Expiry date
   - Status (with color-coded badges)
   - Issuer information

4. **Pagination**
   - 50 records per page
   - Page navigation
   - Total count display

5. **Statistics by License Type**
   - Breakdown of licenses by type
   - Counts for issued, renewed, and active licenses per type

**Color Coding:**

Event Type Badges:
- Issued: Green
- Renewed: Blue
- Revoked: Red
- Cancelled: Gray

Status Badges:
- Active: Green
- Expired: Orange
- Revoked: Red
- Cancelled: Gray

## API Endpoints Summary

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/license-history` | Create license history record | Yes |
| GET | `/api/license-history/request/:requestId` | Get history by request | Yes |
| GET | `/api/license-history/tracking/:trackingNo` | Get history by tracking | Yes |
| GET | `/api/license-history/all` | Get all history with filters | Yes |
| GET | `/api/license-history/statistics` | Get statistics | Yes |
| PUT | `/api/license-history/revoke/:historyId` | Revoke a license | Yes |
| GET | `/api/license-history/vehicle/:vehicleId/active` | Get active licenses by vehicle | Yes |
| GET | `/api/license-history/person/:nationalCode/active` | Get active licenses by person | Yes |
| POST | `/api/license-history/update-expiring` | Update expired licenses | Yes |

## Usage Examples

### Query License History for a Request

```javascript
const response = await api.get(`/api/license-history/request/${requestId}`);
const history = response.data.data;
```

### Get Statistics

```javascript
const response = await api.get('/api/license-history/statistics');
const stats = response.data.statistics;
console.log(`Total licenses: ${stats.TotalRecords}`);
console.log(`Active licenses: ${stats.TotalActive}`);
```

### Filter License History

```javascript
const response = await api.get('/api/license-history/all', {
  params: {
    eventType: 'Issued',
    status: 'Active',
    licenseTypeId: 66,
    page: 1,
    limit: 50
  }
});
```

### Manually Log License History

```javascript
await api.post('/api/license-history', {
  requestId: 123,
  trackingNo: '100-1403-000123',
  licenseTypeId: 66,
  licenseTypeName: 'پروانه فعالیت',
  operationTypeId: 1,
  operationTypeName: 'صدور',
  eventType: 'Issued',
  vehicleId: 456,
  nationalCode: '1234567890',
  issueDate: '1403/09/29',
  expiryDate: '1404/09/29',
  validityDurationMonths: 12,
  status: 'Active',
  issuedByUserId: 1,
  issuedByUsername: 'admin',
  issuedByRole: 'Admin'
});
```

## Permissions

**Page:** `admin_license_history`
**Path:** `/admin/license-history`
**Title:** تاریخچه پروانه‌ها
**Granted to:** Admin role

## Migration Files

1. **create_license_history_table.sql** - Creates the LicenseHistory table with indexes and constraints
2. **add_license_history_page.sql** - Adds the page to Pages table and grants permissions

## Maintenance

### Updating Expired Licenses

Run this endpoint periodically (e.g., daily via cron job) to automatically update expired licenses:

```bash
POST /api/license-history/update-expiring
```

This will update all licenses where:
- Status is 'Active'
- ExpiryDateGregorian is in the past

## Future Enhancements

1. **Automatic Expiry Notifications**
   - Send notifications to users when licenses are about to expire
   - Configurable notification periods (e.g., 30 days, 7 days before expiry)

2. **License Renewal Workflow**
   - Automatic creation of renewal requests for expiring licenses
   - Link renewal requests to original license history

3. **Advanced Reporting**
   - Export license history to Excel/PDF
   - Custom date range reports
   - License expiry forecasting

4. **Revocation Workflow**
   - Formal revocation request process
   - Approval workflow for license revocations
   - Automatic notification to license holders

5. **Integration with External Systems**
   - API for external systems to query license status
   - Real-time license verification service

## Notes

- All dates are stored in both Shamsi (Persian) and Gregorian formats for flexibility
- The system automatically logs license events when workflow approvals complete
- License history is immutable - records are never deleted, only status is updated
- The feature supports all license types (Activity, Exploitation, Employment)
- Both individual (حقیقی) and legal entity (حقوقی) licenses are tracked
