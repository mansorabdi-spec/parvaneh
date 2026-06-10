-- Assign کارشناس تایید محل role to a user
-- This script helps you assign the new role to your user account

-- First, let's see all users and their current roles
PRINT '=== Current Users and Roles ===';
SELECT 
  u.Id,
  u.Username,
  u.NationalCode,
  u.FullName,
  u.Role AS PrimaryRole
FROM Users u
ORDER BY u.Id;

PRINT '';
PRINT '=== Users with Multiple Roles (UserRoles table) ===';
SELECT 
  u.Id AS UserId,
  u.Username,
  r.Name AS RoleName
FROM Users u
INNER JOIN UserRoles ur ON u.Id = ur.UserId
INNER JOIN Roles r ON ur.RoleId = r.Id
ORDER BY u.Id, r.Name;

PRINT '';
PRINT '=== Available Roles ===';
SELECT Id, Name FROM Roles ORDER BY Name;

PRINT '';
PRINT '--- Instructions ---';
PRINT 'To assign the role to a user, uncomment and modify ONE of the following options:';
PRINT '';
PRINT 'OPTION 1: Set as primary role (single role user)';
PRINT '  UPDATE Users SET Role = N''کارشناس تایید محل'' WHERE Username = ''your_username'';';
PRINT '';
PRINT 'OPTION 2: Add as additional role (multi-role user)';
PRINT '  DECLARE @UserId INT = (SELECT Id FROM Users WHERE Username = ''your_username'');';
PRINT '  DECLARE @RoleId INT = (SELECT Id FROM Roles WHERE Name = N''کارشناس تایید محل'');';
PRINT '  IF NOT EXISTS (SELECT 1 FROM UserRoles WHERE UserId = @UserId AND RoleId = @RoleId)';
PRINT '  BEGIN';
PRINT '    INSERT INTO UserRoles (UserId, RoleId) VALUES (@UserId, @RoleId);';
PRINT '    PRINT ''Role assigned successfully!'';';
PRINT '  END';
PRINT '';

-- Uncomment the section below and replace 'your_username' with your actual username

/*
-- OPTION 1: Set as primary role (uncomment if you want this to be the only role)
-- UPDATE Users 
-- SET Role = N'کارشناس تایید محل' 
-- WHERE Username = 'your_username';  -- Replace with your username

-- OPTION 2: Add as additional role (uncomment if you want multiple roles)
DECLARE @UserId INT = (SELECT Id FROM Users WHERE Username = 'your_username');  -- Replace with your username
DECLARE @RoleId INT = (SELECT Id FROM Roles WHERE Name = N'کارشناس تایید محل');

IF @UserId IS NULL
BEGIN
  PRINT 'ERROR: User not found. Please check the username.';
END
ELSE IF @RoleId IS NULL
BEGIN
  PRINT 'ERROR: Role not found. Please run the migration script first.';
END
ELSE
BEGIN
  IF NOT EXISTS (SELECT 1 FROM UserRoles WHERE UserId = @UserId AND RoleId = @RoleId)
  BEGIN
    INSERT INTO UserRoles (UserId, RoleId) VALUES (@UserId, @RoleId);
    PRINT 'Role کارشناس تایید محل assigned successfully to user!';
    
    -- Show updated roles for this user
    SELECT 
      u.Username,
      u.Role AS PrimaryRole,
      r.Name AS AdditionalRole
    FROM Users u
    LEFT JOIN UserRoles ur ON u.Id = ur.UserId
    LEFT JOIN Roles r ON ur.RoleId = r.Id
    WHERE u.Id = @UserId;
  END
  ELSE
  BEGIN
    PRINT 'User already has this role.';
  END
END
*/
