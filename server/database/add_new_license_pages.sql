-- Add new license pages for the restructured menu
-- Run this script to add home page and new license type pages

-- Licenses Menu Group (virtual page for permission control)
IF NOT EXISTS (SELECT 1 FROM Pages WHERE PageKey = 'licenses_menu')
BEGIN
  INSERT INTO Pages (PageKey, PagePath, PageTitle, Description)
  VALUES ('licenses_menu', '/licenses', N'منوی پروانه‌ها', N'دسترسی به منوی پروانه‌ها و زیرمنوهای آن');
  PRINT 'Added licenses_menu page';
END

-- Home page
IF NOT EXISTS (SELECT 1 FROM Pages WHERE PageKey = 'home')
BEGIN
  INSERT INTO Pages (PageKey, PagePath, PageTitle, Description)
  VALUES ('home', '/', N'صفحه اصلی', N'صفحه اصلی سامانه');
  PRINT 'Added home page';
END

-- Renew license page
IF NOT EXISTS (SELECT 1 FROM Pages WHERE PageKey = 'renew_license')
BEGIN
  INSERT INTO Pages (PageKey, PagePath, PageTitle, Description)
  VALUES ('renew_license', '/licenses/activity/renew', N'تمدید پروانه فعالیت', N'تمدید پروانه فعالیت');
  PRINT 'Added renew_license page';
END

-- Cancel license page
IF NOT EXISTS (SELECT 1 FROM Pages WHERE PageKey = 'cancel_license')
BEGIN
  INSERT INTO Pages (PageKey, PagePath, PageTitle, Description)
  VALUES ('cancel_license', '/licenses/activity/cancel', N'ابطال پروانه فعالیت', N'ابطال پروانه فعالیت');
  PRINT 'Added cancel_license page';
END

-- Employment license page
IF NOT EXISTS (SELECT 1 FROM Pages WHERE PageKey = 'employment_license')
BEGIN
  INSERT INTO Pages (PageKey, PagePath, PageTitle, Description)
  VALUES ('employment_license', '/licenses/employment/issue', N'پروانه اشتغال', N'صدور پروانه اشتغال');
  PRINT 'Added employment_license page';
END

-- Exploitation license page
IF NOT EXISTS (SELECT 1 FROM Pages WHERE PageKey = 'exploitation_license')
BEGIN
  INSERT INTO Pages (PageKey, PagePath, PageTitle, Description)
  VALUES ('exploitation_license', '/licenses/exploitation/issue', N'پروانه بهره‌برداری', N'صدور پروانه بهره‌برداری');
  PRINT 'Added exploitation_license page';
END

-- Grant permissions to all roles for the new pages
DECLARE @AdminRoleId INT = (SELECT Id FROM Roles WHERE Name = 'Admin');
DECLARE @OfficerRoleId INT = (SELECT Id FROM Roles WHERE Name = 'Officer');
DECLARE @UserRoleId INT = (SELECT Id FROM Roles WHERE Name = 'User');

-- Grant to Admin role
IF @AdminRoleId IS NOT NULL
BEGIN
  INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess)
  SELECT @AdminRoleId, Id, 1
  FROM Pages
  WHERE PageKey IN ('licenses_menu', 'home', 'renew_license', 'cancel_license', 'employment_license', 'exploitation_license')
    AND NOT EXISTS (
      SELECT 1 FROM RolePagePermissions 
      WHERE RoleId = @AdminRoleId AND PageId = Pages.Id
    );
  PRINT 'Granted permissions to Admin role';
END

-- Grant to Officer role
IF @OfficerRoleId IS NOT NULL
BEGIN
  INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess)
  SELECT @OfficerRoleId, Id, 1
  FROM Pages
  WHERE PageKey IN ('licenses_menu', 'home', 'renew_license', 'cancel_license', 'employment_license', 'exploitation_license')
    AND NOT EXISTS (
      SELECT 1 FROM RolePagePermissions 
      WHERE RoleId = @OfficerRoleId AND PageId = Pages.Id
    );
  PRINT 'Granted permissions to Officer role';
END

-- Grant to User role
IF @UserRoleId IS NOT NULL
BEGIN
  INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess)
  SELECT @UserRoleId, Id, 1
  FROM Pages
  WHERE PageKey IN ('licenses_menu', 'home', 'renew_license', 'cancel_license', 'employment_license', 'exploitation_license')
    AND NOT EXISTS (
      SELECT 1 FROM RolePagePermissions 
      WHERE RoleId = @UserRoleId AND PageId = Pages.Id
    );
  PRINT 'Granted permissions to User role';
END

PRINT '';
PRINT 'New license pages added successfully!';
PRINT 'Total new pages: 6 (licenses_menu, home, renew_license, cancel_license, employment_license, exploitation_license)';
