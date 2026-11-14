# Workflow System Setup Guide

## Quick Start

### Step 1: Run Database Migration

Execute the workflow SQL script to create the necessary tables:

```bash
# Option 1: Using SQL Server Management Studio (SSMS)
# Open: server/database/workflow.sql
# Execute the script against your database

# Option 2: Using sqlcmd
sqlcmd -S your_server -d your_database -i server/database/workflow.sql
```

This will create:
- `RequestWorkflowSteps` table
- `RequestProcessHistory` table
- `RolePermissions` table
- Add new columns to `VehicleRequests`
- Seed default permissions for Admin, Finance, and Officer roles
- Add Finance role if it doesn't exist

### Step 2: Restart the Backend Server

```bash
cd server
npm start
```

### Step 3: Restart the Frontend

```bash
cd client
npm start
```

### Step 4: Configure Approval Flow (Admin Only)

1. Login as an Admin user
2. Navigate to: **مدیریت گردش کار** → **تنظیم فرآیند تایید**
3. Configure the approval steps (example):
   - Step 1: Admin
   - Step 2: Finance
   - Step 3: Officer
4. Click "Save Flow"

### Step 5: Create Test Users

Create users with different roles to test the workflow:

1. **Admin User**: Full access
2. **Finance User**: Only sees discount and payment info
3. **Officer User**: Read-only access to most info

Navigate to: **مدیریت کاربران** → **کاربران**

### Step 6: Test the Workflow

#### As a Regular User:
1. Go to home page (/)
2. Fill out the license application form
3. Upload required documents
4. Click "ثبت نهایی" (Final Submit)
5. Note the tracking number

#### As First Approver (e.g., Admin):
1. Click "کارتابل من" in the navigation
2. You should see the submitted request
3. Click "بررسی پرونده"
4. Review all information (you have full access)
5. Click "✅ تایید" or "❌ رد"
6. Add optional notes
7. Confirm the decision

#### As Second Approver (e.g., Finance):
1. After Admin approves, login as Finance user
2. Click "کارتابل من"
3. You should now see the request
4. Click "بررسی پرونده"
5. Notice you only see discount and payment information
6. Approve or reject

#### As Admin - View All Requests:
1. Navigate to: **مدیریت گردش کار** → **همه درخواست‌ها**
2. See statistics and all requests
3. Filter by status (pending, approved, rejected)
4. Click any request to view details

## Navigation Menu Structure

After implementation, your menu will look like:

```
خانه | کارتابل من | مجوزهای من | [Admin Menus] | تغییر رمز | خروج

Admin Menus:
├── مدیریت کاربران ▾
│   ├── کاربران
│   └── نقش‌ها
├── مدیریت اطلاعات ▾
│   ├── مدیریت اطلاعات پایه
│   ├── مدیریت انواع سیستم
│   ├── استان‌ها و شهرها
│   └── مدیریت تعرفه‌ها
├── گزارشات ▾
│   └── گزارشات پروانه فعالیت
└── مدیریت گردش کار ▾
    ├── همه درخواست‌ها
    └── تنظیم فرآیند تایید
```

## API Endpoints Reference

### User Endpoints
```
GET  /api/workflow/my-inbox                    - Get user's inbox
GET  /api/workflow/requests/:requestId         - Get request detail
GET  /api/workflow/requests/:requestId/steps   - Get workflow steps
GET  /api/workflow/requests/:requestId/history - Get process history
POST /api/workflow/steps/:stepId/decision      - Make approval decision
```

### Admin Endpoints
```
GET  /api/workflow/requests      - Get all requests
GET  /api/approvals/flow         - Get approval flow
POST /api/approvals/flow         - Update approval flow
```

## Testing Checklist

