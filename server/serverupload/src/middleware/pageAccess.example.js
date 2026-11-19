/**
 * Example usage of page access middleware
 * This file demonstrates how to protect routes with page-level permissions
 */

import { Router } from 'express';
import { authRequired } from './auth.js';
import { requirePageAccess, requireAnyPageAccess } from './pageAccess.js';

const router = Router();

// Example 1: Protect a single route with page access
// Only users with access to 'admin_users' page can access this route
router.get('/admin/users', 
  authRequired,                      // First, ensure user is authenticated
  requirePageAccess('admin_users'),  // Then, check page access
  (req, res) => {
    res.json({ message: 'User management page' });
  }
);

// Example 2: Protect multiple routes with the same page access
router.get('/admin/reports/sales', 
  authRequired,
  requirePageAccess('admin_reports_sales'),
  (req, res) => {
    res.json({ message: 'Sales reports' });
  }
);

router.post('/admin/reports/sales/export', 
  authRequired,
  requirePageAccess('admin_reports_sales'),  // Same page key for related endpoints
  (req, res) => {
    res.json({ message: 'Exporting sales report' });
  }
);

// Example 3: Allow access if user has ANY of the specified page permissions
// Useful for pages that can be accessed by multiple different roles
router.get('/dashboard', 
  authRequired,
  requireAnyPageAccess(['admin_dashboard', 'officer_dashboard', 'user_dashboard']),
  (req, res) => {
    res.json({ message: 'Dashboard page' });
  }
);

// Example 4: Combining role-based and page-based access
// This is useful for backward compatibility or additional security
import { requireRole } from './auth.js';

router.delete('/admin/users/:id', 
  authRequired,
  requireRole('Admin'),              // Must be Admin role
  requirePageAccess('admin_users'),  // AND must have page access
  (req, res) => {
    res.json({ message: 'User deleted' });
  }
);

// Example 5: Optional page access check (for analytics or logging)
// This doesn't block access but can be used for tracking
router.get('/public/content', 
  authRequired,
  async (req, res, next) => {
    // Custom logic to check access without blocking
    try {
      const hasAccess = await checkUserPageAccess(req.user.id, 'premium_content');
      req.hasPremiumAccess = hasAccess;
    } catch (err) {
      req.hasPremiumAccess = false;
    }
    next();
  },
  (req, res) => {
    const content = req.hasPremiumAccess 
      ? 'Premium content here' 
      : 'Basic content here';
    res.json({ content });
  }
);

// Example 6: Protecting API endpoints that correspond to frontend pages
// The pageKey should match what's defined in the Pages table
const adminRoutes = {
  '/admin/users': 'admin_users',
  '/admin/roles': 'admin_roles',
  '/admin/lookups': 'admin_lookups',
  '/admin/systemtypes': 'admin_systemtypes',
  '/admin/provinces': 'admin_provinces',
  '/admin/tariffs': 'admin_tariffs',
  '/admin/reports/activity-licenses': 'admin_reports_activity_licenses',
  '/admin/workflow/requests': 'admin_workflow_requests'
};

// Apply middleware to all admin routes dynamically
Object.entries(adminRoutes).forEach(([path, pageKey]) => {
  router.get(path, authRequired, requirePageAccess(pageKey), (req, res) => {
    res.json({ message: `Access granted to ${pageKey}` });
  });
});

export default router;

/**
 * Helper function to check page access (for custom logic)
 */
async function checkUserPageAccess(userId, pageKey) {
  // Implementation would be similar to the middleware
  // but returns boolean instead of calling next() or sending response
  // This is useful for conditional logic in controllers
  return true; // Placeholder
}
