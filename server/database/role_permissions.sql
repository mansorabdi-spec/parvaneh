-- Role-based page access control system
-- This script creates tables to manage which roles can access which pages

-- Pages table: defines all available pages in the system
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Pages')
BEGIN
  CREATE TABLE Pages (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    PageKey NVARCHAR(100) NOT NULL UNIQUE, -- e.g., 'admin_users', 'issue_license'
    PagePath NVARCHAR(255) NOT NULL, -- e.g., '/admin/users'
    PageTitle NVARCHAR(150) NOT NULL, -- e.g., 'مدیریت کاربران'
    Description NVARCHAR(500) NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END;

-- RolePagePermissions table: maps roles to pages (many-to-many)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RolePagePermissions')
BEGIN
  CREATE TABLE RolePagePermissions (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    RoleId INT NOT NULL,
    PageId INT NOT NULL,
    CanAccess BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    FOREIGN KEY (RoleId) REFERENCES Roles(Id) ON DELETE CASCADE,
    FOREIGN KEY (PageId) REFERENCES Pages(Id) ON DELETE CASCADE,
    UNIQUE (RoleId, PageId)
  );
END;

-- Seed default pages
-- Admin pages
IF NOT EXISTS (SELECT 1 FROM Pages WHERE PageKey = 'admin_users')
  INSERT INTO Pages (PageKey, PagePath, PageTitle, Description) 
  VALUES ('admin_users', '/admin/users', N'مدیریت کاربران', N'مدیریت کاربران سیستم');

IF NOT EXISTS (SELECT 1 FROM Pages WHERE PageKey = 'admin_roles')
  INSERT INTO Pages (PageKey, PagePath, PageTitle, Description) 
  VALUES ('admin_roles', '/admin/roles', N'مدیریت نقش‌ها', N'مدیریت نقش‌های سیستم');

IF NOT EXISTS (SELECT 1 FROM Pages WHERE PageKey = 'admin_role_permissions')
  INSERT INTO Pages (PageKey, PagePath, PageTitle, Description) 
  VALUES ('admin_role_permissions', '/admin/role-permissions', N'دسترسی‌های نقش‌ها', N'مدیریت دسترسی‌های نقش‌ها به صفحات');

IF NOT EXISTS (SELECT 1 FROM Pages WHERE PageKey = 'admin_approvals_flow')
  INSERT INTO Pages (PageKey, PagePath, PageTitle, Description) 
  VALUES ('admin_approvals_flow', '/admin/approvals-flow', N'جریان تایید', N'مدیریت جریان تایید درخواست‌ها');

IF NOT EXISTS (SELECT 1 FROM Pages WHERE PageKey = 'admin_lookups')
  INSERT INTO Pages (PageKey, PagePath, PageTitle, Description) 
  VALUES ('admin_lookups', '/admin/lookups', N'مدیریت جداول پایه', N'مدیریت جداول پایه سیستم');

IF NOT EXISTS (SELECT 1 FROM Pages WHERE PageKey = 'admin_systemtypes')
  INSERT INTO Pages (PageKey, PagePath, PageTitle, Description) 
  VALUES ('admin_systemtypes', '/admin/systemtypes', N'انواع سیستم', N'مدیریت انواع سیستم');

IF NOT EXISTS (SELECT 1 FROM Pages WHERE PageKey = 'admin_provinces')
  INSERT INTO Pages (PageKey, PagePath, PageTitle, Description) 
  VALUES ('admin_provinces', '/admin/provinces', N'مدیریت استان‌ها', N'مدیریت استان‌ها و شهرها');

IF NOT EXISTS (SELECT 1 FROM Pages WHERE PageKey = 'admin_tariffs')
  INSERT INTO Pages (PageKey, PagePath, PageTitle, Description) 
  VALUES ('admin_tariffs', '/admin/tariffs', N'مدیریت تعرفه‌ها', N'مدیریت تعرفه‌های سیستم');

IF NOT EXISTS (SELECT 1 FROM Pages WHERE PageKey = 'admin_reports_activity_licenses')
  INSERT INTO Pages (PageKey, PagePath, PageTitle, Description) 
  VALUES ('admin_reports_activity_licenses', '/admin/reports/activity-licenses', N'گزارش پروانه‌های فعالیت', N'مشاهده گزارش پروانه‌های فعالیت');

IF NOT EXISTS (SELECT 1 FROM Pages WHERE PageKey = 'admin_workflow_requests')
  INSERT INTO Pages (PageKey, PagePath, PageTitle, Description) 
  VALUES ('admin_workflow_requests', '/admin/workflow/requests', N'همه درخواست‌ها', N'مشاهده همه درخواست‌های سیستم');

-- User pages
IF NOT EXISTS (SELECT 1 FROM Pages WHERE PageKey = 'issue_license')
  INSERT INTO Pages (PageKey, PagePath, PageTitle, Description) 
  VALUES ('issue_license', '/', N'صدور پروانه', N'صفحه صدور پروانه فعالیت');

IF NOT EXISTS (SELECT 1 FROM Pages WHERE PageKey = 'my_licenses')
  INSERT INTO Pages (PageKey, PagePath, PageTitle, Description) 
  VALUES ('my_licenses', '/licenses', N'پروانه‌های من', N'مشاهده پروانه‌های صادر شده');

IF NOT EXISTS (SELECT 1 FROM Pages WHERE PageKey = 'change_password')
  INSERT INTO Pages (PageKey, PagePath, PageTitle, Description) 
  VALUES ('change_password', '/change-password', N'تغییر رمز عبور', N'تغییر رمز عبور کاربری');

IF NOT EXISTS (SELECT 1 FROM Pages WHERE PageKey = 'payment')
  INSERT INTO Pages (PageKey, PagePath, PageTitle, Description) 
  VALUES ('payment', '/payment', N'پرداخت', N'پرداخت هزینه‌ها');

IF NOT EXISTS (SELECT 1 FROM Pages WHERE PageKey = 'workflow_inbox')
  INSERT INTO Pages (PageKey, PagePath, PageTitle, Description) 
  VALUES ('workflow_inbox', '/workflow/inbox', N'کارتابل من', N'مشاهده کارتابل و درخواست‌های من');

IF NOT EXISTS (SELECT 1 FROM Pages WHERE PageKey = 'print_license')
  INSERT INTO Pages (PageKey, PagePath, PageTitle, Description) 
  VALUES ('print_license', '/print-license', N'چاپ پروانه', N'چاپ پروانه فعالیت');

-- Officer pages
IF NOT EXISTS (SELECT 1 FROM Pages WHERE PageKey = 'approvals_tasks')
  INSERT INTO Pages (PageKey, PagePath, PageTitle, Description) 
  VALUES ('approvals_tasks', '/approvals/tasks', N'وظایف تایید', N'مشاهده و تایید درخواست‌ها');

-- Seed default permissions for Admin role (full access)
DECLARE @AdminRoleId INT = (SELECT Id FROM Roles WHERE Name = 'Admin');
IF @AdminRoleId IS NOT NULL
BEGIN
  INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess)
  SELECT @AdminRoleId, Id, 1
  FROM Pages
  WHERE NOT EXISTS (
    SELECT 1 FROM RolePagePermissions 
    WHERE RoleId = @AdminRoleId AND PageId = Pages.Id
  );
