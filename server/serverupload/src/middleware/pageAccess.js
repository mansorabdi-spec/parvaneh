import { sql, getPool } from '../lib/db.js';

/**
 * Middleware to check if user has access to a specific page
 * @param {string} pageKey - The page key to check access for
 * @returns {Function} Express middleware function
 */
export function requirePageAccess(pageKey) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'کاربر احراز هویت نشده است' });
      }

      const pool = await getPool();

      // Get user's role and additional roles
      const userResult = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
          SELECT u.Role, r.Id as RoleId
          FROM Users u
          LEFT JOIN UserRoles ur ON u.Id = ur.UserId
          LEFT JOIN Roles r ON ur.RoleId = r.Id
          WHERE u.Id = @userId
        `);

      if (userResult.recordset.length === 0) {
        return res.status(404).json({ message: 'کاربر یافت نشد' });
      }

      // Collect all role IDs
      const primaryRole = userResult.recordset[0].Role;
      const roleIds = [];

      // Get primary role ID
      const primaryRoleResult = await pool.request()
        .input('roleName', sql.NVarChar, primaryRole)
        .query('SELECT Id FROM Roles WHERE Name = @roleName');

      if (primaryRoleResult.recordset.length > 0) {
        roleIds.push(primaryRoleResult.recordset[0].Id);
      }

      // Add additional role IDs
      userResult.recordset.forEach(row => {
        if (row.RoleId && !roleIds.includes(row.RoleId)) {
          roleIds.push(row.RoleId);
        }
      });

      if (roleIds.length === 0) {
        return res.status(403).json({ message: 'دسترسی به این صفحه ندارید' });
      }

      // Check if user has access to the page
      const placeholders = roleIds.map((_, i) => `@roleId${i}`).join(',');
      const request = pool.request();
      request.input('pageKey', sql.NVarChar, pageKey);
      roleIds.forEach((id, i) => {
        request.input(`roleId${i}`, sql.Int, id);
      });

      const accessResult = await request.query(`
        SELECT COUNT(*) as HasAccess
        FROM Pages p
        INNER JOIN RolePagePermissions rpp ON p.Id = rpp.PageId
        WHERE p.PageKey = @pageKey
          AND rpp.RoleId IN (${placeholders})
          AND rpp.CanAccess = 1
          AND p.IsActive = 1
      `);

      if (accessResult.recordset[0].HasAccess > 0) {
        return next();
      }

      return res.status(403).json({ message: 'دسترسی به این صفحه ندارید' });
    } catch (err) {
      console.error('Error checking page access:', err);
      return res.status(500).json({ message: 'خطا در بررسی دسترسی' });
    }
  };
}

/**
 * Check if user has access to any of the specified pages
 * @param {string[]} pageKeys - Array of page keys
 * @returns {Function} Express middleware function
 */
export function requireAnyPageAccess(pageKeys) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'کاربر احراز هویت نشده است' });
      }

      const pool = await getPool();

      // Get user's role and additional roles
      const userResult = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
          SELECT u.Role, r.Id as RoleId
          FROM Users u
          LEFT JOIN UserRoles ur ON u.Id = ur.UserId
          LEFT JOIN Roles r ON ur.RoleId = r.Id
          WHERE u.Id = @userId
        `);

      if (userResult.recordset.length === 0) {
        return res.status(404).json({ message: 'کاربر یافت نشد' });
      }

      // Collect all role IDs
      const primaryRole = userResult.recordset[0].Role;
      const roleIds = [];

      // Get primary role ID
      const primaryRoleResult = await pool.request()
        .input('roleName', sql.NVarChar, primaryRole)
        .query('SELECT Id FROM Roles WHERE Name = @roleName');

      if (primaryRoleResult.recordset.length > 0) {
        roleIds.push(primaryRoleResult.recordset[0].Id);
      }

      // Add additional role IDs
      userResult.recordset.forEach(row => {
        if (row.RoleId && !roleIds.includes(row.RoleId)) {
          roleIds.push(row.RoleId);
        }
      });

      if (roleIds.length === 0) {
        return res.status(403).json({ message: 'دسترسی به این صفحه ندارید' });
      }

      // Check if user has access to any of the pages
      const rolePlaceholders = roleIds.map((_, i) => `@roleId${i}`).join(',');
      const pagePlaceholders = pageKeys.map((_, i) => `@pageKey${i}`).join(',');
      
      const request = pool.request();
      roleIds.forEach((id, i) => {
        request.input(`roleId${i}`, sql.Int, id);
      });
      pageKeys.forEach((key, i) => {
        request.input(`pageKey${i}`, sql.NVarChar, key);
      });

      const accessResult = await request.query(`
        SELECT COUNT(*) as HasAccess
        FROM Pages p
        INNER JOIN RolePagePermissions rpp ON p.Id = rpp.PageId
        WHERE p.PageKey IN (${pagePlaceholders})
          AND rpp.RoleId IN (${rolePlaceholders})
          AND rpp.CanAccess = 1
          AND p.IsActive = 1
      `);

      if (accessResult.recordset[0].HasAccess > 0) {
        return next();
      }

      return res.status(403).json({ message: 'دسترسی به این صفحه ندارید' });
    } catch (err) {
      console.error('Error checking page access:', err);
      return res.status(500).json({ message: 'خطا در بررسی دسترسی' });
    }
  };
}
