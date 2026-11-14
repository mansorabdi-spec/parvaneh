# Troubleshooting Guide - Workflow System

## Issue: Timeout Error on Request Submission

### Error Message
```
RequestError: Timeout: Request failed to complete in 15000ms
code: 'ETIMEOUT'
```

### Cause
This error occurs when you try to submit a request but the workflow tables haven't been created yet. The system tries to initialize the workflow but the database tables don't exist, causing the query to timeout.

### Solution

#### Step 1: Verify Database Tables Exist

Run the verification script to check if workflow tables exist:

```sql
-- Open SQL Server Management Studio or your SQL client
-- Connect to your database
-- Run: server/database/check_workflow_tables.sql
```

Expected output should show all tables as "EXISTS ✓":
- RequestWorkflowSteps
- RequestProcessHistory  
- RolePermissions
- GlobalApprovalFlowSteps

#### Step 2: Run the Workflow Migration Script

If tables are missing, run the migration:

**Option A: Using SQL Server Management Studio (SSMS)**
1. Open SSMS
2. Connect to your database
3. Open file: `server/database/workflow.sql`
4. Click "Execute" or press F5
5. Verify no errors in the Messages tab

**Option B: Using sqlcmd**
```bash
sqlcmd -S your_server_name -d your_database_name -i server/database/workflow.sql
```

**Option C: Using Azure Data Studio**
1. Open Azure Data Studio
2. Connect to your database
3. Open file: `server/database/workflow.sql`
4. Click "Run" or press F5

#### Step 3: Verify Migration Success

Run the check script again:
```sql
-- Run: server/database/check_workflow_tables.sql
```

All items should now show "EXISTS ✓"

#### Step 4: Restart the Backend Server

After running the migration:
```bash
# Stop the server (Ctrl+C)
# Start it again
cd server
npm start
```

#### Step 5: Configure Approval Flow

1. Login as Admin user
2. Navigate to: **مدیریت گردش کار** → **تنظیم فرآیند تایید**
3. Add at least one approval step (e.g., Admin)
4. Click "Save Flow"

#### Step 6: Test Again

Try submitting a request again. The timeout should be resolved.

---

## Issue: "No approval flow configured" Error

### Cause
The workflow tables exist but no approval steps have been configured.

### Solution
1. Login as Admin
2. Go to `/admin/approvals-flow`
3. Click "Add Step"
4. Select a role (Admin, Finance, Officer)
5. Click "Save Flow"

---

## Issue: Request Created But No Workflow Steps

### Symptom
- Request is created successfully
- Tracking number is generated
- But request doesn't appear in anyone's inbox
- Console shows warning: "Workflow initialization failed"

### Cause
Workflow tables don't exist or approval flow is not configured.

### Solution
Follow Steps 1-5 from the timeout error solution above.

---

## Issue: User Can't See Request in Inbox

### Possible Causes & Solutions

#### 1. User doesn't have the correct role
**Check:**
```sql
SELECT u.Username, u.Role, r.Name AS AdditionalRole
FROM Users u
LEFT JOIN UserRoles ur ON u.Id = ur.UserId
LEFT JOIN Roles r ON ur.RoleId = r.Id
WHERE u.Username = 'your_username'
```

**Solution:** Assign the correct role to the user in Admin panel

#### 2. Approval flow doesn't include user's role
**Check:**
```sql
SELECT * FROM GlobalApprovalFlowSteps ORDER BY StepOrder
```

**Solution:** Add user's role to the approval flow

#### 3. Previous steps not completed
**Check:**
```sql
SELECT * FROM RequestWorkflowSteps 
WHERE RequestID = YOUR_REQUEST_ID
ORDER BY StepOrder
```

**Solution:** Wait for previous approvers to complete their steps

#### 4. Request already approved/rejected
**Check:**
```sql
SELECT RequestID, TrackingNo, Status 
FROM VehicleRequests 
WHERE RequestID = YOUR_REQUEST_ID
```

**Solution:** If status is "Approved" or "Rejected", the workflow is complete

---

## Issue: Permission Denied When Viewing Request

### Symptom
User can see request in inbox but gets "Permission denied" or sees empty data when viewing details.

### Cause
User's role doesn't have the required permissions in RolePermissions table.

### Solution

**Check current permissions:**
```sql
SELECT RoleName, PermissionKey, CanView, CanEdit
FROM RolePermissions
WHERE RoleName = 'YourRoleName'
ORDER BY PermissionKey
```

