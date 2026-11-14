import { getPool, sql } from '../lib/db.js';
import { initializeWorkflow } from './workflow.controller.js';
import { getPcPosPublicSettings, savePcPosSettings } from '../modules/pcpos/pcpos.config.js';
import { confirmPairing, inquiry, paymentInProgress, releaseStalePurchase, startPairing, startPurchase } from '../modules/pcpos/pcpos.service.js';
import { getLatestPurchaseByRequestId, getTransaction } from '../modules/pcpos/pcpos.store.js';

/**
 * Parse number from string (handles Persian/Arabic digits)
 */
function parseNumberLike(str) {
  if (str == null) return null;
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  const s = String(str)
    .split('').map(ch => {
      const pi = persianDigits.indexOf(ch);
      if (pi >= 0) return String(pi);
      const ai = arabicDigits.indexOf(ch);
      if (ai >= 0) return String(ai);
      return ch;
    }).join('')
    .replace(/[\s,]+/g, '')
    .replace(/٫/g, '.');
  const n = Number(s);
  return isNaN(n) ? null : n;
}

/**
 * Find matching tariff for a request based on license type, operation type, and vehicle capacity
 * Mirrors the logic in FinancialPayment.jsx lines 679-746
 */
async function findMatchingTariff(pool, requestDetails, vehicleCapacity) {
  try {
    const operationTypeName = requestDetails.OperationTypeName || '';
    const licenseTypeName = requestDetails.LicenseTypeName || '';
    
    // Determine target DocType from OperationTypeName (same as FinancialPayment.jsx)
    let targetDocType = '';
    if (operationTypeName.includes('تمدید اجباری')) {
      targetDocType = 'تمدید اجباری';
    } else if (operationTypeName.includes('تمدید')) {
      targetDocType = 'تمدید';
    } else {
      targetDocType = 'صدور';
    }

    // Fetch all tariffs
    const tariffResult = await pool.request().query(`
      SELECT t.Id, t.LicenseType, t.Amount, t.FromTon, t.ToTon,
             lt.Name AS DocTypeName
      FROM Tariffs t
      LEFT JOIN LookupValue lt ON t.DocTypeId = lt.Id
    `);

    if (!tariffResult.recordset.length) {
      console.warn('Kiosk: No tariffs found in database');
      return null;
    }

    // Find matching tariff
    const isEmploymentLicense = licenseTypeName.includes('اشتغال') || licenseTypeName === 'اشتغال';
    const isActivityLicense = licenseTypeName.includes('فعالیت') || licenseTypeName === 'فعالیت';

    for (const t of tariffResult.recordset) {
      const tariffDocTypeName = t.DocTypeName || '';
      if (tariffDocTypeName !== targetDocType) continue;

      const tariffLicenseType = (t.LicenseType || '').trim();
      const tariffIsEmployment = tariffLicenseType.includes('اشتغال');
      const tariffIsActivity = tariffLicenseType.includes('فعالیت');

      if (isEmploymentLicense && !tariffIsEmployment) continue;
      if (isActivityLicense && !tariffIsActivity) continue;

      const from = parseNumberLike(t.FromTon);
      const to = parseNumberLike(t.ToTon);
      const fromOk = (from == null) ? true : vehicleCapacity >= from;
      const toOk = (to == null) ? true : vehicleCapacity <= to;

      if (fromOk && toOk) {
        return {
          id: t.Id,
          amount: Number(t.Amount ?? 0),
          fromTon: from,
          toTon: to,
          licenseType: tariffLicenseType,
          docType: tariffDocTypeName
        };
      }
    }

    console.warn('Kiosk: No matching tariff found for:', { licenseTypeName, operationTypeName, vehicleCapacity });
    return null;
  } catch (e) {
    console.error('Kiosk: Error finding matching tariff:', e.message);
    return null;
  }
}

/**
 * Get vehicle capacity for a request
 */
