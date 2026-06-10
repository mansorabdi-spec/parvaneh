import { Router } from 'express';
import { authRequired } from '../../middleware/auth.js';
import { 
  uploadVehicleLabel,
  uploadLabelImage,
  getVehicleLabelImage,
  getVehicleLabelMetadata,
  checkVehicleLabelExists
} from '../../controllers/vehicleLabel.controller.js';

const router = Router();

// Upload vehicle label image (with multer middleware)
router.post('/', authRequired, uploadLabelImage, uploadVehicleLabel);

// Get vehicle label image
router.get('/:vehicleId/image', authRequired, getVehicleLabelImage);

// Get vehicle label metadata
router.get('/:vehicleId', authRequired, getVehicleLabelMetadata);

// Check if vehicle has label
router.get('/:vehicleId/exists', authRequired, checkVehicleLabelExists);

export default router;
