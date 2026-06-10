import { Router } from 'express';
import { authRequired } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { getVehicleById, getVehicleByTracking, validateVehiclePlate } from '../../controllers/vehicles.controller.js';
import { getVehicleByNationalCode } from '../../controllers/request.controller.js';

const router = Router();

router.get('/by-tracking/:trackingNo', 
  authRequired,
  getVehicleByTracking
);

router.get('/by-national-code/:nationalCode', 
  authRequired, 
  requirePermission('view_vehicle_info', 'view'),
  getVehicleByNationalCode
);

router.get('/:vehicleId',
  authRequired,
  getVehicleById
);

router.post('/validate-plate',
  authRequired,
  validateVehiclePlate
);

export default router;
