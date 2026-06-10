-- Verification script for Role-Based Page Access Control System
-- Run this script to verify that the permissions system is set up correctly

PRINT '========================================';
PRINT 'Role-Based Permissions System Verification';
PRINT '========================================';
PRINT '';

-- 1. Check if Pages table exists and has data
PRINT '1. Checking Pages table...';
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Pages')
BEGIN
    DECLARE @PageCount INT = (SELECT COUNT(*) FROM Pages);
    PRINT '   ✓ Pages table exists';
    PRINT '   ✓ Total pages: ' + CAST(@PageCount AS NVARCHAR(10));
    
    IF @PageCount > 0
    BEGIN
        PRINT '   Pages in system:';
        SELECT '     - ' + PageTitle + ' (' + PageKey + ')' AS PageInfo
        FROM Pages
        WHERE IsActive = 1
        ORDER BY PageTitle;
    END
    ELSE
    BEGIN
        PRINT '   ⚠ WARNING: No pages found in the system';
    END
END
ELSE
BEGIN
    PRINT '   ✗ ERROR: Pages table does not exist';
    PRINT '   Please run role_permissions.sql first';
END
PRINT '';

-- 2. Check if RolePagePermissions table exists
PRINT '2. Checking RolePagePermissions table...';
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'RolePagePermissions')
BEGIN
    DECLARE @PermCount INT = (SELECT COUNT(*) FROM RolePagePermissions);
    PRINT '   ✓ RolePagePermissions table exists';
    PRINT '   ✓ Total permissions: ' + CAST(@PermCount AS NVARCHAR(10));
    
    IF @PermCount = 0
    BEGIN
        PRINT '   ⚠ WARNING: No permissions configured';
    END
END
ELSE
BEGIN
    PRINT '   ✗ ERROR: RolePagePermissions table does not exist';
END
PRINT '';

-- 3. Check roles and their permissions
PRINT '3. Checking role permissions...';
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Roles')
BEGIN
    DECLARE @RoleName NVARCHAR(50);
    DECLARE @RoleId INT;
    DECLARE @RolePermCount INT;
    
    DECLARE role_cursor CURSOR FOR
    SELECT Id, Name FROM Roles ORDER BY Name;
    
    OPEN role_cursor;
    FETCH NEXT FROM role_cursor INTO @RoleId, @RoleName;
    
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @RolePermCount = (
            SELECT COUNT(*) 
            FROM RolePagePermissions 
            WHERE RoleId = @RoleId AND CanAccess = 1
        );
        
        PRINT '   Role: ' + @RoleName;
        PRINT '   - Accessible pages: ' + CAST(@RolePermCount AS NVARCHAR(10));
        
        IF @RolePermCount > 0
        BEGIN
            SELECT '     • ' + p.PageTitle + ' (' + p.PagePath + ')' AS AccessiblePages
            FROM RolePagePermissions rpp
            INNER JOIN Pages p ON rpp.PageId = p.Id
            WHERE rpp.RoleId = @RoleId AND rpp.CanAccess = 1
            ORDER BY p.PageTitle;
        END
        PRINT '';
        
        FETCH NEXT FROM role_cursor INTO @RoleId, @RoleName;
    END
    
    CLOSE role_cursor;
    DEALLOCATE role_cursor;
END
PRINT '';

-- 4. Check for users and their effective permissions
PRINT '4. Checking user permissions (sample)...';
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
BEGIN
    DECLARE @UserCount INT = (SELECT COUNT(*) FROM Users WHERE IsActive = 1);
    PRINT '   Total active users: ' + CAST(@UserCount AS NVARCHAR(10));
    
    IF @UserCount > 0
    BEGIN
        PRINT '   Sample user permissions:';
        PRINT '';
        
        -- Show permissions for first 3 users
        SELECT TOP 3
            u.NationalCode,
            u.FullName,
            u.Role as PrimaryRole,
            COUNT(DISTINCT rpp.PageId) as AccessiblePages
        FROM Users u
        LEFT JOIN Roles r ON r.Name = u.Role
        LEFT JOIN RolePagePermissions rpp ON rpp.RoleId = r.Id AND rpp.CanAccess = 1
        WHERE u.IsActive = 1
        GROUP BY u.NationalCode, u.FullName, u.Role
        ORDER BY u.NationalCode;
    END
END
PRINT '';

-- 5. Check for any orphaned permissions
PRINT '5. Checking data integrity...';
DECLARE @OrphanedPerms INT = (
    SELECT COUNT(*) 
    FROM RolePagePermissions rpp
    LEFT JOIN Roles r ON rpp.RoleId = r.Id
    LEFT JOIN Pages p ON rpp.PageId = p.Id
    WHERE r.Id IS NULL OR p.Id IS NULL
);

IF @OrphanedPerms = 0
BEGIN
    PRINT '   ✓ No orphaned permissions found';
END
ELSE
BEGIN
    PRINT '   ⚠ WARNING: ' + CAST(@OrphanedPerms AS NVARCHAR(10)) + ' orphaned permissions found';
    PRINT '   Run cleanup script to remove them';
END
PRINT '';

-- 6. Summary and recommendations
PRINT '========================================';
PRINT 'Summary and Recommendations';
PRINT '========================================';

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Pages') 
   AND EXISTS (SELECT * FROM sys.tables WHERE name = 'RolePagePermissions')
BEGIN
    DECLARE @TotalPages INT = (SELECT COUNT(*) FROM Pages WHERE IsActive = 1);
    DECLARE @TotalPerms INT = (SELECT COUNT(*) FROM RolePagePermissions WHERE CanAccess = 1);
    DECLARE @TotalRoles INT = (SELECT COUNT(*) FROM Roles);
    
    PRINT 'System Status: ✓ OPERATIONAL';
    PRINT '';
    PRINT 'Statistics:';
    PRINT '  - Active Pages: ' + CAST(@TotalPages AS NVARCHAR(10));
    PRINT '  - Total Roles: ' + CAST(@TotalRoles AS NVARCHAR(10));
    PRINT '  - Active Permissions: ' + CAST(@TotalPerms AS NVARCHAR(10));
    PRINT '';
    
    IF @TotalPages = 0
    BEGIN
        PRINT 'Recommendation: Add pages to the system using the admin interface';
        PRINT '  or by running the role_permissions.sql script';
    END
    
    IF @TotalPerms = 0
    BEGIN
        PRINT 'Recommendation: Configure permissions for each role';
        PRINT '  Navigate to: /admin/role-permissions';
    END
    
    -- Check if Admin has full access
    DECLARE @AdminRoleId INT = (SELECT Id FROM Roles WHERE Name = 'Admin');
    IF @AdminRoleId IS NOT NULL
    BEGIN
        DECLARE @AdminPerms INT = (
            SELECT COUNT(*) 
            FROM RolePagePermissions 
            WHERE RoleId = @AdminRoleId AND CanAccess = 1
        );
        
        IF @AdminPerms < @TotalPages
        BEGIN
            PRINT '';
            PRINT 'Recommendation: Admin role should have access to all pages';
            PRINT '  Current: ' + CAST(@AdminPerms AS NVARCHAR(10)) + ' / ' + CAST(@TotalPages AS NVARCHAR(10));
        END
    END
END
ELSE
BEGIN
    PRINT 'System Status: ✗ NOT CONFIGURED';
    PRINT '';
    PRINT 'Action Required:';
    PRINT '  1. Run server/database/role_permissions.sql';
    PRINT '  2. Restart the application server';
    PRINT '  3. Run this verification script again';
END

PRINT '';
PRINT '========================================';
PRINT 'Verification Complete';
PRINT '========================================';
