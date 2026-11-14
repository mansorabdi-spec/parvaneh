import { Router } from 'express';
import { authRequired, requireRole } from '../../middleware/auth.js';
import { excludeRole } from '../../middleware/roleExempt.js';
import { getPopupSettings, getAllSettings, updatePopupSettings } from '../../controllers/siteSettings.controller.js';

const router = Router();

// Public endpoint - anyone can get popup settings (to show on site load)
router.get('/popup', getPopupSettings);

// Admin-only endpoints (restricted for SuperAdmin)
router.get('/', authRequired, requireRole('Admin'), excludeRole('superadmin'), getAllSettings);
router.put('/popup', authRequired, requireRole('Admin'), excludeRole('superadmin'), updatePopupSettings);

export default router;