- [ ] Database migration executed successfully
- [ ] Backend server running without errors
- [ ] Frontend running without errors
- [ ] Can access "کارتابل من" page
- [ ] Admin can configure approval flow
- [ ] Can submit a new request
- [ ] Request appears in first approver's inbox
- [ ] First approver can see appropriate information based on role
- [ ] First approver can approve/reject with notes
- [ ] After approval, request moves to next step
- [ ] Second approver sees request in their inbox
- [ ] Role-based access control works (Finance only sees payments/discounts)
- [ ] Process history shows all actions
- [ ] Workflow steps show correct status
- [ ] Admin can view all requests
- [ ] Statistics are calculated correctly
- [ ] Rejected requests don't move to next step
- [ ] Completed requests show "Approved" status

## Common Issues and Solutions

### Issue: "Table already exists" error
**Solution**: The migration script checks for existing tables. If you get this error, the tables might already exist. Check your database.

### Issue: User doesn't see requests in inbox
**Solution**: 
- Verify user has correct role assigned
- Check approval flow includes their role
- Ensure previous steps are completed
- Verify request is not already approved/rejected

### Issue: Permission denied when viewing request
**Solution**:
- Check `RolePermissions` table
- Verify user's role has required permissions
- Check if permissions were seeded correctly

### Issue: Cannot approve/reject
**Solution**:
- Verify user's role matches the current step's role
- Check if previous steps are completed
- Ensure step is still in "Pending" status

### Issue: Workflow not initializing on request submission
**Solution**:
- Check if `GlobalApprovalFlowSteps` has configured steps
- Verify `initializeWorkflow` is being called in issue controller
- Check server logs for errors

## Role Permissions Matrix

| Permission                  | Admin | Finance | Officer | User |
|----------------------------|-------|---------|---------|------|
| view_person_info           | ✅    | ❌      | ✅      | ❌   |
| view_person_documents      | ✅    | ❌      | ✅      | ❌   |
| view_vehicle_info          | ✅    | ❌      | ✅      | ❌   |
| view_vehicle_documents     | ✅    | ❌      | ✅      | ❌   |
| view_discounts             | ✅    | ✅      | ✅      | ❌   |
| view_discount_documents    | ✅    | ✅      | ✅      | ❌   |
| view_payments              | ✅    | ✅      | ✅      | ❌   |
| view_payment_documents     | ✅    | ✅      | ❌      | ❌   |
| approve_request            | ✅    | ✅      | ✅      | ❌   |
| reject_request             | ✅    | ✅      | ✅      | ❌   |
| forward_request            | ✅    | ❌      | ❌      | ❌   |

## Files Modified/Created

### Backend Files Created:
- `server/database/workflow.sql` - Database schema
- `server/src/controllers/workflow.controller.js` - Workflow logic
- `server/src/routes/modules/workflow.js` - API routes

### Backend Files Modified:
- `server/src/controllers/issue.controller.js` - Added workflow initialization
- `server/src/routes/index.js` - Registered workflow routes

### Frontend Files Created:
- `client/src/pages/UserInbox.jsx` - User inbox page
- `client/src/pages/WorkflowRequestDetail.jsx` - Request detail page
- `client/src/pages/AdminAllRequests.jsx` - Admin requests page

### Frontend Files Modified:
- `client/src/App.jsx` - Added routes and navigation menu items

### Documentation:
- `WORKFLOW_SYSTEM.md` - Complete system documentation
- `WORKFLOW_SETUP_GUIDE.md` - This setup guide

## Next Steps

After successful setup:

1. **Customize Permissions**: Modify `RolePermissions` table to adjust access levels
2. **Add More Roles**: Create new roles with specific permissions
3. **Configure Notifications**: Add email/SMS notifications (future enhancement)
4. **Add Reports**: Create reports for workflow analytics
5. **Mobile Support**: Optimize UI for mobile devices

## Support

If you encounter issues:
1. Check server logs for errors
2. Check browser console for frontend errors
3. Verify database tables were created correctly
4. Ensure all migrations ran successfully
5. Review the WORKFLOW_SYSTEM.md documentation
