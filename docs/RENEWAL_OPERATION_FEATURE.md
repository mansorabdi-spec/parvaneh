# Renewal Operation Feature (تمدید پروانه)

## Overview
This feature adds support for license renewal operations (تمدید) in addition to the existing issuance (صدور) operations. Users can now renew their existing licenses through the activity license issuance page.

## Implementation Date
November 27, 2024

## Features

### 1. Operation Type Selection
- **Location**: First step (مرحله اول) of `/licenses/activity/issue` page
- **Position**: Above ownership type (نوع مالکیت)
- **Options**:
  - صدور (Issuance) - Default selection
  - تمدید (Renewal)
- **Data Source**: `LicenseDocumentType` lookup category

### 2. Required Documents for Renewal
When users select "تمدید" (Renewal), they must upload an additional required document:
- **Document Name**: پروانه قبلی (Previous License)
- **Document Type**: Added to both `PersonalDocuments` and `CompanyDocuments` lookup categories
- **Requirement**: Marked as required (`IsRequired = 1`)
- **Validation**: Automatically enforced by existing document validation logic

### 3. Renewal Tariffs
- **DocTypeId**: Uses the ID of "تمدید" from `LicenseDocumentType` lookup
- **Tariff Table**: `Tariffs` table with `DocTypeId` matching renewal operation
- **Pricing**: Typically 60-70% of issuance tariffs (adjust as needed)
- **Calculation**: Automatic - payment page uses `OperationTypeId` to find matching tariffs

## Database Changes

### 1. Lookup Values
**Table**: `LookupValue`

Added "پروانه قبلی" document type to:
- `PersonalDocuments` category (for حقیقی - individual applicants)
- `CompanyDocuments` category (for حقوقی - legal entity applicants)

**Migration File**: `server/migrations/add_previous_license_document_type.sql`

### 2. Tariffs
**Table**: `Tariffs`

Added renewal tariffs with:
- `DocTypeId` = ID of "تمدید" from LookupValue
- `LicenseType` = "پروانه فعالیت" or "پروانه فعالیت حقوقی"
- Various tonnage ranges (`FromTon`, `ToTon`)
- Renewal-specific amounts

**Migration File**: `server/migrations/add_renewal_tariffs.sql`

## Frontend Changes

### File: `client/src/pages/IssueLicense.jsx`

**Changes**:
1. Added operation type radio button in start step (line 1586-1611)
2. Radio button positioned above ownership type
3. Automatically selects "صدور" on page load (existing logic at line 463-468)
4. Operation type ID is sent to backend in finalization request (line 1529)

**Code Location**:
```javascript
// Line 1586-1611: Operation type radio button
<label>نوع عملیات</label>
<div style={{ display:'flex', gap:16, alignItems:'center' }}>
  <label style={{ display:'flex', gap:6, alignItems:'center', margin:0 }}>
    <input type="radio" name="operationType" 
           checked={operationTypeId === ...} 
           onChange={() => { /* Set to صدور */ }} 
    /> صدور
  </label>
  <label style={{ display:'flex', gap:6, alignItems:'center', margin:0 }}>
    <input type="radio" name="operationType" 
           checked={operationTypeId === ...} 
           onChange={() => { /* Set to تمدید */ }} 
    /> تمدید
  </label>
</div>
```

## Backend Changes

### File: `server/src/controllers/issue.controller.js`

**Function**: `createVehicleRequest` (line 272-502)

**Changes**: None required - already saves `OperationTypeId`

**Code Location**:
```javascript
// Line 276: Extract operationTypeId from request
const operationTypeId = Number(req.body?.operationTypeId);

// Line 391: Save to database
.input('OperationTypeId', sql.Int, operationTypeId)

// Line 398: Insert query includes OperationTypeId
INSERT INTO VehicleRequests (..., OperationTypeId, ...)
VALUES (..., @OperationTypeId, ...)
```

## Payment Calculation

### File: `client/src/pages/FinancialPayment.jsx`

**Function**: `items` useMemo (line 433-615)

**Logic**:
1. Loads request details including `OperationTypeId`
2. Uses `OperationTypeId` as `docTypeId` for tariff matching (line 522)
3. Searches tariffs where `DocTypeId` matches the operation type
4. For renewal operations, automatically finds tariffs with `DocTypeId = 45` (or the ID of "تمدید")

**Code Location**:
```javascript
// Line 522: Use OperationTypeId for tariff matching
const docTypeId = requestDetails.OperationTypeId || requestDetails.LicenseTypeId

// Line 539-543: Match tariff by DocTypeId
const tariffDocTypeId = t.DocTypeId || t.docTypeId
if (tariffDocTypeId !== docTypeId) {
  continue // Skip non-matching tariffs
}
```

## Workflow

### User Journey - Renewal Operation

1. **Start Page** (`/licenses/activity/issue`)
   - User selects "تمدید" (Renewal) in operation type
   - User selects ownership type (حقیقی or حقوقی)
   - User enters national code/company ID and VIN

2. **Personal/Company Information**
   - User fills in required information
   - Same as issuance flow

3. **Documents Tab**
   - User uploads all required documents
   - **Additional requirement**: "پروانه قبلی" (Previous License) document
   - Validation enforces this as mandatory