async function getVehicleCapacity(pool, requestId) {
  try {
    const result = await pool.request()
      .input('RequestID', sql.BigInt, requestId)
      .query(`
        SELECT v.Capacity
        FROM VehicleRequests vr
        LEFT JOIN Vehicles v ON vr.VehicleID = v.VehicleID
        WHERE vr.RequestID = @RequestID
      `);
    
    if (result.recordset.length && result.recordset[0].Capacity) {
      return parseNumberLike(result.recordset[0].Capacity);
    }
    return null;
  } catch (e) {
    console.warn('Kiosk: Error getting vehicle capacity:', e.message);
    return null;
  }
}

function isValidNationalCode(code) {
  if (!/^\d{10}$/.test(code)) return false;
  const check = +code[9];
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += +code[i] * (10 - i);
  }
  sum %= 11;
  const checkDigit = sum < 2 ? sum : 11 - sum;
  return check === checkDigit;
}

async function getTrainingFee(pool) {
  try {
    const result = await pool.request().query(`
      SELECT TOP 1 lv.Code
      FROM LookupValue lv WITH (NOLOCK)
      INNER JOIN LookupCategory lc WITH (NOLOCK) ON lc.Id = lv.CategoryId
      WHERE lc.[Key] = N'OperatingLicenseTrainingFee'
        AND lv.IsActive = 1
      ORDER BY lv.Id
    `);
    return Number(result.recordset[0]?.Code) || 0;
  } catch (e) {
    console.warn('Kiosk training fee lookup skipped:', e.message);
    return 0;
  }
}

/**
 * Compute payable amount - mirrors FinancialPayment.jsx logic exactly
 * 
 * Three scenarios:
 * 1. Exploitation license (LicenseTypeId=68): OriginalAmount + trainingFee + VAT(10%)
 * 2. Other license with discount: FinalAmount + VAT(10%)
 * 3. Other license without discount: Tariff amount (by capacity) + VAT(10%)
 */
async function computePayableAmount(pool, row, trainingFee) {
    const isExploitation = Number(row.LicenseTypeId) === 68;
    const original = Number(row.OriginalAmount) || 0;
    const final = Number(row.FinalAmount) || 0;
    
    // Check if discount was applied (FinalAmount differs from OriginalAmount)
    const hasDiscount = final > 0 && original > 0 && final !== original;
    
    if (isExploitation) {
        // Scenario 1: Exploitation license
        // Mirrors FinancialPayment.jsx lines 490-558
        const base = original;
        const training = Number(trainingFee) || 0;
        const subtotal = base + training;
        const vat = Math.round(subtotal * 0.10);
        
        return {
            baseAmount: base,
            trainingFee: training,
            vatAmount: vat,
            payableAmount: subtotal + vat,
            calculationMethod: 'exploitation'
        };
    } else if (hasDiscount) {
        // Scenario 2: Discount applied - use stored FinalAmount
        // Mirrors FinancialPayment.jsx lines 586-639
        const base = final;
        const vat = Math.round(base * 0.10);
        
        return {
            baseAmount: base,
            trainingFee: 0,
            vatAmount: vat,
            payableAmount: base + vat,
            calculationMethod: 'stored_discount'
        };
    } else {
        // Scenario 3: No discount - calculate from tariff table
        // Mirrors FinancialPayment.jsx lines 642-793
        const capacity = await getVehicleCapacity(pool, row.RequestID);
        
        if (capacity == null) {
            // Fallback to OriginalAmount if vehicle capacity not found
            console.warn(`Kiosk: No vehicle capacity for request ${row.RequestID}, falling back to OriginalAmount`);
            const base = original;
            const vat = Math.round(base * 0.10);
            return {
                baseAmount: base,
                trainingFee: 0,
                vatAmount: vat,
                payableAmount: base + vat,
                calculationMethod: 'fallback_original'
            };
        }
        
        const tariff = await findMatchingTariff(pool, row, capacity);
        
        if (tariff && tariff.amount > 0) {
            const base = tariff.amount;
            const vat = Math.round(base * 0.10);
            
            return {
                baseAmount: base,
                trainingFee: 0,
                vatAmount: vat,
                payableAmount: base + vat,
                calculationMethod: 'tariff',
                tariffId: tariff.id,
                vehicleCapacity: capacity
            };
        } else {
            // Fallback to OriginalAmount if no matching tariff found
            console.warn(`Kiosk: No matching tariff for request ${row.RequestID}, falling back to OriginalAmount`);
            const base = original;
            const vat = Math.round(base * 0.10);
            return {
                baseAmount: base,
                trainingFee: 0,
                vatAmount: vat,
                payableAmount: base + vat,
                calculationMethod: 'fallback_original'
            };
        }
    }
}


