import { Router } from 'express';
import { authRequired } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { 
  createOnlinePayment, 
  updateOnlinePayment,
  initiatePayment,
  verifyPayment,
  handlePaymentCallback,
  createOfflinePayment,
  listOfflinePayments,
  listOnlinePayments,
  getOfflinePaymentAttachment,
  deleteOfflinePayment,
  getPaymentsByRequestId
} from '../../controllers/payments.controller.js';

const router = Router();

// Allow agents (کارگزار/بهره بردار) to create payments for requests they submitted on behalf of others
router.post('/', authRequired, (req, res, next) => {
  const userRole = req.user?.role;
  if (userRole === 'Agent' || userRole === 'کارگزار (بهره بردار)') {
    return next();
  }
  return requirePermission('view_payments', 'edit')(req, res, next);
}, createOnlinePayment);

router.put('/:id', authRequired, requirePermission('view_payments', 'edit'), updateOnlinePayment);
router.post('/initiate', authRequired, requirePermission('view_payments', 'view'), initiatePayment);
// Verification endpoints are public so bank return flow can verify without a logged-in session
router.get('/verify/:paymentId', verifyPayment);
// Also allow verification without path param, using query params
router.get('/verify', verifyPayment);
// This endpoint handles the payment gateway callback (both GET and POST)
router.all('/callback', handlePaymentCallback);

// Online payments list (by RequestID)
router.get('/online', authRequired, requirePermission('view_payments', 'view'), listOnlinePayments);

// Get all payments (online and offline) by request ID
router.get('/request/:requestId', authRequired, getPaymentsByRequestId);

// Offline payments
// Users can create offline payments for their own license requests
router.post('/offline', authRequired, createOfflinePayment);
// Users can view their own offline payment records
router.get('/offline', authRequired, listOfflinePayments);
router.get('/offline/:id/attachment', authRequired, getOfflinePaymentAttachment);
router.put('/offline/:id', authRequired, requirePermission('view_payments', 'edit'), async (req, res, next) => {
  try {
    const paymentId = parseInt(req.params.id);
    if (!paymentId || isNaN(paymentId)) {
      return res.status(400).json({ message: 'Invalid payment ID' });
    }

    const { receiptNo, amount, payDate, bankName, branchName, description } = req.body;
    const { getPool, sql } = await import('../../lib/db.js');
    const pool = await getPool();
    
    await pool.request()
      .input('Id', sql.BigInt, paymentId)
      .input('ReceiptNo', sql.NVarChar(50), receiptNo)
      .input('Amount', sql.Int, amount)
      .input('PayDate', sql.NVarChar(10), payDate)
      .input('BankName', sql.NVarChar(100), bankName || null)
      .input('BranchName', sql.NVarChar(100), branchName || null)
      .input('Description', sql.NVarChar(sql.MAX), description || null)
      .query(`
        UPDATE OfflinePayment
        SET 
          ReceiptNo = @ReceiptNo,
          Amount = @Amount,
          PayDate = @PayDate,
          BankName = @BankName,
          BranchName = @BranchName,
          Description = @Description
        WHERE Id = @Id
      `);
    
    res.json({ success: true, message: 'Offline payment updated successfully' });
  } catch (error) {
    console.error('Error updating offline payment:', error);
    next(error);
  }
});
router.delete('/offline/:id', authRequired, requirePermission('view_payments', 'edit'), deleteOfflinePayment);

// Delete online payment
router.delete('/online/:id', authRequired, requirePermission('view_payments', 'edit'), async (req, res, next) => {
  try {
    const paymentId = parseInt(req.params.id);
    if (!paymentId || isNaN(paymentId)) {
      return res.status(400).json({ message: 'Invalid payment ID' });
    }

    const { getPool, sql } = await import('../../lib/db.js');
    const pool = await getPool();
    
    await pool.request()
      .input('Id', sql.BigInt, paymentId)
      .query('DELETE FROM OnlinePayment WHERE Id = @Id');
    
    res.json({ success: true, message: 'Online payment deleted successfully' });
  } catch (error) {
    console.error('Error deleting online payment:', error);
    next(error);
  }
});

export default router;
