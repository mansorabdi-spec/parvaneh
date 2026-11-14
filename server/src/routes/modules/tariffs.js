import { Router } from 'express';
import { authRequired, requireAnyRole } from '../../middleware/auth.js';
import { listTariffs, createTariff, updateTariff, deleteTariff } from '../../controllers/tariffs.controller.js';

const router = Router();

// Read endpoint: all authenticated users
router.get('/', authRequired, listTariffs);

// Write endpoints: Admin and superadmin
router.post('/', authRequired, requireAnyRole(['Admin', 'superadmin']), createTariff);
router.put('/:id', authRequired, requireAnyRole(['Admin', 'superadmin']), updateTariff);
router.delete('/:id', authRequired, requireAnyRole(['Admin', 'superadmin']), deleteTariff);

export default router;
