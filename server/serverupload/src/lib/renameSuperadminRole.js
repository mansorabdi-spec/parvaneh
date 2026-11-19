import { sql } from './db.js';

const OLD_ROLE = 'نایب ادمین';
const NEW_ROLE = 'superadmin';

const ROLE_COLUMNS = [
  ['Users', 'Role'],
  ['RolePermissions', 'RoleName'],
  ['GlobalApprovalFlowSteps', 'RoleName'],
  ['RequestWorkflowSteps', 'RoleName'],
  ['RequestProcessHistory', 'ActionByRole'],
  ['LicenseApprovals', 'ApproverRole'],
  ['LicenseHistory', 'IssuedByRole'],
  ['LicenseRenewalHistory', 'RenewedByRole'],
  ['EmploymentRequestWorkflowSteps', 'RoleName']
];

async function columnExists(pool, table, column) {
  const result = await pool.request().query(`
    SELECT CASE
      WHEN OBJECT_ID(N'dbo.${table}', N'U') IS NOT NULL
       AND COL_LENGTH(N'dbo.${table}', N'${column}') IS NOT NULL
      THEN 1 ELSE 0 END AS Ok
  `);
  return result.recordset[0].Ok === 1;
}

async function renameColumn(pool, table, column) {
  if (!(await columnExists(pool, table, column))) return 0;
  const result = await pool.request()
    .input('OldRole', sql.NVarChar(50), OLD_ROLE)
    .input('NewRole', sql.NVarChar(50), NEW_ROLE)
    .query(`UPDATE dbo.${table} SET ${column} = @NewRole WHERE ${column} = @OldRole`);
  return result.rowsAffected?.[0] || 0;
}

/**
 * Rename the deputy-admin role to superadmin in every table that stores the role name.
 */
export async function renameDeputyAdminRole(pool) {
  const roles = await pool.request()
    .input('OldRole', sql.NVarChar(50), OLD_ROLE)
    .input('NewRole', sql.NVarChar(50), NEW_ROLE)
    .query(`SELECT Id, Name FROM dbo.Roles WHERE Name IN (@OldRole, @NewRole)`);

  const oldRole = roles.recordset.find((row) => row.Name === OLD_ROLE);
  const newRole = roles.recordset.find((row) => row.Name === NEW_ROLE);

  if (oldRole && !newRole) {
    await pool.request()
      .input('Id', sql.Int, oldRole.Id)
      .input('Name', sql.NVarChar(50), NEW_ROLE)
      .query(`UPDATE dbo.Roles SET Name = @Name WHERE Id = @Id`);
  } else if (oldRole && newRole) {
    if (await columnExists(pool, 'UserRoles', 'RoleId')) {
      await pool.request()
        .input('OldId', sql.Int, oldRole.Id)
        .input('NewId', sql.Int, newRole.Id)
        .query(`
          UPDATE ur SET RoleId = @NewId
          FROM dbo.UserRoles ur
          WHERE ur.RoleId = @OldId
            AND NOT EXISTS (
              SELECT 1 FROM dbo.UserRoles x WHERE x.UserId = ur.UserId AND x.RoleId = @NewId
            );
          DELETE FROM dbo.UserRoles WHERE RoleId = @OldId;
        `);
    }
    if (await columnExists(pool, 'RolePagePermissions', 'RoleId')) {
      await pool.request()
        .input('OldId', sql.Int, oldRole.Id)
        .input('NewId', sql.Int, newRole.Id)
        .query(`
          UPDATE rpp SET RoleId = @NewId
          FROM dbo.RolePagePermissions rpp
          WHERE rpp.RoleId = @OldId
            AND NOT EXISTS (
              SELECT 1 FROM dbo.RolePagePermissions x
              WHERE x.RoleId = @NewId AND x.PageId = rpp.PageId
            );
          DELETE FROM dbo.RolePagePermissions WHERE RoleId = @OldId;
        `);
    }
    await pool.request()
      .input('Id', sql.Int, oldRole.Id)
      .query(`DELETE FROM dbo.Roles WHERE Id = @Id`);
  }

  if (await columnExists(pool, 'RolePermissions', 'RoleName')) {
    await pool.request()
      .input('OldRole', sql.NVarChar(50), OLD_ROLE)
      .input('NewRole', sql.NVarChar(50), NEW_ROLE)
      .query(`
        DELETE rp
        FROM dbo.RolePermissions rp
        WHERE rp.RoleName = @OldRole
          AND EXISTS (
            SELECT 1 FROM dbo.RolePermissions x
            WHERE x.RoleName = @NewRole AND x.PermissionKey = rp.PermissionKey
          );
      `);
  }

  let changed = 0;
  for (const [table, column] of ROLE_COLUMNS) {
    changed += await renameColumn(pool, table, column);
  }

  const left = await pool.request()
    .input('OldRole', sql.NVarChar(50), OLD_ROLE)
    .query(`
      SELECT
        CASE WHEN EXISTS (SELECT 1 FROM dbo.Roles WHERE Name = @OldRole) THEN 1 ELSE 0 END AS RolesLeft,
        CASE WHEN COL_LENGTH(N'dbo.Users', N'Role') IS NOT NULL
              AND EXISTS (SELECT 1 FROM dbo.Users WHERE Role = @OldRole)
             THEN 1 ELSE 0 END AS UsersLeft
    `);
  const remaining = left.recordset[0];
  if (remaining?.RolesLeft || remaining?.UsersLeft) {
    console.error(`✗ Role rename did not finish; some "${OLD_ROLE}" rows remain`);
  } else {
    console.log(`✓ Role "${OLD_ROLE}" is stored as "${NEW_ROLE}"${changed ? ` (${changed} updated)` : ''}`);
  }
}
