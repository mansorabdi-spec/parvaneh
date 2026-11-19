import Joi from 'joi';
import { getPool, sql } from '../lib/db.js';
import bcrypt from 'bcryptjs';

function isAdminRoleName(name) {
  return String(name || '').trim().toLowerCase() === 'admin';
}

async function loadRoleNames(pool, userId) {
  const userRolesResult = await pool.request()
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
  return userRolesResult.recordset.map((row) => row.RoleName);
}

async function requesterIsSuperAdminOnly(pool, userId) {
  if (!userId) return false;
  const userRoles = await loadRoleNames(pool, userId);
  return userRoles.includes('superadmin') && !userRoles.some(isAdminRoleName);
}

export async function listUsers(req, res, next) {
  try {
    const pool = await getPool();
    const isSuperAdminOnly = await requesterIsSuperAdminOnly(pool, req.user?.id);
    
    const result = await pool.request().query(`
      SELECT u.Id, u.NationalCode, u.FullName, u.Email, u.Role AS PrimaryRole, u.IsActive, u.CreatedAt
      FROM Users u
      ORDER BY u.Id DESC
    `);

    // Fetch roles per user
    const users = result.recordset;
    const rolesRes = await pool.request().query(`
      SELECT ur.UserId, r.Name AS RoleName FROM UserRoles ur JOIN Roles r ON r.Id = ur.RoleId
    `);
    const rolesMap = rolesRes.recordset.reduce((acc, r) => {
      acc[r.UserId] = acc[r.UserId] || [];
      acc[r.UserId].push(r.RoleName);
      return acc;
    }, {});

    const withRoles = users.map(u => ({
      ...u,
      Roles: Array.from(new Set([u.PrimaryRole, ...(rolesMap[u.Id] || [])])).filter(Boolean)
    }));

    // Superadmin must not see users who have the Admin role, even as an extra role
    const filteredUsers = isSuperAdminOnly
      ? withRoles.filter(u => !u.Roles.some(isAdminRoleName))
      : withRoles;

    res.json(filteredUsers);
  } catch (e) { next(e); }
}

export async function deleteUser(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (req.user?.id === id) return res.status(400).json({ message: 'نمی‌توانید حساب خود را حذف کنید' });
    const pool = await getPool();
    const r = await pool.request().input('Id', sql.Int, id).query('DELETE FROM Users WHERE Id=@Id');
    if ((r.rowsAffected?.[0] || 0) === 0) return res.status(404).json({ message: 'کاربر یافت نشد' });
    res.json({ success: true });
  } catch (e) { next(e); }
}

const activeSchema = Joi.object({ isActive: Joi.boolean().required() });
export async function setUserActive(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { error, value } = activeSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });
    if (req.user?.id === id) return res.status(400).json({ message: 'نمی‌توانید وضعیت حساب خود را تغییر دهید' });
    const pool = await getPool();
    if (await requesterIsSuperAdminOnly(pool, req.user?.id) && (await loadRoleNames(pool, id)).some(isAdminRoleName)) {
      return res.status(403).json({ message: 'اجازه این عملیات را ندارید' });
    }
    const r = await pool.request().input('Id', sql.Int, id).input('IsActive', sql.Bit, value.isActive ? 1 : 0)
      .query('UPDATE Users SET IsActive=@IsActive OUTPUT INSERTED.Id, INSERTED.IsActive WHERE Id=@Id');
    if (!r.recordset[0]) return res.status(404).json({ message: 'کاربر یافت نشد' });
    res.json(r.recordset[0]);
  } catch (e) { next(e); }
}

