/**
 * The site-settings item is a normal page permission.
 * Without a Pages row, the data-management menu never renders it.
 */
export async function ensureSiteSettingsPage(pool) {
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM Pages WHERE PageKey = N'admin_site_settings')
    BEGIN
      INSERT INTO Pages (PageKey, PagePath, PageTitle, Description, IsActive)
      VALUES (
        N'admin_site_settings',
        N'/admin/site-settings',
        N'تنظیمات سایت',
        N'مدیریت تنظیمات سایت و دستگاه پوز',
        1
      );
    END
    ELSE
    BEGIN
      UPDATE Pages
      SET IsActive = 1,
          PagePath = N'/admin/site-settings',
          PageTitle = N'تنظیمات سایت'
      WHERE PageKey = N'admin_site_settings';
    END

    DECLARE @PageId INT = (SELECT Id FROM Pages WHERE PageKey = N'admin_site_settings');

    IF @PageId IS NOT NULL
    BEGIN
      INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess)
      SELECT DISTINCT rpp.RoleId, @PageId, 1
      FROM RolePagePermissions rpp
      INNER JOIN Pages p ON p.Id = rpp.PageId
      WHERE p.PageKey = N'admin_lookups'
        AND rpp.CanAccess = 1
        AND NOT EXISTS (
          SELECT 1
          FROM RolePagePermissions existing
          WHERE existing.RoleId = rpp.RoleId AND existing.PageId = @PageId
        );
    END
  `);
}