END;

-- Seed default permissions for Officer role
DECLARE @OfficerRoleId INT = (SELECT Id FROM Roles WHERE Name = 'Officer');
IF @OfficerRoleId IS NOT NULL
BEGIN
  INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess)
  SELECT @OfficerRoleId, Id, 1
  FROM Pages
  WHERE PageKey IN (
    'issue_license', 
    'my_licenses', 
    'change_password', 
    'payment', 
    'workflow_inbox', 
    'print_license',
    'approvals_tasks'
  )
  AND NOT EXISTS (
    SELECT 1 FROM RolePagePermissions 
    WHERE RoleId = @OfficerRoleId AND PageId = Pages.Id
  );
END;

-- Seed default permissions for User role
DECLARE @UserRoleId INT = (SELECT Id FROM Roles WHERE Name = 'User');
IF @UserRoleId IS NOT NULL
BEGIN
  INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess)
  SELECT @UserRoleId, Id, 1
  FROM Pages
  WHERE PageKey IN (
    'issue_license', 
    'my_licenses', 
    'change_password', 
    'payment', 
    'workflow_inbox', 
    'print_license'
  )
  AND NOT EXISTS (
    SELECT 1 FROM RolePagePermissions 
    WHERE RoleId = @UserRoleId AND PageId = Pages.Id
  );
END;

-- Create indexes for better performance
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_RolePagePermissions_RoleId')
  CREATE INDEX IX_RolePagePermissions_RoleId ON RolePagePermissions(RoleId);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_RolePagePermissions_PageId')
  CREATE INDEX IX_RolePagePermissions_PageId ON RolePagePermissions(PageId);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Pages_PageKey')
  CREATE INDEX IX_Pages_PageKey ON Pages(PageKey);
