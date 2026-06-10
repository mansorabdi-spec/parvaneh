import express from 'express';
import { authRequired, requireRole } from '../../middleware/auth.js';
import {
  getAllRolePermissions,
  getPermissionsByRole,
  getAllPermissionKeys,
  getAllRoles,
  createRolePermission,
  updateRolePermission,
  deleteRolePermission,
  bulkUpdateRolePermissions
} from '../../controllers/rolePermissions.controller.js';

const router = express.Router();

// Public endpoint for users to get their own role permissions (before Admin middleware)
router.get('/my-permissions', authRequired, getAllRolePermissions);

// All other routes require authentication and Admin role
router.use(authRequired);
router.use(requireRole('Admin'));

// Get all role permissions
router.get('/', getAllRolePermissions);

// Get permissions grouped by role
router.get('/by-role', getPermissionsByRole);

// Get all unique permission keys
router.get('/permission-keys', getAllPermissionKeys);

// Get all unique roles
router.get('/roles', getAllRoles);

// Create a new role permission
router.post('/', createRolePermission);

// Update a role permission
router.put('/:id', updateRolePermission);

// Delete a role permission
router.delete('/:id', deleteRolePermission);

// Bulk update permissions for a role
router.post('/bulk-update', bulkUpdateRolePermissions);

export default router;
