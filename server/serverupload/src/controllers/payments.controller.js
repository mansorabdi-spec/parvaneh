import Joi from 'joi';
import axios from 'axios';
import { getPool, sql } from '../lib/db.js';
import { ensureOnlinePaymentChannel } from '../lib/ensureOnlinePaymentChannel.js';
import { initializeWorkflow } from './workflow.controller.js';

const createSchema = Joi.object({
  vehicleId: Joi.number().integer().allow(null).optional(), // Optional for exploitation licenses
  trackingNo: Joi.string().max(30).required(),
  amount: Joi.number().integer().min(0).required(),
  calculatedAmount: Joi.number().integer().min(0).allow(null).optional(), // مبلغ محاسبه شده در صفحه پرداخت
  description: Joi.string().allow('', null),
  requestId: Joi.number().integer().optional(),
  orderId: Joi.string().max(100).optional() // Store orderId for payment tracking
});

export async function createOnlinePayment(req, res, next) {
  try {
    const { error, value } = createSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const userId = req.user?.id || null;
    const pool = await getPool();
    await ensureOnlinePaymentChannel(pool);
    
    // Get RequestID from TrackingNo if not provided
    let requestId = value.requestId || null;
    if (!requestId && value.trackingNo) {
      const reqResult = await pool.request()
        .input('TrackingNo', sql.NVarChar(30), value.trackingNo)
        .query(`SELECT RequestID FROM VehicleRequests WHERE TrackingNo = @TrackingNo`);
      if (reqResult.recordset.length > 0) {
        requestId = reqResult.recordset[0].RequestID;
      }
    }
    
    const r = await pool.request()
      .input('VehicleID', sql.BigInt, value.vehicleId)
      .input('TrackingNo', sql.NVarChar(30), value.trackingNo)
      .input('Amount', sql.Int, value.amount)
      .input('CalculatedAmount', sql.BigInt, value.calculatedAmount ?? value.amount)
      .input('UserId', sql.BigInt, userId)
      .input('Description', sql.NVarChar(sql.MAX), value.description || null)
      .input('RequestID', sql.BigInt, requestId)
      .input('GatewayAuthority', sql.NVarChar(100), value.orderId || null)
      .input('PaymentChannel', sql.NVarChar(20), 'Internet')
      .input('ViaKiosk', sql.Bit, 0)
      .query(`INSERT INTO OnlinePayment(VehicleID, TrackingNo, Amount, CalculatedAmount, UserId, PayedBit, Description, Status, RequestID, GatewayAuthority, PaymentChannel, ViaKiosk)
              OUTPUT INSERTED.*
              VALUES(@VehicleID, @TrackingNo, @Amount, @CalculatedAmount, @UserId, 0, @Description, 'Initiated', @RequestID, @GatewayAuthority, @PaymentChannel, @ViaKiosk)`);
    res.status(201).json(r.recordset[0]);
  } catch (e) { next(e); }
}

// ============= Offline Payments ============= //
const offlineCreateSchema = Joi.object({
  vehicleId: Joi.number().integer().allow(null).optional(), // Optional for exploitation licenses
  trackingNo: Joi.string().max(30).required(),
  amount: Joi.number().integer().min(0).required(),
  calculatedAmount: Joi.number().integer().min(0).allow(null).optional(), // مبلغ محاسبه شده در صفحه پرداخت
  payDate: Joi.string().max(10).required(),
  receiptNo: Joi.string().max(50).required(),
  description: Joi.string().allow('', null).optional(),
  bankName: Joi.string().allow('', null).optional(),
  branchName: Joi.string().allow('', null).optional(),
  attachmentBase64: Joi.string().allow('', null).optional(),
  attachmentFileName: Joi.string().allow('', null).optional(),
  attachmentContentType: Joi.string().allow('', null).optional()
});

