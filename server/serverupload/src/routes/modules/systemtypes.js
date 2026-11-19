import { Router } from 'express';
import { authRequired, requireAnyRole } from '../../middleware/auth.js';
import { listSystems, createSystem, updateSystem, deleteSystem, listTips, createTip, updateTip, deleteTip } from '../../controllers/systemtypes.controller.js';

const router = Router();

// Read endpoints: all authenticated users
router.get('/', authRequired, listSystems);
router.get('/:id/tips', authRequired, listTips);

// Write endpoints: Admin and superadmin
router.post('/', authRequired, requireAnyRole(['Admin', 'superadmin']), createSystem);
router.put('/:id', authRequired, requireAnyRole(['Admin', 'superadmin']), updateSystem);
router.delete('/:id', authRequired, requireAnyRole(['Admin', 'superadmin']), deleteSystem);
router.post('/:id/tips', authRequired, requireAnyRole(['Admin', 'superadmin']), createTip);
router.put('/tips/:tipId', authRequired, requireAnyRole(['Admin', 'superadmin']), updateTip);
router.delete('/tips/:tipId', authRequired, requireAnyRole(['Admin', 'superadmin']), deleteTip);

export default router;