/**
 * Public kiosk endpoint: unpaid inbox requests for a national code.
 * Mirrors UserInbox "my_request" + needsPayment rules.
 */
export async function getUnpaidByNationalCode(req, res, next) {
  try {
    const nationalCode = String(req.params.nationalCode || '').trim();

    if (!nationalCode) {
      return res.status(400).json({ message: 'کد ملی الزامی است' });
    }
    if (!isValidNationalCode(nationalCode)) {
      return res.status(400).json({ message: 'کد ملی معتبر نمی‌باشد' });
    }

    const pool = await getPool();

    const userResult = await pool.request()
      .input('NationalCode', sql.NVarChar(10), nationalCode)
      .query(`
        SELECT TOP 1 Id, FirstName, LastName, FullName, NationalCode
        FROM Users WITH (NOLOCK)
        WHERE NationalCode = @NationalCode AND IsActive = 1
      `);

    if (!userResult.recordset.length) {
      return res.json({
        nationalCode,
        userFound: false,
        items: [],
        totalPayable: 0,
        message: 'کاربری با این کد ملی یافت نشد'
      });
    }

    const user = userResult.recordset[0];
    const trainingFee = await getTrainingFee(pool);

    const unpaidResult = await pool.request()
      .input('UserId', sql.Int, user.Id)
      .query(`
        SELECT
          vr.RequestID,
          vr.TrackingNo,
          vr.Status AS RequestStatus,
          vr.LicenseTypeId,
          vr.OperationTypeId,
          vr.OriginalAmount,
          vr.FinalAmount,
          ISNULL(vr.CurrentStepOrder, 0) AS StepOrder,
          vr.CreatedAt AS RequestCreatedAt,
          lt.Name AS LicenseTypeName,
          ot.Name AS OperationTypeName
        FROM VehicleRequests vr WITH (NOLOCK)
        LEFT JOIN LookupValue lt WITH (NOLOCK) ON vr.LicenseTypeId = lt.Id
        LEFT JOIN LookupValue ot WITH (NOLOCK) ON vr.OperationTypeId = ot.Id
        WHERE vr.SubmittedByUserId = @UserId
          AND ISNULL(vr.Status, N'') NOT IN (N'Rejected', N'Cancelled', N'Completed')
          AND NOT EXISTS (
            SELECT 1 FROM OnlinePayment op WITH (NOLOCK)
            WHERE op.RequestID = vr.RequestID AND op.PayedBit = 1
          )
          AND NOT EXISTS (
            SELECT 1 FROM OfflinePayment ofp WITH (NOLOCK)
            WHERE ofp.RequestID = vr.RequestID
          )
          AND (
            vr.LicenseTypeId <> 68
            OR vr.Status = N'AwaitingPayment'
            OR ISNULL(vr.CurrentStepOrder, 0) >= 3
          )
        ORDER BY vr.CreatedAt DESC
      `);

    // Compute payable amounts asynchronously (may need tariff lookup)
    const items = [];
    for (const row of unpaidResult.recordset) {
      const amounts = await computePayableAmount(pool, row, trainingFee);
      items.push({
        requestId: row.RequestID,
        trackingNo: row.TrackingNo,
        requestStatus: row.RequestStatus,
        licenseTypeId: row.LicenseTypeId,
        licenseTypeName: row.LicenseTypeName || 'پروانه',
        operationTypeName: row.OperationTypeName || null,
        originalAmount: Number(row.OriginalAmount) || 0,
        finalAmount: Number(row.FinalAmount) || 0,
        ...amounts
      });
    }

    const totalPayable = items.reduce((sum, item) => sum + item.payableAmount, 0);

    return res.json({
      nationalCode,
      userFound: true,
      fullName: user.FullName || [user.FirstName, user.LastName].filter(Boolean).join(' ') || null,
      items,
      totalPayable,
      message: items.length
        ? null
        : 'پرونده پرداخت‌نشده‌ای در کارتابل شما وجود ندارد'
    });
  } catch (e) {
    console.error('Kiosk unpaid lookup error:', e);
    next(e);
  }
}

