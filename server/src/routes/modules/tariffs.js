import { Router } from 'express';
import { authRequired, requireRole } from '../../middleware/auth.js';
import { listTariffs, createTariff, updateTariff, deleteTariff } from '../../controllers/tariffs.controller.js';

const router = Router();

// Read endpoint: all authenticated users
router.get('/', authRequired, listTariffs);

// Write endpoints: Admin-only
router.post('/', authRequired, requireRole('Admin'), createTariff);
router.put('/:id', authRequired, requireRole('Admin'), updateTariff);
router.delete('/:id', authRequired, requireRole('Admin'), deleteTariff);

export default router;
