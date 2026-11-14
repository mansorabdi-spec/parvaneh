import { Router } from 'express';
import { authRequired, requireRole } from '../../middleware/auth.js';
import { excludeRole } from '../../middleware/roleExempt.js';
import {
  getAllPages,
  getRolesWithPermissions,
  getRolePermissions,
  updateRolePermissions,
  setRolePermission,
  getMyAccessiblePages,
  createPage,
  updatePage,
  deletePage
} from '../../controllers/permissions.controller.js';

const router = Router();

// Get all pages (Admin only, restricted for SuperAdmin)
router.get('/pages', authRequired, requireRole('Admin'), excludeRole('superadmin'), getAllPages);

// Create a new page (Admin only, restricted for SuperAdmin)
router.post('/pages', authRequired, requireRole('Admin'), excludeRole('superadmin'), createPage);

// Update a page (Admin only, restricted for SuperAdmin)
router.put('/pages/:pageId', authRequired, requireRole('Admin'), excludeRole('superadmin'), updatePage);

// Delete a page (Admin only, restricted for SuperAdmin)
router.delete('/pages/:pageId', authRequired, requireRole('Admin'), excludeRole('superadmin'), deletePage);

// Get all roles with their permissions (Admin only, restricted for SuperAdmin)
router.get('/roles', authRequired, requireRole('Admin'), excludeRole('superadmin'), getRolesWithPermissions);

// Get permissions for a specific role (Admin only, restricted for SuperAdmin)
router.get('/roles/:roleId', authRequired, requireRole('Admin'), excludeRole('superadmin'), getRolePermissions);

// Update all permissions for a role (Admin only, restricted for SuperAdmin)
router.put('/roles/:roleId', authRequired, requireRole('Admin'), excludeRole('superadmin'), updateRolePermissions);

// Set a single permission for a role (Admin only, restricted for SuperAdmin)
router.put('/roles/:roleId/pages/:pageId', authRequired, requireRole('Admin'), excludeRole('superadmin'), setRolePermission);

// Get accessible pages for the current user
router.get('/my-pages', authRequired, getMyAccessiblePages);

export default router;
