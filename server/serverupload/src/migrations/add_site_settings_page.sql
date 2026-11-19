-- Migration: Register admin_site_settings page and grant Admin role access

-- Insert the page if it doesn't exist
IF NOT EXISTS (SELECT 1 FROM Pages WHERE PageKey = 'admin_site_settings')
BEGIN
    INSERT INTO Pages (PageKey, PagePath, PageTitle, Description, IsActive)
    VALUES (
        'admin_site_settings',
        '/admin/site-settings',
        N'تنظیمات سایت',
        N'مدیریت تنظیمات سایت از جمله پیام پاپ‌آپ',
        1
    );
END

-- Grant access to Admin role
DECLARE @pageId INT = (SELECT Id FROM Pages WHERE PageKey = 'admin_site_settings');
DECLARE @adminRoleId INT = (SELECT Id FROM Roles WHERE Name = 'Admin');

IF @pageId IS NOT NULL AND @adminRoleId IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM RolePagePermissions WHERE RoleId = @adminRoleId AND PageId = @pageId)
    BEGIN
        INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess)
        VALUES (@adminRoleId, @pageId, 1);
    END
    ELSE
    BEGIN
        UPDATE RolePagePermissions SET CanAccess = 1
        WHERE RoleId = @adminRoleId AND PageId = @pageId;
    END
END
