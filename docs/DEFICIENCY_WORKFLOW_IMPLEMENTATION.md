# Deficiency Workflow Implementation Summary

## Overview
Complete implementation of the deficiency (رفع نقص) workflow that allows managers and experts to send requests back for corrections, with automatic routing and user notifications.

## Business Rules Implemented

### 1. Deficiency Assignment Rules
- **Default**: Request is returned to the **original user (متقاضی/کاربر مستقل)** who created the request
- **Exception**: If **"رییس اداره صدور پروانه"** sends for deficiency → Goes to **"کارشناس صدور پروانه"**

### 2. User Workflow
1. Manager/Expert reviews request and finds deficiencies
2. Clicks "🔧 رفع نقص" button
3. Enters detailed deficiency notes (required)
4. Request is removed from their inbox
5. Request appears in applicant's inbox with:
   - Orange highlighted row
   - Deficiency notification badge
   - Edit button enabled
6. Applicant edits the request to fix deficiencies
7. After saving edits, request automatically returns to the person who sent it for deficiency
8. Deficiency flags are cleared
9. Workflow continues normally

## Database Changes

### New Fields in VehicleRequests Table

```sql
-- Track deficiency state
HasDeficiency BIT NOT NULL DEFAULT 0

-- Track who sent the deficiency
DeficiencySenderStepOrder INT NULL
DeficiencySenderUserId INT NULL
```

**SQL Migration Script**: `server/database/add_deficiency_tracking_fields.sql`

### RequestProcessHistory Table
- New ActionType: `'FixDeficiency'`
- Stores deficiency notes and routing information

## Backend Implementation

### 1. Fix Deficiency Endpoint
**File**: `server/src/controllers/workflow.controller.js`
**Function**: `fixDeficiency(req, res, next)`

**Route**: `POST /api/workflow/steps/:stepId/fix-deficiency`

**Logic**:
- Validates deficiency notes (required, 1-2000 chars)
- Determines target step based on business rules
- Updates VehicleRequests with deficiency tracking fields
- Resets target step to Pending with deficiency notes
- Records action in RequestProcessHistory
- Returns success with target information

### 2. Updated Inbox Query
**File**: `server/src/controllers/workflow.controller.js`
**Function**: `getMyInbox(req, res, next)`

**Changes**:
- Added `HasDeficiency` and `DeficiencySenderStepOrder` to SELECT
- Allows applicants to see deficiency status in their inbox

### 3. Updated Request Update Logic
**File**: `server/src/controllers/workflow.controller.js`
**Function**: `updateRequest(req, res, next)`

**Changes**:
- Checks if request has deficiency flag
- If deficiency exists:
  - Returns request to deficiency sender's step
  - Clears deficiency flags
  - Assigns to sender user
  - Updates workflow step status
- If no deficiency:
  - Uses original rejection logic (existing behavior)

## Frontend Implementation

### 1. Fix Deficiency Button
**File**: `client/src/pages/WorkflowRequestDetail.jsx`

**Location**: Next to Approve (✅ تایید) and Reject (❌ رد) buttons

