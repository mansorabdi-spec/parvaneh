import express from 'express';
import {
  createLicenseHistory,
  getLicenseHistoryByRequest,
  getLicenseHistoryByTracking,
  getAllLicenseHistory,
  getLicenseHistoryStatistics,
  revokeLicense,
  getActiveLicensesByVehicle,
  getActiveLicensesByPerson,
  updateExpiringLicenses,
  getMyLicenses,
  updatePaidAmount
} from '../controllers/licensehistory.controller.js';
import { authRequired, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.post('/', authRequired, createLicenseHistory);

router.get('/request/:requestId', authRequired, getLicenseHistoryByRequest);

router.get('/tracking/:trackingNo', authRequired, getLicenseHistoryByTracking);

router.get('/all', authRequired, getAllLicenseHistory);

router.get('/my', authRequired, getMyLicenses);

router.get('/statistics', authRequired, getLicenseHistoryStatistics);

router.put('/revoke/:historyId', authRequired, revokeLicense);

router.put('/:historyId/paid-amount', authRequired, requireRole('Admin'), updatePaidAmount);

router.get('/vehicle/:vehicleId/active', authRequired, getActiveLicensesByVehicle);

router.get('/person/:nationalCode/active', authRequired, getActiveLicensesByPerson);

router.post('/update-expiring', authRequired, updateExpiringLicenses);

export default router;
