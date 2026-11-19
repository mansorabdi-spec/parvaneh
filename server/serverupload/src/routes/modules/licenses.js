import { Router } from 'express';
import * as controller from '../../controllers/licenses.controller.js';
import { authRequired } from '../../middleware/auth.js';

const router = Router();

router.get('/', authRequired, controller.listLicenses);
router.get('/my', authRequired, controller.listMyLicenses);
router.post('/issue', authRequired, controller.issueLicense);
router.get('/:id/pdf', authRequired, controller.getLicensePdf);

export default router;
