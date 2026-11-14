# Role-Based Page Access Control System

## Overview
This system allows administrators to configure which roles can access which pages in the application. It provides both backend and frontend enforcement of page access permissions.

## Architecture

### Database Tables

#### Pages Table
Stores all available pages in the system.
- `Id`: Primary key
- `PageKey`: Unique identifier for the page (e.g., 'admin_users')
- `PagePath`: URL path (e.g., '/admin/users')
- `PageTitle`: Display title in Persian
- `Description`: Optional description
- `IsActive`: Whether the page is active
- `CreatedAt`: Creation timestamp

#### RolePagePermissions Table
Maps roles to pages (many-to-many relationship).
- `Id`: Primary key
- `RoleId`: Foreign key to Roles table
- `PageId`: Foreign key to Pages table
- `CanAccess`: Boolean flag for access permission
- `CreatedAt`: Creation timestamp

### Backend Components

#### 1. Database Schema
**File**: `server/database/role_permissions.sql`

Run this script to create the necessary tables and seed default permissions:
```bash
# Execute in SQL Server Management Studio or via command line
sqlcmd -S your_server -d your_database -i server/database/role_permissions.sql
```

#### 2. Permissions Controller
**File**: `server/src/controllers/permissions.controller.js`

Provides the following functions:
- `getAllPages()`: Get all pages in the system
- `getRolesWithPermissions()`: Get all roles with their page permissions
- `getRolePermissions(roleId)`: Get permissions for a specific role
- `updateRolePermissions(roleId, permissions)`: Update all permissions for a role
- `setRolePermission(roleId, pageId, canAccess)`: Set a single permission
- `getMyAccessiblePages()`: Get accessible pages for the current user
- `createPage()`: Create a new page
- `updatePage()`: Update a page
- `deletePage()`: Delete a page

#### 3. Permissions Routes
**File**: `server/src/routes/modules/permissions.js`

API Endpoints:
- `GET /api/permissions/pages` - Get all pages (Admin only)
- `POST /api/permissions/pages` - Create a new page (Admin only)
- `PUT /api/permissions/pages/:pageId` - Update a page (Admin only)
- `DELETE /api/permissions/pages/:pageId` - Delete a page (Admin only)
- `GET /api/permissions/roles` - Get all roles with permissions (Admin only)
- `GET /api/permissions/roles/:roleId` - Get permissions for a role (Admin only)
- `PUT /api/permissions/roles/:roleId` - Update role permissions (Admin only)
- `PUT /api/permissions/roles/:roleId/pages/:pageId` - Set single permission (Admin only)
- `GET /api/permissions/my-pages` - Get accessible pages for current user

#### 4. Page Access Middleware
**File**: `server/src/middleware/pageAccess.js`

Provides middleware functions to enforce page access:
- `requirePageAccess(pageKey)`: Require access to a specific page
- `requireAnyPageAccess([pageKeys])`: Require access to any of the specified pages

**Usage Example**:
```javascript
import { requirePageAccess } from '../middleware/pageAccess.js';

// Protect a route with page access check
router.get('/admin/users', 
  authRequired, 
  requirePageAccess('admin_users'), 
  getUsersController
);
```

### Frontend Components

#### 1. Admin Page for Managing Permissions
**File**: `client/src/pages/AdminRolePermissions.jsx`

A comprehensive UI for administrators to:
- View all roles and their permissions
- Toggle permissions for each role-page combination
- Select all or deselect all permissions for a role
- Save changes in bulk or individually

**Access**: Available at `/admin/role-permissions` (Admin only)

#### 2. Page Access Hook
**File**: `client/src/lib/usePageAccess.js`

A React hook for checking page access in the frontend:

```javascript
import { usePageAccess } from './lib/usePageAccess';

function MyComponent() {
  const { accessiblePages, hasAccess, loading, error } = usePageAccess();
  
  if (loading) return <div>Loading...</div>;
  
  return (
    <div>
      {hasAccess('admin_users') && (
        <Link to="/admin/users">User Management</Link>
      )}
      {hasAccess('/admin/reports') && (
        <Link to="/admin/reports">Reports</Link>
      )}
    </div>
  );
}
```

## Setup Instructions

### 1. Database Setup
Execute the SQL script to create tables and seed default data:
```sql
-- Run this in SQL Server
USE YourDatabase;
GO
-- Execute the contents of server/database/role_permissions.sql
```

### 2. Backend Setup
The routes are already registered in `server/src/routes/index.js`. No additional setup needed.

### 3. Frontend Setup
The admin page is already integrated into the navigation menu under "مدیریت کاربران" → "دسترسی‌های نقش‌ها".

## Usage Guide

### For Administrators

#### Managing Role Permissions
1. Log in as an Admin user
2. Navigate to "مدیریت کاربران" → "دسترسی‌های نقش‌ها"
3. Select a role from the left panel
4. Check/uncheck permissions for each page
5. Click "ذخیره تغییرات" to save changes

#### Quick Actions
- **انتخاب همه** (Select All): Grant access to all pages
- **حذف همه** (Deselect All): Revoke access to all pages
- **ذخیره تغییرات** (Save Changes): Bulk save all permission changes

