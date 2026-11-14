# Employment License Approval Workflow Implementation

## Overview
This document describes the implementation of separate approval workflows for **Employment Licenses** (پروانه اشتغال) and **Activity Licenses** (پروانه فعالیت).

## What Was Changed

### 1. Database Schema (`add_license_type_to_approval_flow.sql`)
- Added `LicenseType` column to `GlobalApprovalFlowSteps` table
- Column accepts values: `'Activity'` or `'Employment'`
- Added check constraint to ensure only valid license types
- Default Employment workflow created with 3 steps:
  1. کارشناس مالی (Financial Officer)
  2. کارشناس صدور پروانه (License Issuance Officer)
  3. رییس اداره صدور پروانه (License Department Head)

### 2. Backend API Updates

#### `approvals.controller.js`
- **`getFlow()`**: Now accepts optional `licenseType` query parameter
  - Example: `GET /api/approvals/flow?licenseType=Employment`
  - Defaults to 'Activity' for backwards compatibility
  
- **`setFlow()`**: Updated to require `licenseType` in request body
  - Only deletes and updates steps for the specified license type
  - Preserves the other license type's workflow

#### `issue.controller.js`
- **`createEmploymentRequest()`**: 
  - Now initializes Employment approval workflow from `GlobalApprovalFlowSteps`
  - Automatically creates workflow steps based on configured Employment flow
  - Sets first step to 'Pending', others to 'NotStarted'
  
- **`createVehicleRequest()`**: 
  - Now initializes Activity approval workflow from `GlobalApprovalFlowSteps`
  - Creates both discount approval step (StepOrder 0) and main workflow steps
  - Main workflow steps start as 'NotStarted' until payment is completed

### 3. Admin UI Updates (`AdminApprovalFlow.jsx`)
- **Tabbed Interface**: Separate tabs for Activity and Employment workflows
- **Independent Management**: Each workflow can be configured independently
- **Visual Distinction**: 
  - Activity tab: Blue theme
  - Employment tab: Green theme
- **Farsi Labels**: All UI text translated to Persian

## How to Use

### Step 1: Run Database Migration
```bash
# Connect to your SQL Server and run:
sqlcmd -S your_server -d parvaneh -i server/database/add_license_type_to_approval_flow.sql
```

Or execute the SQL file manually in SQL Server Management Studio.

### Step 2: Configure Workflows in Admin Panel

1. Navigate to: `http://localhost:5173/admin/approvals-flow`
2. You'll see two tabs:
   - **فرآیند تایید پروانه فعالیت** (Activity License Approval Flow)
   - **فرآیند تایید پروانه اشتغال** (Employment License Approval Flow)

3. For each tab:
   - Click "افزودن مرحله" to add a step
   - Select the role from the dropdown
   - Use "بالا/پایین" to reorder steps
   - Use "حذف" to remove a step
   - Click "ذخیره فرآیند تایید" to save

### Step 3: Test Employment License Flow

1. **Create an Employment License Request**:
   - Go to Employment License form
   - Fill in personal information
   - Submit the request

2. **Verify Workflow Creation**:
   ```sql
   -- Check that workflow steps were created
   SELECT 
     rws.RequestID,
     rws.StepOrder,
     rws.RoleName,
     rws.Status,
     vr.TrackingNo
   FROM RequestWorkflowSteps rws
   JOIN VehicleRequests vr ON vr.RequestID = rws.RequestID
   WHERE vr.TrackingNo LIKE '2%' -- Employment licenses start with 2
   ORDER BY rws.RequestID, rws.StepOrder
   ```

3. **Process Approval Steps**:
   - Users with the appropriate role will see pending tasks in their workflow inbox
   - Each step must be approved in order (StepOrder 1, 2, 3, etc.)

### Step 4: Test Activity License Flow

1. **Create an Activity License Request**:
   - Go to Activity License form
   - Fill in vehicle information
   - Submit the request

2. **Verify Workflow Creation**:
   ```sql
   -- Check that workflow steps were created
   SELECT 
     rws.RequestID,
     rws.StepOrder,
     rws.RoleName,
     rws.Status,
     vr.TrackingNo
   FROM RequestWorkflowSteps rws
   JOIN VehicleRequests vr ON vr.RequestID = rws.RequestID
   WHERE vr.TrackingNo LIKE '3%' -- Activity licenses start with 3
   ORDER BY rws.RequestID, rws.StepOrder
   ```

## API Examples

### Get Employment Approval Flow
```javascript
const response = await api.get('/api/approvals/flow?licenseType=Employment')
console.log(response.data)
// Returns: [{ Id, StepOrder, RoleName, LicenseType }, ...]
```

### Get Activity Approval Flow
```javascript
const response = await api.get('/api/approvals/flow?licenseType=Activity')
console.log(response.data)
```

### Update Employment Approval Flow
```javascript
await api.post('/api/approvals/flow', {
  licenseType: 'Employment',
  steps: [
    { stepOrder: 1, roleName: 'کارشناس مالی' },
    { stepOrder: 2, roleName: 'کارشناس صدور پروانه' },
    { stepOrder: 3, roleName: 'رییس اداره صدور پروانه' }
  ]
})
```

## Default Workflows

### Activity License (Default)
1. کارشناس مالی (Financial Officer)
2. کارشناس صدور پروانه (License Issuance Officer)
3. کارشناس الصاق برچسب (Label Attachment Officer)
4. رییس اداره صدور پروانه (License Department Head)

### Employment License (Default)
1. کارشناس مالی (Financial Officer)
2. کارشناس صدور پروانه (License Issuance Officer)
3. رییس اداره صدور پروانه (License Department Head)

## Technical Notes

### Workflow Initialization
- **Activity Licenses**: Workflow steps created during request submission, but set to 'NotStarted' until payment is completed
- **Employment Licenses**: Workflow steps created immediately with first step as 'Pending'

### Discount Handling
- Both license types support discount approval as StepOrder 0
- Discount approval must complete before main workflow begins
- Discount documents are linked to requests automatically

### Backward Compatibility
- API defaults to 'Activity' license type if not specified
- Existing Activity licenses continue to work without changes
- Migration script sets all existing steps to 'Activity' type

## Troubleshooting

### No workflow steps created
- Check that `GlobalApprovalFlowSteps` has entries for the license type:
  ```sql
  SELECT * FROM GlobalApprovalFlowSteps WHERE LicenseType = 'Employment'
  ```
- Verify the migration script ran successfully

### Steps appear out of order
- Ensure StepOrder values are sequential (1, 2, 3, ...)
- Use the admin panel to reorder steps

### Role not showing in dropdown
- Check that the role exists in the Users/Roles table
- Verify role names match exactly (case-sensitive)

## Future Enhancements

Possible improvements:
1. Add custom workflow templates for different license subtypes
2. Allow conditional branching in workflows
3. Add time limits for each approval step
4. Email notifications for pending approvals
5. Workflow analytics and reporting

---

**Implementation Date**: 2025-10-18  
**Version**: 1.0  
**Status**: ✅ Complete and Ready for Testing
