# Permission System Implementation Guide

## Overview
این سند نحوه پیاده‌سازی سیستم مدیریت دسترسی (Permissions) برای نقش‌های مختلف، به‌ویژه **کارشناس مالی** را شرح می‌دهد.

## What Was Completed

### 1. Database Permissions ✅
اسکریپت SQL در `server/database/fix_financial_analyst_permissions.sql` اجرا شد و دسترسی‌های زیر برای نقش **کارشناس مالی** در جدول `RolePermissions` ثبت شدند:

| Permission Key | CanView | CanEdit | Description |
|----------------|---------|---------|-------------|
| `view_person_info` | ✓ | ✗ | مشاهده اطلاعات متقاضی |
| `view_residences` | ✓ | ✗ | مشاهده آدرس‌ها |
| `view_contacts` | ✓ | ✗ | مشاهده اطلاعات تماس |
| `view_vehicle_info` | ✓ | ✗ | مشاهده اطلاعات وسیله نقلیه |
| `view_payments` | ✓ | ✓ | مشاهده و ویرایش اطلاعات پرداخت |
| `view_payment_documents` | ✓ | ✗ | مشاهده اسناد پرداخت |
| `view_discounts` | ✓ | ✗ | مشاهده تخفیفات |
| `view_discount_documents` | ✓ | ✗ | مشاهده اسناد تخفیف |
| `approve_request` | ✓ | ✗ | تأیید درخواست |
| `reject_request` | ✓ | ✗ | رد درخواست |

### 2. Permission Middleware ✅
فایل جدید `server/src/middleware/permission.js` ایجاد شد با سه تابع اصلی:

#### `requirePermission(permissionKey, action)`
بررسی می‌کند که کاربر دسترسی مشخصی را دارد یا نه.

**مثال استفاده:**
```javascript
router.get('/persons/:id', 
  authRequired, 
  requirePermission('view_person_info', 'view'),
  getPersonController
);
```

#### `requireAnyPermission(permissions)`
بررسی می‌کند که کاربر حداقل یکی از دسترسی‌های مشخص شده را دارد.

**مثال استفاده:**
```javascript
router.get('/request/:id', 
  authRequired,
  requireAnyPermission([
    { key: 'view_person_info', action: 'view' },
    { key: 'view_payments', action: 'view' }
  ]),
  getRequestController
);
```

#### `attachUserPermissions(req, res, next)`
تمام دسترسی‌های کاربر را به `req.permissions` اضافه می‌کند تا در controller استفاده شود.

**مثال استفاده در controller:**
```javascript
export async function someController(req, res) {
  // Check if user can edit payments
  if (req.permissions['view_payments']?.canEdit) {
    // Allow editing
  }
}
```

### 3. Updated Routes ✅
Routes زیر بروزرسانی شدند تا از permission middleware استفاده کنند:

#### **Persons Routes** (`routes/modules/persons.js`)
- `GET /api/persons/by-national-code/:nationalCode` → نیاز به `view_person_info` (view)
- `POST /api/persons/upsert` → نیاز به `view_person_info` (edit)

#### **Vehicles Routes** (`routes/modules/vehicles.js`)
- `GET /api/vehicles/by-tracking/:trackingNo` → نیاز به `view_vehicle_info` (view)
- `GET /api/vehicles/by-national-code/:nationalCode` → نیاز به `view_vehicle_info` (view)

#### **Request Routes** (`routes/modules/request.js`)
- `GET /api/request/by-tracking/:trackingNo` → نیاز به یکی از: `view_person_info`, `view_vehicle_info`, `view_payments`, `view_discounts`
- `GET /api/request/:requestId` → نیاز به یکی از: `view_person_info`, `view_vehicle_info`, `view_payments`, `view_discounts`

#### **Payments Routes** (`routes/modules/payments.js`)
- `POST /api/payments/` → نیاز به `view_payments` (edit)
- `PUT /api/payments/:id` → نیاز به `view_payments` (edit)
- `POST /api/payments/initiate` → نیاز به `view_payments` (view)
- `GET /api/payments/online` → نیاز به `view_payments` (view)
- `POST /api/payments/offline` → نیاز به `view_payments` (edit)
- `GET /api/payments/offline` → نیاز به `view_payments` (view)
- `GET /api/payments/offline/:id/attachment` → نیاز به `view_payment_documents` (view)
- `DELETE /api/payments/offline/:id` → نیاز به `view_payments` (edit)

#### **Approvals Routes** (`routes/modules/approvals.js`)
- `GET /api/approvals/my-tasks` → نیاز به authentication
- `POST /api/approvals/:id/decision` → نیاز به `approve_request` یا `reject_request`

