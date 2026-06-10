import { Router } from 'express';
import { authRequired } from '../../middleware/auth.js';
import { requirePermission, requireAnyPermission } from '../../middleware/permission.js';
import {
  getMyInbox,
  getRequestDetail,
  getRequestWorkflowSteps,
  getRequestHistory,
  makeDecision,
  fixDeficiency,
  getAllRequests,
  updateRequest,
  notifyRequestChanges,
  deleteRequest,
  approveDiscount,
  getDeficiencyStatus,
  submitCorrections,
  verifyLicenseByTracking,
  checkExistingExploitationLicense,
  adminFixWorkflowStatus
} from '../../controllers/workflow.controller.js';

const router = Router();

// Public endpoint - no authentication required
router.get('/verify/:trackingNo', verifyLicenseByTracking);

// Check if company already has exploitation license - requires authentication
router.get('/check-existing-exploitation', authRequired, checkExistingExploitationLicense);

// User inbox
router.get('/my-inbox', authRequired, getMyInbox);

// Request details - users with any view permission OR request owner can see request details
router.get('/requests/:requestId', 
  authRequired,
  getRequestDetail
);

router.get('/requests/:requestId/steps', authRequired, getRequestWorkflowSteps);
router.get('/requests/:requestId/history', authRequired, getRequestHistory);
router.get('/requests/:requestId/deficiency-status', authRequired, getDeficiencyStatus);
router.post('/requests/:requestId/submit-corrections', authRequired, submitCorrections);

// Workflow actions - requires approval permissions
router.post('/steps/:stepId/decision', 
  authRequired, 
  requireAnyPermission([
    { key: 'approve_request', action: 'view' },
    { key: 'reject_request', action: 'view' }
  ]),
  makeDecision
);

router.post('/steps/:stepId/fix-deficiency', authRequired, fixDeficiency);

// Discount approval - requires view_discounts permission
router.post('/requests/:requestId/discount-approval', 
  authRequired, 
  requirePermission('view_discounts', 'edit'),
  approveDiscount
);

// Admin routes
router.get('/requests', authRequired, getAllRequests);
router.put('/requests/:requestId', authRequired, updateRequest);
router.post('/requests/:requestId/notify', authRequired, notifyRequestChanges);
router.delete('/requests/:requestId', authRequired, deleteRequest);
router.post('/requests/:requestId/admin-fix-status', authRequired, adminFixWorkflowStatus);

export default router;
