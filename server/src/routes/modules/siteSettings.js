import { Router } from 'express';
import { authRequired, requireRole } from '../../middleware/auth.js';
import { excludeRole } from '../../middleware/roleExempt.js';
import { getPopupSettings, getAllSettings, updatePopupSettings } from '../../controllers/siteSettings.controller.js';
import {
  confirmKioskPos,
  getKioskPosSettings,
  pairKioskPos,
  saveKioskPosSettings,
} from '../../controllers/kiosk.controller.js';

const router = Router();
const adminOnly = [authRequired, requireRole('Admin'), excludeRole('superadmin')];

// Public endpoint - anyone can get popup settings (to show on site load)
router.get('/popup', getPopupSettings);

// Admin-only endpoints (restricted for SuperAdmin)
router.get('/', ...adminOnly, getAllSettings);
router.put('/popup', ...adminOnly, updatePopupSettings);
router.get('/pos', ...adminOnly, getKioskPosSettings);
router.put('/pos', ...adminOnly, saveKioskPosSettings);
router.post('/pos/pair', ...adminOnly, pairKioskPos);
router.post('/pos/pair/confirm', ...adminOnly, confirmKioskPos);

export default router;