export async function createOfflinePayment(req, res, next) {
  try {
    const { error, value } = offlineCreateSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const userId = req.user?.id || null;
    const pool = await getPool();
    
    // Convert base64 to binary if attachment is provided
    let attachmentBinary = null;
    if (value.attachmentBase64) {
      try {
        // Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
        const base64Data = value.attachmentBase64.replace(/^data:image\/\w+;base64,/, '');
        attachmentBinary = Buffer.from(base64Data, 'base64');
      } catch (err) {
        console.error('Error converting base64 to binary:', err);
        return res.status(400).json({ message: 'Invalid image data' });
      }
    }
    
    // Get RequestID and request details from TrackingNo (use TOP 1 ORDER BY DESC to get the latest request)
    const requestResult = await pool.request()
      .input('TrackingNo', sql.NVarChar(30), value.trackingNo)
      .query(`SELECT TOP 1 RequestID, Status, LicenseTypeId, TrackingNo, SubmittedByUserId FROM VehicleRequests WHERE TrackingNo = @TrackingNo ORDER BY RequestID DESC`);
    
    const requestId = requestResult.recordset.length > 0 ? requestResult.recordset[0].RequestID : null;
    const requestStatus = requestResult.recordset[0]?.Status;
    const licenseTypeId = requestResult.recordset[0]?.LicenseTypeId;
    const trackingNoFromDB = requestResult.recordset[0]?.TrackingNo;
    const submittedByUserId = requestResult.recordset[0]?.SubmittedByUserId;
    
    const r = await pool.request()
      .input('VehicleID', sql.BigInt, value.vehicleId)
      .input('TrackingNo', sql.NVarChar(30), value.trackingNo)
      .input('Amount', sql.Int, value.amount)
      .input('CalculatedAmount', sql.BigInt, value.calculatedAmount ?? value.amount)
      .input('PayDate', sql.NVarChar(10), value.payDate)
      .input('ReceiptNo', sql.NVarChar(50), value.receiptNo)
      .input('Description', sql.NVarChar(sql.MAX), value.description ?? null)
      .input('BankName', sql.NVarChar(100), value.bankName ?? null)
      .input('BranchName', sql.NVarChar(100), value.branchName ?? null)
      .input('AttachmentBinary', sql.VarBinary(sql.MAX), attachmentBinary)
      .input('AttachmentFileName', sql.NVarChar(255), value.attachmentFileName ?? null)
      .input('AttachmentContentType', sql.NVarChar(100), value.attachmentContentType ?? null)
      .input('UserId', sql.BigInt, userId)
      .input('RequestID', sql.BigInt, requestId)
      .query(`INSERT INTO OfflinePayment(
                VehicleID, TrackingNo, Amount, CalculatedAmount, PayDate, ReceiptNo, Description,
                BankName, BranchName, AttachmentBinary, AttachmentFileName, AttachmentContentType, UserId, RequestID, CreatedAt
              )
              OUTPUT INSERTED.Id, INSERTED.VehicleID, INSERTED.TrackingNo, INSERTED.Amount, INSERTED.CalculatedAmount,
                     INSERTED.PayDate, INSERTED.ReceiptNo, INSERTED.Description, INSERTED.BankName,
                     INSERTED.BranchName, INSERTED.AttachmentFileName, INSERTED.AttachmentContentType,
                     INSERTED.UserId, INSERTED.RequestID, INSERTED.CreatedAt
              VALUES(
                @VehicleID, @TrackingNo, @Amount, @CalculatedAmount, @PayDate, @ReceiptNo, @Description,
                @BankName, @BranchName, @AttachmentBinary, @AttachmentFileName, @AttachmentContentType, @UserId, @RequestID, SYSUTCDATETIME()
              )`);
    
    // Activate workflow after successful offline payment
    if (requestId) {
      console.log(`💳 Offline payment received for request ${requestId}, activating workflow`);
      
      // Check if this is an exploitation license
      // Format: 11YY-NNNN (YY = activity category code)
      const isExploitation = licenseTypeId === 68 || trackingNoFromDB?.startsWith('11');
      
      console.log(`🔍 Offline payment - checking workflow advancement:`);
      console.log(`   - RequestID: ${requestId}`);
      console.log(`   - LicenseTypeId: ${licenseTypeId}`);
      console.log(`   - TrackingNo: ${trackingNoFromDB}`);
      console.log(`   - isExploitation: ${isExploitation}`);
      console.log(`   - RequestStatus: ${requestStatus}`);
      
      // Check if workflow steps exist
      const workflowCheck = await pool.request()
        .input('RequestID', sql.BigInt, requestId)
        .query(`SELECT COUNT(*) AS Count FROM RequestWorkflowSteps WHERE RequestID = @RequestID AND StepOrder > 0`);
      
      if (workflowCheck.recordset[0].Count > 0) {
        // Workflow steps already exist
        
        // Check if this is an exploitation license in AwaitingPayment status
        if (isExploitation && requestStatus === 'AwaitingPayment') {
          // For exploitation licenses in AwaitingPayment, advance to Step 3
          console.log(`💳 Payment completed for exploitation license ${requestId} - advancing workflow from AwaitingPayment`);
          
          // Find Step 3 (next step after payment) and activate it
          const nextStepResult = await pool.request()
            .input('RequestID', sql.BigInt, requestId)
            .query(`
              SELECT TOP 1 Id, StepOrder, RoleName
              FROM RequestWorkflowSteps
              WHERE RequestID = @RequestID AND StepOrder = 3
            `);
          
          if (nextStepResult.recordset.length > 0) {
            const nextStep = nextStepResult.recordset[0];
            
            // Activate Step 3
            await pool.request()
              .input('Id', sql.BigInt, nextStep.Id)
              .query(`
                UPDATE RequestWorkflowSteps
                SET Status = 'Pending'
                WHERE Id = @Id
              `);
            
            // Update request status from AwaitingPayment to InProgress
            await pool.request()
              .input('RequestID', sql.BigInt, requestId)
              .input('CurrentStepOrder', sql.Int, 3)
              .query(`
                UPDATE VehicleRequests
                SET Status = 'InProgress', CurrentStepOrder = @CurrentStepOrder
                WHERE RequestID = @RequestID
              `);
            
            // Add to process history
            await pool.request()
              .input('RequestID', sql.BigInt, requestId)
              .input('ActionType', sql.NVarChar(50), 'PaymentCompleted')
              .input('ActionByUserId', sql.Int, submittedByUserId)
              .input('ActionByUserName', sql.NVarChar(150), 'System')
              .input('ActionByRole', sql.NVarChar(50), 'User')
              .input('FromStatus', sql.NVarChar(50), 'AwaitingPayment')
              .input('ToStatus', sql.NVarChar(50), 'InProgress')
              .input('StepOrder', sql.Int, 3)
              .input('Notes', sql.NVarChar(sql.MAX), 'پرداخت آفلاین با موفقیت انجام شد - ارجاع به مرحله بعد')
              .query(`
                INSERT INTO RequestProcessHistory 
                (RequestID, ActionType, ActionByUserId, ActionByUserName, ActionByRole, FromStatus, ToStatus, StepOrder, Notes)
                VALUES (@RequestID, @ActionType, @ActionByUserId, @ActionByUserName, @ActionByRole, @FromStatus, @ToStatus, @StepOrder, @Notes)
              `);
            
            console.log(`✅ Workflow advanced to Step 3 (${nextStep.RoleName}) after offline payment`);
          }
        } else {
          // Normal flow - activate Step 1
          await pool.request()
            .input('RequestID', sql.BigInt, requestId)
            .query(`
              UPDATE RequestWorkflowSteps
              SET Status = 'Pending'
              WHERE RequestID = @RequestID AND StepOrder = 1
            `);
          
          // Update request status to InProgress with first step
          await pool.request()
            .input('RequestID', sql.BigInt, requestId)
            .query(`
              UPDATE VehicleRequests
              SET Status = 'InProgress', CurrentStepOrder = 1
              WHERE RequestID = @RequestID
            `);
          
          console.log(`✅ Workflow activated for request ${requestId} - first step now Pending`);
        }
      } else {
        // No workflow steps exist (legacy request or Employment license)
        // Initialize workflow using the old method
        console.log(`📝 No workflow steps found, initializing workflow for request ${requestId}`);
        await initializeWorkflow(requestId, submittedByUserId, pool, 'offline');
      }
    }
    
    return res.status(201).json(r.recordset[0]);
  } catch (e) { next(e); }
}

