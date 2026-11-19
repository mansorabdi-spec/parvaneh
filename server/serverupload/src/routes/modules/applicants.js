import { Router } from 'express';
import * as controller from '../../controllers/applicants.controller.js';

const router = Router();

router.get('/', controller.listApplicants);
router.get('/:id', controller.getApplicantById);
router.post('/', controller.createApplicant);
router.put('/:id', controller.updateApplicant);
router.delete('/:id', controller.deleteApplicant);

export default router;
