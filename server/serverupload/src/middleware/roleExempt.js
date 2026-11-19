import { sql, getPool } from '../lib/db.js';

/**
 * Middleware to check if user has a specific role OR any of the allowed roles
 * EXCEPT if the user has an exempt role for the current action
 * @param {string|string[]} allowedRoles - Role(s) that are allowed
 * @param {Object} options - Optional configuration
 * @param {string} options.action - Action type for logging ('view', 'edit', 'delete')
 * @returns {Function} Express middleware function
 */
export function requireRoleExempt(allowedRoles, options = {}) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'کاربر احراز هویت نشده است' });
      }

      const pool = await getPool();

      // Get user's roles (primary and from UserRoles)
      const userResult = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
          SELECT u.Role AS PrimaryRole
          FROM Users u
          WHERE u.Id = @userId
        `);

      if (userResult.recordset.length === 0) {
        return res.status(404).json({ message: 'کاربر یافت نشد' });
      }

      const primaryRole = userResult.recordset[0].PrimaryKey;
      
      // Get all roles for this user
      const rolesResult = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
          SELECT r.Name AS RoleName
          FROM UserRoles ur
          JOIN Roles r ON r.Id = ur.RoleId
          WHERE ur.UserId = @userId
          UNION
          SELECT u.Role AS RoleName
          FROM Users u
          WHERE u.Id = @userId
        `);

      const userRoles = rolesResult.recordset.map(r => r.RoleName);
      
      // Check if user has any of the allowed roles
      const hasAllowedRole = userRoles.some(r => roles.includes(r));
      
      if (!hasAllowedRole) {
        return res.status(403).json({ 
          message: 'دسترسی برای این عملیات ندارید',
          requiredRoles: roles
        });
      }

      // Attach user roles to request for further checks
      req.userRoles = userRoles;
      next();
    } catch (err) {
      console.error('Error checking role exemption:', err);
      return res.status(500).json({ message: 'خطا در بررسی نقش' });
    }
  };
}

/**
 * Middleware to check if user is Admin OR has the exempt role
 * Used to allow both Admin and SuperAdmin users to access
 * @param {string} exemptRole - The role that should be allowed (e.g., 'superadmin')
 * @returns {Function} Express middleware function
 */
export function excludeRole(exemptRole = 'superadmin') {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'کاربر احراز هویت نشده است' });
      }

      const pool = await getPool();

      // Get all roles for this user
      const rolesResult = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
          SELECT DISTINCT r.Name AS RoleName
          FROM (
            SELECT @userId AS UserId, (SELECT Role FROM Users WHERE Id=@userId) AS RoleName
            UNION ALL
            SELECT ur.UserId, r.Name FROM UserRoles ur JOIN Roles r ON r.Id = ur.RoleId WHERE ur.UserId = @userId
          ) x
          JOIN Roles r ON r.Name = x.RoleName
        `);

      const userRoles = rolesResult.recordset.map(r => r.RoleName);

      // Check if user has Admin role
      const hasAdmin = userRoles.includes('Admin');
      
      // Check if user has exempt role
      const hasExemptRole = userRoles.includes(exemptRole);

      // If user has the exempt role (superadmin) but NOT Admin role, deny access
      // If user has Admin role (with or without exempt role), allow access
      if (hasExemptRole && !hasAdmin) {
        return res.status(403).json({ 
          message: 'شما دسترسی به این بخش را ندارید',
          reason: 'این بخش فقط برای ادمین قابل دسترسی است'
        });
      }

      next();
    } catch (err) {
      console.error('Error checking role exclusion:', err);
      return res.status(500).json({ message: 'خطا در بررسی نقش' });
    }
  };
}

/**
 * Middleware to check if user has Admin role OR the exempt role
 * This is for endpoints that should be accessible by both Admin and exempt role
 * @param {string} exemptRole - The role that should also be allowed (e.g., 'superadmin')
 * @returns {Function} Express middleware function
 */
export function requireRoleOrExempt(adminRole = 'Admin', exemptRole = 'superadmin') {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'کاربر احراز هویت نشده است' });
      }

      const pool = await getPool();

      // Get all roles for this user
      const rolesResult = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
          SELECT DISTINCT r.Name AS RoleName
          FROM (
            SELECT @userId AS UserId, (SELECT Role FROM Users WHERE Id=@userId) AS RoleName
            UNION ALL
            SELECT ur.UserId, r.Name FROM UserRoles ur JOIN Roles r ON r.Id = ur.RoleId WHERE ur.UserId = @userId
          ) x
          JOIN Roles r ON r.Name = x.RoleName
        `);

      const userRoles = rolesResult.recordset.map(r => r.RoleName);

      // Check if user has Admin role OR exempt role
      const hasAdmin = userRoles.includes(adminRole);
      const hasExemptRole = userRoles.includes(exemptRole);

      // Allow access if user has either Admin role OR exempt role
      if (!hasAdmin && !hasExemptRole) {
        return res.status(403).json({ 
          message: 'شما دسترسی به این بخش را ندارید',
          requiredRoles: [adminRole, exemptRole]
        });
      }

      next();
    } catch (err) {
      console.error('Error checking role exemption:', err);
      return res.status(500).json({ message: 'خطا در بررسی نقش' });
    }
  };
}

/**
 * Middleware to filter out users with specific roles from list results
 * @param {string|string[]} excludedRoles - Role(s) to exclude from results
 * @param {string} roleField - The field name in the result (default: 'PrimaryRole')
 * @returns {Function} Express middleware function (should be used after the controller)
 */
export function filterExcludedRoles(excludedRoles = ['Admin'], roleField = 'PrimaryRole') {
  const excluded = Array.isArray(excludedRoles) ? excludedRoles : [excludedRoles];
  
  return (req, res, next) => {
    try {
      const originalBody = res.locals.data || res.json;
      
      // Wrap res.json to filter the response
      const originalJson = res.json.bind(res);
      res.json = function(data) {
        if (Array.isArray(data)) {
          const filtered = data.filter(item => !excluded.includes(item[roleField]));
          return originalJson(filtered);
        }
        return originalJson(data);
      };
      
      next();
    } catch (err) {
      return next(err);
    }
  };
}