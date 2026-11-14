-- Add permissions for Change License pages
-- This migration adds permissions for:
-- - change_license (Activity License Change)
-- - employment_change (Employment License Change)
-- - exploitation_change (Exploitation License Change)

-- First, check if permissions already exist
IF NOT EXISTS (SELECT 1 FROM [dbo].[Permissions] WHERE [PermissionKey] = 'change_license')
BEGIN
    INSERT INTO [dbo].[Permissions] ([PermissionKey], [PermissionName], [Description], [IsActive])
    VALUES 
        ('change_license', 'درخواست تغییر پروانه فعالیت', 'مجوز درخواست تغییر برای پروانه فعالیت حقیقی/حقوقی', 1)
END

IF NOT EXISTS (SELECT 1 FROM [dbo].[Permissions] WHERE [PermissionKey] = 'employment_change')
BEGIN
    INSERT INTO [dbo].[Permissions] ([PermissionKey], [PermissionName], [Description], [IsActive])
    VALUES 
        ('employment_change', 'درخواست تغییر پروانه اشتغال', 'مجوز درخواست تغییر برای پروانه اشتغال', 1)
END

IF NOT EXISTS (SELECT 1 FROM [dbo].[Permissions] WHERE [PermissionKey] = 'exploitation_change')
BEGIN
    INSERT INTO [dbo].[Permissions] ([PermissionKey], [PermissionName], [Description], [IsActive])
    VALUES 
        ('exploitation_change', 'درخواست تغییر پروانه بهره‌برداری', 'مجوز درخواست تغییر برای پروانه بهره‌برداری', 1)
END

-- Get the Permission IDs
DECLARE @change_license_id INT
DECLARE @employment_change_id INT
DECLARE @exploitation_change_id INT

SELECT @change_license_id = [PermissionID] FROM [dbo].[Permissions] WHERE [PermissionKey] = 'change_license'
SELECT @employment_change_id = [PermissionID] FROM [dbo].[Permissions] WHERE [PermissionKey] = 'employment_change'
SELECT @exploitation_change_id = [PermissionID] FROM [dbo].[Permissions] WHERE [PermissionKey] = 'exploitation_change'

-- Add permissions for Admin role
DECLARE @admin_role_id INT
SELECT @admin_role_id = [RoleID] FROM [dbo].[Roles] WHERE [RoleName] = 'Admin'

IF @admin_role_id IS NOT NULL AND @change_license_id IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM [dbo].[RolePermissions] WHERE [RoleID] = @admin_role_id AND [PermissionID] = @change_license_id)
    BEGIN
        INSERT INTO [dbo].[RolePermissions] ([RoleID], [PermissionID], [CanView], [CanEdit])
        VALUES (@admin_role_id, @change_license_id, 1, 1)
    END
END

IF @admin_role_id IS NOT NULL AND @employment_change_id IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM [dbo].[RolePermissions] WHERE [RoleID] = @admin_role_id AND [PermissionID] = @employment_change_id)
    BEGIN
        INSERT INTO [dbo].[RolePermissions] ([RoleID], [PermissionID], [CanView], [CanEdit])
        VALUES (@admin_role_id, @employment_change_id, 1, 1)
    END
END

IF @admin_role_id IS NOT NULL AND @exploitation_change_id IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM [dbo].[RolePermissions] WHERE [RoleID] = @admin_role_id AND [PermissionID] = @exploitation_change_id)
    BEGIN
        INSERT INTO [dbo].[RolePermissions] ([RoleID], [PermissionID], [CanView], [CanEdit])
        VALUES (@admin_role_id, @exploitation_change_id, 1, 1)
    END
END

-- Add permissions for superadmin role
DECLARE @deputy_admin_role_id INT
SELECT @deputy_admin_role_id = [RoleID] FROM [dbo].[Roles] WHERE [RoleName] = 'superadmin'

IF @deputy_admin_role_id IS NOT NULL AND @change_license_id IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM [dbo].[RolePermissions] WHERE [RoleID] = @deputy_admin_role_id AND [PermissionID] = @change_license_id)
    BEGIN
        INSERT INTO [dbo].[RolePermissions] ([RoleID], [PermissionID], [CanView], [CanEdit])
        VALUES (@deputy_admin_role_id, @change_license_id, 1, 1)
    END
END

