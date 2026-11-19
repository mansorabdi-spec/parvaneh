import { sql, getPool } from '../lib/db.js';

/**
 * Get all pages in the system
 */
export async function getAllPages(req, res) {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query(`
        SELECT 
          Id, PageKey, PagePath, PageTitle, Description, IsActive, CreatedAt
        FROM Pages
        WHERE IsActive = 1
        ORDER BY PageTitle
      `);
    res.json({ pages: result.recordset });
  } catch (err) {
    console.error('Error fetching pages:', err);
    res.status(500).json({ message: 'خطا در دریافت صفحات' });
  }
}

/**
 * Get all roles with their page permissions
 */
export async function getRolesWithPermissions(req, res) {
  try {
    const pool = await getPool();
    
    // Get all roles
    const rolesResult = await pool.request()
      .query('SELECT Id, Name FROM Roles ORDER BY Name');
    
    const roles = rolesResult.recordset;
    
    // Get permissions for each role
    for (const role of roles) {
      const permissionsResult = await pool.request()
        .input('roleId', sql.Int, role.Id)
        .query(`
          SELECT 
            p.Id as PageId,
            p.PageKey,
            p.PagePath,
            p.PageTitle,
            p.Description,
            ISNULL(rpp.CanAccess, 0) as CanAccess
          FROM Pages p
          LEFT JOIN RolePagePermissions rpp ON p.Id = rpp.PageId AND rpp.RoleId = @roleId
          WHERE p.IsActive = 1
          ORDER BY p.PageTitle
        `);
      
      role.Permissions = permissionsResult.recordset;
    }
    
    res.json({ roles });
  } catch (err) {
    console.error('Error fetching roles with permissions:', err);
    res.status(500).json({ message: 'خطا در دریافت نقش‌ها و دسترسی‌ها' });
  }
}

/**
 * Get permissions for a specific role
 */
export async function getRolePermissions(req, res) {
  try {
    const { roleId } = req.params;
    const pool = await getPool();
    
    const result = await pool.request()
      .input('roleId', sql.Int, roleId)
      .query(`
        SELECT 
          p.Id as PageId,
          p.PageKey,
          p.PagePath,
          p.PageTitle,
          p.Description,
          ISNULL(rpp.CanAccess, 0) as CanAccess
        FROM Pages p
        LEFT JOIN RolePagePermissions rpp ON p.Id = rpp.PageId AND rpp.RoleId = @roleId
        WHERE p.IsActive = 1
        ORDER BY p.PageTitle
      `);
    
    res.json({ permissions: result.recordset });
  } catch (err) {
    console.error('Error fetching role permissions:', err);
    res.status(500).json({ message: 'خطا در دریافت دسترسی‌های نقش' });
  }
}

/**
 * Update permissions for a role
 */
export async function updateRolePermissions(req, res) {
  try {
    const { roleId } = req.params;
    const { permissions } = req.body; // Array of { pageId, canAccess }
    
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ message: 'فرمت دسترسی‌ها نامعتبر است' });
    }
    
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    
    await transaction.begin();
    
    try {
      // Delete existing permissions for this role
      await transaction.request()
        .input('roleId', sql.Int, roleId)
        .query('DELETE FROM RolePagePermissions WHERE RoleId = @roleId');
      
      // Insert new permissions
      for (const perm of permissions) {
        if (perm.canAccess) {
          await transaction.request()
            .input('roleId', sql.Int, roleId)
            .input('pageId', sql.Int, perm.pageId)
            .input('canAccess', sql.Bit, perm.canAccess ? 1 : 0)
            .query(`
              INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess)
              VALUES (@roleId, @pageId, @canAccess)
            `);
        }
      }
      
      await transaction.commit();
      res.json({ message: 'دسترسی‌ها با موفقیت به‌روزرسانی شد' });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.error('Error updating role permissions:', err);
    res.status(500).json({ message: 'خطا در به‌روزرسانی دسترسی‌ها' });
  }
}

/**
 * Set a single permission for a role
 */
export async function setRolePermission(req, res) {
  try {
    const { roleId, pageId } = req.params;
    const { canAccess } = req.body;
    
    const pool = await getPool();
    
    // Check if permission exists
    const existingResult = await pool.request()
      .input('roleId', sql.Int, roleId)
      .input('pageId', sql.Int, pageId)
      .query('SELECT Id FROM RolePagePermissions WHERE RoleId = @roleId AND PageId = @pageId');
    
    if (existingResult.recordset.length > 0) {
      // Update existing permission
      await pool.request()
        .input('roleId', sql.Int, roleId)
        .input('pageId', sql.Int, pageId)
        .input('canAccess', sql.Bit, canAccess ? 1 : 0)
        .query('UPDATE RolePagePermissions SET CanAccess = @canAccess WHERE RoleId = @roleId AND PageId = @pageId');
    } else {
      // Insert new permission
      await pool.request()
        .input('roleId', sql.Int, roleId)
        .input('pageId', sql.Int, pageId)
        .input('canAccess', sql.Bit, canAccess ? 1 : 0)
        .query('INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess) VALUES (@roleId, @pageId, @canAccess)');
    }
    
    res.json({ message: 'دسترسی با موفقیت تنظیم شد' });
  } catch (err) {
    console.error('Error setting role permission:', err);
    res.status(500).json({ message: 'خطا در تنظیم دسترسی' });
  }
}

