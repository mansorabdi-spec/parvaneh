-- Add کارشناس تایید محل (Location Verification Expert) role and permissions
-- This script adds the new role to the Roles table and grants it the same permissions as Admin

-- Step 1: Add the role to Roles table if it doesn't exist
IF NOT EXISTS (SELECT 1 FROM Roles WHERE Name = N'کارشناس تایید محل')
BEGIN
  INSERT INTO Roles (Name) VALUES (N'کارشناس تایید محل');
  PRINT 'Role کارشناس تایید محل created';
END
ELSE
BEGIN
  PRINT 'Role کارشناس تایید محل already exists';
END;

-- Step 2: Add permissions for کارشناس تایید محل (same as Admin)
-- Insert all Admin permissions for the new role if they don't exist
INSERT INTO RolePermissions (RoleName, PermissionKey, CanView, CanEdit)
SELECT 
  N'کارشناس تایید محل' AS RoleName,
  PermissionKey,
  CanView,
  CanEdit
FROM RolePermissions
WHERE RoleName = 'Admin'
  AND NOT EXISTS (
    SELECT 1 FROM RolePermissions rp2
    WHERE rp2.RoleName = N'کارشناس تایید محل'
      AND rp2.PermissionKey = RolePermissions.PermissionKey
  );

PRINT 'Permissions copied from Admin to کارشناس تایید محل';

-- Step 3: Verify the setup
-- Check if role exists
IF EXISTS (SELECT 1 FROM Roles WHERE Name = N'کارشناس تایید محل')
BEGIN
  PRINT '✅ Role کارشناس تایید محل exists in Roles table';
END
ELSE
BEGIN
  PRINT '❌ Role کارشناس تایید محل NOT found in Roles table';
END;

-- Count permissions
DECLARE @PermissionCount INT;
SELECT @PermissionCount = COUNT(*) 
FROM RolePermissions 
WHERE RoleName = N'کارشناس تایید محل';

PRINT 'Total permissions for کارشناس تایید محل: ' + CAST(@PermissionCount AS NVARCHAR);

-- Show all permissions
SELECT 
  RoleName,
  PermissionKey,
  CanView,
  CanEdit
FROM RolePermissions
WHERE RoleName = N'کارشناس تایید محل'
ORDER BY PermissionKey;