const offlineListSchema = Joi.object({
  vehicleId: Joi.number().integer().required(),
  trackingNo: Joi.string().max(30).required()
});

export async function listOfflinePayments(req, res, next) {
  try {
    // Support both old format (vehicleId + trackingNo) and new format (requestId)
    if (req.query.requestId) {
      const requestId = Number(req.query.requestId);
      if (!requestId) return res.status(400).json({ message: 'Invalid requestId' });
      
      const pool = await getPool();
      const r = await pool.request()
        .input('RequestID', sql.BigInt, requestId)
        .query(`SELECT Id, VehicleID, TrackingNo, Amount, PayDate, ReceiptNo, Description,
                       BankName, BranchName, AttachmentFileName, AttachmentContentType, UserId, RequestID, CreatedAt
                FROM OfflinePayment
                WHERE RequestID=@RequestID
                ORDER BY CreatedAt DESC, Id DESC`);
      return res.json(r.recordset);
    }
    
    // Old format for backward compatibility
    const { error, value } = offlineListSchema.validate(req.query);
    if (error) return res.status(400).json({ message: error.message });

    const pool = await getPool();
    const r = await pool.request()
      .input('VehicleID', sql.BigInt, value.vehicleId)
      .input('TrackingNo', sql.NVarChar(30), value.trackingNo)
      .query(`SELECT Id, VehicleID, TrackingNo, Amount, PayDate, ReceiptNo, Description,
                     BankName, BranchName, AttachmentFileName, AttachmentContentType, UserId, RequestID, CreatedAt
              FROM OfflinePayment
              WHERE VehicleID=@VehicleID AND TrackingNo=@TrackingNo
              ORDER BY PayDate DESC, Id DESC`);
    return res.json(r.recordset);
  } catch (e) { next(e); }
}

// List online payments by RequestID
export async function listOnlinePayments(req, res, next) {
  try {
    const requestId = Number(req.query.requestId);
    if (!requestId) return res.status(400).json({ message: 'requestId is required' });
    
    const pool = await getPool();
    await ensureOnlinePaymentChannel(pool);
    const r = await pool.request()
      .input('RequestID', sql.BigInt, requestId)
      .query(`SELECT Id, VehicleID, TrackingNo, Amount, UserId, PayedBit, Description, 
                     Status, GatewayRef, GatewayAuthority, CreatedAt, PaidAt, RequestID,
                     PaymentChannel, ViaKiosk
              FROM OnlinePayment
              WHERE RequestID=@RequestID
              ORDER BY CreatedAt DESC, Id DESC`);
    return res.json(r.recordset);
  } catch (e) { next(e); }
}

// Get attachment image by payment ID
export async function getOfflinePaymentAttachment(req, res, next) {
  try {
    const paymentId = Number(req.params.id);
    if (!paymentId) {
      return res.status(400).json({ message: 'Missing payment ID' });
    }

    const pool = await getPool();
    
    // Get payment details with user information
    const result = await pool.request()
      .input('Id', sql.BigInt, paymentId)
      .query(`
        SELECT 
          op.AttachmentBinary, 
          op.AttachmentContentType, 
          op.AttachmentFileName,
          op.UserId,
          vr.SubmittedByUserId
        FROM OfflinePayment op
        LEFT JOIN VehicleRequests vr ON op.TrackingNo = vr.TrackingNo
        WHERE op.Id = @Id
      `);

    if (!result.recordset.length || !result.recordset[0].AttachmentBinary) {
      return res.status(404).json({ message: 'Attachment not found' });
    }

    const row = result.recordset[0];
    const currentUserId = req.user?.id;
    
    console.log('🔍 Payment attachment access check:', {
      paymentId,
      currentUserId,
      submittedByUserId: row.SubmittedByUserId,
      trackingNo: result.recordset[0].TrackingNo || 'N/A'
    });
    
    // Check if user owns the payment directly or is the request submitter
    const isPaymentOwner = currentUserId && row.UserId && currentUserId === row.UserId;
    const isRequestOwner = currentUserId && row.SubmittedByUserId && currentUserId === row.SubmittedByUserId;
    const isOwner = Boolean(isPaymentOwner || isRequestOwner);
    console.log('👤 Ownership check:', {
      isOwner,
      isPaymentOwner,
      isRequestOwner,
      currentUserId,
      paymentUserId: row.UserId,
      submittedByUserId: row.SubmittedByUserId
    });
    
    // If not the owner, check if user has view_payment_documents permission
    if (!isOwner) {
      // Get user's role
      const userResult = await pool.request()
        .input('userId', sql.Int, currentUserId)
        .query('SELECT Role FROM Users WHERE Id = @userId');
      
      if (userResult.recordset.length === 0) {
        return res.status(403).json({ message: 'Access denied. You can only view your own payment attachments.' });
      }
      
      const userRole = userResult.recordset[0].Role;
      
      // Check if user's role can view payment documents or payments in general
      // (keeps backward compatibility with deployments that only define view_payments)
      const permissionResult = await pool.request()
        .input('roleName', sql.NVarChar, userRole)
        .query(`
          SELECT PermissionKey, CanView
          FROM RolePermissions
          WHERE RoleName = @roleName
            AND PermissionKey IN (N'view_payment_documents', N'view_payments')
        `);
      
      const hasPermission = permissionResult.recordset.some((p) => p.CanView);
      
      if (!hasPermission) {
        return res.status(403).json({ message: 'Access denied. You can only view your own payment attachments.' });
      }
    }
    
    res.setHeader('Content-Type', row.AttachmentContentType || 'application/octet-stream');
    
    // Properly encode filename to handle Persian characters in HTTP headers
    const filename = row.AttachmentFileName || 'attachment';
    const encodedFilename = encodeURIComponent(filename);
    const asciiFilename = filename.replace(/[^\x00-\x7F]/g, '_');
    res.setHeader('Content-Disposition', `inline; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`);
    
    res.send(row.AttachmentBinary);
  } catch (e) {
    next(e);
  }
}