function posPayload(result, extra = {}) {
  return {
    outcome: result.outcome,
    message: result.message,
    responseCode: result.responseCode || '',
    amount: extra.amount ?? null,
    rrn: result.rrn || null,
    stan: result.stan || null,
    transactionId: result.transactionId || extra.transactionId || null,
    shouldInquiry: Boolean(result.shouldInquiry),
    shouldRetry: Boolean(result.shouldRetry),
    printFailed: Boolean(result.printFailed),
    needsPairing: Boolean(result.needsPairing),
    paid: Boolean(extra.paid)
  };
}

async function findKioskUser(pool, nationalCode) {
  const userResult = await pool.request()
    .input('NationalCode', sql.NVarChar(10), nationalCode)
    .query(`
      SELECT TOP 1 Id, FirstName, LastName, FullName, NationalCode
      FROM Users WITH (NOLOCK)
      WHERE NationalCode = @NationalCode AND IsActive = 1
    `);
  return userResult.recordset[0] || null;
}

async function findOwnedRequest(pool, userId, requestId) {
  const result = await pool.request()
    .input('UserId', sql.Int, userId)
    .input('RequestID', sql.BigInt, requestId)
    .query(`
      SELECT TOP 1
        vr.RequestID,
        vr.TrackingNo,
        vr.Status AS RequestStatus,
        vr.LicenseTypeId,
        vr.VehicleID,
        vr.OriginalAmount,
        vr.FinalAmount,
        vr.OperationTypeId,
        lt.Name AS LicenseTypeName,
        ot.Name AS OperationTypeName
      FROM VehicleRequests vr WITH (NOLOCK)
      LEFT JOIN LookupValue lt WITH (NOLOCK) ON vr.LicenseTypeId = lt.Id
      LEFT JOIN LookupValue ot WITH (NOLOCK) ON vr.OperationTypeId = ot.Id
      WHERE vr.RequestID = @RequestID
        AND vr.SubmittedByUserId = @UserId
    `);
  return result.recordset[0] || null;
}

