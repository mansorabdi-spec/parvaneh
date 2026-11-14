# Workflow System (سیستم کارتابل) Documentation

## Overview
This document describes the workflow management system (کارتابل) implemented for the activity license issuance application. The system allows multiple users with different roles to review and approve/reject license requests in a configurable order.

## Key Features

### 1. **User Inbox (کارتابل)**
- Each user sees only the requests assigned to their role
- Requests are shown only when previous steps are completed
- Real-time status updates

### 2. **Role-Based Access Control**
Different roles have different levels of access to request information:

#### Admin Role
- Full access to all information:
  - Person information + documents
  - Vehicle information + documents
  - Discount information + documents
  - Payment information + documents
- Can approve/reject requests
- Can forward requests
- Can view all requests in the system

#### Finance Role
- Limited access:
  - Discount information + documents
  - Payment information + documents
- Can approve/reject requests
- Cannot see personal or vehicle information

#### Officer Role
- Read-only access to most information:
  - Person information + documents (view only)
  - Vehicle information + documents (view only)
  - Discount information + documents (view only)
  - Payment information (view only)
- Can approve/reject requests

### 3. **Configurable Approval Flow**
- Admins can define the order of approval steps
- Each step is assigned to a specific role
- Steps are executed sequentially
- If any step is rejected, subsequent steps are skipped

### 4. **Process History**
- Complete audit trail of all actions
- Records who did what and when
- Includes notes and comments
- Displayed in chronological order

## Database Schema

### New Tables

#### `RequestWorkflowSteps`
Tracks approval steps for each request:
- `RequestID`: Reference to VehicleRequests
- `StepOrder`: Order of the step in the workflow
- `RoleName`: Role responsible for this step
- `Status`: Pending | Approved | Rejected | Skipped
- `DecidedByUserId`: User who made the decision
- `DecidedAt`: Timestamp of decision
- `Notes`: Optional notes from approver

#### `RequestProcessHistory`
Complete audit trail:
- `RequestID`: Reference to VehicleRequests
- `ActionType`: Created | Assigned | Approved | Rejected | Commented | etc.
- `ActionByUserId`: User who performed the action
- `ActionByRole`: Role of the user
- `Notes`: Optional notes
- `CreatedAt`: Timestamp

#### `RolePermissions`
Defines what each role can access:
- `RoleName`: Name of the role
- `PermissionKey`: Permission identifier (e.g., 'view_person_info')
- `CanView`: Boolean
- `CanEdit`: Boolean

### Modified Tables

#### `VehicleRequests`
Added fields:
- `Status`: Pending | InProgress | Approved | Rejected
- `CurrentStepOrder`: Current step in the workflow
- `SubmittedByUserId`: User who submitted the request
- `CompletedAt`: Timestamp when workflow completed

## API Endpoints

### User Endpoints
- `GET /api/workflow/my-inbox` - Get user's inbox (کارتابل)
- `GET /api/workflow/requests/:requestId` - Get request detail with role-based filtering
- `GET /api/workflow/requests/:requestId/steps` - Get workflow steps for a request
- `GET /api/workflow/requests/:requestId/history` - Get process history
- `POST /api/workflow/steps/:stepId/decision` - Approve or reject a step

### Admin Endpoints
- `GET /api/workflow/requests` - Get all requests (admin only)
- `GET /api/approvals/flow` - Get approval flow configuration
- `POST /api/approvals/flow` - Update approval flow configuration

## Frontend Pages

### 1. User Inbox (`/workflow/inbox`)
- Shows all requests assigned to the current user
- Filterable by status
- Click to view details

### 2. Request Detail (`/workflow/request/:requestId`)
- Three tabs:
  - **Information**: Shows data based on role permissions
  - **Workflow Steps**: Shows all steps and their status
  - **Process History**: Shows complete audit trail
- Approve/Reject buttons (if user has permission)
- Modal for adding notes when making decisions

### 3. Admin All Requests (`/admin/workflow/requests`)
- Shows all requests in the system
- Statistics cards (total, pending, approved, rejected)
- Filterable by status
- Admin can view any request

