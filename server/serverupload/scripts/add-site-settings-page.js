/**
 * Script to register admin_site_settings page in the Pages table
 * and grant Admin role access to it.
 * 
 * Run with: node server/scripts/add-site-settings-page.js
 */

import { getPool, sql } from '../src/lib/db.js';

async function run() {
  try {
    const pool = await getPool();
    console.log('✅ Connected to database');

    // 1. Insert page if not exists
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM Pages WHERE PageKey = 'admin_site_settings')
      BEGIN
        INSERT INTO Pages (PageKey, PagePath, PageTitle, Description, IsActive)
        VALUES (
          'admin_site_settings',
          '/admin/site-settings',
          N'تنظیمات سایت',
          N'مدیریت تنظیمات سایت از جمله پیام پاپ‌آپ',
          1
        );
        PRINT 'Page admin_site_settings inserted.';
      END
      ELSE
      BEGIN
        PRINT 'Page admin_site_settings already exists.';
      END
    `);
    console.log('✅ Page registered');

    // 2. Get page ID
    const pageResult = await pool.request().query(
      `SELECT Id FROM Pages WHERE PageKey = 'admin_site_settings'`
    );
    const pageId = pageResult.recordset[0]?.Id;
    if (!pageId) throw new Error('Page not found after insert');
    console.log(`📄 Page ID: ${pageId}`);

    // 3. Get Admin role ID
    const roleResult = await pool.request().query(
      `SELECT Id FROM Roles WHERE Name = 'Admin'`
    );
    const adminRoleId = roleResult.recordset[0]?.Id;
    if (!adminRoleId) throw new Error('Admin role not found');
    console.log(`👤 Admin Role ID: ${adminRoleId}`);

    // 4. Grant access
    await pool.request()
      .input('roleId', sql.Int, adminRoleId)
      .input('pageId', sql.Int, pageId)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM RolePagePermissions WHERE RoleId = @roleId AND PageId = @pageId)
        BEGIN
          INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess)
          VALUES (@roleId, @pageId, 1);
          PRINT 'Permission granted to Admin.';
        END
        ELSE
        BEGIN
          UPDATE RolePagePermissions SET CanAccess = 1
          WHERE RoleId = @roleId AND PageId = @pageId;
          PRINT 'Permission updated for Admin.';
        END
      `);
    console.log('✅ Admin role granted access to admin_site_settings');

    console.log('\n🎉 Done! The admin_site_settings page is now accessible to Admin users.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

run();
