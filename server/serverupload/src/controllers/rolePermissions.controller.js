import { sql, getPool } from '../lib/db.js';

/**
 * Get all role permissions (optionally filter by role name)
 */
export async function getAllRolePermissions(req, res) {
  try {
    // Get role from query parameter OR from JWT token (for /my-permissions endpoint)
    let { roleName } = req.query;
    
    // If no roleName in query, try to get it from authenticated user
    if (!roleName && req.user && req.user.role) {
      roleName = req.user.role;
      console.log('🔐 getAllRolePermissions using role from JWT token:', roleName);
    } else if (roleName) {
      console.log('🔐 getAllRolePermissions called with roleName from query:', roleName);
    }
    
    const pool = await getPool();
    
    let query = `
      SELECT 
        Id,
        RoleName,
        PermissionKey,
        CanView,
        CanEdit,
        CreatedAt
      FROM RolePermissions
    `;
    
    if (roleName) {
      query += ` WHERE RoleName = @roleName`;
    }
    
    query += ` ORDER BY RoleName, PermissionKey`;
    
    const request = pool.request();
    if (roleName) {
      request.input('roleName', sql.NVarChar(50), roleName);
    }
    
    const result = await request.query(query);
    
    console.log(`✅ Found ${result.recordset.length} permissions for role: ${roleName}`);
    
    res.json({ permissions: result.recordset });
  } catch (err) {
    console.error('Error fetching role permissions:', err);
    res.status(500).json({ message: 'خطا در دریافت دسترسی‌ها' });
  }
}

/**
 * Get permissions grouped by role
 */
export async function getPermissionsByRole(req, res) {
  try {
    const pool = await getPool();
    
    // Get all unique roles
    const rolesResult = await pool.request()
      .query('SELECT DISTINCT RoleName FROM RolePermissions ORDER BY RoleName');
    
    const roles = rolesResult.recordset.map(r => r.RoleName);
    
    // Get permissions for each role
    const rolePermissions = {};
    for (const roleName of roles) {
      const permResult = await pool.request()
        .input('roleName', sql.NVarChar(50), roleName)
        .query(`
          SELECT 
            Id,
            PermissionKey,
            CanView,
            CanEdit,
            CreatedAt
          FROM RolePermissions
          WHERE RoleName = @roleName
          ORDER BY PermissionKey
        `);
      
      rolePermissions[roleName] = permResult.recordset;
    }
    
    res.json({ roles, permissions: rolePermissions });
  } catch (err) {
    console.error('Error fetching permissions by role:', err);
    res.status(500).json({ message: 'خطا در دریافت دسترسی‌های نقش‌ها' });
  }
}

/**
 * Get all unique permission keys
 */
export async function getAllPermissionKeys(req, res) {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query('SELECT DISTINCT PermissionKey FROM RolePermissions ORDER BY PermissionKey');
    
    res.json({ permissionKeys: result.recordset.map(r => r.PermissionKey) });
  } catch (err) {
    console.error('Error fetching permission keys:', err);
    res.status(500).json({ message: 'خطا در دریافت کلیدهای دسترسی' });
  }
}

/**
 * Get all unique roles from Roles table
 */
export async function getAllRoles(req, res) {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query('SELECT Id, Name FROM Roles ORDER BY Name');
    
    res.json({ roles: result.recordset.map(r => r.Name) });
  } catch (err) {
    console.error('Error fetching roles:', err);
    res.status(500).json({ message: 'خطا در دریافت نقش‌ها' });
  }
}

/**
 * Create a new role permission
 */
