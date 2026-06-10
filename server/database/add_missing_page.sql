-- Add missing admin_role_permissions page if it doesn't exist
-- Run this if you've already run role_permissions.sql but need to add the new page

IF NOT EXISTS (SELECT 1 FROM Pages WHERE PageKey = 'admin_role_permissions')
BEGIN
  INSERT INTO Pages (PageKey, PagePath, PageTitle, Description)
  VALUES ('admin_role_permissions', '/admin/role-permissions', N'دسترسی‌های نقش‌ها', N'مدیریت دسترسی‌های نقش‌ها به صفحات');
  
  PRINT 'Added admin_role_permissions page';
  
  -- Grant access to Admin role
  DECLARE @AdminRoleId INT = (SELECT Id FROM Roles WHERE Name = 'Admin');
  DECLARE @PageId INT = (SELECT Id FROM Pages WHERE PageKey = 'admin_role_permissions');
  
  IF @AdminRoleId IS NOT NULL AND @PageId IS NOT NULL
  BEGIN
    INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess)
    VALUES (@AdminRoleId, @PageId, 1);
    
    PRINT 'Granted admin_role_permissions access to Admin role';
  END
END
ELSE
BEGIN
  PRINT 'admin_role_permissions page already exists';
END
