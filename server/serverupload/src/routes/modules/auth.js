import { Router } from 'express';
import { register, login, me, changePassword, switchRole } from '../../controllers/auth.controller.js';
import { authRequired } from '../../middleware/auth.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authRequired, me);
router.post('/change-password', authRequired, changePassword);
router.post('/switch-role', authRequired, switchRole);

export default router;