async function findPayableRequest(pool, userId, requestId) {
  const result = await pool.request()
    .input('UserId', sql.Int, userId)
    .input('RequestID', sql.BigInt, requestId)
    .query(`
      SELECT TOP 1
        vr.RequestID,
        vr.TrackingNo,
        vr.Status AS RequestStatus,
        vr.LicenseTypeId,
        vr.VehicleID,
        vr.OriginalAmount,
        vr.FinalAmount,
        vr.OperationTypeId,
        ISNULL(vr.CurrentStepOrder, 0) AS StepOrder,
        lt.Name AS LicenseTypeName,
        ot.Name AS OperationTypeName
      FROM VehicleRequests vr WITH (NOLOCK)
      LEFT JOIN LookupValue lt WITH (NOLOCK) ON vr.LicenseTypeId = lt.Id
      LEFT JOIN LookupValue ot WITH (NOLOCK) ON vr.OperationTypeId = ot.Id
      WHERE vr.RequestID = @RequestID
        AND vr.SubmittedByUserId = @UserId
        AND ISNULL(vr.Status, N'') NOT IN (N'Rejected', N'Cancelled', N'Completed')
        AND NOT EXISTS (
          SELECT 1 FROM OnlinePayment op WITH (NOLOCK)
          WHERE op.RequestID = vr.RequestID AND op.PayedBit = 1
        )
        AND NOT EXISTS (
          SELECT 1 FROM OfflinePayment ofp WITH (NOLOCK)
          WHERE ofp.RequestID = vr.RequestID
        )
        AND (
          vr.LicenseTypeId <> 68
          OR vr.Status = N'AwaitingPayment'
          OR ISNULL(vr.CurrentStepOrder, 0) >= 3
        )
    `);
  return result.recordset[0] || null;
}

function invoiceNumberFor(row) {
  const tracking = String(row.TrackingNo || '').trim();
  if (/^[A-Za-z0-9_-]{1,30}$/.test(tracking)) return tracking;
  return String(row.RequestID);
}

async function activateWorkflowStep(pool, { requestId, userId, fromStatus, step }) {
  await pool.request()
    .input('Id', sql.BigInt, step.Id)
    .query(`UPDATE RequestWorkflowSteps SET Status = 'Pending' WHERE Id = @Id`);

  await pool.request()
    .input('RequestID', sql.BigInt, requestId)
    .input('CurrentStepOrder', sql.Int, step.StepOrder)
    .query(`
      UPDATE VehicleRequests
      SET Status = 'InProgress', CurrentStepOrder = @CurrentStepOrder
      WHERE RequestID = @RequestID
    `);

  await pool.request()
    .input('RequestID', sql.BigInt, requestId)
    .input('ActionType', sql.NVarChar(50), 'PaymentCompleted')
    .input('ActionByUserId', sql.Int, userId)
    .input('ActionByUserName', sql.NVarChar(150), 'System')
    .input('ActionByRole', sql.NVarChar(50), 'User')
    .input('FromStatus', sql.NVarChar(50), fromStatus)
    .input('ToStatus', sql.NVarChar(50), 'InProgress')
    .input('StepOrder', sql.Int, step.StepOrder)
    .input('Notes', sql.NVarChar(sql.MAX), `پرداخت با دستگاه پوز انجام شد - ارجاع به ${step.RoleName}`)
    .query(`
      INSERT INTO RequestProcessHistory
      (RequestID, ActionType, ActionByUserId, ActionByUserName, ActionByRole, FromStatus, ToStatus, StepOrder, Notes)
      VALUES (@RequestID, @ActionType, @ActionByUserId, @ActionByUserName, @ActionByRole, @FromStatus, @ToStatus, @StepOrder, @Notes)
    `);
}

async function advanceWorkflowAfterCardPayment(pool, request, userId) {
  const requestId = request.RequestID;
  const requestStatus = request.RequestStatus;
  const workflowCheck = await pool.request()
    .input('RequestID', sql.BigInt, requestId)
    .query(`SELECT COUNT(*) AS Count FROM RequestWorkflowSteps WHERE RequestID = @RequestID`);
  const stepCount = workflowCheck.recordset[0].Count;

  if (stepCount === 0) {
    await initializeWorkflow(requestId, userId, pool, 'online');
    return;
  }

  if (requestStatus === 'AwaitingPayment') {
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
    if (nextStepResult.recordset[0]) {
      await activateWorkflowStep(pool, {
        requestId,
        userId,
        fromStatus: 'AwaitingPayment',
        step: nextStepResult.recordset[0]
      });
    }
    return;
  }

  if (requestStatus === 'Pending') {
    const firstStepResult = await pool.request()
      .input('RequestID', sql.BigInt, requestId)
      .query(`
        SELECT TOP 1 Id, StepOrder, RoleName
        FROM RequestWorkflowSteps
        WHERE RequestID = @RequestID
          AND RoleName != N'کارشناس مالی'
        ORDER BY StepOrder ASC
      `);
    if (firstStepResult.recordset[0]) {
      await activateWorkflowStep(pool, {
        requestId,
        userId,
        fromStatus: 'Pending',
        step: firstStepResult.recordset[0]
      });
    }
  }
}

