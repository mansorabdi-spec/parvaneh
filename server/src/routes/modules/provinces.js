import { Router } from 'express';
import { authRequired, requireRole } from '../../middleware/auth.js';
import { listProvinces, createProvince, updateProvince, deleteProvince, listCities, createCity, updateCity, deleteCity } from '../../controllers/provinces.controller.js';

const router = Router();

// Read endpoints: all authenticated users
router.get('/', authRequired, listProvinces);
router.get('/:id/cities', authRequired, listCities);

// Write endpoints: Admin-only
router.post('/', authRequired, requireRole('Admin'), createProvince);
router.put('/:id', authRequired, requireRole('Admin'), updateProvince);
router.delete('/:id', authRequired, requireRole('Admin'), deleteProvince);
router.post('/:id/cities', authRequired, requireRole('Admin'), createCity);
router.put('/cities/:cityId', authRequired, requireRole('Admin'), updateCity);
router.delete('/cities/:cityId', authRequired, requireRole('Admin'), deleteCity);

export default router;