// Get all payments (online and offline) by request ID
export async function getPaymentsByRequestId(req, res, next) {
  try {
    const requestId = parseInt(req.params.requestId);
    if (!requestId || isNaN(requestId)) {
      return res.status(400).json({ message: 'Invalid request ID' });
    }

    const pool = await getPool();
    await ensureOnlinePaymentChannel(pool);
    
    // Get online payments
    const onlineResult = await pool.request()
      .input('RequestID', sql.BigInt, requestId)
      .query(`
        SELECT 
          Id AS PaymentID,
          Amount,
          GatewayAuthority AS ReferenceNo,
          CONVERT(VARCHAR, PaidAt, 23) AS PaymentDate,
          Status,
          Description,
          PaymentChannel,
          ViaKiosk
        FROM OnlinePayment
        WHERE RequestID = @RequestID AND PayedBit = 1
        ORDER BY PaidAt DESC
      `);
    
    // Get offline payments
    const offlineResult = await pool.request()
      .input('RequestID', sql.BigInt, requestId)
      .query(`
        SELECT 
          Id AS PaymentID,
          Amount,
          ReceiptNo AS BankTrackingNo,
          PayDate AS PaymentDate,
          BankName,
          BranchName,
          Description,
          AttachmentFileName,
          AttachmentContentType,
          CASE WHEN AttachmentBinary IS NOT NULL THEN 1 ELSE 0 END AS HasAttachment
        FROM OfflinePayment
        WHERE RequestID = @RequestID
        ORDER BY CreatedAt DESC
      `);
    
    return res.json({
      onlinePayments: onlineResult.recordset || [],
      offlinePayments: offlineResult.recordset || []
    });
  } catch (error) {
    console.error('Error fetching payments by request ID:', error);
    next(error);
  }
}

// Delete an offline payment
export async function deleteOfflinePayment(req, res, next) {
  try {
    const paymentId = Number(req.params.id);
    if (!paymentId) {
      return res.status(400).json({ message: 'Missing payment ID' });
    }

    const pool = await getPool();
    
    // Check if payment exists and belongs to the user
    const checkResult = await pool.request()
      .input('Id', sql.BigInt, paymentId)
      .query(`SELECT Id, UserId FROM OfflinePayment WHERE Id = @Id`);
    
    if (!checkResult.recordset.length) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    // Delete the payment
    await pool.request()
      .input('Id', sql.BigInt, paymentId)
      .query(`DELETE FROM OfflinePayment WHERE Id = @Id`);

    res.json({ success: true, message: 'پرداخت با موفقیت حذف شد' });
  } catch (e) {
    next(e);
  }
}

const statusSchema = Joi.object({
  status: Joi.string().max(50).required(),
  description: Joi.string().allow('', null),
  gatewayRef: Joi.string().allow('', null),
  gatewayAuthority: Joi.string().allow('', null),
  paid: Joi.boolean()
});

export async function updateOnlinePayment(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { error, value } = statusSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });
    const pool = await getPool();
    const r = await pool.request()
      .input('Id', sql.BigInt, id)
      .input('Status', sql.NVarChar(50), value.status)
      .input('Description', sql.NVarChar(sql.MAX), value.description ?? null)
      .input('GatewayRef', sql.NVarChar(100), value.gatewayRef ?? null)
      .input('GatewayAuthority', sql.NVarChar(100), value.gatewayAuthority ?? null)
      .input('PayedBit', sql.Bit, value.paid ? 1 : 0)
      .query(`UPDATE OnlinePayment
              SET Status=@Status,
                  Description=COALESCE(@Description, Description),
                  GatewayRef=@GatewayRef,
                  GatewayAuthority=@GatewayAuthority,
                  PayedBit=@PayedBit,
                  PaidAt=CASE WHEN @PayedBit=1 THEN SYSUTCDATETIME() ELSE PaidAt END
              OUTPUT INSERTED.*
              WHERE Id=@Id`);
    if (!r.recordset[0]) return res.status(404).json({ message: 'Payment not found' });
    res.json(r.recordset[0]);
  } catch (e) { next(e); }
}

// Payment gateway configuration
const PAYMENT_CONFIG = {
  baseUrl: 'https://pay.tabriz.ir/api/payment',
  auth: {
    username: 'Hamlebar',
    password: 'H123baR456'
  },
  timeout: 20000 // 20 seconds
};