async function recordCardPayment(pool, { request, userId, amount, rrn, stan, responseCode }) {
  const existing = await pool.request()
    .input('RequestID', sql.BigInt, request.RequestID)
    .query(`
      SELECT
        (SELECT TOP 1 Id FROM OnlinePayment WHERE RequestID = @RequestID AND PayedBit = 1) AS OnlineId,
        (SELECT TOP 1 Id FROM OfflinePayment WHERE RequestID = @RequestID) AS OfflineId
    `);
  if (!existing.recordset[0]?.OnlineId && !existing.recordset[0]?.OfflineId) {
    await pool.request()
      .input('VehicleID', sql.BigInt, request.VehicleID ?? null)
      .input('TrackingNo', sql.NVarChar(30), String(request.TrackingNo || '').slice(0, 30))
      .input('Amount', sql.Int, amount)
      .input('CalculatedAmount', sql.BigInt, amount)
      .input('UserId', sql.BigInt, userId)
      .input('Description', sql.NVarChar(sql.MAX), `پرداخت با دستگاه پوز. کد پاسخ ${responseCode || '00'}`)
      .input('RequestID', sql.BigInt, request.RequestID)
      .input('GatewayAuthority', sql.NVarChar(100), stan ? String(stan).slice(0, 100) : null)
      .input('GatewayRef', sql.NVarChar(100), rrn ? String(rrn).slice(0, 100) : null)
      .query(`
        INSERT INTO OnlinePayment(
          VehicleID, TrackingNo, Amount, CalculatedAmount, UserId, PayedBit, Description,
          Status, RequestID, GatewayAuthority, GatewayRef, PaidAt
        )
        VALUES (
          @VehicleID, @TrackingNo, @Amount, @CalculatedAmount, @UserId, 1, @Description,
          N'Completed', @RequestID, @GatewayAuthority, @GatewayRef, SYSUTCDATETIME()
        )
      `);
  }
  try {
    await advanceWorkflowAfterCardPayment(pool, request, userId);
  } catch (error) {
    console.error('[kiosk-pos] payment recorded but workflow was not advanced:', error.message);
  }
}

function readNationalCode(value) {
  const nationalCode = String(value || '').trim();
  if (!isValidNationalCode(nationalCode)) {
    const error = new Error('کد ملی معتبر نمی‌باشد');
    error.status = 400;
    throw error;
  }
  return nationalCode;
}

