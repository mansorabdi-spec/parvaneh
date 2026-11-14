const sql = require('../server/node_modules/mssql');
const fs = require('fs');
const path = require('path');

// Manually load env vars from server/.env
const envContent = fs.readFileSync(path.join(__dirname, '../server/.env'), 'utf8');
envContent.split('\n').forEach(line => {
  line = line.trim();
  if (line && !line.startsWith('#')) {
    const eqIndex = line.indexOf('=');
    if (eqIndex > 0) {
      const key = line.substring(0, eqIndex).trim();
      let value = line.substring(eqIndex + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
});

async function addChangePagePermissions() {
  try {
    const { getConfig } = require('../server/src/lib/db.js');
    const config = getConfig();
    
    console.log('Connecting to database...');
    await sql.connect(config);
    console.log('Connected successfully!');
    
    const request = new sql.Request();
    
    // First, check what roles exist
    const rolesResult = await request.query(`SELECT Id, Name FROM Roles`);
    console.log('\n=== Existing Roles ===');
    rolesResult.recordset.forEach(r => console.log(`  ${r.Id}: ${r.Name}`));
    
    // Create roles that don't exist
    const requiredRoles = ['superadmin', 'کارگزار (بهره بردار)', 'کاربر'];
    for (const roleName of requiredRoles) {
      const exists = await request.query(`SELECT COUNT(*) as Count FROM Roles WHERE Name = '${roleName}'`);
      if (exists.recordset[0].Count === 0) {
        await request.query(`INSERT INTO Roles (Name) VALUES ('${roleName}')`);
        console.log(`  Created role: ${roleName}`);
      } else {
        console.log(`  Role already exists: ${roleName}`);
      }
    }
    
    // Get updated role IDs
    const adminRoleResult = await request.query(`SELECT Id FROM Roles WHERE Name = 'Admin'`);
    const deputyAdminRoleResult = await request.query(`SELECT Id FROM Roles WHERE Name = 'superadmin'`);
    const operatorRoleResult = await request.query(`SELECT Id FROM Roles WHERE Name = 'کارگزار (بهره بردار)'`);
    const userRoleResult = await request.query(`SELECT Id FROM Roles WHERE Name = 'کاربر'`);
    
    console.log('\n=== Role IDs ===');
    console.log('Admin:', adminRoleResult.recordset);
    console.log('superadmin:', deputyAdminRoleResult.recordset);
    console.log('کارگزار:', operatorRoleResult.recordset);
    console.log('کاربر:', userRoleResult.recordset);
    
    const adminRoleId = adminRoleResult.recordset[0]?.Id;
    const deputyAdminRoleId = deputyAdminRoleResult.recordset[0]?.Id;
    const operatorRoleId = operatorRoleResult.recordset[0]?.Id;
    const userRoleId = userRoleResult.recordset[0]?.Id;
    
    // Create pages that don't exist
    const requiredPages = [
      { pageKey: 'change_license', pagePath: '/licenses/activity/change/:requestId', pageTitle: 'تغییر پروانه فعالیت', description: 'صفحه تغییر پروانه فعالیت حقیقی' },
      { pageKey: 'employment_change', pagePath: '/licenses/employment/change/:requestId', pageTitle: 'تغییر پروانه اشتغال', description: 'صفحه تغییر پروانه اشتغال' },
      { pageKey: 'exploitation_change', pagePath: '/licenses/exploitation/change/:requestId', pageTitle: 'تغییر پروانه بهره‌برداری', description: 'صفحه تغییر پروانه بهره‌برداری' }
    ];
    
    console.log('\n=== Creating Pages ===');
    for (const page of requiredPages) {
      const exists = await request.query(`SELECT COUNT(*) as Count FROM Pages WHERE PageKey = '${page.pageKey}' AND PagePath = '${page.pagePath}'`);
      if (exists.recordset[0].Count === 0) {
        const result = await request.query(`
          INSERT INTO Pages (PageKey, PagePath, PageTitle, Description, IsActive) 
          VALUES ('${page.pageKey}', '${page.pagePath}', '${page.pageTitle}', '${page.description}', 1);
          SELECT SCOPE_IDENTITY() as Id;
        `);
        console.log(`  Created page: ${page.pageKey} with Id: ${result.recordset[0]?.Id}`);
      } else {
        console.log(`  Page already exists: ${page.pageKey}`);
      }
    }
    
    // Get updated page IDs
    const changeLicenseResult = await request.query(`SELECT Id FROM Pages WHERE PageKey = 'change_license' AND PagePath = '/licenses/activity/change/:requestId'`);
    const employmentChangeResult = await request.query(`SELECT Id FROM Pages WHERE PageKey = 'employment_change'`);
    const exploitationChangeResult = await request.query(`SELECT Id FROM Pages WHERE PageKey = 'exploitation_change'`);
    
    console.log('\n=== Page IDs ===');
    console.log('change_license:', changeLicenseResult.recordset);
    console.log('employment_change:', employmentChangeResult.recordset);
    console.log('exploitation_change:', exploitationChangeResult.recordset);
    
    const changeLicenseId = changeLicenseResult.recordset[0]?.Id;
    const employmentChangeId = employmentChangeResult.recordset[0]?.Id;
    const exploitationChangeId = exploitationChangeResult.recordset[0]?.Id;
    
    // Function to add permission
    async function addPermission(roleId, pageId, roleName, pageKey) {
      if (!roleId || !pageId) {
        console.log(`  Skipping: roleId=${roleId}, pageId=${pageId}, role=${roleName}, page=${pageKey}`);
        return;
      }
      
      const existsResult = await request.query(`SELECT COUNT(*) as Count FROM RolePagePermissions WHERE RoleId = ${roleId} AND PageId = ${pageId}`);
      
      if (existsResult.recordset[0].Count === 0) {
        await request.query(`INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess) VALUES (${roleId}, ${pageId}, 1)`);
        console.log(`  Added ${pageKey} permission for ${roleName}`);
      } else {
        console.log(`  Permission ${pageKey} already exists for ${roleName}`);
      }
    }
    
    console.log('\n=== Adding permissions for change_license ===');
    if (changeLicenseId) {
      await addPermission(adminRoleId, changeLicenseId, 'Admin', 'change_license');
      await addPermission(deputyAdminRoleId, changeLicenseId, 'superadmin', 'change_license');
      await addPermission(operatorRoleId, changeLicenseId, 'کارگزار', 'change_license');
      await addPermission(userRoleId, changeLicenseId, 'کاربر', 'change_license');
    }
    
    console.log('\n=== Adding permissions for employment_change ===');
    if (employmentChangeId) {
      await addPermission(adminRoleId, employmentChangeId, 'Admin', 'employment_change');
      await addPermission(deputyAdminRoleId, employmentChangeId, 'superadmin', 'employment_change');
      await addPermission(operatorRoleId, employmentChangeId, 'کارگزار', 'employment_change');
      await addPermission(userRoleId, employmentChangeId, 'کاربر', 'employment_change');
    }
    
    console.log('\n=== Adding permissions for exploitation_change ===');
    if (exploitationChangeId) {
      await addPermission(adminRoleId, exploitationChangeId, 'Admin', 'exploitation_change');
      await addPermission(deputyAdminRoleId, exploitationChangeId, 'superadmin', 'exploitation_change');
      await addPermission(operatorRoleId, exploitationChangeId, 'کارگزار', 'exploitation_change');
      await addPermission(userRoleId, exploitationChangeId, 'کاربر', 'exploitation_change');
    }
    
    // Verify final result
    const finalResult = await request.query(`
      SELECT 
        p.PageKey,
        p.PagePath,
        p.PageTitle,
        r.Name AS RoleName,
        rpp.CanAccess
      FROM Pages p
      INNER JOIN RolePagePermissions rpp ON p.Id = rpp.PageId
      INNER JOIN Roles r ON rpp.RoleId = r.Id
      WHERE p.PageKey IN ('change_license', 'employment_change', 'exploitation_change')
      ORDER BY r.Name, p.PageKey
    `);
    
    console.log('\n=== Final Permissions ===');
    finalResult.recordset.forEach(rp => {
      console.log(`  ${rp.RoleName} | ${rp.PageKey} | CanAccess: ${rp.CanAccess}`);
    });
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\n⚠️ Important: User needs to refresh the page (F5) to load the new permissions!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addChangePagePermissions();