export async function resetUserPassword(req, res, next) {
  try {
    const id = Number(req.params.id);
    const pool = await getPool();
    if (await requesterIsSuperAdminOnly(pool, req.user?.id) && (await loadRoleNames(pool, id)).some(isAdminRoleName)) {
      return res.status(403).json({ message: 'اجازه این عملیات را ندارید' });
    }
    const userRes = await pool.request().input('Id', sql.Int, id).query('SELECT Id FROM Users WHERE Id=@Id');
    if (!userRes.recordset[0]) return res.status(404).json({ message: 'کاربر یافت نشد' });
    const hash = await bcrypt.hash('123456', 10);
    await pool.request().input('Id', sql.Int, id).input('PasswordHash', sql.NVarChar(255), hash)
      .query('UPDATE Users SET PasswordHash=@PasswordHash WHERE Id=@Id');
    res.json({ success: true });
  } catch (e) { next(e); }
}

const setRolesSchema = Joi.object({
  roles: Joi.array().items(Joi.string().min(2).max(50)).default([]),
  primaryRole: Joi.string().min(2).max(50).allow(null)
});

export async function setUserRoles(req, res, next) {
  const userId = Number(req.params.id);
  try {
    const { error, value } = setRolesSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    // Check if requester is SuperAdmin-only (can't change user roles)
    const requesterId = req.user?.id;
    if (requesterId) {
      const pool = await getPool();
      const userRoles = await loadRoleNames(pool, requesterId);
      const hasSuperAdmin = userRoles.includes('superadmin');
      const hasAdmin = userRoles.some(isAdminRoleName);
      
      // Superadmin cannot change roles, and cannot be told that an Admin role exists
      if (hasSuperAdmin && !hasAdmin) {
        return res.status(403).json({ message: 'شما اجازه تغییر نقش کاربران را ندارید' });
      }
    }

    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    
    try {
      const r = new sql.Request(tx);
      await r.input('UserId', sql.Int, userId).query('DELETE FROM UserRoles WHERE UserId=@UserId');

      // Validate roles exist in Roles table and insert
      for (const roleName of value.roles || []) {
        const roleRes = await new sql.Request(tx)
          .input('Name', sql.NVarChar(50), roleName)
          .query('SELECT Id FROM Roles WHERE Name=@Name');
        const role = roleRes.recordset[0];
        if (!role) throw new Error(`نقش نامعتبر: ${roleName}`);
        await new sql.Request(tx)
          .input('UserId', sql.Int, userId)
          .input('RoleId', sql.Int, role.Id)
          .query('INSERT INTO UserRoles (UserId, RoleId) VALUES (@UserId, @RoleId)');
      }

      if (value.primaryRole) {
        // ensure provided primaryRole exists in Roles
        const primaryExists = await new sql.Request(tx)
          .input('Name', sql.NVarChar(50), value.primaryRole)
          .query('SELECT 1 FROM Roles WHERE Name=@Name');
        if (!primaryExists.recordset[0]) throw new Error('نقش اصلی نامعتبر است');
        await new sql.Request(tx)
          .input('UserId', sql.Int, userId)
          .input('PrimaryRole', sql.NVarChar(50), value.primaryRole)
          .query('UPDATE Users SET Role=@PrimaryRole WHERE Id=@UserId');
      }

      await tx.commit();
    } catch (err) {
      // Only rollback if transaction hasn't been committed yet
      try {
        await tx.rollback();
      } catch (rollbackErr) {
        // Ignore rollback errors (transaction may already be committed/rolled back)
        console.warn('Transaction rollback failed:', rollbackErr.message);
      }
      throw err;
    }

    // Return updated user with roles (outside transaction)
    const userRes = await pool.request().input('UserId', sql.Int, userId).query(`
      SELECT u.Id, u.NationalCode, u.FullName, u.Email, u.Role AS PrimaryRole, u.IsActive, u.CreatedAt
      FROM Users u WHERE u.Id=@UserId
    `);
    const user = userRes.recordset[0];
    if (!user) return res.status(404).json({ message: 'کاربر یافت نشد' });

    const rolesQuery = await pool.request().input('UserId', sql.Int, userId).query(`
      SELECT DISTINCT r.Name AS RoleName
      FROM (
        SELECT @UserId AS UserId, (SELECT Role FROM Users WHERE Id=@UserId) AS RoleName
        UNION ALL
        SELECT ur.UserId, r.Name FROM UserRoles ur JOIN Roles r ON r.Id = ur.RoleId WHERE ur.UserId = @UserId
      ) x
      JOIN Roles r ON r.Name = x.RoleName
    `);
    const roles = rolesQuery.recordset.map(r => r.RoleName);

    res.json({ ...user, Roles: roles });
  } catch (e) { 
    next(e); 
  }
}