export async function payKioskWithPos(req, res, next) {
  try {
    const nationalCode = readNationalCode(req.body?.nationalCode);
    const requestId = Number(req.body?.requestId);
    if (!Number.isSafeInteger(requestId) || requestId <= 0) {
      return res.status(400).json({ message: 'پرونده پرداخت نامعتبر است' });
    }

    const pool = await getPool();
    const user = await findKioskUser(pool, nationalCode);
    if (!user) return res.status(404).json({ message: 'کاربری با این کد ملی یافت نشد' });

    const request = await findPayableRequest(pool, user.Id, requestId);
    if (!request) return res.status(404).json({ message: 'این پرونده قابل پرداخت نیست' });

    const trainingFee = await getTrainingFee(pool);
    const amounts = await computePayableAmount(pool, request, trainingFee);
    const amount = Math.round(Number(amounts.payableAmount) || 0);
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 2147483647) {
      return res.status(400).json({ message: 'مبلغ قابل پرداخت برای ارسال به دستگاه معتبر نیست' });
    }

    const latest = await getLatestPurchaseByRequestId(request.RequestID);
    if (latest?.Outcome === 'success') {
      await recordCardPayment(pool, {
        request,
        userId: user.Id,
        amount,
        rrn: latest.Rrn,
        stan: latest.Stan,
        responseCode: latest.ResponseCode
      });
      return res.json(posPayload({
        outcome: 'success',
        message: 'این پرونده قبلاً با دستگاه پوز پرداخت شده است',
        responseCode: latest.ResponseCode,
        rrn: latest.Rrn,
        stan: latest.Stan,
        transactionId: latest.Id
      }, { amount, paid: true }));
    }
    if (latest && (latest.Outcome === 'unknown' || latest.Outcome === 'pending')) {
      if (paymentInProgress(request.RequestID)) {
        return res.json({
          outcome: 'pending',
          transactionId: latest.Id,
          message: 'مبلغ روی کارتخوان است. کارت را بکشید و رمز را وارد کنید.',
          shouldInquiry: false,
          shouldRetry: false,
          amount
        });
      }
      const stale = await releaseStalePurchase(latest);
      if (stale.active) {
        return res.json({
          message: 'پرداخت این پرونده همین حالا روی کارتخوان باز است. همان خرید را تمام یا لغو کنید',
          outcome: 'pending',
          shouldInquiry: false,
          shouldRetry: false,
          transactionId: latest.Id,
          amount
        });
      }
      if (stale.accepted) {
        return res.json({
          message: 'قفل این پرونده برداشته شد چون کارتخوان خریدی باز ندارد. اگر رسیدی چاپ نشده، یک بار دیگر پرداخت را بزنید.',
          outcome: 'failed',
          shouldInquiry: false,
          shouldRetry: true,
          transactionId: latest.Id,
          amount
        });
      }
    }

    const started = await startPurchase({
      amount,
      invoiceNumber: invoiceNumberFor(request),
      requestId: request.RequestID
    });
    if (!started.completion) {
      return res.json(posPayload(started.result, { amount, paid: false }));
    }
    res.json(posPayload(started.result, { amount, paid: false }));
    try {
      const result = await started.completion;
      if (result.outcome === 'success') {
        await recordCardPayment(pool, {
          request,
          userId: user.Id,
          amount,
          rrn: result.rrn,
          stan: result.stan,
          responseCode: result.responseCode
        });
      }
    } catch (error) {
      console.error('[kiosk-pos] purchase follow-up failed:', error);
    }
    return;
  } catch (error) {
    if (res.headersSent) {
      console.error('[kiosk-pos] purchase failed after response:', error);
      return;
    }
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error('[kiosk-pos] purchase failed:', error);
    next(error);
  }
}