export async function createRolePermission(req, res) {
  try {
    const { roleName, permissionKey, canView, canEdit } = req.body;
    
    if (!roleName || !permissionKey) {
      return res.status(400).json({ message: 'نام نقش و کلید دسترسی الزامی است' });
    }
    
    const pool = await getPool();
    
    // Check if permission already exists
    const existingResult = await pool.request()
      .input('roleName', sql.NVarChar(50), roleName)
      .input('permissionKey', sql.NVarChar(100), permissionKey)
      .query(`
        SELECT Id FROM RolePermissions 
        WHERE RoleName = @roleName AND PermissionKey = @permissionKey
      `);
    
    if (existingResult.recordset.length > 0) {
      return res.status(400).json({ message: 'این دسترسی قبلاً ثبت شده است' });
    }
    
    const result = await pool.request()
      .input('roleName', sql.NVarChar(50), roleName)
      .input('permissionKey', sql.NVarChar(100), permissionKey)
      .input('canView', sql.Bit, canView !== undefined ? (canView ? 1 : 0) : 1)
      .input('canEdit', sql.Bit, canEdit !== undefined ? (canEdit ? 1 : 0) : 0)
      .query(`
        INSERT INTO RolePermissions (RoleName, PermissionKey, CanView, CanEdit)
        VALUES (@roleName, @permissionKey, @canView, @canEdit);
        SELECT SCOPE_IDENTITY() as Id;
      `);
    
    res.json({ 
      message: 'دسترسی با موفقیت ایجاد شد',
      id: result.recordset[0].Id
    });
  } catch (err) {
    console.error('Error creating role permission:', err);
    if (err.number === 2627) { // Unique constraint violation
      res.status(400).json({ message: 'این دسترسی قبلاً ثبت شده است' });
    } else {
      res.status(500).json({ message: 'خطا در ایجاد دسترسی' });
    }
  }
}

/**
 * Update a role permission
 */
export async function updateRolePermission(req, res) {
  try {
    const { id } = req.params;
    const { canView, canEdit } = req.body;
    
    const pool = await getPool();
    
    await pool.request()
      .input('id', sql.Int, id)
      .input('canView', sql.Bit, canView ? 1 : 0)
      .input('canEdit', sql.Bit, canEdit ? 1 : 0)
      .query(`
        UPDATE RolePermissions
        SET CanView = @canView,
            CanEdit = @canEdit
        WHERE Id = @id
      `);
    
    res.json({ message: 'دسترسی با موفقیت به‌روزرسانی شد' });
  } catch (err) {
    console.error('Error updating role permission:', err);
    res.status(500).json({ message: 'خطا در به‌روزرسانی دسترسی' });
  }
}

/**
 * Delete a role permission
 */
export async function deleteRolePermission(req, res) {
  try {
    const { id } = req.params;
    
    const pool = await getPool();
    
    await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM RolePermissions WHERE Id = @id');
    
    res.json({ message: 'دسترسی با موفقیت حذف شد' });
  } catch (err) {
    console.error('Error deleting role permission:', err);
    res.status(500).json({ message: 'خطا در حذف دسترسی' });
  }
}

/**
 * Bulk update permissions for a role
 */
export async function bulkUpdateRolePermissions(req, res) {
  try {
    const { roleName, permissions } = req.body;
    
    if (!roleName || !Array.isArray(permissions)) {
      return res.status(400).json({ message: 'اطلاعات نامعتبر است' });
    }
    
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    
    await transaction.begin();
    
    try {
      // Delete existing permissions for this role
      await transaction.request()
        .input('roleName', sql.NVarChar(50), roleName)
        .query('DELETE FROM RolePermissions WHERE RoleName = @roleName');
      
      // Insert new permissions
      for (const perm of permissions) {
        await transaction.request()
          .input('roleName', sql.NVarChar(50), roleName)
          .input('permissionKey', sql.NVarChar(100), perm.permissionKey)
          .input('canView', sql.Bit, perm.canView ? 1 : 0)
          .input('canEdit', sql.Bit, perm.canEdit ? 1 : 0)
          .query(`
            INSERT INTO RolePermissions (RoleName, PermissionKey, CanView, CanEdit)
            VALUES (@roleName, @permissionKey, @canView, @canEdit)
          `);
      }
      
      await transaction.commit();
      res.json({ message: 'دسترسی‌ها با موفقیت به‌روزرسانی شد' });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.error('Error bulk updating role permissions:', err);
    res.status(500).json({ message: 'خطا در به‌روزرسانی دسترسی‌ها' });
  }
}