export async function listRoles(req, res, next) {
  try {
    const pool = await getPool();
    const { recordset } = await pool.request().query('SELECT Id, Name FROM Roles ORDER BY Name');
    const hideAdmin = await requesterIsSuperAdminOnly(pool, req.user?.id);
    res.json(hideAdmin ? recordset.filter((role) => !isAdminRoleName(role.Name)) : recordset);
  } catch (e) { next(e); }
}

const roleSchema = Joi.object({
  name: Joi.string().min(2).max(50).required()
});

export async function createRole(req, res, next) {
  try {
    const { error, value } = roleSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });
    const name = value.name.trim();

    const pool = await getPool();
    // prevent duplicates
    const exists = await pool.request().input('Name', sql.NVarChar(50), name).query('SELECT Id FROM Roles WHERE Name=@Name');
    if (exists.recordset[0]) return res.status(409).json({ message: 'این نقش قبلاً وجود دارد' });

    const result = await pool.request().input('Name', sql.NVarChar(50), name).query('INSERT INTO Roles (Name) OUTPUT INSERTED.* VALUES (@Name)');
    res.status(201).json(result.recordset[0]);
  } catch (e) { next(e); }
}

export async function updateRole(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { error, value } = roleSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });
    const name = value.name.trim();

    const pool = await getPool();
    // Check if role exists
    const existing = await pool.request().input('Id', sql.Int, id).query('SELECT * FROM Roles WHERE Id=@Id');
    if (!existing.recordset[0]) return res.status(404).json({ message: 'نقش یافت نشد' });

    // prevent duplicate name
    const dup = await pool.request().input('Id', sql.Int, id).input('Name', sql.NVarChar(50), name).query('SELECT 1 FROM Roles WHERE Name=@Name AND Id<>@Id');
    if (dup.recordset[0]) return res.status(409).json({ message: 'نقشی با این نام وجود دارد' });

    const result = await pool.request().input('Id', sql.Int, id).input('Name', sql.NVarChar(50), name).query('UPDATE Roles SET Name=@Name OUTPUT INSERTED.* WHERE Id=@Id');
    res.json(result.recordset[0]);
  } catch (e) { next(e); }
}

export async function deleteRole(req, res, next) {
  try {
    const id = Number(req.params.id);
    const pool = await getPool();
    // Find role and ensure no users have it as primary role
    const roleRes = await pool.request().input('Id', sql.Int, id).query('SELECT * FROM Roles WHERE Id=@Id');
    const role = roleRes.recordset[0];
    if (!role) return res.status(404).json({ message: 'نقش یافت نشد' });

    const usersWithPrimary = await pool.request().input('Name', sql.NVarChar(50), role.Name).query('SELECT TOP 1 Id FROM Users WHERE Role=@Name');
    if (usersWithPrimary.recordset[0]) return res.status(400).json({ message: 'این نقش به عنوان نقش اصلی برخی کاربران تنظیم شده است. ابتدا نقش اصلی آنها را تغییر دهید.' });

    // Deleting from Roles will cascade delete UserRoles due to FK ON DELETE CASCADE
    await pool.request().input('Id', sql.Int, id).query('DELETE FROM Roles WHERE Id=@Id');
    res.json({ success: true });
  } catch (e) { next(e); }
}