**Add missing permissions:**
```sql
-- Example: Give Finance role permission to view payments
INSERT INTO RolePermissions (RoleName, PermissionKey, CanView, CanEdit)
VALUES ('Finance', 'view_payments', 1, 1)
```

---

## Issue: Cannot Approve/Reject Request

### Possible Causes & Solutions

#### 1. User's role doesn't match current step
**Check:**
```sql
SELECT rws.*, u.Username, u.Role
FROM RequestWorkflowSteps rws
LEFT JOIN Users u ON rws.DecidedByUserId = u.Id
WHERE rws.RequestID = YOUR_REQUEST_ID
ORDER BY rws.StepOrder
```

**Solution:** Only users with the role matching the current pending step can approve

#### 2. Previous steps not completed
**Solution:** Wait for previous approvers

#### 3. Step already decided
**Check:** Look at the Status column in the query above
**Solution:** If Status is "Approved" or "Rejected", it's already been decided

---

## Issue: Database Connection Timeout

### Symptom
Multiple timeout errors, slow queries

### Solutions

#### 1. Increase timeout in database config
Edit `server/src/lib/db.js`:
```javascript
const config = {
  // ... existing config
  requestTimeout: 30000, // Increase from default 15000
  connectionTimeout: 30000,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};
```

#### 2. Check database performance
- Ensure SQL Server is running
- Check for blocking queries
- Verify indexes exist on key columns
- Check SQL Server error logs

#### 3. Verify network connectivity
```bash
# Test connection to SQL Server
ping your_sql_server_address
```

---

## Issue: Frontend Shows "خطا در بارگذاری کارتابل"

### Cause
Backend API error or network issue

### Solutions

#### 1. Check browser console
- Open Developer Tools (F12)
- Look at Console tab for errors
- Look at Network tab for failed requests

#### 2. Check backend logs
Look at the terminal where backend is running for error messages

#### 3. Verify API endpoint
Test the endpoint directly:
```bash
# Get your auth token from browser localStorage
# Then test:
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/workflow/my-inbox
```

---

## General Debugging Tips

### 1. Enable Detailed Logging

Add to backend code:
```javascript
// In workflow.controller.js
console.log('User roles:', userRoles);
console.log('Query result:', result.recordset);
```

### 2. Check All Services Running

```bash
# Backend should be running on port 3000
# Frontend should be running on port 5173
# SQL Server should be accessible
```

### 3. Clear Browser Cache

Sometimes old JavaScript is cached:
- Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- Or clear browser cache completely

### 4. Check Environment Variables

Verify `.env` file in server directory:
```
DB_SERVER=localhost
DB_DATABASE=YourDatabaseName
DB_USER=sa
DB_PASSWORD=YourPassword
DB_ENCRYPT=false
DB_TRUST_CERT=true
```

---

## Quick Diagnostic Checklist

Run through this checklist when troubleshooting:

- [ ] SQL Server is running
- [ ] Backend server is running (port 3000)
- [ ] Frontend is running (port 5173)
- [ ] Database connection works (check backend startup logs)
- [ ] Workflow tables exist (run check_workflow_tables.sql)
- [ ] Approval flow is configured (at least 1 step)
- [ ] User has correct role assigned
- [ ] User's role has permissions in RolePermissions table
- [ ] No errors in browser console
- [ ] No errors in backend terminal

---

## Still Having Issues?

If none of the above solutions work:

1. **Check the full error stack trace** in backend logs
2. **Run the verification script** to see what's missing
3. **Review the WORKFLOW_SETUP_GUIDE.md** for setup steps
4. **Check database table structure** matches the schema in workflow.sql
5. **Verify all migrations ran successfully** (no partial migrations)

## Common SQL Server Connection Issues

### Named Instance Not Found
If using SQL Server Express with named instance (e.g., `localhost\SQLEXPRESS`):

```env
# In .env file
DB_SERVER=localhost
DB_INSTANCE=SQLEXPRESS
DB_PORT=  # Leave empty for named instances
```

### Authentication Failed
- Verify SQL Server authentication mode (mixed mode)
- Check username and password are correct
- Ensure SQL Server allows remote connections

### Connection Refused
- Check SQL Server is running (SQL Server Configuration Manager)
- Verify TCP/IP is enabled for SQL Server
- Check firewall allows SQL Server port (default 1433)
