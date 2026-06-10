-- Migration: Add license history page and permissions
-- Date: 2025-12-19

USE [parvaneh2]
GO

-- Add license history page to Pages table
IF NOT EXISTS (SELECT * FROM Pages WHERE PageKey = 'admin_license_history')
BEGIN
    INSERT INTO Pages (PageKey, PagePath, PageTitle, Description, IsActive)
    VALUES (
        'admin_license_history',
        '/admin/license-history',
        N'تاریخچه پروانه‌ها',
        N'مشاهده و مدیریت تاریخچه صدور، تمدید و ابطال پروانه‌ها',
        1
    );
    
    PRINT 'License history page added to Pages table';
END
ELSE
BEGIN
    PRINT 'License history page already exists';
END
GO

-- Grant permission to Admin role
DECLARE @PageId INT;
DECLARE @AdminRoleId INT;

SELECT @PageId = Id FROM Pages WHERE PageKey = 'admin_license_history';
SELECT @AdminRoleId = Id FROM Roles WHERE Name = 'Admin';

IF @PageId IS NOT NULL AND @AdminRoleId IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT * FROM RolePagePermissions WHERE RoleId = @AdminRoleId AND PageId = @PageId)
    BEGIN
        INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess)
        VALUES (@AdminRoleId, @PageId, 1);
        
        PRINT 'License history page permission granted to Admin role';
    END
    ELSE
    BEGIN
        PRINT 'License history page permission already exists for Admin role';
    END
END
GO

PRINT 'License history page migration completed successfully';
GO
