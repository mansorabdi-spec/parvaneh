# Fix Deficiency Feature (رفع نقص)

## Overview
The Fix Deficiency feature allows managers and experts to return a request to the previous workflow step when deficiencies are found, along with detailed notes explaining what needs to be corrected.

## User Story
When a manager or expert reviews a request and finds deficiencies that need to be corrected, they can:
1. Click the "رفع نقص" (Fix Deficiency) button
2. Enter detailed notes explaining what needs to be fixed
3. Submit the request back to the previous workflow step
4. The previous assignee can see the deficiency notes and make corrections

## Implementation Details

### Backend Changes

#### 1. Controller Function
**File**: `server/src/controllers/workflow.controller.js`

Added `fixDeficiency` function that:
- Validates the deficiency notes (required, 1-2000 characters)
- Checks user permissions
- Finds the previous workflow step
- Resets the previous step to "Pending" status
- Updates the request's current step order
- Records the action in RequestProcessHistory
- Returns success message with step information

**Endpoint**: `POST /api/workflow/steps/:stepId/fix-deficiency`

**Request Body**:
```json
{
  "notes": "توضیحات رفع نقص (الزامی)"
}
```

**Response**:
```json
{
  "success": true,
  "message": "پرونده برای رفع نقص به مرحله قبل ارجاع شد",
  "returnedToStep": 2,
  "returnedToRole": "کارشناس فنی"
}
```

#### 2. Route Configuration
**File**: `server/src/routes/modules/workflow.js`

Added route:
```javascript
router.post('/steps/:stepId/fix-deficiency', authRequired, fixDeficiency);
```

#### 3. Database Changes
**Table**: `RequestProcessHistory`

New action type: `'FixDeficiency'`

Records include:
- RequestID
- ActionType: 'FixDeficiency'
- ActionByUserId, ActionByUserName, ActionByRole
- StepOrder (current step)
- Notes (deficiency explanation)
- FromStatus, ToStatus (both 'InProgress')
- CreatedAt (timestamp)

**SQL Script**: `server/database/create_request_process_history_table.sql`

### Frontend Changes

#### 1. Component State
**File**: `client/src/pages/WorkflowRequestDetail.jsx`

Added state variables:
```javascript
const [fixDeficiencyModal, setFixDeficiencyModal] = useState(null)
const [fixDeficiencyNotes, setFixDeficiencyNotes] = useState('')
```

#### 2. Handler Function
Added `handleFixDeficiency` function that:
- Validates notes are not empty
- Calls the backend API
- Shows success/error messages
- Reloads the request detail

#### 3. UI Components

**Button** (next to Approve/Reject buttons):
```jsx
<button onClick={() => setFixDeficiencyModal({ stepId: currentStep.Id })}>
  🔧 رفع نقص
</button>
```
- Orange color (#f59e0b)
- Visible only when user has approve_request permission
- Not shown for label specialists

**Modal Dialog**:
- Title: "🔧 رفع نقص"
- Tracking number display
- Explanation text
- Required textarea for deficiency notes
- Submit button (disabled if notes empty)
- Cancel button

#### 4. History Display
Updated history section to show fix deficiency actions with:
- Orange icon (🔧)
- Orange background (#fef3c7)
- Orange text color for title
- Label: "رفع نقص - ارجاع به مرحله قبل"

## Workflow Logic

### Business Rules:

1. **Default Behavior**: When any role (except the exception below) sends a request for fix deficiency, the request is **always returned to the original user** (متقاضی/کاربر مستقل) who created the request.

2. **Exception**: When **"رییس اداره صدور پروانه"** (Head of License Issuance Office) sends a request for fix deficiency, the request is returned to **"کارشناس صدور پروانه"** (License Issuance Expert) instead of the original user.

### Step-by-Step Process:

1. **User Action**: Manager/Expert clicks "رفع نقص" button
2. **Modal Opens**: User enters deficiency notes (required)
3. **Validation**: System validates notes are not empty
4. **Backend Processing**:
   - Finds current workflow step
   - Verifies user has permission
   - **Determines target step based on business rules**:
     - If current role is "رییس اداره صدور پروانه" → Target is "کارشناس صدور پروانه"
     - Otherwise → Target is the original submitter (first step, متقاضی)
   - Resets target step to Pending with deficiency notes
   - Updates request's CurrentStepOrder to target step
   - Adds entry to RequestProcessHistory
5. **Database Updates**:
   - RequestWorkflowSteps: Target step reset to Pending with notes
   - VehicleRequests: CurrentStepOrder updated to target step
   - RequestProcessHistory: New entry added with target description
6. **Response**: Success message shown to user (includes target description)
7. **UI Update**: Request detail reloaded
8. **Target Assignee**: Sees request back in their inbox with deficiency notes

## Security & Permissions

- User must have `approve_request` permission
- User's role must match the current workflow step's role
- Current step must be in "Pending" status
- Previous step must exist and be completed

## Error Handling

### Backend Errors:
- Missing stepId: 400 Bad Request
- Invalid notes: 400 Bad Request (validation error)
- Step not found: 404 Not Found
- Permission denied: 403 Forbidden
- Step already decided: 400 Bad Request
- No previous step: 400 Bad Request

### Frontend Errors:
- Empty notes: Alert shown before API call
- API errors: Alert with error message

## Testing Checklist

- [ ] Button appears for users with approve_request permission
- [ ] Button does not appear for label specialists
- [ ] Modal opens when button clicked
- [ ] Submit button disabled when notes empty
- [ ] Submit button enabled when notes entered
- [ ] API call succeeds with valid data
- [ ] Request returns to previous step
- [ ] Previous step status changes to Pending
- [ ] History shows fix deficiency action
- [ ] Previous assignee sees request in inbox
- [ ] Deficiency notes visible in history
- [ ] Cancel button closes modal without changes

## Database Schema

### RequestProcessHistory Table Structure:
```sql
CREATE TABLE [dbo].[RequestProcessHistory](
    [Id] [bigint] IDENTITY(1,1) NOT NULL,
    [RequestID] [bigint] NOT NULL,
    [ActionType] [nvarchar](50) NOT NULL,
    [ActionByUserId] [int] NULL,
    [ActionByUserName] [nvarchar](100) NULL,
    [ActionByRole] [nvarchar](50) NULL,
    [FromStatus] [nvarchar](50) NULL,
    [ToStatus] [nvarchar](50) NULL,
    [StepOrder] [int] NULL,
    [Notes] [nvarchar](max) NULL,
    [CreatedAt] [datetime2](7) NOT NULL DEFAULT GETDATE(),
    PRIMARY KEY ([Id])
)
```

## Future Enhancements

1. Email notification to previous assignee
2. Deficiency counter/statistics
3. Deficiency resolution tracking
4. Multiple deficiency iterations tracking
5. Deficiency category classification
6. Automatic escalation after multiple deficiencies

## Related Files

### Backend:
- `server/src/controllers/workflow.controller.js` - Main logic
- `server/src/routes/modules/workflow.js` - Route definition
- `server/database/create_request_process_history_table.sql` - Database script

### Frontend:
- `client/src/pages/WorkflowRequestDetail.jsx` - UI implementation

### Documentation:
- `DATABASE_SCHEMA_REFERENCE.md` - Database schema reference
