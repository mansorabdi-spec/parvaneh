import { Router } from 'express';
import { authRequired, requireRole } from '../../middleware/auth.js';
import { excludeRole, requireRoleOrExempt } from '../../middleware/roleExempt.js';
import { listUsers, setUserRoles, listRoles, createRole, updateRole, deleteRole, deleteUser, setUserActive, resetUserPassword } from '../../controllers/users.controller.js';

const router = Router();

// Users list - accessible by Admin and superadmin (filters out Admin users for SuperAdmin)
router.get('/', authRequired, requireRoleOrExempt('Admin', 'superadmin'), listUsers);

// Roles endpoints - Admin only (superadmin can read roles for user management)
router.get('/roles', authRequired, requireRoleOrExempt('Admin', 'superadmin'), listRoles);
router.put('/:id/roles', authRequired, requireRole('Admin'), excludeRole('superadmin'), setUserRoles);
router.post('/roles', authRequired, requireRole('Admin'), excludeRole('superadmin'), createRole);
router.put('/roles/:id', authRequired, requireRole('Admin'), excludeRole('superadmin'), updateRole);
router.delete('/roles/:id', authRequired, requireRole('Admin'), excludeRole('superadmin'), deleteRole);

// User management - Admin only for delete, but superadmin can reset password and toggle active
router.delete('/:id', authRequired, requireRole('Admin'), deleteUser);
router.put('/:id/active', authRequired, requireRoleOrExempt('Admin', 'superadmin'), setUserActive);
router.post('/:id/reset-password', authRequired, requireRoleOrExempt('Admin', 'superadmin'), resetUserPassword);

export default router;
