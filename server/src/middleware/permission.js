import { sql, getPool } from '../lib/db.js';

/**
 * Middleware to check if user has a specific permission
 * @param {string} permissionKey - The permission key to check (e.g., 'view_person_info', 'edit_payments')
 * @param {string} action - The action type: 'view' or 'edit' (default: 'view')
 * @returns {Function} Express middleware function
 */
export function requirePermission(permissionKey, action = 'view') {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'کاربر احراز هویت نشده است' });
      }

      const pool = await getPool();

      // Get user's primary role
      const userResult = await pool.request()
        .input('userId', sql.Int, userId)
        .query('SELECT Role FROM Users WHERE Id = @userId');

      if (userResult.recordset.length === 0) {
        return res.status(404).json({ message: 'کاربر یافت نشد' });
      }

      const userRole = userResult.recordset[0].Role;

      // Check if user has the required permission
      const permissionResult = await pool.request()
        .input('roleName', sql.NVarChar, userRole)
        .input('permissionKey', sql.NVarChar, permissionKey)
        .query(`
          SELECT CanView, CanEdit
          FROM RolePermissions
          WHERE RoleName = @roleName
            AND PermissionKey = @permissionKey
        `);

      if (permissionResult.recordset.length === 0) {
        return res.status(403).json({ 
          message: 'دسترسی به این عملیات ندارید',
          required: permissionKey,
          action: action
        });
      }

      const permission = permissionResult.recordset[0];

      // Check if user has the required action permission
      if (action === 'view' && !permission.CanView) {
        return res.status(403).json({ 
          message: 'دسترسی مشاهده ندارید',
          required: permissionKey
        });
      }

      if (action === 'edit' && !permission.CanEdit) {
        return res.status(403).json({ 
          message: 'دسترسی ویرایش ندارید',
          required: permissionKey
        });
      }

      // Permission granted
      next();
    } catch (err) {
      console.error('Error checking permission:', err);
      return res.status(500).json({ message: 'خطا در بررسی دسترسی' });
    }
  };
}

/**
 * Middleware to check if user has any of the specified permissions
 * @param {Array<{key: string, action: string}>} permissions - Array of permission objects
 * @returns {Function} Express middleware function
 */
export function requireAnyPermission(permissions) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'کاربر احراز هویت نشده است' });
      }

      const pool = await getPool();

      // Get user's primary role
      const userResult = await pool.request()
        .input('userId', sql.Int, userId)
        .query('SELECT Role FROM Users WHERE Id = @userId');

      if (userResult.recordset.length === 0) {
        return res.status(404).json({ message: 'کاربر یافت نشد' });
      }

      const userRole = userResult.recordset[0].Role;

      // Check each permission
      for (const perm of permissions) {
        const permissionResult = await pool.request()
          .input('roleName', sql.NVarChar, userRole)
          .input('permissionKey', sql.NVarChar, perm.key)
          .query(`
            SELECT CanView, CanEdit
            FROM RolePermissions
            WHERE RoleName = @roleName
              AND PermissionKey = @permissionKey
          `);

        if (permissionResult.recordset.length > 0) {
          const permission = permissionResult.recordset[0];
          const action = perm.action || 'view';

          if ((action === 'view' && permission.CanView) || 
              (action === 'edit' && permission.CanEdit)) {
            // User has at least one of the required permissions
            return next();
          }
        }
      }

      // No matching permissions found
      return res.status(403).json({ 
        message: 'دسترسی به این عملیات ندارید',
        required: permissions.map(p => p.key).join(' یا ')
      });
    } catch (err) {
      console.error('Error checking permissions:', err);
      return res.status(500).json({ message: 'خطا در بررسی دسترسی' });
    }
  };
}

/**
 * Middleware to attach user permissions to request object
 * This allows checking permissions in the controller
 */
export async function attachUserPermissions(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      req.permissions = {};
      return next();
    }

    const pool = await getPool();

    // Get user's primary role
    const userResult = await pool.request()
      .input('userId', sql.Int, userId)
      .query('SELECT Role FROM Users WHERE Id = @userId');

    if (userResult.recordset.length === 0) {
      req.permissions = {};
      return next();
    }

    const userRole = userResult.recordset[0].Role;

    // Get all permissions for user's role
    const permissionsResult = await pool.request()
      .input('roleName', sql.NVarChar, userRole)
      .query(`
        SELECT PermissionKey, CanView, CanEdit
        FROM RolePermissions
        WHERE RoleName = @roleName
      `);

    // Build permissions object
    const permissions = {};
    permissionsResult.recordset.forEach(perm => {
      permissions[perm.PermissionKey] = {
        canView: perm.CanView,
        canEdit: perm.CanEdit
      };
    });

    req.permissions = permissions;
    next();
  } catch (err) {
    console.error('Error attaching permissions:', err);
    req.permissions = {};
    next();
  }
}