#### **Workflow Routes** (`routes/modules/workflow.js`)
- `GET /api/workflow/requests/:requestId` → نیاز به یکی از: `view_person_info`, `view_vehicle_info`, `view_payments`, `view_discounts`
- `POST /api/workflow/steps/:stepId/decision` → نیاز به `approve_request` یا `reject_request`
- `POST /api/workflow/requests/:requestId/discount-approval` → نیاز به `view_discounts` (edit)

#### **Uploads Routes** (`routes/modules/uploads.js`)
- `POST /api/uploads/receipt` → نیاز به `view_payment_documents` (edit)

## How It Works

### Permission Check Flow
```
1. User sends request with JWT token
   ↓
2. authRequired middleware verifies token
   ↓
3. requirePermission middleware:
   - Extracts user ID from req.user
   - Queries database for user's role
   - Queries RolePermissions table for role's permissions
   - Checks if CanView or CanEdit is true based on action
   ↓
4. If permission granted → continue to controller
   If permission denied → return 403 Forbidden
```

## Testing Guide

### Test Case 1: Financial Analyst Can View Payments
```bash
# Login as financial analyst
POST /api/auth/login
{
  "nationalCode": "1718933002",
  "password": "password"
}

# Get token from response, then:
GET /api/payments/offline
Authorization: Bearer <token>

# Expected: 200 OK with payment list
```

### Test Case 2: Financial Analyst Can View Request Details
```bash
GET /api/request/by-tracking/TRACK123
Authorization: Bearer <token>

# Expected: 200 OK with request details including:
# - Person info (name, national code)
# - Vehicle info
# - Payment info
# - Discount info (view only)
```

### Test Case 3: Financial Analyst Can Approve/Reject
```bash
POST /api/approvals/123/decision
Authorization: Bearer <token>
{
  "decision": "approved",
  "comment": "پرداخت تایید شد"
}

# Expected: 200 OK with approval result
```

### Test Case 4: Financial Analyst Cannot Edit Vehicle Info
```bash
POST /api/vehicles/upsert
Authorization: Bearer <token>
{
  "vehicleData": "..."
}

# Expected: 403 Forbidden
# Message: "دسترسی به این عملیات ندارید"
```

## SQL Verification Queries

### Check Financial Analyst Permissions
```sql
SELECT 
  RoleName,
  PermissionKey,
  CanView,
  CanEdit
FROM RolePermissions
WHERE RoleName = N'کارشناس مالی'
ORDER BY PermissionKey;
```

### Check Financial Analyst User
```sql
SELECT 
  Id, 
  NationalCode, 
  FullName, 
  Role 
FROM Users 
WHERE Role = N'کارشناس مالی';
```

### Check All Roles in System
```sql
SELECT DISTINCT Role FROM Users;
```

## Adding New Permissions

### Step 1: Add Permission to Database
```sql
INSERT INTO RolePermissions (RoleName, PermissionKey, CanView, CanEdit) 
VALUES (N'کارشناس مالی', 'new_permission_key', 1, 0);
```

### Step 2: Add Permission Check to Route
```javascript
import { requirePermission } from '../../middleware/permission.js';

router.get('/new-endpoint', 
  authRequired,
  requirePermission('new_permission_key', 'view'),
  controllerFunction
);
```

### Step 3: Test the New Permission
Test with financial analyst user to ensure access control works correctly.

## Troubleshooting

### Issue: 403 Forbidden Error
**Possible Causes:**
1. Permission not added to RolePermissions table
2. Wrong role name (check for encoding issues with Persian characters)
3. User's role doesn't match exactly

**Solution:**
```sql
-- Check user's exact role
SELECT Id, Role, LEN(Role) as RoleLength FROM Users WHERE NationalCode = '1718933002';

-- Check if permission exists for role
SELECT * FROM RolePermissions WHERE RoleName = N'کارشناس مالی' AND PermissionKey = 'view_payments';
```

### Issue: Middleware Not Applied
**Possible Causes:**
1. Route registered before middleware import
2. Middleware not called in correct order

**Solution:**
Ensure middleware order is:
```javascript
authRequired → requirePermission → controller
```

## Security Notes

1. **Always use `authRequired` first** before any permission check
2. **Use `N` prefix** for Persian strings in SQL queries
3. **Separate view and edit permissions** for better control
4. **Test all permission combinations** for each role
5. **Log permission denials** for security auditing

## Next Steps

1. ✅ Database permissions configured
2. ✅ Middleware implemented
3. ✅ Routes updated
4. ⏳ **Testing needed:** Test with actual financial analyst user
5. ⏳ **Frontend integration:** Update frontend to handle 403 responses
6. ⏳ **Audit logging:** Add permission check logging for security

## Related Files

- **Database Schema:** `DATABASE_SCHEMA_REFERENCE.md`
- **SQL Script:** `server/database/fix_financial_analyst_permissions.sql`
- **Middleware:** `server/src/middleware/permission.js`
- **Auth Middleware:** `server/src/middleware/auth.js`
- **Routes:** `server/src/routes/modules/*.js`
