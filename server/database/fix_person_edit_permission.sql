-- Fix: Grant edit permission for person info to applicant role
-- This allows applicants to edit their own personal information

USE [parvaneh]
GO

-- Check current permission status
SELECT RoleName, PermissionKey, CanView, CanEdit
FROM RolePermissions
WHERE PermissionKey = 'view_person_info'
ORDER BY RoleName;

-- Grant edit permission to applicant role for view_person_info
-- If the record doesn't exist, insert it
IF NOT EXISTS (SELECT 1 FROM RolePermissions WHERE RoleName = 'applicant' AND PermissionKey = 'view_person_info')
BEGIN
    INSERT INTO RolePermissions (RoleName, PermissionKey, CanView, CanEdit)
    VALUES ('applicant', 'view_person_info', 1, 1);
    PRINT 'Permission added for applicant role';
END
ELSE
BEGIN
    UPDATE RolePermissions
    SET CanEdit = 1, CanView = 1
    WHERE RoleName = 'applicant' AND PermissionKey = 'view_person_info';
    PRINT 'Permission updated for applicant role';
END

-- Also check and fix for company routes if needed
IF NOT EXISTS (SELECT 1 FROM RolePermissions WHERE RoleName = 'applicant' AND PermissionKey = 'company_info')
BEGIN
    INSERT INTO RolePermissions (RoleName, PermissionKey, CanView, CanEdit)
    VALUES ('applicant', 'company_info', 1, 1);
    PRINT 'Company permission added for applicant role';
END
ELSE
BEGIN
    UPDATE RolePermissions
    SET CanEdit = 1, CanView = 1
    WHERE RoleName = 'applicant' AND PermissionKey = 'company_info';
    PRINT 'Company permission updated for applicant role';
END

-- Verify the changes
SELECT RoleName, PermissionKey, CanView, CanEdit
FROM RolePermissions
WHERE RoleName = 'applicant' 
  AND PermissionKey IN ('view_person_info', 'company_info')
ORDER BY PermissionKey;

PRINT 'Permission fix completed successfully!';
GO
