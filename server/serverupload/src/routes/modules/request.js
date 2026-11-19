import { Router } from 'express';
import { authRequired } from '../../middleware/auth.js';
import { requireAnyPermission } from '../../middleware/permission.js';
import { getRequestDetails, getRequestByTracking } from '../../controllers/request.controller.js';

const router = Router();

// Get request details by tracking number
// Users can access their own request data for payment purposes
router.get('/by-tracking/:trackingNo', 
  authRequired,
  getRequestByTracking
);

// Get request details by RequestID
// Users can access their own request data for payment purposes
router.get('/:requestId', 
  authRequired,
  getRequestDetails
);

export default router;
