# Backend Changes for Unified VehicleRequests Table

## Overview
Updated backend to support the unified `VehicleRequests` table that handles all three license types:
1. **پروانه فعالیت (Activity License)** - Vehicle-based
2. **پروانه اشتغال (Employment License)** - Person-based  
3. **پروانه بهره برداری (Exploitation License)** - Person-based

## Database Changes

### VehicleRequests Table - New Fields
| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `LicenseTypeId` | int | License type from `LicenseType` lookup | Yes |
| `OperationTypeId` | int | Operation type from `LicenseDocumentType` lookup | Yes |
| `NationalCode` | nvarchar(20) | Person's national code (for employment/exploitation) | No |
| `VehicleID` | bigint | Vehicle ID (now nullable, for activity licenses) | No |

### Constraints
- `FK_VehicleRequests_LicenseType` → `LookupValue.Id`
- `FK_VehicleRequests_OperationType` → `LookupValue.Id`
- `FK_VehicleRequests_Person` → `Persons.NationalCode`
- `CK_VehicleRequests_VehicleOrPerson` - Either VehicleID or NationalCode must be provided

## Backend Code Changes

### 1. Controller: `server/src/controllers/issue.controller.js`

#### Updated: `createVehicleRequest` Function
**Purpose:** Create activity license requests (vehicle-based)

**Changes:**
- Added `licenseTypeId` parameter (required)
- Added `operationTypeId` parameter (required)
- Updated INSERT query to include new fields

**Request Body:**
```javascript
{
  licenseTypeId: number,      // Required - from LicenseType lookup
  operationTypeId: number,    // Required - from LicenseDocumentType lookup
  finalDescription: string    // Optional
}
```

**Example:**
```javascript
POST /api/issue/vehicle/123/finalize
{
  "licenseTypeId": 1,        // فعالیت (Activity)
  "operationTypeId": 5,      // صدور (Issuance)
  "finalDescription": "توضیحات"
}
```

#### New: `createEmploymentRequest` Function
**Purpose:** Create employment license requests (person-based)

**Features:**
- Uses `nationalCode` instead of `vehicleId`
- Generates employment-specific tracking number format: `EMPL-YYYYMMDD-NNNNN`
- Links to `EmploymentDiscountDocuments` table
- Creates discount approval workflow if discount documents exist

**Request Body:**
```javascript
{
  nationalCode: string,       // Required
  licenseTypeId: number,      // Required - from LicenseType lookup
  operationTypeId: number,    // Required - from LicenseDocumentType lookup
  finalDescription: string    // Optional
}
```

**Example:**
```javascript
POST /api/issue/employment/finalize
{
  "nationalCode": "1234567890",
  "licenseTypeId": 2,        // اشتغال (Employment)
  "operationTypeId": 5,      // صدور (Issuance)
  "finalDescription": "توضیحات"
}
```

**Response:**
```javascript
{
  "requestId": 123,
  "trackingNo": "EMPL-20251015-00001",
  "discountStatus": "Pending",
  "hasDiscountDocs": true,
  "requiresDiscountApproval": true
}
```

### 2. Routes: `server/src/routes/modules/issue.js`

#### Updated Imports
Added `createEmploymentRequest` to imports

#### New Route
```javascript
POST /api/issue/employment/finalize
```
- Requires authentication (`authRequired` middleware)
- Calls `createEmploymentRequest` controller function

## API Endpoints Summary

### Activity License (Vehicle-based)
```
POST /api/issue/vehicle/:vehicleId/finalize
Body: { licenseTypeId, operationTypeId, finalDescription }
```

### Employment License (Person-based)
```
POST /api/issue/employment/finalize
Body: { nationalCode, licenseTypeId, operationTypeId, finalDescription }
```

### Employment Discount Documents
```
GET    /api/issue/employment/:nationalCode/discount-documents
POST   /api/issue/employment/:nationalCode/discount-documents
DELETE /api/issue/employment/:nationalCode/discount-documents/:docId
GET    /api/issue/employment/:nationalCode/discount-documents/:docId/content
```

## Tracking Number Formats

### Activity License
Format: `3XYY-NNNNN`
- `3` = Fixed digit for activity licenses
- `X` = Vehicle type (2, 3, or 4 based on capacity)
- `YY` = Activity category code
- `NNNNN` = Sequential number starting from 30010

Example: `3245-30015`

### Employment License
Format: `2XYY-NNNNN`
- `2` = Fixed digit for employment licenses
- `X` = Employment type (0 for now, can be expanded)
- `YY` = Operation type code (00 for now, can be customized)
- `NNNNN` = Sequential number starting from 20010

Example: `2000-20015`

### Exploitation License (Future)
Format: `1XYY-NNNNN`
- `1` = Fixed digit for exploitation licenses
- `X` = Exploitation type
- `YY` = Operation type code
- `NNNNN` = Sequential number starting from 10010

Example: `1000-10001`

## Lookup Categories

### LicenseType (نوع پروانه)
Used for `LicenseTypeId` field:
- فعالیت (Activity)
- اشتغال (Employment)
- بهره برداری (Exploitation)

### LicenseDocumentType (نوع سند پروانه)
Used for `OperationTypeId` field:
- صدور (Issuance)
- تمدید (Renewal)
- اصلاح (Amendment)
- etc.

## Workflow Integration

Both activity and employment requests support:
✅ **Discount Documents** - Automatic workflow creation if discount docs exist
✅ **Workflow Steps** - Integration with `RequestWorkflowSteps` table
✅ **Status Management** - Automatic status updates (Pending → InProgress)
✅ **Document Linking** - Links discount documents to request via `RequestID`

## Testing Checklist

### Activity License
- [ ] Create activity license request with licenseTypeId and operationTypeId
- [ ] Verify tracking number format (3XYY-NNNNN)
- [ ] Verify VehicleID is populated, NationalCode is NULL
- [ ] Test with discount documents
- [ ] Test without discount documents

### Employment License
- [ ] Create employment license request with nationalCode
- [ ] Verify tracking number format (EMPL-YYYYMMDD-NNNNN)
- [ ] Verify NationalCode is populated, VehicleID is NULL
- [ ] Test with discount documents
- [ ] Test without discount documents
- [ ] Verify EmploymentDiscountDocuments are linked to request

### Database Integrity
- [ ] Verify foreign key constraints work
- [ ] Verify check constraint (VehicleID OR NationalCode) works
- [ ] Verify indexes are created
- [ ] Test vw_UnifiedRequests view

## Next Steps

1. ✅ **Backend Updated** - Controllers and routes support unified table
2. ⏳ **Frontend Updates Needed**:
   - Update `IssueLicense.jsx` to send licenseTypeId and operationTypeId
   - Update `IssueEmploymentLicense.jsx` to use new employment endpoint
   - Add license type and operation type selection UI
3. ⏳ **Admin Pages**:
   - Update inbox/review pages to show license type
   - Add filtering by license type
   - Update request details page

## Migration Status

- ✅ Database migration script created (`unify_vehicle_requests_v2.sql`)
- ✅ Backend controllers updated
- ✅ Backend routes added
- ⏳ Frontend updates pending
- ⏳ Admin pages updates pending

## Important Notes

1. **Backward Compatibility**: Existing activity license requests will work after migration updates them with default values
2. **Authentication**: All finalize endpoints require authentication
3. **Validation**: Both licenseTypeId and operationTypeId are required fields
4. **Discount Workflow**: Automatically created when discount documents exist
5. **Tracking Numbers**: Different formats for different license types for easy identification