IF @deputy_admin_role_id IS NOT NULL AND @employment_change_id IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM [dbo].[RolePermissions] WHERE [RoleID] = @deputy_admin_role_id AND [PermissionID] = @employment_change_id)
    BEGIN
        INSERT INTO [dbo].[RolePermissions] ([RoleID], [PermissionID], [CanView], [CanEdit])
        VALUES (@deputy_admin_role_id, @employment_change_id, 1, 1)
    END
END

IF @deputy_admin_role_id IS NOT NULL AND @exploitation_change_id IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM [dbo].[RolePermissions] WHERE [RoleID] = @deputy_admin_role_id AND [PermissionID] = @exploitation_change_id)
    BEGIN
        INSERT INTO [dbo].[RolePermissions] ([RoleID], [PermissionID], [CanView], [CanEdit])
        VALUES (@deputy_admin_role_id, @exploitation_change_id, 1, 1)
    END
END

-- Add permissions for کارگزار (بهره بردار) role
DECLARE @agent_role_id INT
SELECT @agent_role_id = [RoleID] FROM [dbo].[Roles] WHERE [RoleName] = 'کارگزار (بهره بردار)'

IF @agent_role_id IS NOT NULL AND @change_license_id IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM [dbo].[RolePermissions] WHERE [RoleID] = @agent_role_id AND [PermissionID] = @change_license_id)
    BEGIN
        INSERT INTO [dbo].[RolePermissions] ([RoleID], [PermissionID], [CanView], [CanEdit])
        VALUES (@agent_role_id, @change_license_id, 1, 0)
    END
END

IF @agent_role_id IS NOT NULL AND @employment_change_id IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM [dbo].[RolePermissions] WHERE [RoleID] = @agent_role_id AND [PermissionID] = @employment_change_id)
    BEGIN
        INSERT INTO [dbo].[RolePermissions] ([RoleID], [PermissionID], [CanView], [CanEdit])
        VALUES (@agent_role_id, @employment_change_id, 1, 0)
    END
END

IF @agent_role_id IS NOT NULL AND @exploitation_change_id IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM [dbo].[RolePermissions] WHERE [RoleID] = @agent_role_id AND [PermissionID] = @exploitation_change_id)
    BEGIN
        INSERT INTO [dbo].[RolePermissions] ([RoleID], [PermissionID], [CanView], [CanEdit])
        VALUES (@agent_role_id, @exploitation_change_id, 1, 0)
    END
END

-- Add permissions for کاربر role
DECLARE @user_role_id INT
SELECT @user_role_id = [RoleID] FROM [dbo].[Roles] WHERE [RoleName] = 'کاربر'

IF @user_role_id IS NOT NULL AND @change_license_id IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM [dbo].[RolePermissions] WHERE [RoleID] = @user_role_id AND [PermissionID] = @change_license_id)
    BEGIN
        INSERT INTO [dbo].[RolePermissions] ([RoleID], [PermissionID], [CanView], [CanEdit])
        VALUES (@user_role_id, @change_license_id, 1, 0)
    END
END

IF @user_role_id IS NOT NULL AND @employment_change_id IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM [dbo].[RolePermissions] WHERE [RoleID] = @user_role_id AND [PermissionID] = @employment_change_id)
    BEGIN
        INSERT INTO [dbo].[RolePermissions] ([RoleID], [PermissionID], [CanView], [CanEdit])
        VALUES (@user_role_id, @employment_change_id, 1, 0)
    END
END

IF @user_role_id IS NOT NULL AND @exploitation_change_id IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM [dbo].[RolePermissions] WHERE [RoleID] = @user_role_id AND [PermissionID] = @exploitation_change_id)
    BEGIN
        INSERT INTO [dbo].[RolePermissions] ([RoleID], [PermissionID], [CanView], [CanEdit])
        VALUES (@user_role_id, @exploitation_change_id, 1, 0)
    END
END

-- Verify the changes
SELECT 
    r.[RoleName],
    p.[PermissionKey],
    p.[PermissionName],
    rp.[CanView],
    rp.[CanEdit]
FROM [dbo].[RolePermissions] rp
INNER JOIN [dbo].[Roles] r ON rp.[RoleID] = r.[RoleID]
INNER JOIN [dbo].[Permissions] p ON rp.[PermissionID] = p.[PermissionID]
WHERE p.[PermissionKey] IN ('change_license', 'employment_change', 'exploitation_change')
ORDER BY r.[RoleName], p.[PermissionKey]