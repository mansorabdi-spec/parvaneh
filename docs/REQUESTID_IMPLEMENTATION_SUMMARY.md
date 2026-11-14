# RequestID Implementation Summary

**Date:** 2025-10-09  
**Status:** Ready for implementation

---

## Overview

Adding `RequestID` column to `VehicleDiscountDocuments` and `VehicleLabel` tables to link them directly to specific requests. Also ensuring `RequestID` in `OnlinePayment` and `OfflinePayment` is properly used throughout the codebase.

---

## Step 1: Run Database Migration

**File:** `server/database/add_requestid_to_discount_and_label_tables.sql`

**What it does:**
1. Adds `RequestID BIGINT NULL` to `VehicleDiscountDocuments`
2. Adds `RequestID BIGINT NULL` to `VehicleLabel`
3. Creates foreign key constraints
4. Updates existing records with RequestID
5. Creates indexes for performance
6. Includes verification queries

**Run command:**
```bash
# In SQL Server Management Studio or sqlcmd
sqlcmd -S DESKTOP-U61G9KA\SQL2022 -d parvaneh -U parvanehuser -P parvanehpass -i server/database/add_requestid_to_discount_and_label_tables.sql
```

---

## Step 2: Schema File Updated

**File:** `DATABASE_SCHEMA_REFERENCE.md`

**Changes made:**
1. ✅ Added documentation header with important notes
2. ✅ Added `RequestID` column to `VehicleDiscountDocuments` table definition
3. ✅ Added `RequestID` column to `VehicleLabel` table definition

**Note:** Foreign key constraints will be added by the migration script.

---

## Step 3: Backend Code Changes Needed

### A. VehicleDiscountDocuments - Link to Request

**File:** `server/src/controllers/issue.controller.js`

**Current:** Discount documents are uploaded before request is created

**Change needed:** After request is created, update discount documents with RequestID:

```javascript
// In createVehicleRequest function, after request is created
if (hasDiscountDocs && row?.RequestID) {
  // Update discount documents with RequestID
  await pool.request()
    .input('RequestID', sql.BigInt, row.RequestID)
    .input('VehicleID', sql.BigInt, vehicleId)
    .query(`
      UPDATE VehicleDiscountDocuments
      SET RequestID = @RequestID
      WHERE VehicleID = @VehicleID AND RequestID IS NULL
    `);
  
  console.log(`✅ Linked ${result.rowsAffected[0]} discount documents to request ${row.RequestID}`);
}
```

### B. VehicleLabel - Include RequestID on Upload

**File:** Search for vehicle label upload code (likely in workflow controller)

**Change needed:** When uploading label, include RequestID:

```javascript
// Get RequestID from workflow step or vehicle
const requestResult = await pool.request()
  .input('VehicleID', sql.BigInt, vehicleId)
  .query(`
    SELECT TOP 1 RequestID 
    FROM VehicleRequests 
    WHERE VehicleID = @VehicleID 
    ORDER BY CreatedAt DESC
  `);

const requestId = requestResult.recordset[0]?.RequestID;

// Insert with RequestID
await pool.request()
  .input('VehicleID', sql.BigInt, vehicleId)
  .input('LabelImage', sql.VarBinary(sql.MAX), imageBuffer)
  .input('UserID', sql.Int, userId)
  .input('RequestID', sql.BigInt, requestId)
  .input('Notes', sql.NVarChar(1000), notes)
  .query(`
    INSERT INTO VehicleLabel (VehicleID, LabelImage, UserID, RequestID, Notes, CreatedAt)
    VALUES (@VehicleID, @LabelImage, @UserID, @RequestID, @Notes, GETDATE())
  `);
```

### C. Payment Tables - Already Have RequestID

**Files:** 
- `server/src/controllers/payments.controller.js` (createOfflinePayment, verifyPayment)

**Status:** ✅ Already implemented correctly
- `createOfflinePayment` sets RequestID (line 88-103)
- `verifyPayment` sets RequestID for online payments (line 580-600)

**No changes needed** - RequestID is already being set and used.

### D. Query Updates - Use RequestID

**Discount Documents Query:**
```javascript
// OLD: Query by VehicleID
SELECT * FROM VehicleDiscountDocuments WHERE VehicleID = @VehicleID

// NEW: Query by RequestID (when available)
SELECT * FROM VehicleDiscountDocuments WHERE RequestID = @RequestID
```

**Vehicle Label Query:**
```javascript
// OLD: Query by VehicleID
SELECT * FROM VehicleLabel WHERE VehicleID = @VehicleID

// NEW: Query by RequestID (when available)
SELECT * FROM VehicleLabel WHERE RequestID = @RequestID
```

---

## Step 4: Files to Update

### Backend Files:

1. **`server/src/controllers/issue.controller.js`**
   - Update `createVehicleRequest` to link discount documents to request

2. **`server/src/controllers/workflow.controller.js`** (or wherever label upload is)
   - Update vehicle label upload to include RequestID

3. **`server/src/controllers/workflow.controller.js`** (getRequestDetail)
   - Update queries to use RequestID for discount documents and labels

### No Changes Needed:
- ✅ `payments.controller.js` - Already using RequestID correctly

---

## Step 5: Testing Checklist

After migration and code changes:

### Discount Documents:
- [ ] Upload discount documents with new request
- [ ] Verify RequestID is set after request creation
- [ ] Check discount documents appear in request detail
- [ ] Verify old records have RequestID populated

### Vehicle Label:
- [ ] Upload vehicle label for a request
- [ ] Verify RequestID is set on upload
- [ ] Check label appears for department head
- [ ] Verify old records have RequestID populated

### Payments:
- [ ] Create offline payment
- [ ] Verify RequestID is set
- [ ] Create online payment
- [ ] Verify RequestID is set after verification
- [ ] Check payment history shows correct request

---

## Benefits

1. **Better Data Integrity:** Each document/label is linked to specific request
2. **Prevents Confusion:** When vehicle has multiple requests, clear which documents belong to which
3. **Easier Queries:** Can fetch all related data using RequestID
4. **Audit Trail:** Clear history of which documents/labels belong to which request
5. **Performance:** Indexes on RequestID improve query speed

---

## Rollback Plan

If issues occur:

```sql
-- Remove foreign key constraints
ALTER TABLE VehicleDiscountDocuments DROP CONSTRAINT FK_VehicleDiscountDocuments_Request
ALTER TABLE VehicleLabel DROP CONSTRAINT FK_VehicleLabel_Request

-- Remove columns
ALTER TABLE VehicleDiscountDocuments DROP COLUMN RequestID
ALTER TABLE VehicleLabel DROP COLUMN RequestID
```

---

## Next Steps

1. ✅ Migration script created
2. ✅ Schema file updated
3. ⏳ Run migration script in database
4. ⏳ Update backend code (issue.controller.js, workflow.controller.js)
5. ⏳ Test all scenarios
6. ⏳ Verify existing data is linked correctly

---

**Status:** Ready for database migration and code implementation

