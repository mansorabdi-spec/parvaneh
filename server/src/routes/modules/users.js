import { Router } from 'express';
import { authRequired } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/auth.js';
import { listUsers, setUserRoles, listRoles, createRole, updateRole, deleteRole, deleteUser, setUserActive, resetUserPassword } from '../../controllers/users.controller.js';

const router = Router();

// Admin-only endpoints
router.get('/', authRequired, requireRole('Admin'), listUsers);
router.get('/roles', authRequired, requireRole('Admin'), listRoles);
router.put('/:id/roles', authRequired, requireRole('Admin'), setUserRoles);
router.post('/roles', authRequired, requireRole('Admin'), createRole);
router.put('/roles/:id', authRequired, requireRole('Admin'), updateRole);
router.delete('/roles/:id', authRequired, requireRole('Admin'), deleteRole);
// user management
router.delete('/:id', authRequired, requireRole('Admin'), deleteUser);
router.put('/:id/active', authRequired, requireRole('Admin'), setUserActive);
router.post('/:id/reset-password', authRequired, requireRole('Admin'), resetUserPassword);

export default router;
