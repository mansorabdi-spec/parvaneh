/**
 * Applicant roles open renew/change from the inbox.
 * Older scripts granted these pages to role names User / کاربر,
 * while registered applicants use نقش «کاربر مستقل».
 * Missing RolePagePermissions makes ProtectedRoute send them to home.
 */
export async function ensureApplicantLicensePages(pool) {
  await pool.request().query(`
    DECLARE @Pages TABLE (
      PageKey NVARCHAR(100),
      PagePath NVARCHAR(255),
      PageTitle NVARCHAR(150)
    );

    INSERT INTO @Pages (PageKey, PagePath, PageTitle) VALUES
      (N'renew_license', N'/licenses/activity/renew/:requestId', N'تمدید پروانه فعالیت'),
      (N'change_license', N'/licenses/activity/change/:requestId', N'تغییر پروانه فعالیت'),
      (N'employment_renew', N'/licenses/employment/renew/:requestId', N'تمدید پروانه اشتغال'),
      (N'employment_change', N'/licenses/employment/change/:requestId', N'تغییر پروانه اشتغال'),
      (N'exploitation_renew', N'/licenses/exploitation/renew/:requestId', N'تمدید پروانه بهره‌برداری'),
      (N'exploitation_change', N'/licenses/exploitation/change/:requestId', N'تغییر پروانه بهره‌برداری');

    INSERT INTO Pages (PageKey, PagePath, PageTitle, Description, IsActive)
    SELECT p.PageKey, p.PagePath, p.PageTitle, p.PageTitle, 1
    FROM @Pages p
    WHERE NOT EXISTS (
      SELECT 1 FROM Pages existing WHERE existing.PageKey = p.PageKey
    );

    INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess)
    SELECT DISTINCT inboxPerm.RoleId, pg.Id, 1
    FROM RolePagePermissions inboxPerm
    INNER JOIN Pages inboxPage ON inboxPage.Id = inboxPerm.PageId
    INNER JOIN Pages pg ON pg.IsActive = 1
    INNER JOIN @Pages wanted ON wanted.PageKey = pg.PageKey
    WHERE inboxPage.PageKey = N'workflow_inbox'
      AND inboxPerm.CanAccess = 1
      AND NOT EXISTS (
        SELECT 1 FROM RolePagePermissions existing
        WHERE existing.RoleId = inboxPerm.RoleId AND existing.PageId = pg.Id
      );
  `);
}