/**
 * Get accessible pages for the current user based on their CURRENT ACTIVE role from JWT
 */
export async function getMyAccessiblePages(req, res) {
  try {
    const userId = req.user?.id;
    const currentRole = req.user?.role; // Get current active role from JWT token
    
    if (!userId) {
      return res.status(401).json({ message: 'کاربر احراز هویت نشده است' });
    }
    
    if (!currentRole) {
      return res.status(400).json({ message: 'نقش کاربر مشخص نیست' });
    }
    
    console.log(`📋 Getting accessible pages for user ${userId} with role: ${currentRole}`);
    
    const pool = await getPool();
    
    // Get the role ID for the current active role
    const roleResult = await pool.request()
      .input('roleName', sql.NVarChar, currentRole)
      .query('SELECT Id FROM Roles WHERE Name = @roleName');
    
    if (roleResult.recordset.length === 0) {
      console.warn(`⚠️ Role not found: ${currentRole}`);
      return res.json({ pages: [] });
    }
    
    const roleId = roleResult.recordset[0].Id;
    console.log(`📋 Role ID for ${currentRole}: ${roleId}`);
    
    // Get all accessible pages for this specific role only
    const pagesResult = await pool.request()
      .input('roleId', sql.Int, roleId)
      .query(`
        SELECT DISTINCT
          p.Id,
          p.PageKey,
          p.PagePath,
          p.PageTitle,
          p.Description
        FROM Pages p
        INNER JOIN RolePagePermissions rpp ON p.Id = rpp.PageId
        WHERE rpp.RoleId = @roleId
          AND rpp.CanAccess = 1
          AND p.IsActive = 1
        ORDER BY p.PageTitle
      `);
    
    console.log(`✅ Found ${pagesResult.recordset.length} accessible pages for role ${currentRole}`);
    res.json({ pages: pagesResult.recordset });
  } catch (err) {
    console.error('❌ Error fetching accessible pages:', err);
    res.status(500).json({ message: 'خطا در دریافت صفحات قابل دسترسی' });
  }
}

/**
 * Create a new page
 */
export async function createPage(req, res) {
  try {
    const { pageKey, pagePath, pageTitle, description } = req.body;
    
    if (!pageKey || !pagePath || !pageTitle) {
      return res.status(400).json({ message: 'اطلاعات صفحه ناقص است' });
    }
    
    const pool = await getPool();
    
    const result = await pool.request()
      .input('pageKey', sql.NVarChar, pageKey)
      .input('pagePath', sql.NVarChar, pagePath)
      .input('pageTitle', sql.NVarChar, pageTitle)
      .input('description', sql.NVarChar, description || null)
      .query(`
        INSERT INTO Pages (PageKey, PagePath, PageTitle, Description)
        VALUES (@pageKey, @pagePath, @pageTitle, @description);
        SELECT SCOPE_IDENTITY() as Id;
      `);
    
    res.json({ 
      message: 'صفحه با موفقیت ایجاد شد',
      pageId: result.recordset[0].Id
    });
  } catch (err) {
    console.error('Error creating page:', err);
    if (err.number === 2627) { // Unique constraint violation
      res.status(400).json({ message: 'کلید صفحه تکراری است' });
    } else {
      res.status(500).json({ message: 'خطا در ایجاد صفحه' });
    }
  }
}

/**
 * Update a page
 */
export async function updatePage(req, res) {
  try {
    const { pageId } = req.params;
    const { pageKey, pagePath, pageTitle, description, isActive } = req.body;
    
    const pool = await getPool();
    
    await pool.request()
      .input('pageId', sql.Int, pageId)
      .input('pageKey', sql.NVarChar, pageKey)
      .input('pagePath', sql.NVarChar, pagePath)
      .input('pageTitle', sql.NVarChar, pageTitle)
      .input('description', sql.NVarChar, description || null)
      .input('isActive', sql.Bit, isActive !== undefined ? (isActive ? 1 : 0) : 1)
      .query(`
        UPDATE Pages
        SET PageKey = @pageKey,
            PagePath = @pagePath,
            PageTitle = @pageTitle,
            Description = @description,
            IsActive = @isActive
        WHERE Id = @pageId
      `);
    
    res.json({ message: 'صفحه با موفقیت به‌روزرسانی شد' });
  } catch (err) {
    console.error('Error updating page:', err);
    res.status(500).json({ message: 'خطا در به‌روزرسانی صفحه' });
  }
}

/**
 * Delete a page
 */
export async function deletePage(req, res) {
  try {
    const { pageId } = req.params;
    
    const pool = await getPool();
    
    await pool.request()
      .input('pageId', sql.Int, pageId)
      .query('DELETE FROM Pages WHERE Id = @pageId');
    
    res.json({ message: 'صفحه با موفقیت حذف شد' });
  } catch (err) {
    console.error('Error deleting page:', err);
    res.status(500).json({ message: 'خطا در حذف صفحه' });
  }
}
