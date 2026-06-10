import { Router } from 'express';
import { authRequired, requireRole } from '../../middleware/auth.js';
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

// Get all pages (Admin only)
router.get('/pages', authRequired, requireRole('Admin'), getAllPages);

// Create a new page (Admin only)
router.post('/pages', authRequired, requireRole('Admin'), createPage);

// Update a page (Admin only)
router.put('/pages/:pageId', authRequired, requireRole('Admin'), updatePage);

// Delete a page (Admin only)
router.delete('/pages/:pageId', authRequired, requireRole('Admin'), deletePage);

// Get all roles with their permissions (Admin only)
router.get('/roles', authRequired, requireRole('Admin'), getRolesWithPermissions);

// Get permissions for a specific role (Admin only)
router.get('/roles/:roleId', authRequired, requireRole('Admin'), getRolePermissions);

// Update all permissions for a role (Admin only)
router.put('/roles/:roleId', authRequired, requireRole('Admin'), updateRolePermissions);

// Set a single permission for a role (Admin only)
router.put('/roles/:roleId/pages/:pageId', authRequired, requireRole('Admin'), setRolePermission);

// Get accessible pages for the current user
router.get('/my-pages', authRequired, getMyAccessiblePages);

export default router;
