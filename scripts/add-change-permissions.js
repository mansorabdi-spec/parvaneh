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

async function addChangePermissions() {
  try {
    const { getConfig } = require('../server/src/lib/db.js');
    const config = getConfig();
    
    console.log('Connecting to database...');
    await sql.connect(config);
    console.log('Connected successfully!');
    
    const request = new sql.Request();
    
    // The RolePermissions table uses RoleName and PermissionKey directly
    // Add permissions for change_license
    await request.query(`
      IF NOT EXISTS (SELECT 1 FROM RolePermissions WHERE PermissionKey = 'change_license')
      BEGIN
        INSERT INTO RolePermissions (RoleName, PermissionKey, CanView, CanEdit)
        VALUES 
          ('Admin', 'change_license', 1, 1),
          ('superadmin', 'change_license', 1, 1),
          ('کارگزار (بهره بردار)', 'change_license', 1, 0),
          ('کاربر', 'change_license', 1, 0)
        PRINT 'Added permission: change_license for all roles'
      END
      ELSE
      PRINT 'Permission already exists: change_license'
    `);
    
    // Add permissions for employment_change
    await request.query(`
      IF NOT EXISTS (SELECT 1 FROM RolePermissions WHERE PermissionKey = 'employment_change')
      BEGIN
        INSERT INTO RolePermissions (RoleName, PermissionKey, CanView, CanEdit)
        VALUES 
          ('Admin', 'employment_change', 1, 1),
          ('superadmin', 'employment_change', 1, 1),
          ('کارگزار (بهره بردار)', 'employment_change', 1, 0),
          ('کاربر', 'employment_change', 1, 0)
        PRINT 'Added permission: employment_change for all roles'
      END
      ELSE
      PRINT 'Permission already exists: employment_change'
    `);
    
    // Add permissions for exploitation_change
    await request.query(`
      IF NOT EXISTS (SELECT 1 FROM RolePermissions WHERE PermissionKey = 'exploitation_change')
      BEGIN
        INSERT INTO RolePermissions (RoleName, PermissionKey, CanView, CanEdit)
        VALUES 
          ('Admin', 'exploitation_change', 1, 1),
          ('superadmin', 'exploitation_change', 1, 1),
          ('کارگزار (بهره بردار)', 'exploitation_change', 1, 0),
          ('کاربر', 'exploitation_change', 1, 0)
        PRINT 'Added permission: exploitation_change for all roles'
      END
      ELSE
      PRINT 'Permission already exists: exploitation_change'
    `);
    
    // Verify final result
    const finalResult = await request.query(`
      SELECT 
        RoleName,
        PermissionKey,
        CanView,
        CanEdit
      FROM RolePermissions
      WHERE PermissionKey IN ('change_license', 'employment_change', 'exploitation_change')
      ORDER BY RoleName, PermissionKey
    `);
    
    console.log('\n=== Role Permissions for Change Pages ===');
    finalResult.recordset.forEach(rp => {
      console.log(`  ${rp.RoleName} | ${rp.PermissionKey} | View: ${rp.CanView} | Edit: ${rp.CanEdit}`);
    });
    
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addChangePermissions();