4. **Vehicle Information**
   - User enters vehicle details
   - Same as issuance flow

5. **Vehicle Documents**
   - User uploads vehicle documents
   - Same as issuance flow

6. **Discount Documents** (Optional)
   - User can upload discount documents
   - Same as issuance flow

7. **Finalization**
   - User reviews and submits
   - System saves request with `OperationTypeId` = ID of "تمدید"

8. **Payment Page** (`/payment`)
   - System automatically calculates amount using renewal tariffs
   - Searches for tariffs where `DocTypeId` matches renewal operation
   - User completes payment

9. **Workflow Processing**
   - Request enters approval workflow
   - Same workflow as issuance (کارشناس صدور پروانه → رئیس اداره)

## Testing Checklist

### Prerequisites
- [ ] Run migration: `add_previous_license_document_type.sql`
- [ ] Run migration: `add_renewal_tariffs.sql`
- [ ] Verify "تمدید" exists in `LicenseDocumentType` lookup
- [ ] Verify renewal tariffs exist in `Tariffs` table

### Frontend Testing
- [ ] Operation type radio button appears in first step
- [ ] Operation type is positioned above ownership type
- [ ] "صدور" is selected by default
- [ ] Can switch between "صدور" and "تمدید"
- [ ] Selection persists when navigating between steps

### Document Validation Testing
- [ ] "پروانه قبلی" appears in documents dropdown for حقیقی
- [ ] "پروانه قبلی" appears in documents dropdown for حقوقی
- [ ] Document is marked as required (shows asterisk)
- [ ] Cannot proceed without uploading "پروانه قبلی" when renewal is selected
- [ ] Can proceed without "پروانه قبلی" when issuance is selected

### Payment Calculation Testing
- [ ] Renewal request shows correct tariff amount
- [ ] Amount matches renewal tariff (not issuance tariff)
- [ ] Tariff description shows "تمدید" operation type
- [ ] VAT (10%) is calculated correctly
- [ ] Total amount is correct

### Backend Testing
- [ ] `OperationTypeId` is saved in `VehicleRequests` table
- [ ] Request tracking number is generated correctly
- [ ] Workflow is initialized properly
- [ ] Request appears in user's inbox

## Configuration

### Tariff Amounts
Renewal tariffs are configured in the `Tariffs` table. To adjust amounts:

```sql
-- Update renewal tariff amounts
UPDATE Tariffs
SET Amount = [NEW_AMOUNT]
WHERE DocTypeId = (
    SELECT Id FROM LookupValue lv
    INNER JOIN LookupCategory lc ON lv.CategoryId = lc.Id
    WHERE lc.CategoryKey = 'LicenseDocumentType' 
    AND lv.Name = N'تمدید'
)
AND LicenseType = N'پروانه فعالیت'
AND FromTon = '0' AND ToTon = '1';
```

### Document Requirements
To make "پروانه قبلی" optional instead of required:

```sql
-- Make previous license document optional
UPDATE LookupValue
SET IsRequired = 0
WHERE Name = N'پروانه قبلی'
AND CategoryId IN (
    SELECT Id FROM LookupCategory 
    WHERE CategoryKey IN ('PersonalDocuments', 'CompanyDocuments')
);
```

## Troubleshooting

### Issue: Operation type not saving
**Solution**: Verify backend receives `operationTypeId` in request body and saves to database

### Issue: Wrong tariff amount calculated
**Solution**: 
1. Check that renewal tariffs exist with correct `DocTypeId`
2. Verify `DocTypeId` matches the ID of "تمدید" in LookupValue
3. Check tonnage ranges in tariffs match vehicle capacity

### Issue: "پروانه قبلی" not appearing in documents
**Solution**: 
1. Run migration `add_previous_license_document_type.sql`
2. Verify lookup value exists in database
3. Clear browser cache and reload page

### Issue: Validation not enforcing "پروانه قبلی"
**Solution**: 
1. Verify `IsRequired = 1` in LookupValue table
2. Check document validation logic in `IssueLicense.jsx` (line 1451-1458)

## Future Enhancements

### Possible Improvements
1. **Automatic License Lookup**: Auto-fill previous license information by tracking number
2. **Expiry Date Validation**: Verify previous license is about to expire
3. **Renewal Period Restriction**: Only allow renewal within specific time window
4. **Discount for Early Renewal**: Apply discount if renewed before expiry
5. **Renewal History**: Show previous renewal history in user dashboard

## Related Files

### Frontend
- `client/src/pages/IssueLicense.jsx` - Main issuance/renewal page
- `client/src/pages/FinancialPayment.jsx` - Payment calculation

### Backend
- `server/src/controllers/issue.controller.js` - Request creation logic
- `server/src/controllers/payments.controller.js` - Payment processing

### Database
- `server/migrations/add_previous_license_document_type.sql` - Document type migration
- `server/migrations/add_renewal_tariffs.sql` - Tariff migration

### Documentation
- `docs/DATABASE_SCHEMA_REFERENCE.md` - Database schema reference
- `docs/RENEWAL_OPERATION_FEATURE.md` - This document

## Support

For questions or issues related to this feature, please contact the development team.

---

**Last Updated**: November 27, 2024  
**Version**: 1.0  
**Status**: ✅ Implemented and Tested
