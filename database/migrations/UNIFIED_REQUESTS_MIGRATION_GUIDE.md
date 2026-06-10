# Unified Requests Migration Guide

## Overview
This migration transforms the `VehicleRequests` table into a unified requests table that supports all three license types:
1. **پروانه فعالیت (Activity License)** - Vehicle-based
2. **پروانه اشتغال (Employment License)** - Person-based
3. **پروانه بهره برداری (Exploitation License)** - Person-based

## Database Changes

### New Columns Added
| Column | Type | Description | Required |
|--------|------|-------------|----------|
| `LicenseTypeId` | int | Type of license (references LookupValue) | Yes |
| `OperationTypeId` | int | Operation type: صدور, تمدید, اصلاح, etc. (references LookupValue) | Yes |
| `NationalCode` | nvarchar(20) | Person's national code for employment/exploitation licenses | No |

### Modified Columns
- `VehicleID` - Changed from NOT NULL to NULL (not all licenses need a vehicle)

### New Constraints
- `FK_VehicleRequests_LicenseType` - Foreign key to LookupValue
- `FK_VehicleRequests_OperationType` - Foreign key to LookupValue
- `FK_VehicleRequests_Person` - Foreign key to Persons table
- `CK_VehicleRequests_VehicleOrPerson` - Check constraint: either VehicleID or NationalCode must be provided

### New Indexes
- `IX_VehicleRequests_LicenseType` - Performance index for license type queries
- `IX_VehicleRequests_OperationType` - Performance index for operation type queries
- `IX_VehicleRequests_NationalCode` - Performance index for person-based licenses
- `IX_VehicleRequests_TrackingNo` - Performance index for tracking number lookups

### New View
- `vw_UnifiedRequests` - Unified view joining all related tables for easy querying

## Migration Steps

### 1. Run Migration Script
```sql
-- Execute the migration script
-- File: database/migrations/unify_vehicle_requests_table.sql
```

### 2. Verify Data Migration
```sql
-- Check that all existing records have been updated
SELECT 
    COUNT(*) AS TotalRequests,
    SUM(CASE WHEN LicenseTypeId IS NOT NULL THEN 1 ELSE 0 END) AS WithLicenseType,
    SUM(CASE WHEN OperationTypeId IS NOT NULL THEN 1 ELSE 0 END) AS WithOperationType
FROM VehicleRequests;

-- Should show all records have both fields populated
```

### 3. Test Unified View
```sql
-- Test the unified view
SELECT TOP 10 * FROM vw_UnifiedRequests
ORDER BY CreatedAt DESC;
```

## Code Changes Required

### Backend Files to Update

#### 1. Controllers
- **`server/src/controllers/issue.controller.js`**
  - Update `createVehicleRequest` function to accept `licenseTypeId`, `operationTypeId`, `nationalCode`
  - Add validation for license type and operation type
  - Handle person-based licenses (employment/exploitation)
  
#### 2. Routes
- **`server/src/routes/modules/issue.js`**
  - Update routes to support unified request creation
  - Add routes for employment and exploitation license requests

#### 3. Models/Types (if any)
- Update TypeScript/JSDoc types for request objects

### Frontend Files to Update

#### 1. Issue Pages
- **`client/src/pages/IssueLicense.jsx`** (Activity License)
  - Add `licenseTypeId` and `operationTypeId` to request payload
  - Set licenseTypeId to "فعالیت" (Activity)
  
- **`client/src/pages/IssueEmploymentLicense.jsx`** (Employment License)
  - Update to use unified request creation
  - Add `licenseTypeId` (Employment) and `operationTypeId`
  - Include `nationalCode` in request

#### 2. Admin/Review Pages
- **`client/src/pages/admin/ReviewRequest.jsx`** (if exists)
  - Update to handle all license types
  - Show/hide sections based on `licenseTypeId`
  - Display appropriate fields for each license type

#### 3. Request List/Inbox Pages
- **`client/src/pages/Inbox.jsx`** (or similar)
  - Update queries to include license type and operation type
  - Display license type badge/indicator
  - Filter by license type

## API Changes

### Request Creation Endpoint
**Before:**
```javascript
POST /api/issue/vehicle/:vehicleId/finalize
Body: {
  finalDescription: string
}
```

**After:**
```javascript
POST /api/issue/requests/create
Body: {
  licenseTypeId: number,        // Required
  operationTypeId: number,       // Required
  vehicleId?: number,            // Optional (for activity licenses)
  nationalCode?: string,         // Optional (for employment/exploitation)
  finalDescription?: string
}
```

### Request Query Endpoints
```javascript
// Get all requests (unified)
GET /api/requests?licenseType=&operationType=&status=

// Get request by ID
GET /api/requests/:requestId

// Get requests by national code (employment/exploitation)
GET /api/requests/person/:nationalCode

// Get requests by vehicle (activity)
GET /api/requests/vehicle/:vehicleId
```

## Testing Checklist

### Database
- [ ] Migration script runs without errors
- [ ] All existing records have LicenseTypeId and OperationTypeId
- [ ] Indexes are created successfully
- [ ] View `vw_UnifiedRequests` returns data correctly

### Backend
- [ ] Create activity license request (with VehicleID)
- [ ] Create employment license request (with NationalCode)
- [ ] Create exploitation license request (with NationalCode)
- [ ] Query requests by license type
- [ ] Query requests by operation type
- [ ] Query requests by national code
- [ ] Query requests by vehicle ID

### Frontend
- [ ] Activity license issuance form works
- [ ] Employment license issuance form works
- [ ] Admin can review all license types
- [ ] Inbox shows all request types with proper badges
- [ ] Filtering by license type works
- [ ] Request details page shows correct information for each type

## Rollback Plan

If issues occur, you can rollback using:

```sql
-- Remove new columns
ALTER TABLE VehicleRequests DROP CONSTRAINT FK_VehicleRequests_LicenseType;
ALTER TABLE VehicleRequests DROP CONSTRAINT FK_VehicleRequests_OperationType;
ALTER TABLE VehicleRequests DROP CONSTRAINT FK_VehicleRequests_Person;
ALTER TABLE VehicleRequests DROP CONSTRAINT CK_VehicleRequests_VehicleOrPerson;

ALTER TABLE VehicleRequests DROP COLUMN LicenseTypeId;
ALTER TABLE VehicleRequests DROP COLUMN OperationTypeId;
ALTER TABLE VehicleRequests DROP COLUMN NationalCode;

-- Restore VehicleID as NOT NULL
ALTER TABLE VehicleRequests ALTER COLUMN VehicleID bigint NOT NULL;

-- Drop indexes
DROP INDEX IX_VehicleRequests_LicenseType ON VehicleRequests;
DROP INDEX IX_VehicleRequests_OperationType ON VehicleRequests;
DROP INDEX IX_VehicleRequests_NationalCode ON VehicleRequests;
DROP INDEX IX_VehicleRequests_TrackingNo ON VehicleRequests;

-- Drop view
DROP VIEW vw_UnifiedRequests;
```

## Next Steps

1. **Run the migration script** on development database first
2. **Update backend controllers** to support new fields
3. **Update frontend forms** to send new fields
4. **Test thoroughly** with all three license types
5. **Update documentation** for API endpoints
6. **Train users** on new unified system

## Benefits of Unified Approach

✅ **Single source of truth** - All requests in one table
✅ **Easier reporting** - Query all license types together
✅ **Consistent workflow** - Same approval process for all types
✅ **Better analytics** - Compare metrics across license types
✅ **Simplified maintenance** - One codebase for all license types
✅ **Future-proof** - Easy to add new license types or operations