// Map gateway Status codes to human-friendly messages
function getGatewayError(status) {
  const map = {
    100: 'تراکنش با موفقیت انجام شد',
    101: 'تراکنش قبلاً تایید شده است',
    0: 'تراکنش نامشخص',
    '-414151': 'کاربر از انجام تراکنش منصرف شده است',
    '-1': 'خطای داخلی',
    400: 'درخواست نامعتبر',
    401: 'عدم احراز هویت',
    402: 'عدم دسترسی',
    403: 'عدم مجوز',
    404: 'خدمت مورد نظر یافت نشد',
    500: 'خطای داخلی سرور درگاه'
  };
  if (status === undefined || status === null) return 'خطای نامشخص در تایید پرداخت';
  const key = String(status);
  return map[status] || map[key] || `خطا با کد ${status}`;
}

const initiateSchema = Joi.object({
  orderId: Joi.string().required(),
  amount: Joi.number().integer().min(1000).required(), // Minimum 1000 Rials
  callbackUrl: Joi.string().uri().required(),
  description: Joi.string().allow('').optional()
});

/**
 * Initiate a payment with the payment gateway
 */
export async function initiatePayment(req, res, next) {
  try {
    // Validate request
    const { error, value } = initiateSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const { orderId, amount, callbackUrl, description } = value;
    
    // Log the payment initiation
    console.log(`Initiating payment for order ${orderId}, amount: ${amount} Rials`);
    
    // Call the payment gateway
    const response = await axios.post(
      `${PAYMENT_CONFIG.baseUrl}/pay`,
      {
        OrderID: orderId,
        Price: amount,
        callback: callbackUrl,
        Description: description || `پرداخت شماره سفارش ${orderId}`
      },
      {
        auth: PAYMENT_CONFIG.auth,
        timeout: PAYMENT_CONFIG.timeout,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    // Log the gateway response
    console.log('Payment gateway response:', response.data);
    
    // Handle the gateway response
    if (response.data && response.data.Status === 100) {
      // Success - return the payment URL to redirect the user
      return res.json({
        success: true,
        paymentUrl: `https://pay.tabriz.ir/pg/StartPay/${response.data.Authority}`,
        authority: response.data.Authority,
        status: response.data.Status,
        orderId: orderId,
        amount: amount
      });
    } else {
      // Handle gateway errors
      const errorMessage = getGatewayError(response.data?.Status) || 'خطا در ارتباط با درگاه پرداخت';
      return res.status(400).json({
        success: false,
        message: errorMessage,
        status: response.data?.Status
      });
    }
  } catch (error) {
    console.error('Payment initiation error:', error);
    
    // Handle specific Axios errors
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Payment gateway error response:', error.response.data);
      return res.status(502).json({
        success: false,
        message: 'خطا در ارتباط با درگاه پرداخت',
        details: error.response.data || {}
      });
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response from payment gateway');
      return res.status(504).json({
        success: false,
        message: 'عدم پاسخگویی درگاه پرداخت. لطفا مجددا تلاش نمایید.'
      });
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Payment request setup error:', error.message);
      return res.status(500).json({
        success: false,
        message: 'خطا در ارسال درخواست پرداخت',
        details: error.message
      });
    }
  }
}

const verifySchema = Joi.object({
  orderId: Joi.string().required(),
  refId: Joi.string().required(),
  saleOrderId: Joi.string().required()
});

/**
 * Verify a payment with the payment gateway
 */
export async function handlePaymentCallback(req, res, next) {
  try {
    console.log('🏛️ ========== PAYMENT CALLBACK RECEIVED ==========');
    console.log('📫 Request body:', req.body);
    console.log('📫 Request query:', req.query);
    
    // Try to get the data param first (some gateways send a base64 JSON under 'data')
    let data = req.body?.data || req.query?.data;

    // If data is not present, build it from the gateway's posted form/query fields
    if (!data) {
      // Merge body and query for safety
      const src = { ...(req.body || {}), ...(req.query || {}) };

      // Normalize keys (case-insensitive) to our expected payload
      const normalized = {
        OrderID: src.OrderID || src.orderId || src.OrderId || '',
        RefId: src.RefId || src.refId || src.RefID || '',
        SaleOrderId: src.SaleOrderId || src.saleOrderId || src.SaleOrderID || '',
        SaleReferenceId: src.SaleReferenceId || src.saleReferenceId || src.SaleReferenceID || '',
        ResCode: src.ResCode ?? src.resCode ?? '',
        ResCodeMessage: src.ResCodeMessage || src.resCodeMessage || '',
        CardHolderPan: src.CardHolderPan || src.cardHolderPan || '',
        FinalAmount: src.FinalAmount || src.finalAmount || '',
      };

      // Encode as base64 JSON
      const json = JSON.stringify(normalized);
      data = Buffer.from(json, 'utf8').toString('base64');
    }

    // Redirect to the frontend with the data as a query parameter, preserve pid if provided
    const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';
    const url = new URL('/payment-callback', frontendBase);
    url.searchParams.set('data', data);
    const pid = req.body?.pid || req.query?.pid;
    if (pid) url.searchParams.set('pid', String(pid));
    const frontendUrl = url.toString();
    
    console.log('➡️ Redirecting to frontend:', frontendUrl);
    console.log('🏛️ ========== PAYMENT CALLBACK END ==========');
    
    return res.redirect(frontendUrl);
  } catch (e) {
    next(e);
  }
}

export async function verifyPayment(req, res, next) {
  try {
    console.log('🚀 ========== VERIFY PAYMENT STARTED ==========');
    console.log('📋 Request params:', req.params);
    console.log('📋 Request query:', req.query);
    
    // Get payment ID from URL parameters (optional)
    const paymentIdRaw = req.params.paymentId;
    let paymentId = paymentIdRaw && !isNaN(Number(paymentIdRaw)) ? Number(paymentIdRaw) : null;
    
    console.log('🔑 Payment ID from params:', paymentId);
    
    // Get verification data from query parameters
    const { error, value } = verifySchema.validate(req.query);
    if (error) {
      return res.status(400).json({ 
        success: false, 
        message: 'پارامترهای تایید پرداخت نامعتبر است',
        details: error.details 
      });
    }
    
    const { orderId, refId, saleOrderId } = value;
    
    // If paymentId is not provided, look it up from the database
    // We need to find the payment record by other criteria since orderId is not stored during creation
    if (!paymentId) {
      try {
        const pool = await getPool();
        
        // First, try to find by orderId in GatewayAuthority (in case it was stored)
        if (orderId) {
          const lookupByAuthority = await pool.request()
            .input('GatewayAuthority', sql.NVarChar(100), orderId)
            .query(`SELECT TOP 1 Id, TrackingNo FROM OnlinePayment WHERE GatewayAuthority = @GatewayAuthority ORDER BY CreatedAt DESC`);
          
          if (lookupByAuthority.recordset.length > 0) {
            paymentId = lookupByAuthority.recordset[0].Id;
            console.log(`✅ Found payment ID ${paymentId} from orderId in GatewayAuthority`);
          }
        }
        
        // If still not found, try to find by refId in GatewayRef
        if (!paymentId && refId) {
          const lookupByRef = await pool.request()
            .input('GatewayRef', sql.NVarChar(100), refId)
            .query(`SELECT TOP 1 Id, TrackingNo FROM OnlinePayment WHERE GatewayRef = @GatewayRef ORDER BY CreatedAt DESC`);
          
          if (lookupByRef.recordset.length > 0) {
            paymentId = lookupByRef.recordset[0].Id;
            console.log(`✅ Found payment ID ${paymentId} from refId in GatewayRef`);
          }
        }
        
        // If still not found and we have saleOrderId, try to find by saleOrderId in GatewayAuthority
        if (!paymentId && saleOrderId) {
          const lookupBySaleOrder = await pool.request()
            .input('SaleOrderId', sql.NVarChar(100), saleOrderId)
            .query(`SELECT TOP 1 Id, TrackingNo FROM OnlinePayment WHERE GatewayAuthority = @SaleOrderId ORDER BY CreatedAt DESC`);
          
          if (lookupBySaleOrder.recordset.length > 0) {
            paymentId = lookupBySaleOrder.recordset[0].Id;
            console.log(`✅ Found payment ID ${paymentId} from saleOrderId in GatewayAuthority`);
          }
        }
        
        // Last resort: Find the most recent 'Initiated' payment record
        // This works because the user just completed payment, so the most recent initiated payment is likely theirs
        if (!paymentId) {
          console.warn(`⚠️ Could not find payment by gateway IDs, looking for most recent Initiated payment`);
          const lookupByStatus = await pool.request()
            .input('Status', sql.NVarChar(50), 'Initiated')
            .query(`
              SELECT TOP 1 Id, TrackingNo, CreatedAt 
              FROM OnlinePayment 
              WHERE Status = @Status 
              ORDER BY CreatedAt DESC
            `);
          
          if (lookupByStatus.recordset.length > 0) {
            paymentId = lookupByStatus.recordset[0].Id;
            const trackingNo = lookupByStatus.recordset[0].TrackingNo;
            const createdAt = lookupByStatus.recordset[0].CreatedAt;
            console.log(`⚠️ Using most recent Initiated payment: ID ${paymentId}, TrackingNo ${trackingNo}, Created ${createdAt}`);
          } else {
            console.error(`❌ No Initiated payment records found in database`);
          }
        }
        
      } catch (lookupError) {
        console.error('Error looking up payment ID:', lookupError);
      }
    }
    
    // Log the verification request
    console.log(`Verifying payment ${paymentId} with orderId: ${orderId}, refId: ${refId}, saleOrderId: ${saleOrderId}`);
    
    // Call the payment gateway to verify the payment
    let response;
    try {
      response = await axios.post(
        `${PAYMENT_CONFIG.baseUrl}/verify`,
        {
          OrderID: orderId,
          RefId: refId,
          SaleOrderId: saleOrderId
        },
        {
          auth: PAYMENT_CONFIG.auth,
          timeout: PAYMENT_CONFIG.timeout,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (error) {
      // Handle Axios errors properly
      if (error.response) {
        console.error('Payment gateway verification error:', error.response.data);
        return res.status(502).json({
          success: false,
          verified: false,
          message: 'خطا در ارتباط با درگاه پرداخت برای تایید تراکنش',
          details: error.response.data || {}
        });
      } else if (error.request) {
        console.error('No response from payment gateway during verification');
        return res.status(504).json({
          success: false,
          verified: false,
          message: 'عدم پاسخگویی درگاه پرداخت در حین تایید تراکنش. لطفا مجددا تلاش نمایید.'
        });
      } else {
        console.error('Payment verification setup error:', error.message);
        return res.status(500).json({
          success: false,
          verified: false,
          message: 'خطا در ارسال درخواست تایید پرداخت',
          details: error.message
        });
      }
    }

    // Log the verification response
    console.log('Payment verification response:', response.data);

    // Normalize gateway response: it may be an object (with Status) or a plain success string
    let normalizedStatus = null;
    let normalizedMessage = null;
    if (typeof response.data === 'string') {
      normalizedMessage = String(response.data).trim();
      // Heuristic: consider it success if it contains the Persian word for success ("موفق")
      if (/موفق/.test(normalizedMessage)) {
        normalizedStatus = 100;
      } else {
        normalizedStatus = 0; // unknown/failure
      }
    } else if (response.data && typeof response.data === 'object') {
      normalizedStatus = response.data.Status;
      normalizedMessage = response.data.Message || null;
    }

    // Process verification result once (success: Status 100 or 101)
    const isOk = normalizedStatus === 100 || normalizedStatus === 101;
    if (isOk) {
      let updatedPayment = null;
      if (paymentId) {
        // Update DB only if we know the numeric OnlinePayment.Id
        const pool = await getPool();
        const result = await pool.request()
          .input('Id', sql.BigInt, paymentId)
          .input('Status', sql.NVarChar(50), 'Completed')
          .input('GatewayRef', sql.NVarChar(100), refId)
          .input('GatewayAuthority', sql.NVarChar(100), saleOrderId)
          .input('PayedBit', sql.Bit, 1)
          .query(`
            UPDATE OnlinePayment
            SET 
              Status = @Status,
              GatewayRef = @GatewayRef,
              GatewayAuthority = @GatewayAuthority,
              PayedBit = @PayedBit,
              PaidAt = SYSUTCDATETIME()
            WHERE Id = @Id;
            SELECT * FROM OnlinePayment WHERE Id = @Id;
          `);
        updatedPayment = result.recordset[0] || null;
        
        // Initialize workflow after successful online payment
        if (updatedPayment) {
          const trackingNo = updatedPayment.TrackingNo;
          
          // Find the request associated with this tracking number
          const requestResult = await pool.request()
            .input('TrackingNo', sql.NVarChar(30), trackingNo)
            .query(`SELECT RequestID, SubmittedByUserId, Status, LicenseTypeId, TrackingNo FROM VehicleRequests WHERE TrackingNo = @TrackingNo`);
          
          if (requestResult.recordset.length > 0) {
            const requestId = requestResult.recordset[0].RequestID;
            const userId = requestResult.recordset[0].SubmittedByUserId;
            const requestStatus = requestResult.recordset[0].Status;
            const licenseTypeId = requestResult.recordset[0].LicenseTypeId;
            const trackingNoFromDB = requestResult.recordset[0].TrackingNo;
            
            // Check if this is an exploitation license
            // Format: 11YY-NNNN (YY = activity category code)
            const isExploitation = licenseTypeId === 68 || trackingNoFromDB?.startsWith('11');
            
            console.log(`🔍 Payment verification - checking workflow advancement:`);
            console.log(`   - RequestID: ${requestId}`);
            console.log(`   - LicenseTypeId: ${licenseTypeId}`);
            console.log(`   - TrackingNo: ${trackingNoFromDB}`);
            console.log(`   - isExploitation: ${isExploitation}`);
            console.log(`   - RequestStatus: ${requestStatus}`);
            
            // Check if workflow has been initialized
            // We check for any workflow steps, regardless of StepOrder
            const workflowCheck = await pool.request()
              .input('RequestID', sql.BigInt, requestId)
              .query(`SELECT COUNT(*) AS Count FROM RequestWorkflowSteps WHERE RequestID = @RequestID`);
            
            console.log(`   - Workflow steps count (total): ${workflowCheck.recordset[0].Count}`);
            
            // Only initialize workflow if it doesn't exist yet (no steps at all)
            if (workflowCheck.recordset[0].Count === 0) {
              console.log(`💳 Online payment verified for request ${requestId}, initializing workflow`);
              // Online payment - skip financial expert step
              await initializeWorkflow(requestId, userId, pool, 'online');
            } else if (requestStatus === 'AwaitingPayment') {
              // For licenses in AwaitingPayment status (exploitation and others), advance workflow to next step
              // SKIP the financial expert step if payment is online
              console.log(`💳 Online payment completed for request ${requestId} - advancing workflow from AwaitingPayment`);
              
              // Find the next step that is NOT the financial expert (کارشناس مالی)
              const nextStepResult = await pool.request()
                .input('RequestID', sql.BigInt, requestId)
                .query(`
                  SELECT TOP 1 Id, StepOrder, RoleName
                  FROM RequestWorkflowSteps
                  WHERE RequestID = @RequestID 
                    AND Status IN ('NotStarted', 'Waiting')
                    AND RoleName != N'کارشناس مالی'
                  ORDER BY StepOrder ASC
                `);
              
              if (nextStepResult.recordset.length > 0) {
                const nextStep = nextStepResult.recordset[0];
                
                console.log(`📌 Found next non-financial step: StepOrder ${nextStep.StepOrder}, RoleName: ${nextStep.RoleName}`);
                
                // Activate the next step
                await pool.request()
                  .input('Id', sql.BigInt, nextStep.Id)
                  .query(`
                    UPDATE RequestWorkflowSteps
                    SET Status = 'Pending'
                    WHERE Id = @Id
                  `);
                
                // Update request status from AwaitingPayment to InProgress
                await pool.request()
                  .input('RequestID', sql.BigInt, requestId)
                  .input('CurrentStepOrder', sql.Int, nextStep.StepOrder)
                  .query(`
                    UPDATE VehicleRequests
                    SET Status = 'InProgress', CurrentStepOrder = @CurrentStepOrder
                    WHERE RequestID = @RequestID
                  `);
                
                // Add to process history
                await pool.request()
                  .input('RequestID', sql.BigInt, requestId)
                  .input('ActionType', sql.NVarChar(50), 'PaymentCompleted')
                  .input('ActionByUserId', sql.Int, userId)
                  .input('ActionByUserName', sql.NVarChar(150), 'System')
                  .input('ActionByRole', sql.NVarChar(50), 'User')
                  .input('FromStatus', sql.NVarChar(50), 'AwaitingPayment')
                  .input('ToStatus', sql.NVarChar(50), 'InProgress')
                  .input('StepOrder', sql.Int, nextStep.StepOrder)
                  .input('Notes', sql.NVarChar(sql.MAX), `پرداخت آنلاین با موفقیت انجام شد - ارجاع به ${nextStep.RoleName}`)
                  .query(`
                    INSERT INTO RequestProcessHistory 
                    (RequestID, ActionType, ActionByUserId, ActionByUserName, ActionByRole, FromStatus, ToStatus, StepOrder, Notes)
                    VALUES (@RequestID, @ActionType, @ActionByUserId, @ActionByUserName, @ActionByRole, @FromStatus, @ToStatus, @StepOrder, @Notes)
                  `);
                
                console.log(`✅ Workflow advanced to Step ${nextStep.StepOrder} (${nextStep.RoleName}) after online payment, skipping financial expert`);
              } else {
                console.warn(`⚠️ No next non-financial step found for request ${requestId}`);
              }
            } else if (requestStatus === 'Pending' && workflowCheck.recordset[0].Count > 0) {
              // Workflow exists but not activated yet (Activity/Employment licenses)
              // Activate the first step after successful payment
              console.log(`💳 Online payment completed for request ${requestId} - activating first workflow step`);
              
              // Find the first step (should be non-financial for online payment)
              const firstStepResult = await pool.request()
                .input('RequestID', sql.BigInt, requestId)
                .query(`
                  SELECT TOP 1 Id, StepOrder, RoleName
                  FROM RequestWorkflowSteps
                  WHERE RequestID = @RequestID 
                    AND RoleName != N'کارشناس مالی'
                  ORDER BY StepOrder ASC
                `);
              
              if (firstStepResult.recordset.length > 0) {
                const firstStep = firstStepResult.recordset[0];
                
                console.log(`📌 Activating first non-financial step: StepOrder ${firstStep.StepOrder}, RoleName: ${firstStep.RoleName}`);
                
                // Activate the first step
                await pool.request()
                  .input('Id', sql.BigInt, firstStep.Id)
                  .query(`
                    UPDATE RequestWorkflowSteps
                    SET Status = 'Pending'
                    WHERE Id = @Id
                  `);
                
                // Update request status from Pending to InProgress
                await pool.request()
                  .input('RequestID', sql.BigInt, requestId)
                  .input('CurrentStepOrder', sql.Int, firstStep.StepOrder)
                  .query(`
                    UPDATE VehicleRequests
                    SET Status = 'InProgress', CurrentStepOrder = @CurrentStepOrder
                    WHERE RequestID = @RequestID
                  `);
                
                // Add to process history
                await pool.request()
                  .input('RequestID', sql.BigInt, requestId)
                  .input('ActionType', sql.NVarChar(50), 'PaymentCompleted')
                  .input('ActionByUserId', sql.Int, userId)
                  .input('ActionByUserName', sql.NVarChar(150), 'System')
                  .input('ActionByRole', sql.NVarChar(50), 'User')
                  .input('FromStatus', sql.NVarChar(50), 'Pending')
                  .input('ToStatus', sql.NVarChar(50), 'InProgress')
                  .input('StepOrder', sql.Int, firstStep.StepOrder)
                  .input('Notes', sql.NVarChar(sql.MAX), `پرداخت آنلاین با موفقیت انجام شد - ارجاع به ${firstStep.RoleName}`)
                  .query(`
                    INSERT INTO RequestProcessHistory 
                    (RequestID, ActionType, ActionByUserId, ActionByUserName, ActionByRole, FromStatus, ToStatus, StepOrder, Notes)
                    VALUES (@RequestID, @ActionType, @ActionByUserId, @ActionByUserName, @ActionByRole, @FromStatus, @ToStatus, @StepOrder, @Notes)
                  `);
                
                console.log(`✅ Workflow activated: Step ${firstStep.StepOrder} (${firstStep.RoleName}) is now active after online payment`);
              } else {
                console.warn(`⚠️ No non-financial step found for request ${requestId}`);
              }
            } else {
              console.log(`⚠️ Workflow already exists for request ${requestId}, skipping initialization`);
            }
          }
        }
      }
      return res.json({
        success: true,
        verified: true,
        status: response.data.Status,
        refId: refId,
        amount: updatedPayment?.Amount,
        paymentId: paymentId,
        orderId: orderId,
        transactionDate: updatedPayment?.PaidAt || new Date().toISOString(),
        message: 'پرداخت با موفقیت تایید شد',
        gatewayResponse: response.data
      });
    } else {
      const errorMessage = getGatewayError(response.data?.Status) || 'خطا در تایید پرداخت';
      if (paymentId) {
        try {
          const pool = await getPool();
          await pool.request()
            .input('Id', sql.BigInt, paymentId)
            .input('Status', sql.NVarChar(50), 'Failed')
            .input('Description', sql.NVarChar(sql.MAX), errorMessage)
            .query(`
              UPDATE OnlinePayment
              SET 
                Status = @Status,
                Description = @Description
              WHERE Id = @Id
            `);
        } catch (dbError) {
          console.error('Error updating payment status to failed:', dbError);
        }
      }
      return res.status(400).json({
        success: false,
        verified: false,
        message: normalizedMessage || errorMessage,
        status: normalizedStatus,
        paymentId: paymentId,
        orderId: orderId
      });
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    
    // Handle specific Axios errors
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Payment gateway verification error:', error.response.data);
      return res.status(502).json({
        success: false,
        verified: false,
        message: 'خطا در ارتباط با درگاه پرداخت برای تایید تراکنش',
        details: error.response.data || {}
      });
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response from payment gateway during verification');
      return res.status(504).json({
        success: false,
        verified: false,
        message: 'عدم پاسخگویی درگاه پرداخت در حین تایید تراکنش. لطفا مجددا تلاش نمایید.'
      });
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Payment verification setup error:', error.message);
      return res.status(500).json({
        success: false,
        verified: false,
        message: 'خطا در ارسال درخواست تایید پرداخت',
        details: error.message
      });
    }
  }
}
