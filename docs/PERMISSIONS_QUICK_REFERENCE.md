# Role Permissions - Quick Reference Card

## Quick Setup (First Time)

### 1. Run Database Script
```bash
# Connect to your SQL Server and run:
sqlcmd -S localhost -d parvaneh_db -i server/database/role_permissions.sql
```

### 2. Verify Setup
```bash
# Run verification script:
sqlcmd -S localhost -d parvaneh_db -i server/database/verify_permissions_setup.sql
```

### 3. Access Admin Interface
- Login as Admin user
- Navigate to: **مدیریت کاربران** → **دسترسی‌های نقش‌ها**
- URL: `http://localhost:3000/admin/role-permissions`

---

## Common Tasks

### Add a New Page

**SQL Method:**
```sql
INSERT INTO Pages (PageKey, PagePath, PageTitle, Description)
VALUES ('my_page', '/my/page', N'My Page Title', N'Description');
```

**API Method:**
```javascript
POST /api/permissions/pages
{
  "pageKey": "my_page",
  "pagePath": "/my/page",
  "pageTitle": "My Page Title",
  "description": "Description"
}
```

### Grant Permission to a Role

**Via Admin UI:**
1. Go to `/admin/role-permissions`
2. Select role from left panel
3. Check the page checkbox
4. Click "ذخیره تغییرات"

**Via SQL:**
```sql
DECLARE @RoleId INT = (SELECT Id FROM Roles WHERE Name = 'User');
DECLARE @PageId INT = (SELECT Id FROM Pages WHERE PageKey = 'my_page');

INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess)
VALUES (@RoleId, @PageId, 1);
```

### Protect a Backend Route

```javascript
import { requirePageAccess } from '../middleware/pageAccess.js';

router.get('/my/route', 
  authRequired, 
  requirePageAccess('my_page'), 
  myController
);
```

### Check Access in Frontend

```javascript
import { usePageAccess } from './lib/usePageAccess';

function MyComponent() {
  const { hasAccess } = usePageAccess();
  
  return (
    <>
      {hasAccess('my_page') && (
        <Link to="/my/page">My Page</Link>
      )}
    </>
  );
}
```

---

## API Endpoints Cheat Sheet

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/permissions/pages` | Get all pages | Admin |
| POST | `/api/permissions/pages` | Create page | Admin |
| PUT | `/api/permissions/pages/:id` | Update page | Admin |
| DELETE | `/api/permissions/pages/:id` | Delete page | Admin |
| GET | `/api/permissions/roles` | Get roles + permissions | Admin |
| GET | `/api/permissions/roles/:id` | Get role permissions | Admin |
| PUT | `/api/permissions/roles/:id` | Update role permissions | Admin |
| PUT | `/api/permissions/roles/:roleId/pages/:pageId` | Set single permission | Admin |
| GET | `/api/permissions/my-pages` | Get my accessible pages | User |

---

## Default Page Keys

| Page Key | Path | Default Access |
|----------|------|----------------|
| `issue_license` | `/` | All roles |
| `my_licenses` | `/licenses` | All roles |
| `change_password` | `/change-password` | All roles |
| `payment` | `/payment` | All roles |
| `workflow_inbox` | `/workflow/inbox` | All roles |
| `print_license` | `/print-license` | All roles |
| `approvals_tasks` | `/approvals/tasks` | Admin, Officer |
| `admin_users` | `/admin/users` | Admin |
| `admin_roles` | `/admin/roles` | Admin |
| `admin_approvals_flow` | `/admin/approvals-flow` | Admin |
| `admin_lookups` | `/admin/lookups` | Admin |
| `admin_systemtypes` | `/admin/systemtypes` | Admin |
| `admin_provinces` | `/admin/provinces` | Admin |
| `admin_tariffs` | `/admin/tariffs` | Admin |
| `admin_reports_activity_licenses` | `/admin/reports/activity-licenses` | Admin |
| `admin_workflow_requests` | `/admin/workflow/requests` | Admin |

---

## Troubleshooting

### User can't access a page

**Check 1: Is the page in the database?**
```sql
SELECT * FROM Pages WHERE PageKey = 'your_page_key';
```

**Check 2: Does the role have permission?**
```sql
SELECT r.Name, p.PageTitle, rpp.CanAccess
FROM Roles r
CROSS JOIN Pages p
LEFT JOIN RolePagePermissions rpp ON r.Id = rpp.RoleId AND p.Id = rpp.PageId
WHERE p.PageKey = 'your_page_key';
```

**Check 3: Is the user assigned to the role?**
```sql
SELECT u.NationalCode, u.FullName, u.Role, r.Name as AdditionalRole
FROM Users u
LEFT JOIN UserRoles ur ON u.Id = ur.UserId
LEFT JOIN Roles r ON ur.RoleId = r.Id
WHERE u.NationalCode = '1234567890';
```

### Permission changes not reflecting

1. **Clear browser cache**: Ctrl+Shift+Delete
2. **Re-login**: Logout and login again
3. **Check API response**: Open DevTools → Network tab
4. **Verify database**: Run verification script

---

## SQL Queries for Common Operations

### View all permissions for a role
```sql
SELECT r.Name as Role, p.PageTitle, p.PagePath, rpp.CanAccess
FROM Roles r
INNER JOIN RolePagePermissions rpp ON r.Id = rpp.RoleId
INNER JOIN Pages p ON rpp.PageId = p.Id
WHERE r.Name = 'User'
ORDER BY p.PageTitle;
```

### Grant all permissions to a role
```sql
DECLARE @RoleId INT = (SELECT Id FROM Roles WHERE Name = 'Officer');

INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess)
SELECT @RoleId, Id, 1
FROM Pages
WHERE NOT EXISTS (
  SELECT 1 FROM RolePagePermissions 
  WHERE RoleId = @RoleId AND PageId = Pages.Id
);
```

### Revoke all permissions from a role
```sql
DELETE FROM RolePagePermissions
WHERE RoleId = (SELECT Id FROM Roles WHERE Name = 'User');
```

### Copy permissions from one role to another
```sql
DECLARE @SourceRoleId INT = (SELECT Id FROM Roles WHERE Name = 'Officer');
DECLARE @TargetRoleId INT = (SELECT Id FROM Roles WHERE Name = 'NewRole');

INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess)
SELECT @TargetRoleId, PageId, CanAccess
FROM RolePagePermissions
WHERE RoleId = @SourceRoleId;
```

### Find pages without any permissions
```sql
SELECT p.PageKey, p.PageTitle, p.PagePath
FROM Pages p
LEFT JOIN RolePagePermissions rpp ON p.Id = rpp.PageId
WHERE rpp.Id IS NULL
ORDER BY p.PageTitle;
```

### Find users with access to a specific page
```sql
DECLARE @PageKey NVARCHAR(100) = 'admin_users';

SELECT DISTINCT u.NationalCode, u.FullName, u.Role
FROM Users u
INNER JOIN Roles r ON r.Name = u.Role
INNER JOIN RolePagePermissions rpp ON rpp.RoleId = r.Id
INNER JOIN Pages p ON p.Id = rpp.PageId
WHERE p.PageKey = @PageKey AND rpp.CanAccess = 1
ORDER BY u.NationalCode;
```

---

## Best Practices

✅ **DO:**
- Always protect backend routes with `requirePageAccess()`
- Use descriptive page keys (e.g., `admin_users`, not `page1`)
- Test permissions after changes
- Keep page titles in Persian for consistency
- Document new pages in this reference

❌ **DON'T:**
- Don't rely only on frontend checks for security
- Don't hardcode role names in multiple places
- Don't delete pages that are in use
- Don't modify Admin permissions without careful consideration
- Don't forget to grant permissions after adding new pages

---

## File Locations

| Component | File Path |
|-----------|-----------|
| Database Schema | `server/database/role_permissions.sql` |
| Verification Script | `server/database/verify_permissions_setup.sql` |
| Backend Controller | `server/src/controllers/permissions.controller.js` |
| Backend Routes | `server/src/routes/modules/permissions.js` |
| Backend Middleware | `server/src/middleware/pageAccess.js` |
| Frontend Admin Page | `client/src/pages/AdminRolePermissions.jsx` |
| Frontend Hook | `client/src/lib/usePageAccess.js` |
| Full Documentation | `ROLE_PERMISSIONS_GUIDE.md` |
| Usage Examples | `server/src/middleware/pageAccess.example.js` |

---

## Support & Resources

- **Full Documentation**: See `ROLE_PERMISSIONS_GUIDE.md`
- **Code Examples**: See `server/src/middleware/pageAccess.example.js`
- **Database Verification**: Run `verify_permissions_setup.sql`

---

*Last Updated: 2025-10-04*
