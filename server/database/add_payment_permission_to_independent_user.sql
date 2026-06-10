USE [parvaneh]
GO

-- Add payment edit permission to کاربر مستقل (Independent User) role
-- This allows independent users to submit offline payments for their own requests

-- First, check if the permission already exists
IF NOT EXISTS (
    SELECT 1 
    FROM RolePermissions 
    WHERE RoleName = N'کاربر مستقل' 
    AND PermissionKey = 'view_payments' 
    AND CanEdit = 1
)
BEGIN
    -- If the row exists but CanEdit is 0, update it
    IF EXISTS (
        SELECT 1 
        FROM RolePermissions 
        WHERE RoleName = N'کاربر مستقل' 
        AND PermissionKey = 'view_payments'
    )
    BEGIN
        UPDATE RolePermissions
        SET CanEdit = 1
        WHERE RoleName = N'کاربر مستقل' 
        AND PermissionKey = 'view_payments';
        
        PRINT 'Updated view_payments permission for کاربر مستقل role - CanEdit set to 1';
    END
    ELSE
    BEGIN
        -- If the row doesn't exist at all, insert it
        INSERT INTO RolePermissions (RoleName, PermissionKey, CanView, CanEdit)
        VALUES (N'کاربر مستقل', 'view_payments', 1, 1);
        
        PRINT 'Added view_payments permission (view and edit) for کاربر مستقل role';
    END
END
ELSE
BEGIN
    PRINT 'Permission already exists - no changes needed';
END
GO

-- Verify the permission
SELECT 
    RoleName,
    PermissionKey,
    CanView,
    CanEdit
FROM RolePermissions
WHERE RoleName = N'کاربر مستقل'
AND PermissionKey = 'view_payments';
GO
