import { Router } from 'express';
import { authRequired, requireAnyRole } from '../../middleware/auth.js';
import { listCategories, createCategory, updateCategory, deleteCategory, listValues, getValue, createValue, updateValue, deleteValue } from '../../controllers/lookups.controller.js';

const router = Router();

// Read endpoints: all authenticated users
router.get('/categories', authRequired, listCategories);
router.get('/values', authRequired, listValues);
router.get('/values/:id', authRequired, getValue);

// Write endpoints: Admin and superadmin
router.post('/categories', authRequired, requireAnyRole(['Admin', 'superadmin']), createCategory);
router.put('/categories/:id', authRequired, requireAnyRole(['Admin', 'superadmin']), updateCategory);
router.delete('/categories/:id', authRequired, requireAnyRole(['Admin', 'superadmin']), deleteCategory);
router.post('/values', authRequired, requireAnyRole(['Admin', 'superadmin']), createValue);
router.put('/values/:id', authRequired, requireAnyRole(['Admin', 'superadmin']), updateValue);
router.delete('/values/:id', authRequired, requireAnyRole(['Admin', 'superadmin']), deleteValue);

export default router;
