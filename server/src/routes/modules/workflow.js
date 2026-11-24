import { Router } from 'express';
import multer from 'multer';
import { authRequired } from '../../middleware/auth.js';
import { requirePermission, requireAnyPermission } from '../../middleware/permission.js';
import { getPool, sql } from '../../lib/db.js';
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
  adminFixWorkflowStatus,
  startLicenseCancellation,
  getCancellationAttachment
} from '../../controllers/workflow.controller.js';

const cancelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }
});

function acceptCancellationFile(req, res, next) {
  cancelUpload.single('attachment')(req, res, (err) => {
    if (!err) return next();
    const tooBig = err.code === 'LIMIT_FILE_SIZE';
    return res.status(400).json({
      message: tooBig ? 'حجم فایل نباید بیشتر از 2 مگابایت باشد.' : (err.message || 'بارگذاری فایل انجام نشد')
    });
  });
}

const router = Router();

// Public endpoint - no authentication required
router.get('/verify/:trackingNo', verifyLicenseByTracking);

// Check if company already has exploitation license - requires authentication
router.get('/check-existing-exploitation', authRequired, checkExistingExploitationLicense);

// User inbox
router.get('/my-inbox', authRequired, getMyInbox);

// Check if a license is expired by RequestID and TrackingNo
router.get('/license-expiry-check/:requestId', authRequired, async (req, res, next) => {
  try {
    const requestId = Number(req.params.requestId);
    console.log(`🔍 Checking license expiry for RequestID: ${requestId}`);
    
    const pool = await getPool();
    
    // Get the request with TrackingNo
    const requestResult = await pool.request()
      .input('RequestID', sql.BigInt, requestId)
      .query(`
        SELECT vr.RequestID, vr.TrackingNo, vr.LicenseTypeId, lt.Name AS LicenseTypeName
        FROM VehicleRequests vr
        LEFT JOIN LookupValue lt ON vr.LicenseTypeId = lt.Id
        WHERE vr.RequestID = @RequestID
      `);
    
    if (requestResult.recordset.length === 0) {
      return res.json({ hasExpiry: false, isExpired: false, reason: 'Request not found' });
    }
    
    const request = requestResult.recordset[0];
    console.log(`📋 Found request: ${request.RequestID}, TrackingNo: ${request.TrackingNo}`);
    
    // Check LicenseHistory with BOTH RequestID and TrackingNo
    // First, try to get the active license for this specific RequestID
    let licenseHistoryResult = await pool.request()
      .input('TrackingNo', sql.NVarChar(30), request.TrackingNo)
      .input('RequestID', sql.BigInt, requestId)
      .query(`
        SELECT lh.TrackingNo, lh.ExpiryDate, lh.RequestID, lh.Status, lh.CreatedAt, lh.HistoryID
        FROM LicenseHistory lh WITH (NOLOCK)
        WHERE lh.TrackingNo = @TrackingNo
          AND lh.RequestID = @RequestID
          AND lh.Status = 'Active'
        ORDER BY lh.CreatedAt DESC
      `);
    
    console.log(`📊 Found ${licenseHistoryResult.recordset.length} active license(s) for TrackingNo: ${request.TrackingNo} AND RequestID: ${requestId}`);
    
    // Log for debugging
    licenseHistoryResult.recordset.forEach((lh, idx) => {
      console.log(`  License ${idx + 1}: HistoryID=${lh.HistoryID}, RequestID=${lh.RequestID}, ExpiryDate=${lh.ExpiryDate}, Status=${lh.Status}, CreatedAt=${lh.CreatedAt}`);
    });
    
    // If no active license found for this RequestID, try to get the most recent active license for this TrackingNo
    if (licenseHistoryResult.recordset.length === 0) {
      console.log(`ℹ️ No active license found for RequestID ${requestId}, trying to get most recent active license for TrackingNo: ${request.TrackingNo}`);
      
      licenseHistoryResult = await pool.request()
        .input('TrackingNo', sql.NVarChar(30), request.TrackingNo)
        .query(`
          SELECT lh.TrackingNo, lh.ExpiryDate, lh.RequestID, lh.Status, lh.CreatedAt, lh.HistoryID
          FROM LicenseHistory lh WITH (NOLOCK)
          WHERE lh.TrackingNo = @TrackingNo
            AND lh.Status = 'Active'
          ORDER BY lh.CreatedAt DESC, lh.HistoryID DESC
        `);
      
      console.log(`📊 Fallback: Found ${licenseHistoryResult.recordset.length} active license(s) for TrackingNo: ${request.TrackingNo}`);
      
      licenseHistoryResult.recordset.forEach((lh, idx) => {
        console.log(`  Fallback License ${idx + 1}: HistoryID=${lh.HistoryID}, RequestID=${lh.RequestID}, ExpiryDate=${lh.ExpiryDate}, Status=${lh.Status}, CreatedAt=${lh.CreatedAt}`);
      });
    }
    
    if (licenseHistoryResult.recordset.length === 0) {
      console.log(`ℹ️ No active license found for TrackingNo: ${request.TrackingNo}`);
      return res.json({ hasExpiry: false, isExpired: false, reason: 'No active license' });
    }
    
    // Get the most recent active license
    const latestLicense = licenseHistoryResult.recordset[0];
    const { ExpiryDate } = latestLicense;
    
    console.log(`✅ Using license for expiry check:`, {
      HistoryID: latestLicense.HistoryID,
      RequestID: latestLicense.RequestID,
      ExpiryDate: latestLicense.ExpiryDate,
      Status: latestLicense.Status,
      CreatedAt: latestLicense.CreatedAt
    });
    
    if (!ExpiryDate) {
      console.log(`ℹ️ No expiry date for license`);
      return res.json({ hasExpiry: false, isExpired: false, reason: 'No expiry date' });
    }
    
    // Convert Shamsi expiry date to compare with today
    const today = new Date();
    
    // Get today's date in Shamsi format with 2-digit month and day (e.g., "1405/05/23")
    const todayShamsi = today.toLocaleDateString('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    // Simple string comparison function for Shamsi dates
    const persianToEnglishDigits = (str) => {
      const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
      const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
      const englishDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
      
      let result = String(str);
      persianDigits.forEach((persian, i) => {
        result = result.replace(new RegExp(persian, 'g'), englishDigits[i]);
      });
      arabicDigits.forEach((arabic, i) => {
        result = result.replace(new RegExp(arabic, 'g'), englishDigits[i]);
      });
      return result;
    };
    
    const expiryStr = persianToEnglishDigits(String(ExpiryDate).trim());
    const todayStr = persianToEnglishDigits(todayShamsi.trim());
    
    console.log(`📅 Date comparison debug:`, {
      expiryStr,
      todayStr,
      todayJsDate: today.toISOString()
    });
    
    const expiryParts = expiryStr.split('/');
    const todayParts = todayStr.split('/');
    
    if (expiryParts.length !== 3 || todayParts.length !== 3) {
      console.warn(`⚠️ Invalid date format: expiry="${expiryStr}", today="${todayStr}"`);
      return res.json({ hasExpiry: true, isExpired: false, reason: 'Invalid date format' });
    }
    
    const expiryYear = parseInt(expiryParts[0]);
    const expiryMonth = parseInt(expiryParts[1]);
    const expiryDay = parseInt(expiryParts[2]);
    
    const todayYear = parseInt(todayParts[0]);
    const todayMonth = parseInt(todayParts[1]);
    const todayDay = parseInt(todayParts[2]);
    
    if (isNaN(expiryYear) || isNaN(expiryMonth) || isNaN(expiryDay) ||
        isNaN(todayYear) || isNaN(todayMonth) || isNaN(todayDay)) {
      console.warn(`⚠️ Failed to parse date parts`);
      return res.json({ hasExpiry: true, isExpired: false, reason: 'Failed to parse dates' });
    }
    
    // Compare dates: expired if expiry date is before or equal to today
    const isExpired = (expiryYear < todayYear) || 
                      (expiryYear === todayYear && expiryMonth < todayMonth) || 
                      (expiryYear === todayYear && expiryMonth === todayMonth && expiryDay <= todayDay);
    
    console.log(`✅ License expiry check result:`, {
      expiryYear, expiryMonth, expiryDay,
      todayYear, todayMonth, todayDay,
      isExpired,
      explanation: isExpired ? 'Expired' : 'Still valid'
    });
    
    res.json({
      hasExpiry: true,
      isExpired,
      expiryDate: ExpiryDate,
      trackingNo: request.TrackingNo,
      requestID: request.RequestID
    });
  } catch (e) {
    console.error('❌ Error checking license expiry:', e);
    next(e);
  }
});

// Request details - users with any view permission OR request owner can see request details
router.get('/requests/:requestId', 
  authRequired,
  getRequestDetail
);

router.get('/requests/:requestId/steps', authRequired, getRequestWorkflowSteps);
router.get('/requests/:requestId/history', authRequired, getRequestHistory);
router.get('/requests/:requestId/deficiency-status', authRequired, getDeficiencyStatus);
router.post('/requests/:requestId/submit-corrections', authRequired, submitCorrections);
router.post('/requests/:requestId/cancel', authRequired, acceptCancellationFile, startLicenseCancellation);
router.get('/requests/:requestId/cancellation-file', authRequired, getCancellationAttachment);

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
