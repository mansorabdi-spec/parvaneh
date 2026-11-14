-- Add pages for Change License functionality
-- This migration adds pages and permissions for the Change License feature

-- Insert pages for Change License functionality
IF NOT EXISTS (SELECT 1 FROM Pages WHERE PageKey = 'change_license' AND PagePath = '/licenses/activity/change/:requestId')
BEGIN
    INSERT INTO Pages (PageKey, PagePath, PageTitle, Description, IsActive)
    VALUES 
        ('change_license', '/licenses/activity/change/:requestId', 'تغییر پروانه فعالیت', 'صفحه تغییر پروانه فعالیت حقیقی', 1),
        ('employment_change', '/licenses/employment/change/:requestId', 'تغییر پروانه اشتغال', 'صفحه تغییر پروانه اشتغال', 1),
        ('exploitation_change', '/licenses/exploitation/change/:requestId', 'تغییر پروانه بهره‌برداری', 'صفحه تغییر پروانه بهره‌برداری', 1)
    PRINT 'Pages added successfully'
END
ELSE
PRINT 'Pages already exist'

-- Get the Page IDs for the newly added pages
DECLARE @change_license_id INT
DECLARE @employment_change_id INT
DECLARE @exploitation_change_id INT

SELECT @change_license_id = Id FROM Pages WHERE PageKey = 'change_license' AND PagePath = '/licenses/activity/change/:requestId'
SELECT @employment_change_id = Id FROM Pages WHERE PageKey = 'employment_change'
SELECT @exploitation_change_id = Id FROM Pages WHERE PageKey = 'exploitation_change'

-- Get role IDs
DECLARE @admin_role_id INT
DECLARE @deputy_admin_role_id INT
DECLARE @operator_role_id INT
DECLARE @user_role_id INT

SELECT @admin_role_id = Id FROM Roles WHERE Name = 'Admin'
SELECT @deputy_admin_role_id = Id FROM Roles WHERE Name = 'superadmin'
SELECT @operator_role_id = Id FROM Roles WHERE Name = 'کارگزار (بهره بردار)'
SELECT @user_role_id = Id FROM Roles WHERE Name = 'کاربر'

-- Add permissions for change_license page
IF @change_license_id IS NOT NULL
BEGIN
    -- Admin - View and Edit
    IF NOT EXISTS (SELECT 1 FROM RolePagePermissions WHERE RoleId = @admin_role_id AND PageId = @change_license_id)
    BEGIN
        INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess) VALUES (@admin_role_id, @change_license_id, 1)
        PRINT 'Added change_license permission for Admin'
    END
    
    -- Deputy Admin - View and Edit
    IF NOT EXISTS (SELECT 1 FROM RolePagePermissions WHERE RoleId = @deputy_admin_role_id AND PageId = @change_license_id)
    BEGIN
        INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess) VALUES (@deputy_admin_role_id, @change_license_id, 1)
        PRINT 'Added change_license permission for Deputy Admin'
    END
    
    -- Operator - View only
    IF NOT EXISTS (SELECT 1 FROM RolePagePermissions WHERE RoleId = @operator_role_id AND PageId = @change_license_id)
    BEGIN
        INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess) VALUES (@operator_role_id, @change_license_id, 1)
        PRINT 'Added change_license permission for Operator'
    END
    
    -- User - View only
    IF NOT EXISTS (SELECT 1 FROM RolePagePermissions WHERE RoleId = @user_role_id AND PageId = @change_license_id)
    BEGIN
        INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess) VALUES (@user_role_id, @change_license_id, 1)
        PRINT 'Added change_license permission for User'
    END
END

-- Add permissions for employment_change page
IF @employment_change_id IS NOT NULL
BEGIN
    -- Admin - View and Edit
    IF NOT EXISTS (SELECT 1 FROM RolePagePermissions WHERE RoleId = @admin_role_id AND PageId = @employment_change_id)
    BEGIN
        INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess) VALUES (@admin_role_id, @employment_change_id, 1)
        PRINT 'Added employment_change permission for Admin'
    END
    
    -- Deputy Admin - View and Edit
    IF NOT EXISTS (SELECT 1 FROM RolePagePermissions WHERE RoleId = @deputy_admin_role_id AND PageId = @employment_change_id)
    BEGIN
        INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess) VALUES (@deputy_admin_role_id, @employment_change_id, 1)
        PRINT 'Added employment_change permission for Deputy Admin'
    END
    
    -- Operator - View only
    IF NOT EXISTS (SELECT 1 FROM RolePagePermissions WHERE RoleId = @operator_role_id AND PageId = @employment_change_id)
    BEGIN
        INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess) VALUES (@operator_role_id, @employment_change_id, 1)
        PRINT 'Added employment_change permission for Operator'
    END
    
    -- User - View only
    IF NOT EXISTS (SELECT 1 FROM RolePagePermissions WHERE RoleId = @user_role_id AND PageId = @employment_change_id)
    BEGIN
        INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess) VALUES (@user_role_id, @employment_change_id, 1)
        PRINT 'Added employment_change permission for User'
    END
END

-- Add permissions for exploitation_change page
IF @exploitation_change_id IS NOT NULL
BEGIN
    -- Admin - View and Edit
    IF NOT EXISTS (SELECT 1 FROM RolePagePermissions WHERE RoleId = @admin_role_id AND PageId = @exploitation_change_id)
    BEGIN
        INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess) VALUES (@admin_role_id, @exploitation_change_id, 1)
        PRINT 'Added exploitation_change permission for Admin'
    END
    
    -- Deputy Admin - View and Edit
    IF NOT EXISTS (SELECT 1 FROM RolePagePermissions WHERE RoleId = @deputy_admin_role_id AND PageId = @exploitation_change_id)
    BEGIN
        INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess) VALUES (@deputy_admin_role_id, @exploitation_change_id, 1)
        PRINT 'Added exploitation_change permission for Deputy Admin'
    END
    
    -- Operator - View only
    IF NOT EXISTS (SELECT 1 FROM RolePagePermissions WHERE RoleId = @operator_role_id AND PageId = @exploitation_change_id)
    BEGIN
        INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess) VALUES (@operator_role_id, @exploitation_change_id, 1)
        PRINT 'Added exploitation_change permission for Operator'
    END
    
    -- User - View only
    IF NOT EXISTS (SELECT 1 FROM RolePagePermissions WHERE RoleId = @user_role_id AND PageId = @exploitation_change_id)
    BEGIN
        INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess) VALUES (@user_role_id, @exploitation_change_id, 1)
        PRINT 'Added exploitation_change permission for User'
    END
END

-- Verify the results
SELECT 
    p.PageKey,
    p.PagePath,
    p.PageTitle,
    r.Name AS RoleName,
    rpp.CanAccess
FROM Pages p
INNER JOIN RolePagePermissions rpp ON p.Id = rpp.PageId
INNER JOIN Roles r ON rpp.RoleId = r.Id
WHERE p.PageKey IN ('change_license', 'employment_change', 'exploitation_change')
ORDER BY r.Name, p.PageKey

PRINT 'Migration completed successfully!'