export async function getKioskPosTransaction(req, res, next) {
  try {
    const nationalCode = readNationalCode(req.query?.nationalCode);
    const transactionId = Number(req.params.id);
    if (!Number.isSafeInteger(transactionId) || transactionId <= 0) {
      return res.status(400).json({ message: 'شناسه تراکنش نامعتبر است' });
    }
    const stored = await getTransaction(transactionId);
    if (!stored || stored.Kind !== 'purchase' || stored.RequestId == null) {
      return res.status(404).json({ message: 'تراکنش پوز پیدا نشد' });
    }
    const pool = await getPool();
    const user = await findKioskUser(pool, nationalCode);
    if (!user) return res.status(404).json({ message: 'کاربری با این کد ملی یافت نشد' });
    const request = await findOwnedRequest(pool, user.Id, stored.RequestId);
    if (!request) return res.status(404).json({ message: 'این تراکنش به پرونده شما تعلق ندارد' });

    if (stored.Outcome === 'pending') {
      return res.json({
        outcome: 'pending',
        transactionId: stored.Id,
        message: 'مبلغ روی کارتخوان است. کارت را بکشید و رمز را وارد کنید.',
        shouldInquiry: false,
        shouldRetry: false,
        amount: stored.Amount == null ? null : Number(stored.Amount)
      });
    }

    let paid = false;
    const amount = Math.round(Number(stored.Amount) || 0);
    if (stored.Outcome === 'success') {
      await recordCardPayment(pool, {
        request,
        userId: user.Id,
        amount,
        rrn: stored.Rrn,
        stan: stored.Stan,
        responseCode: stored.ResponseCode
      });
      paid = true;
    }
    return res.json({
      outcome: stored.Outcome,
      message: stored.Outcome === 'success'
        ? 'پرداخت با موفقیت انجام شد'
        : (stored.ErrorMessage || 'پرداخت انجام نشد'),
      responseCode: stored.ResponseCode || '',
      rrn: stored.Rrn || null,
      stan: stored.Stan || null,
      transactionId: stored.Id,
      shouldInquiry: stored.Outcome === 'unknown',
      shouldRetry: stored.Outcome === 'failed' || stored.Outcome === 'cancelled',
      printFailed: false,
      paid,
      amount
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    console.error('[kiosk-pos] status read failed:', error);
    next(error);
  }
}

export async function inquiryKioskPos(req, res, next) {
  try {
    const nationalCode = readNationalCode(req.body?.nationalCode);
    const transactionId = Number(req.body?.transactionId);
    if (!Number.isSafeInteger(transactionId) || transactionId <= 0) {
      return res.status(400).json({ message: 'شناسه تراکنش نامعتبر است' });
    }

    const stored = await getTransaction(transactionId);
    if (!stored || stored.Kind !== 'purchase' || stored.RequestId == null) {
      return res.status(404).json({ message: 'تراکنش پوز پیدا نشد' });
    }

    const pool = await getPool();
    const user = await findKioskUser(pool, nationalCode);
    if (!user) return res.status(404).json({ message: 'کاربری با این کد ملی یافت نشد' });
    const request = await findOwnedRequest(pool, user.Id, stored.RequestId);
    if (!request) {
      return res.status(404).json({ message: 'این تراکنش به پرونده شما تعلق ندارد' });
    }

    const result = await inquiry({ transactionId });
    let paid = false;
    const amount = Math.round(Number(stored.Amount) || 0);
    if (result.outcome === 'success') {
      await recordCardPayment(pool, {
        request,
        userId: user.Id,
        amount: amount > 0 ? amount : Math.round(Number(result.amount) || 0),
        rrn: result.rrn,
        stan: result.stan,
        responseCode: result.responseCode
      });
      paid = true;
    }
    return res.json(posPayload(result, { amount: amount || result.amount, paid }));
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error('[kiosk-pos] inquiry failed:', error);
    next(error);
  }
}

export async function getKioskPosSettings(_req, res) {
  res.json(getPcPosPublicSettings());
}

export async function saveKioskPosSettings(req, res) {
  try {
    const saved = savePcPosSettings({
      host: req.body?.host,
      port: req.body?.port,
    });
    res.json({
      ...saved,
      message: 'آدرس کارتخوان ذخیره شد. اگر دستگاه عوض شده، یک‌بار دیگر کد جفت‌سازی را وارد کنید.',
    });
  } catch (error) {
    res.status(error.status || 400).json({ message: error.message || 'ذخیرهٔ آدرس کارتخوان ناموفق بود' });
  }
}

export async function pairKioskPos(_req, res) {
  try {
    const result = await startPairing();
    res.status(result.ok ? 200 : 409).json(result);
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, message: error.message || 'جفت‌سازی شروع نشد' });
  }
}

export async function confirmKioskPos(req, res) {
  try {
    const result = await confirmPairing(req.body?.code);
    res.status(result.ok ? 200 : 400).json(result);
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, message: error.message || 'تأیید جفت‌سازی ناموفق بود' });
  }
}