### 4. Approval Flow Configuration (`/admin/approvals-flow`)
- Configure the order of approval steps
- Add/remove steps
- Assign roles to steps
- Reorder steps

## Workflow Process

### 1. Request Submission
When a user clicks "ثبت نهایی" (Final Submit) on the form:
1. A record is created in `VehicleRequests`
2. Workflow steps are automatically created based on `GlobalApprovalFlowSteps`
3. Request status is set to "Pending"
4. First step is assigned to the appropriate role
5. Process history records the creation

### 2. Approval Process
When a user with the appropriate role views their inbox:
1. They see only requests where:
   - The current step is assigned to their role
   - All previous steps are completed
2. They can view request details (filtered by their permissions)
3. They can approve or reject with optional notes
4. Upon decision:
   - Workflow step is updated
   - Request status is updated
   - Process history is recorded
   - If rejected, subsequent steps are skipped
   - If approved and no more steps, request is marked as "Approved"

### 3. Completion
When all steps are approved:
- Request status changes to "Approved"
- `CompletedAt` timestamp is set
- License can be issued

If any step is rejected:
- Request status changes to "Rejected"
- All subsequent steps are marked as "Skipped"
- Process stops

## Permission Keys

The following permission keys are used:

- `view_person_info` - View personal information
- `view_person_documents` - View personal documents
- `view_vehicle_info` - View vehicle information
- `view_vehicle_documents` - View vehicle documents
- `view_discounts` - View discount information
- `view_discount_documents` - View discount documents
- `view_payments` - View payment information
- `view_payment_documents` - View payment documents
- `approve_request` - Can approve requests
- `reject_request` - Can reject requests
- `forward_request` - Can forward requests to other users

## Setup Instructions

### 1. Run Database Migration
Execute the workflow SQL script:
```sql
-- Run this in SQL Server Management Studio or your SQL client
-- File: server/database/workflow.sql
```

### 2. Configure Approval Flow
1. Login as Admin
2. Navigate to "مدیریت گردش کار" → "تنظیم فرآیند تایید"
3. Add/configure approval steps
4. Save the flow

### 3. Assign Roles to Users
1. Navigate to "مدیریت کاربران" → "نقش‌ها"
2. Assign appropriate roles to users (Admin, Finance, Officer, etc.)

### 4. Test the Workflow
1. Submit a new license request
2. Check the inbox of users with the first role in the flow
3. Approve/reject and verify the request moves to the next step
4. Verify role-based access control is working

## Customization

### Adding New Roles
1. Add role to `Roles` table
2. Add permissions in `RolePermissions` table
3. Update approval flow to include the new role

### Adding New Permissions
1. Define new permission key in `RolePermissions`
2. Update backend controller to check the permission
3. Update frontend to conditionally show/hide based on permission

### Modifying Approval Flow
Admins can modify the approval flow at any time through the UI. Changes apply to new requests only. Existing requests continue with their original workflow.

## Troubleshooting

### User doesn't see requests in inbox
- Check if user has the correct role assigned
- Verify approval flow includes their role
- Check if previous steps are completed
- Verify request status is not "Rejected" or "Approved"

### Permission denied errors
- Check `RolePermissions` table for the user's role
- Verify user has the required permission key
- Check if permission has `CanView = 1`

### Workflow stuck
- Check `RequestWorkflowSteps` table for the request
- Verify all previous steps are approved
- Check if any step is rejected (subsequent steps will be skipped)

## Security Considerations

1. **Role-Based Access**: Users can only see data they have permission to view
2. **Audit Trail**: All actions are logged in process history
3. **Sequential Approval**: Steps must be completed in order
4. **No Bypass**: Users cannot skip steps or approve out of order
5. **Immutable History**: Process history cannot be modified or deleted

## Future Enhancements

Possible improvements:
- Email notifications when requests are assigned
- Deadline tracking for each step
- Parallel approval (multiple users must approve same step)
- Conditional routing (different paths based on request data)
- Bulk approval operations
- Advanced filtering and search
- Export reports
- Mobile app support
