import { Router } from 'express';
import {
  getKioskPosTransaction,
  getUnpaidByNationalCode,
  inquiryKioskPos,
  payKioskWithPos,
} from '../../controllers/kiosk.controller.js';

const router = Router();

// Public kiosk endpoints (no authentication)
router.get('/unpaid/:nationalCode', getUnpaidByNationalCode);
router.post('/pos/purchase', payKioskWithPos);
router.get('/pos/transactions/:id', getKioskPosTransaction);
router.post('/pos/inquiry', inquiryKioskPos);

export default router;
