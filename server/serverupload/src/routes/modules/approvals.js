import { Router } from 'express';
import { authRequired } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/auth.js';
import { requireAnyPermission } from '../../middleware/permission.js';
import { excludeRole } from '../../middleware/roleExempt.js';
import { getFlow, setFlow, myTasks, decideApproval } from '../../controllers/approvals.controller.js';

const router = Router();

// Admin can configure the flow (restricted for SuperAdmin)
router.get('/flow', authRequired, requireRole('Admin'), excludeRole('superadmin'), getFlow);
router.post('/flow', authRequired, requireRole('Admin'), excludeRole('superadmin'), setFlow);

// Approvers (Officer/Admin) can view tasks and decide
// Users with approve or reject permission can view their tasks
router.get('/my-tasks', authRequired, myTasks);

// Users need approve_request or reject_request permission to make decisions
router.post('/:id/decision', 
  authRequired, 
  requireAnyPermission([
    { key: 'approve_request', action: 'view' },
    { key: 'reject_request', action: 'view' }
  ]),
  decideApproval
);

export default router;
