import { Router } from 'express';
import { authRequired, requireRole } from '../../middleware/auth.js';
import { requirePageAccess } from '../../middleware/pageAccess.js';
import {
  getActivityLicenseReports,
  getVehicleDetailReport,
  getComprehensiveReportMeta,
  postComprehensiveReport,
  exportComprehensiveReport
} from '../../controllers/reports.controller.js';

const router = Router();

// Admin-only endpoints for reports
router.get('/activity-licenses', authRequired, requireRole('Admin'), getActivityLicenseReports);
router.get('/activity-licenses/:vehicleId', authRequired, requireRole('Admin'), getVehicleDetailReport);

router.get('/comprehensive/meta', authRequired, requirePageAccess('admin_reports_comprehensive'), getComprehensiveReportMeta);
router.post('/comprehensive', authRequired, requirePageAccess('admin_reports_comprehensive'), postComprehensiveReport);
router.post('/comprehensive/export', authRequired, requirePageAccess('admin_reports_comprehensive'), exportComprehensiveReport);

export default router;
