import { Router } from 'express';
import { authRequired, requireAnyRole } from '../../middleware/auth.js';
import { listProvinces, createProvince, updateProvince, deleteProvince, listCities, createCity, updateCity, deleteCity } from '../../controllers/provinces.controller.js';

const router = Router();

// Read endpoints: all authenticated users
router.get('/', authRequired, listProvinces);
router.get('/:id/cities', authRequired, listCities);

// Write endpoints: Admin and superadmin
router.post('/', authRequired, requireAnyRole(['Admin', 'superadmin']), createProvince);
router.put('/:id', authRequired, requireAnyRole(['Admin', 'superadmin']), updateProvince);
router.delete('/:id', authRequired, requireAnyRole(['Admin', 'superadmin']), deleteProvince);
router.post('/:id/cities', authRequired, requireAnyRole(['Admin', 'superadmin']), createCity);
router.put('/cities/:cityId', authRequired, requireAnyRole(['Admin', 'superadmin']), updateCity);
router.delete('/cities/:cityId', authRequired, requireAnyRole(['Admin', 'superadmin']), deleteCity);

export default router;
