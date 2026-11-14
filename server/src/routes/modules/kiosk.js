import { Router } from 'express';
import {
  confirmKioskPos,
  getKioskPosSettings,
  getUnpaidByNationalCode,
  inquiryKioskPos,
  pairKioskPos,
  payKioskWithPos,
  saveKioskPosSettings,
} from '../../controllers/kiosk.controller.js';

const router = Router();

// Public kiosk endpoints (no authentication)
router.get('/unpaid/:nationalCode', getUnpaidByNationalCode);
router.get('/pos/settings', getKioskPosSettings);
router.post('/pos/settings', saveKioskPosSettings);
router.post('/pos/pair', pairKioskPos);
router.post('/pos/pair/confirm', confirmKioskPos);
router.post('/pos/purchase', payKioskWithPos);
router.post('/pos/inquiry', inquiryKioskPos);

export default router;
