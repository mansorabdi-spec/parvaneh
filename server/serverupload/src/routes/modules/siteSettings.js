import { Router } from 'express';
import { authRequired } from '../../middleware/auth.js';
import { requirePageAccess } from '../../middleware/pageAccess.js';
import { getPopupSettings, getAllSettings, updatePopupSettings } from '../../controllers/siteSettings.controller.js';
import {
  confirmKioskPos,
  getKioskPosSettings,
  pairKioskPos,
  saveKioskPosSettings,
} from '../../controllers/kiosk.controller.js';

const router = Router();
const adminOnly = [authRequired, requirePageAccess('admin_site_settings')];

// Public endpoint - anyone can get popup settings (to show on site load)
router.get('/popup', getPopupSettings);

// Same roles that can open the data-management menu
router.get('/', ...adminOnly, getAllSettings);
router.put('/popup', ...adminOnly, updatePopupSettings);
router.get('/pos', ...adminOnly, getKioskPosSettings);
router.put('/pos', ...adminOnly, saveKioskPosSettings);
router.post('/pos/pair', ...adminOnly, pairKioskPos);
router.post('/pos/pair/confirm', ...adminOnly, confirmKioskPos);

export default router;
