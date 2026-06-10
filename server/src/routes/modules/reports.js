import { Router } from 'express';
import { authRequired, requireRole } from '../../middleware/auth.js';
import { getActivityLicenseReports, getVehicleDetailReport } from '../../controllers/reports.controller.js';

const router = Router();

// Admin-only endpoints for reports
router.get('/activity-licenses', authRequired, requireRole('Admin'), getActivityLicenseReports);
router.get('/activity-licenses/:vehicleId', authRequired, requireRole('Admin'), getVehicleDetailReport);

export default router;
