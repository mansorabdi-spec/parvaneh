-- Migration: Add user_licenses page to Pages table
-- This allows users to view their own licenses from LicenseHistory table

USE [parvaneh2]
GO

-- Check if page already exists
IF NOT EXISTS (SELECT 1 FROM Pages WHERE PageKey = 'user_licenses')
BEGIN
    INSERT INTO Pages (PageKey, PagePath, PageTitle, Description)
    VALUES (
        'user_licenses',
        '/user/licenses',
        N'پروانه‌ها',
        N'مشاهده لیست پروانه‌های کاربر'
    )
    
    PRINT 'Page user_licenses added successfully'
END
ELSE
BEGIN
    PRINT 'Page user_licenses already exists'
END
GO

-- Grant permission to all user roles (User, Agent, Admin, and experts)
DECLARE @PageId INT
SELECT @PageId = Id FROM Pages WHERE PageKey = 'user_licenses'

IF @PageId IS NOT NULL
BEGIN
    -- Grant to User role
    DECLARE @UserRoleId INT
    SELECT @UserRoleId = Id FROM Roles WHERE Name = N'کاربر'
    
    IF @UserRoleId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM RolePagePermissions WHERE RoleId = @UserRoleId AND PageId = @PageId)
    BEGIN
        INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess)
        VALUES (@UserRoleId, @PageId, 1)
        PRINT 'Permission granted to کاربر role'
    END

    -- Grant to Agent role
    DECLARE @AgentRoleId INT
    SELECT @AgentRoleId = Id FROM Roles WHERE Name = N'کارگزار (بهره بردار)'
    
    IF @AgentRoleId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM RolePagePermissions WHERE RoleId = @AgentRoleId AND PageId = @PageId)
    BEGIN
        INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess)
        VALUES (@AgentRoleId, @PageId, 1)
        PRINT 'Permission granted to کارگزار (بهره بردار) role'
    END

    -- Grant to Admin role
    DECLARE @AdminRoleId INT
    SELECT @AdminRoleId = Id FROM Roles WHERE Name = 'Admin'
    
    IF @AdminRoleId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM RolePagePermissions WHERE RoleId = @AdminRoleId AND PageId = @PageId)
    BEGIN
        INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess)
        VALUES (@AdminRoleId, @PageId, 1)
        PRINT 'Permission granted to Admin role'
    END

    -- Grant to کارشناس صدور پروانه role
    DECLARE @ExpertRoleId INT
    SELECT @ExpertRoleId = Id FROM Roles WHERE Name = N'کارشناس صدور پروانه'
    
    IF @ExpertRoleId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM RolePagePermissions WHERE RoleId = @ExpertRoleId AND PageId = @PageId)
    BEGIN
        INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess)
        VALUES (@ExpertRoleId, @PageId, 1)
        PRINT 'Permission granted to کارشناس صدور پروانه role'
    END

    -- Grant to کارشناس مالی role
    DECLARE @FinancialExpertRoleId INT
    SELECT @FinancialExpertRoleId = Id FROM Roles WHERE Name = N'کارشناس مالی'
    
    IF @FinancialExpertRoleId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM RolePagePermissions WHERE RoleId = @FinancialExpertRoleId AND PageId = @PageId)
    BEGIN
        INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess)
        VALUES (@FinancialExpertRoleId, @PageId, 1)
        PRINT 'Permission granted to کارشناس مالی role'
    END

    -- Grant to رییس اداره صدور پروانه role
    DECLARE @ManagerRoleId INT
    SELECT @ManagerRoleId = Id FROM Roles WHERE Name = N'رییس اداره صدور پروانه'
    
    IF @ManagerRoleId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM RolePagePermissions WHERE RoleId = @ManagerRoleId AND PageId = @PageId)
    BEGIN
        INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess)
        VALUES (@ManagerRoleId, @PageId, 1)
        PRINT 'Permission granted to رییس اداره صدور پروانه role'
    END

    -- Grant to کارشناس تایید محل role
    DECLARE @LocationExpertRoleId INT
    SELECT @LocationExpertRoleId = Id FROM Roles WHERE Name = N'کارشناس تایید محل'
    
    IF @LocationExpertRoleId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM RolePagePermissions WHERE RoleId = @LocationExpertRoleId AND PageId = @PageId)
    BEGIN
        INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess)
        VALUES (@LocationExpertRoleId, @PageId, 1)
        PRINT 'Permission granted to کارشناس تایید محل role'
    END
END
GO

PRINT 'Migration completed successfully!'
GO