### For Developers

#### Adding a New Page to the System

1. **Add page to database**:
```sql
INSERT INTO Pages (PageKey, PagePath, PageTitle, Description)
VALUES ('my_new_page', '/my/new/page', N'صفحه جدید من', N'توضیحات صفحه');
```

2. **Grant default permissions** (optional):
```sql
-- Grant access to Admin role
DECLARE @AdminRoleId INT = (SELECT Id FROM Roles WHERE Name = 'Admin');
DECLARE @PageId INT = (SELECT Id FROM Pages WHERE PageKey = 'my_new_page');

INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess)
VALUES (@AdminRoleId, @PageId, 1);
```

3. **Protect the route** (backend):
```javascript
import { requirePageAccess } from '../middleware/pageAccess.js';

router.get('/my/new/page', 
  authRequired, 
  requirePageAccess('my_new_page'), 
  myController
);
```

4. **Conditionally render in frontend**:
```javascript
import { usePageAccess } from './lib/usePageAccess';

function Navigation() {
  const { hasAccess } = usePageAccess();
  
  return (
    <nav>
      {hasAccess('my_new_page') && (
        <Link to="/my/new/page">صفحه جدید من</Link>
      )}
    </nav>
  );
}
```

#### Using the API Programmatically

**Get accessible pages for current user**:
```javascript
const response = await fetch('/api/permissions/my-pages', {
  headers: { Authorization: `Bearer ${token}` }
});
const data = await response.json();
console.log(data.pages); // Array of accessible pages
```

**Update role permissions** (Admin only):
```javascript
const permissions = [
  { pageId: 1, canAccess: true },
  { pageId: 2, canAccess: false },
  { pageId: 3, canAccess: true }
];

const response = await fetch(`/api/permissions/roles/${roleId}`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  },
  body: JSON.stringify({ permissions })
});
```

## Default Permissions

### Admin Role
Has access to ALL pages by default.

### Officer Role
Has access to:
- صدور پروانه (issue_license)
- پروانه‌های من (my_licenses)
- تغییر رمز عبور (change_password)
- پرداخت (payment)
- کارتابل من (workflow_inbox)
- چاپ پروانه (print_license)
- وظایف تایید (approvals_tasks)

### User Role
Has access to:
- صدور پروانه (issue_license)
- پروانه‌های من (my_licenses)
- تغییر رمز عبور (change_password)
- پرداخت (payment)
- کارتابل من (workflow_inbox)
- چاپ پروانه (print_license)

## Security Considerations

1. **Backend Enforcement**: Always enforce permissions on the backend using middleware. Frontend checks are for UX only.

2. **Token Validation**: All permission checks require a valid JWT token.

3. **Role Hierarchy**: The system supports both primary roles (User.Role) and additional roles (UserRoles table).

4. **Admin Override**: Admin role typically has access to all pages. Be careful when modifying admin permissions.

5. **Database Integrity**: Foreign key constraints ensure data consistency between roles, pages, and permissions.

## Troubleshooting

### Issue: User can't access a page they should have access to
1. Check if the page exists in the Pages table
2. Verify the user's role(s) in the Users and UserRoles tables
3. Check RolePagePermissions table for the role-page mapping
4. Ensure the page is active (IsActive = 1)

### Issue: Changes not reflecting in frontend
1. Clear browser cache and local storage
2. Re-login to get fresh token with updated permissions
3. Check browser console for API errors

### Issue: SQL script fails to execute
1. Ensure you're connected to the correct database
2. Check if tables already exist (script uses IF NOT EXISTS)
3. Verify foreign key relationships are intact

## API Response Examples

### GET /api/permissions/my-pages
```json
{
  "pages": [
    {
      "Id": 1,
      "PageKey": "issue_license",
      "PagePath": "/",
      "PageTitle": "صدور پروانه",
      "Description": "صفحه صدور پروانه فعالیت"
    },
    {
      "Id": 2,
      "PageKey": "my_licenses",
      "PagePath": "/licenses",
      "PageTitle": "پروانه‌های من",
      "Description": "مشاهده پروانه‌های صادر شده"
    }
  ]
}
```

### GET /api/permissions/roles
```json
{
  "roles": [
    {
      "Id": 1,
      "Name": "Admin",
      "Permissions": [
        {
          "PageId": 1,
          "PageKey": "admin_users",
          "PagePath": "/admin/users",
          "PageTitle": "مدیریت کاربران",
          "Description": "مدیریت کاربران سیستم",
          "CanAccess": true
        }
      ]
    }
  ]
}
```

## Future Enhancements

1. **Page Groups**: Organize pages into logical groups for easier management
2. **Permission Inheritance**: Allow roles to inherit permissions from parent roles
3. **Temporary Access**: Grant time-limited access to specific pages
4. **Audit Log**: Track permission changes and access attempts
5. **Bulk Operations**: Import/export permissions via CSV or JSON
6. **UI Improvements**: Drag-and-drop interface, search/filter capabilities

## Support

For issues or questions, please contact the development team or refer to the main project documentation.
