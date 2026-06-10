-- Migration: Add admin_print_statistics page to Pages table
-- This allows admins to view print statistics and logs

USE [parvaneh2]
GO

-- Check if page already exists
IF NOT EXISTS (SELECT 1 FROM Pages WHERE PageKey = 'admin_print_statistics')
BEGIN
    INSERT INTO Pages (PageKey, PagePath, PageTitle, Description)
    VALUES (
        'admin_print_statistics',
        '/admin/print-statistics',
        N'آمار و گزارش چاپ پروانه‌ها',
        N'مشاهده آمار و گزارش‌های مربوط به چاپ پروانه‌ها'
    )
    
    PRINT 'Page admin_print_statistics added successfully'
END
ELSE
BEGIN
    PRINT 'Page admin_print_statistics already exists'
END
GO

-- Grant permission to Admin role
DECLARE @PageId INT
DECLARE @AdminRoleId INT

SELECT @PageId = Id FROM Pages WHERE PageKey = 'admin_print_statistics'
SELECT @AdminRoleId = Id FROM Roles WHERE Name = 'Admin'

IF @PageId IS NOT NULL AND @AdminRoleId IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM RolePagePermissions WHERE RoleId = @AdminRoleId AND PageId = @PageId)
    BEGIN
        INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess)
        VALUES (@AdminRoleId, @PageId, 1)
        
        PRINT 'Permission granted to Admin role for admin_print_statistics page'
    END
    ELSE
    BEGIN
        PRINT 'Permission already exists for Admin role'
    END
END
GO

PRINT 'Migration completed successfully!'
GO
