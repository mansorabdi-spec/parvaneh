import { Router } from 'express';
import { authRequired, requireRole } from '../../middleware/auth.js';
import { listCategories, createCategory, updateCategory, deleteCategory, listValues, getValue, createValue, updateValue, deleteValue } from '../../controllers/lookups.controller.js';

const router = Router();

// Read endpoints: all authenticated users
router.get('/categories', authRequired, listCategories);
router.get('/values', authRequired, listValues);
router.get('/values/:id', authRequired, getValue);

// Write endpoints: Admin-only
router.post('/categories', authRequired, requireRole('Admin'), createCategory);
router.put('/categories/:id', authRequired, requireRole('Admin'), updateCategory);
router.delete('/categories/:id', authRequired, requireRole('Admin'), deleteCategory);
router.post('/values', authRequired, requireRole('Admin'), createValue);
router.put('/values/:id', authRequired, requireRole('Admin'), updateValue);
router.delete('/values/:id', authRequired, requireRole('Admin'), deleteValue);

export default router;