**Features**:
- Orange color (#f59e0b)
- Icon: 🔧
- Only visible for users with `approve_request` permission
- Not shown for label specialists

### 2. Fix Deficiency Modal
**File**: `client/src/pages/WorkflowRequestDetail.jsx`

**Features**:
- Title: "🔧 رفع نقص"
- Shows tracking number
- Explanation text about workflow
- Required textarea for deficiency notes
- Submit button (disabled if notes empty)
- Cancel button

### 3. Inbox Enhancements
**File**: `client/src/pages/UserInbox.jsx`

**Visual Indicators**:
- **Row Background**: Orange (#fef3c7) for deficiency requests
- **Deficiency Badge**: 
  - Shows "🔧 رفع نقص" header
  - Displays deficiency notes
  - Orange border and background
  - Located in status column

**Edit Button Logic**:
- Enabled for applicants when:
  - Request is their own
  - Status is Pending/Rejected AND no payment made
  - **OR** request has deficiency flag (new)

### 4. History Display
**File**: `client/src/pages/WorkflowRequestDetail.jsx`

**Deficiency Actions**:
- Icon: 🔧
- Background: Orange (#fef3c7)
- Title: "رفع نقص - ارجاع به مرحله قبل" (orange color)
- Shows deficiency notes

## Complete Workflow Example

### Scenario 1: Technical Expert Sends Deficiency

```
Step 1: کارشناس فنی reviews request at step 3
Step 2: Finds missing documents
Step 3: Clicks "🔧 رفع نقص"
Step 4: Enters: "مدارک هویتی کامل نیست"
Step 5: Request removed from کارشناس فنی inbox
Step 6: Request appears in متقاضی inbox with:
        - Orange row
        - Badge: "🔧 رفع نقص: مدارک هویتی کامل نیست"
        - Edit button enabled
Step 7: متقاضی clicks Edit, uploads documents, saves
Step 8: Request automatically returns to کارشناس فنی (step 3)
Step 9: کارشناس فنی sees request back with note: "رفع نقص انجام شد - بازگشت از کاربر"
Step 10: Workflow continues from step 3
```

### Scenario 2: Head of License Office Sends Deficiency (Exception)

```
Step 1: رییس اداره صدور پروانه reviews at step 5
Step 2: Finds issues
Step 3: Clicks "🔧 رفع نقص"
Step 4: Enters deficiency notes
Step 5: Request goes to کارشناس صدور پروانه (not متقاضی)
Step 6: کارشناس صدور پروانه sees deficiency and fixes
Step 7: After edit, returns to رییس اداره صدور پروانه
```

## API Endpoints

### Fix Deficiency
```
POST /api/workflow/steps/:stepId/fix-deficiency
Authorization: Bearer <token>

Request Body:
{
  "notes": "توضیحات رفع نقص (الزامی)"
}

Response:
{
  "success": true,
  "message": "پرونده برای رفع نقص به متقاضی (کاربر مستقل) ارجاع شد",
  "returnedToStep": 1,
  "returnedToRole": "متقاضی",
  "targetDescription": "متقاضی (کاربر مستقل)"
}
```

### Update Request (Enhanced)
```
PUT /api/workflow/requests/:requestId
Authorization: Bearer <token>

Request Body:
{
  "finalDescription": "...",
  "paymentInfo": { ... }
}

Response (with deficiency):
{
  "message": "تغییرات با موفقیت ذخیره شد و پرونده پس از رفع نقص به [sender name] ارجاع شد",
  "reassigned": true
}
```

## Testing Checklist

### Backend Tests
- [ ] Fix deficiency endpoint validates notes
- [ ] Default routing to original user works
- [ ] Exception routing (رییس اداره → کارشناس) works
- [ ] Deficiency flags are set correctly
- [ ] Process history records deficiency action
- [ ] Update request clears deficiency flags
- [ ] Update request returns to sender correctly

### Frontend Tests
- [ ] Fix deficiency button appears for authorized users
- [ ] Modal opens and validates input
- [ ] Deficiency requests show in inbox with orange highlight
- [ ] Deficiency badge displays notes correctly
- [ ] Edit button enabled for deficiency requests
- [ ] History shows deficiency actions with correct styling
- [ ] After edit, request disappears from applicant inbox
- [ ] Request reappears in sender's inbox

### Integration Tests
- [ ] Complete workflow: Send deficiency → Edit → Return
- [ ] Multiple deficiency iterations work
- [ ] Deficiency + rejection scenarios
- [ ] Permission checks work correctly
- [ ] Database transactions are atomic

## Files Modified

### Backend
1. `server/src/controllers/workflow.controller.js`
   - Added `fixDeficiency()` function
   - Updated `getMyInbox()` query
   - Enhanced `updateRequest()` logic

2. `server/src/routes/modules/workflow.js`
   - Added fix deficiency route

3. `server/database/add_deficiency_tracking_fields.sql`
   - New migration script

4. `server/database/create_request_process_history_table.sql`
   - Documentation update

### Frontend
1. `client/src/pages/WorkflowRequestDetail.jsx`
   - Added fix deficiency button
   - Added fix deficiency modal
   - Updated history display
   - Added handler function

2. `client/src/pages/UserInbox.jsx`
   - Added deficiency detection
   - Updated row styling
   - Added deficiency badge
   - Enhanced edit button logic

### Documentation
1. `docs/FIX_DEFICIENCY_FEATURE.md`
   - Complete feature documentation

2. `docs/DEFICIENCY_WORKFLOW_IMPLEMENTATION.md`
   - This implementation summary

## Security Considerations

- User must have `approve_request` permission to send deficiency
- User's role must match current workflow step
- Only request owner can edit deficiency requests
- All database operations use transactions
- Deficiency sender is tracked to prevent unauthorized returns

## Future Enhancements

1. Email notifications to applicant when deficiency is set
2. SMS notifications for urgent deficiencies
3. Deficiency statistics and reporting
4. Automatic escalation after multiple deficiencies
5. Deficiency templates for common issues
6. Deficiency resolution time tracking
7. Bulk deficiency operations

## Troubleshooting

### Issue: Edit button not showing for deficiency
**Solution**: Run the SQL migration script to add deficiency tracking fields

### Issue: Request not returning to sender after edit
**Solution**: Check that DeficiencySenderStepOrder and DeficiencySenderUserId are set

### Issue: Deficiency badge not showing
**Solution**: Verify HasDeficiency flag is set to 1 in database

### Issue: Wrong person receives deficiency
**Solution**: Check business rule logic for role-based routing

## Conclusion

The deficiency workflow is fully implemented and integrated with the existing workflow system. It provides a seamless way for experts to request corrections while maintaining complete audit trails and automatic routing.
