import express from 'express';
import { getPersonByNationalCode, upsertPerson } from '../../controllers/persons.controller.js';
import { authRequired } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';

const router = express.Router();

// Get person by national code
// Allow agents (کارگزار/بهره بردار) to view person data when submitting requests on behalf of others
router.get('/by-national-code/:nationalCode', 
  authRequired, 
  (req, res, next) => {
    // Allow if user has permission OR if user is an Agent
    const userRole = req.user?.role;
    if (userRole === 'Agent' || userRole === 'کارگزار (بهره بردار)') {
      // Agent can view person data for license requests
      return next();
    }
    // Otherwise, require permission
    return requirePermission('view_person_info', 'view')(req, res, next);
  },
  getPersonByNationalCode
);

// Create or update person
// Allow agents (کارگزار/بهره بردار) to upsert person data when submitting requests on behalf of others
router.post('/upsert', 
  authRequired, 
  (req, res, next) => {
    // Allow if user has edit permission OR if user is an Agent
    const userRole = req.user?.role;
    if (userRole === 'Agent' || userRole === 'کارگزار (بهره بردار)') {
      // Agent can upsert person data for license requests
      return next();
    }
    // Otherwise, require permission
    return requirePermission('view_person_info', 'edit')(req, res, next);
  },
  upsertPerson
);

export default router;
