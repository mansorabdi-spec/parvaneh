-- =============================================
-- Add Employment License Pages and Permissions
-- =============================================
USE [parvaneh]
GO

PRINT 'Starting Employment License setup...'
GO

-- Step 1: Remove any duplicate or old employment license entries
PRINT 'Cleaning up old entries...'

-- Remove old page entries if they exist
DELETE FROM Pages WHERE PageKey = 'employment_license';
DELETE FROM Pages WHERE PageKey = 'employment_issue';
DELETE FROM Pages WHERE PageKey = 'employment_renew';
DELETE FROM Pages WHERE PageKey = 'employment_revoke';

-- Remove old permission entries
DELETE FROM RolePermissions WHERE PermissionKey = 'employment_license';
DELETE FROM RolePermissions WHERE PermissionKey = 'employment_issue';
DELETE FROM RolePermissions WHERE PermissionKey = 'employment_renew';
DELETE FROM RolePermissions WHERE PermissionKey = 'employment_revoke';

PRINT 'Old entries cleaned up'
GO

-- Step 2: Add new pages to Pages table
PRINT 'Adding Employment License pages...'

INSERT INTO Pages (PageKey, PageTitle, PagePath, IsActive) 
VALUES ('employment_issue', N'صدور پروانه اشتغال', '/licenses/employment/issue', 1);

INSERT INTO Pages (PageKey, PageTitle, PagePath, IsActive) 
VALUES ('employment_renew', N'تمدید پروانه اشتغال', '/licenses/employment/renew', 1);

INSERT INTO Pages (PageKey, PageTitle, PagePath, IsActive) 
VALUES ('employment_revoke', N'ابطال پروانه اشتغال', '/licenses/employment/revoke', 1);

PRINT 'Pages added successfully'
GO

-- Step 3: Add permissions to RolePermissions table
PRINT 'Adding permissions for all roles...'

-- Add permissions for Admin role
INSERT INTO RolePermissions (RoleName, PermissionKey, CanView, CanEdit) 
VALUES (N'Admin', 'employment_issue', 1, 1);

INSERT INTO RolePermissions (RoleName, PermissionKey, CanView, CanEdit) 
VALUES (N'Admin', 'employment_renew', 1, 1);

INSERT INTO RolePermissions (RoleName, PermissionKey, CanView, CanEdit) 
VALUES (N'Admin', 'employment_revoke', 1, 1);

-- Add permissions for User role
INSERT INTO RolePermissions (RoleName, PermissionKey, CanView, CanEdit) 
VALUES (N'User', 'employment_issue', 1, 1);

INSERT INTO RolePermissions (RoleName, PermissionKey, CanView, CanEdit) 
VALUES (N'User', 'employment_renew', 1, 1);

INSERT INTO RolePermissions (RoleName, PermissionKey, CanView, CanEdit) 
VALUES (N'User', 'employment_revoke', 1, 1);

-- Add permissions for Officer role
INSERT INTO RolePermissions (RoleName, PermissionKey, CanView, CanEdit) 
VALUES (N'Officer', 'employment_issue', 1, 1);

INSERT INTO RolePermissions (RoleName, PermissionKey, CanView, CanEdit) 
VALUES (N'Officer', 'employment_renew', 1, 1);

INSERT INTO RolePermissions (RoleName, PermissionKey, CanView, CanEdit) 
VALUES (N'Officer', 'employment_revoke', 1, 1);

PRINT 'Permissions added successfully for all roles'
GO

PRINT '============================================='
PRINT 'Employment License setup completed!'
PRINT 'Pages added: employment_issue, employment_renew, employment_revoke'
PRINT 'Permissions granted to: Admin, User, Officer'
PRINT '============================================='
GO
