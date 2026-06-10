import { Router } from 'express';
import { authRequired, requireRole } from '../../middleware/auth.js';
import { listSystems, createSystem, updateSystem, deleteSystem, listTips, createTip, updateTip, deleteTip } from '../../controllers/systemtypes.controller.js';

const router = Router();

// Read endpoints: all authenticated users
router.get('/', authRequired, listSystems);
router.get('/:id/tips', authRequired, listTips);

// Write endpoints: Admin-only
router.post('/', authRequired, requireRole('Admin'), createSystem);
router.put('/:id', authRequired, requireRole('Admin'), updateSystem);
router.delete('/:id', authRequired, requireRole('Admin'), deleteSystem);
router.post('/:id/tips', authRequired, requireRole('Admin'), createTip);
router.put('/tips/:tipId', authRequired, requireRole('Admin'), updateTip);
router.delete('/tips/:tipId', authRequired, requireRole('Admin'), deleteTip);

export default router;
