-- Register the comprehensive report builder page and grant it to roles
-- that already have access to activity-license reports, plus Admin.

IF NOT EXISTS (SELECT 1 FROM Pages WHERE PageKey = 'admin_reports_comprehensive')
BEGIN
    INSERT INTO Pages (PageKey, PagePath, PageTitle, Description, IsActive)
    VALUES (
        'admin_reports_comprehensive',
        '/admin/reports/comprehensive',
        N'گزارش جامع',
        N'گزارش‌ساز با انتخاب فیلد و خروجی اکسل',
        1
    );
END
GO

DECLARE @PageId INT = (SELECT Id FROM Pages WHERE PageKey = 'admin_reports_comprehensive');
DECLARE @SourcePageId INT = (SELECT Id FROM Pages WHERE PageKey = 'admin_reports_activity_licenses');

IF @PageId IS NOT NULL AND @SourcePageId IS NOT NULL
BEGIN
    INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess)
    SELECT rpp.RoleId, @PageId, 1
    FROM RolePagePermissions rpp
    WHERE rpp.PageId = @SourcePageId
      AND rpp.CanAccess = 1
      AND NOT EXISTS (
        SELECT 1 FROM RolePagePermissions existing
        WHERE existing.RoleId = rpp.RoleId AND existing.PageId = @PageId
      );
END

DECLARE @AdminRoleId INT = (SELECT Id FROM Roles WHERE Name = 'Admin');
IF @PageId IS NOT NULL AND @AdminRoleId IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM RolePagePermissions WHERE RoleId = @AdminRoleId AND PageId = @PageId)
BEGIN
    INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess)
    VALUES (@AdminRoleId, @PageId, 1);
END
GO
