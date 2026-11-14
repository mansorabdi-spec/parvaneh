import { getPool, sql } from '../lib/db.js';
import { initializeWorkflow } from './workflow.controller.js';

// ---------------- Sequence Counter Helper -----------------
/**
 * Get next sequence number from SequenceCounters table
 * This ensures no duplicate tracking numbers even if records are deleted
 * Uses a single transaction with proper cleanup to prevent connection leaks
 */
async function getNextSequence(pool, counterType, prefix = 'DEFAULT') {
  const tx = new sql.Transaction(pool);
  
  try {
    await tx.begin();
    
    // Get current counter with row lock
    const result = await new sql.Request(tx)
      .input('CounterType', sql.NVarChar(50), counterType)
      .input('Prefix', sql.NVarChar(20), prefix)
      .query(`
        SELECT LastSequence 
        FROM SequenceCounters WITH (UPDLOCK, ROWLOCK)
        WHERE CounterType = @CounterType AND Prefix = @Prefix
      `);
    
    let lastSequence = 0;
    
    if (result.recordset && result.recordset.length > 0) {
      // Counter exists, increment it
      lastSequence = result.recordset[0].LastSequence;
      const nextSequence = lastSequence + 1;
      
      await new sql.Request(tx)
        .input('CounterType', sql.NVarChar(50), counterType)
        .input('Prefix', sql.NVarChar(20), prefix)
        .input('NextSequence', sql.Int, nextSequence)
        .query(`
          UPDATE SequenceCounters 
          SET LastSequence = @NextSequence, UpdatedAt = GETUTCDATE()
          WHERE CounterType = @CounterType AND Prefix = @Prefix
        `);
      
      await tx.commit();
      return nextSequence;
    } else {
      // Counter doesn't exist, create it with initial value
      let initialValue = 0;
      switch(counterType) {
        case 'Activity': initialValue = 30010; break;
        case 'Employment': initialValue = 10001; break;
        case 'Exploitation': initialValue = 1201; break;
        default: initialValue = 1;
      }
      
      await new sql.Request(tx)
        .input('CounterType', sql.NVarChar(50), counterType)
        .input('Prefix', sql.NVarChar(20), prefix)
        .input('InitialValue', sql.Int, initialValue)
        .query(`
          INSERT INTO SequenceCounters (CounterType, Prefix, LastSequence, UpdatedAt)
          VALUES (@CounterType, @Prefix, @InitialValue, GETUTCDATE())
        `);
      
      await tx.commit();
      return initialValue;
    }
  } catch (err) {
    // Always rollback on error to prevent connection leaks
    try {
      await tx.rollback();
    } catch (rollbackErr) {
      // Ignore rollback errors if transaction already completed
      if (rollbackErr.code !== 'EINVALIDSTATE') {
        console.error('[getNextSequence] Rollback error:', rollbackErr.message);
      }
    }
    throw err;
  }
}

const required = [
  'vehicleKindId','systemId','systemTipId','yearManufacture','capacity','fuelTypeId','trackerTypeId',
  'cylinders','axles','wheels','vin','chassisNo','engineNo','bodyColor','activityCategoryId','plateTypeId',
  'inspectionDate','greenCardDate','isContainer','insuranceCompanyId','insurancePolicyNo','insuranceIssueDate',
  'insuranceValidDate','techInspectSerial','techInspectIssueDate','techInspectValidDate'
];

function normalizeVehicle(body) {
  const v = body?.vehicle || body || {};
  return v;
}

// ---------------- Generate New Tracking Number -----------------
/**
 * Generate tracking number in format: 3XYY-NNNNN
 * 3 = fixed digit
 * X = vehicle type based on capacity (2, 3, or 4)
 * YY = activity category code from LookupValue
 * NNNNN = sequential number starting from 30010
 */
async function generateTrackingNumber(pool, vehicleId) {
  // Get vehicle capacity and activity category
  const vehicleResult = await pool.request()
    .input('VehicleID', sql.BigInt, vehicleId)
    .query(`
      SELECT 
        v.Capacity,
        v.ActivityCategoryId,
        lv.Code AS ActivityCategoryCode
      FROM Vehicles v
      LEFT JOIN LookupValue lv ON lv.Id = v.ActivityCategoryId
      WHERE v.VehicleID = @VehicleID
    `);
  
  if (!vehicleResult.recordset || vehicleResult.recordset.length === 0) {
    throw new Error('Vehicle not found');
  }
  
  const vehicle = vehicleResult.recordset[0];
  const capacityTon = parseFloat(vehicle.Capacity) || 0;
  const capacityKg = capacityTon * 1000; // Convert ton to kg
  const activityCode = vehicle.ActivityCategoryCode || '00';
  
// Determine vehicle type based on capacity (in kg)
let vehicleType;
if (capacityKg >= 0 && capacityKg <= 499) {
  vehicleType = '1';
} else if (capacityKg >= 500 && capacityKg <= 3500) {
  vehicleType = '2';
} else if (capacityKg >= 3501 && capacityKg <= 6000) {
  vehicleType = '3';
} else if (capacityKg >= 6001 && capacityKg <= 100000) {
  vehicleType = '4';
} else {
  vehicleType = '4'; // Default to 2 if out of range
}
  
  // Pad activity code to ensure it's always 2 digits
  const paddedActivityCode = activityCode.toString().padStart(2, '0');
  
  // Build the prefix for this vehicle type and activity
  const prefix = `3${vehicleType}${paddedActivityCode}`;
  
  // Get the next sequential number from SequenceCounters table
  // This prevents duplicate numbers even if records are deleted
  const sequentialNumber = await getNextSequence(pool, 'Activity', prefix);
  
  // Format: 3XYY-NNNNN
  const trackingNo = `${prefix}-${sequentialNumber.toString().padStart(5, '0')}`;
  
  console.log(`Generated tracking number: ${trackingNo} (Capacity: ${capacityKg}kg, Type: ${vehicleType}, Activity: ${paddedActivityCode}, Seq: ${sequentialNumber})`);
  
  return trackingNo;
}

// ---------------- Check Pending Request by VIN -----------------
export async function checkPendingRequestByVin(req, res, next) {
  try {
    const vin = String(req.params.vin || '').trim();
    const licenseType = String(req.query.licenseType || '').trim(); // 'Activity', 'Employment', 'Exploitation'
    const currentNationalCode = String(req.user?.nationalCode || '').trim();
    if (!vin) return res.status(400).json({ message: 'Missing VIN' });
    if (!currentNationalCode) return res.status(401).json({ message: 'UNAUTHORIZED' });

    const pool = await getPool();
    
    // Determine LicenseTypeId based on licenseType parameter
    let licenseTypeId = null;
    if (licenseType === 'Employment') {
      licenseTypeId = 67; // Employment license
    } else if (licenseType === 'Exploitation') {
      licenseTypeId = 68; // Exploitation license
    } else if (licenseType === 'Activity') {
      // Activity licenses don't have a specific LicenseTypeId (or it varies)
      // We'll check by tracking number pattern instead
    }
    
    // Check unfinished requests for THIS user, VIN, and LICENSE TYPE
    let pendingQuery = `
      SELECT TOP 1 
        vr.RequestID, vr.TrackingNo, vr.Status, vr.CreatedAt, vr.LicenseTypeId,
        lv.Name AS LicenseTypeName
      FROM VehicleRequests vr
      INNER JOIN Vehicles v ON v.VehicleID = vr.VehicleID
      LEFT JOIN LookupValue lv ON lv.Id = vr.LicenseTypeId
      WHERE v.VIN = @VIN 
        AND LTRIM(RTRIM(v.RegistrarNationalCode)) = LTRIM(RTRIM(@RegistrarNationalCode))
        AND vr.Status IN ('Pending', 'InProgress')
    `;
    
    // Add license type filter
    if (licenseType === 'Employment') {
      pendingQuery += ` AND (vr.LicenseTypeId = 67 OR vr.TrackingNo LIKE '2%')`;
    } else if (licenseType === 'Exploitation') {
      pendingQuery += ` AND (vr.LicenseTypeId = 68 OR vr.TrackingNo LIKE '11%')`;
    } else if (licenseType === 'Activity') {
      pendingQuery += ` AND (vr.LicenseTypeId IS NULL OR vr.LicenseTypeId NOT IN (67, 68)) AND vr.TrackingNo LIKE '3%'`;
    }
    
    pendingQuery += ` ORDER BY vr.CreatedAt DESC`;
    
    const resultPending = await pool.request()
      .input('VIN', sql.NVarChar(50), vin)
      .input('RegistrarNationalCode', sql.NVarChar(100), currentNationalCode)
      .query(pendingQuery);

    // Check existing licenses for THIS user, VIN, and LICENSE TYPE
    let existingQuery = `
      SELECT TOP 1 
        vr.RequestID, vr.TrackingNo, vr.Status, vr.CreatedAt, vr.LicenseTypeId,
        lv.Name AS LicenseTypeName
      FROM VehicleRequests vr
      INNER JOIN Vehicles v ON v.VehicleID = vr.VehicleID
      LEFT JOIN LookupValue lv ON lv.Id = vr.LicenseTypeId
      WHERE v.VIN = @VIN 
        AND LTRIM(RTRIM(v.RegistrarNationalCode)) = LTRIM(RTRIM(@RegistrarNationalCode))
        AND vr.Status IN ('Approved', 'Completed')
    `;
    
    // Add license type filter
    if (licenseType === 'Employment') {
      existingQuery += ` AND (vr.LicenseTypeId = 67 OR vr.TrackingNo LIKE '2%')`;
    } else if (licenseType === 'Exploitation') {
      existingQuery += ` AND (vr.LicenseTypeId = 68 OR vr.TrackingNo LIKE '11%')`;
    } else if (licenseType === 'Activity') {
      existingQuery += ` AND (vr.LicenseTypeId IS NULL OR vr.LicenseTypeId NOT IN (67, 68)) AND vr.TrackingNo LIKE '3%'`;
    }
    
    existingQuery += ` ORDER BY vr.CreatedAt DESC`;
    
    const resultExisting = await pool.request()
      .input('VIN', sql.NVarChar(50), vin)
      .input('RegistrarNationalCode', sql.NVarChar(100), currentNationalCode)
      .query(existingQuery);

    const pendingRequest = resultPending.recordset?.[0];
    const existingLicense = resultExisting.recordset?.[0];
    
    if (pendingRequest) {
      return res.json({ 
        hasPending: true, 
        request: {
          requestId: pendingRequest.RequestID,
          trackingNo: pendingRequest.TrackingNo,
          status: pendingRequest.Status,
          licenseType: pendingRequest.LicenseTypeName || 'پروانه فعالیت',
          createdAt: pendingRequest.CreatedAt
        }
      });
    }
    if (existingLicense) {
      return res.json({
        hasPending: false,
        hasExistingLicense: true,
        request: {
          requestId: existingLicense.RequestID,
          trackingNo: existingLicense.TrackingNo,
          status: existingLicense.Status,
          licenseType: existingLicense.LicenseTypeName || 'پروانه فعالیت',
          createdAt: existingLicense.CreatedAt
        }
      });
    }

    return res.json({ hasPending: false, hasExistingLicense: false });
  } catch (e) { 
    next(e); 
  }
}

// ---------------- Check VIN Registration -----------------
// Check if VIN is already registered with a different national code
export async function checkVinRegistration(req, res, next) {
  try {
    const vin = String(req.params.vin || '').trim();
    const currentNationalCode = String(req.user?.nationalCode || '').trim();
    const ownershipType = String(req.query.ownershipType || 'حقیقی').trim(); // حقیقی or حقوقی
    const companyNationalId = String(req.query.companyNationalId || '').trim(); // NationalId شرکت (در سیستم شما این همان کد ملی است)
    
    if (!vin) return res.status(400).json({ message: 'Missing VIN' });
    if (!currentNationalCode) return res.status(401).json({ message: 'UNAUTHORIZED' });

    const pool = await getPool();
    
    // For legal entities (حقوقی), check against company's NationalId (which is the company's national code in your system)
    // For individuals (حقیقی), check against person's national code
    let checkNationalCode = currentNationalCode;
    
    if (ownershipType === 'حقوقی' && companyNationalId) {
      // For legal entities, use company's NationalId (در سیستم شما NationalId = کد ملی شرکت)
      checkNationalCode = companyNationalId;
      console.log('🏢 Checking VIN for legal entity:', { vin, companyNationalId, checkNationalCode });
    } else {
      console.log('👤 Checking VIN for individual:', { vin, currentNationalCode });
    }
    
    // Check if this VIN is registered with a different national code
    const result = await pool.request()
      .input('VIN', sql.NVarChar(50), vin)
      .input('CheckNationalCode', sql.NVarChar(100), checkNationalCode)
      .query(`
        SELECT TOP 1 
          VehicleID,
          RegistrarNationalCode,
          VIN
        FROM Vehicles
        WHERE VIN = @VIN 
          AND LTRIM(RTRIM(RegistrarNationalCode)) != LTRIM(RTRIM(@CheckNationalCode))
      `);

    if (result.recordset && result.recordset.length > 0) {
      const registeredTo = result.recordset[0].RegistrarNationalCode;
      console.log('❌ VIN already registered to:', registeredTo);
      return res.json({
        isRegisteredToOther: true,
        message: 'این VIN با کد ملی دیگری ثبت شده است، اجازه ادامه با این VIN را ندارید، با پشتیبانی تماس بگیرید'
      });
    }

    console.log('✅ VIN is available');
    return res.json({ isRegisteredToOther: false });
  } catch (e) { next(e); }
}

// ---------------- Renew Exploitation License Request -----------------
export async function renewExploitationRequest(req, res, next) {
  try {
    const nationalId = String(req.body?.nationalId || '').trim();
    const registrationNo = String(req.body?.registrationNo || '').trim();
    const existingTrackingNo = String(req.body?.existingTrackingNo || '').trim();
    const isRenewal = req.body?.isRenewal || false;
    const finalDescription = String(req.body?.finalDescription || '').trim() || null;
    
    if (!nationalId) return res.status(400).json({ message: 'شناسه ملی شرکت الزامی است' });
    
    const pool = await getPool();
    const userId = req.user?.id || null;
    
    console.log('=== renewExploitationRequest ===');
    console.log('nationalId:', nationalId);
    console.log('registrationNo:', registrationNo);
    console.log('existingTrackingNo:', existingTrackingNo);
    console.log('isRenewal:', isRenewal);
    console.log('=============================');
    
    // Get existing company by national ID
    const companyResult = await pool.request()
      .input('NationalId', sql.NVarChar(100), nationalId)
      .query(`
        SELECT TOP 1 ci.CompanyName, ci.RegistrationNo, ci.NationalCode, ci.ManagerNationalCode,
               ci.CompanyTypeId, ci.ActivityFieldId, ci.TonnageRateId
        FROM CompanyInfo ci
        WHERE LTRIM(RTRIM(ci.NationalId)) = LTRIM(RTRIM(@NationalId))
      `);
    
    if (!companyResult.recordset || companyResult.recordset.length === 0) {
      return res.status(404).json({ message: 'شرکت مورد نظر یافت نشد' });
    }
    
    const company = companyResult.recordset[0];
    const managerNationalCode = String(company.ManagerNationalCode || company.NationalCode || '').trim();
    if (!managerNationalCode) {
      return res.status(400).json({ 
        message: 'کد ملی مدیر شرکت یافت نشد. لطفاً ابتدا مشخصات مدیر شرکت را تکمیل کنید.' 
      });
    }

    // Renew the license identified by the page's tracking number.
    // Fall back to the latest approved exploitation license of this company.
    const sourceResult = await pool.request()
      .input('CompanyNationalId', sql.NVarChar(100), nationalId)
      .input('TrackingNo', sql.NVarChar(30), existingTrackingNo || null)
      .query(`
        SELECT TOP 1
          r.RequestID, r.TrackingNo, r.Status,
          r.TonnageFromTon, r.TonnageToTon, r.FinalAmount, r.OriginalAmount
        FROM VehicleRequests r
        WHERE LTRIM(RTRIM(r.CompanyNationalId)) = LTRIM(RTRIM(@CompanyNationalId))
          AND (r.LicenseTypeId = 68 OR r.TrackingNo LIKE N'11%')
          AND r.Status IN (N'Approved', N'Completed')
          AND (
            @TrackingNo IS NULL
            OR LTRIM(RTRIM(r.TrackingNo)) = LTRIM(RTRIM(@TrackingNo))
          )
        ORDER BY
          CASE
            WHEN @TrackingNo IS NOT NULL AND LTRIM(RTRIM(r.TrackingNo)) = LTRIM(RTRIM(@TrackingNo)) THEN 0
            ELSE 1
          END,
          r.CreatedAt DESC
      `);
    
    if (sourceResult.recordset.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'پروانه بهره‌برداری معتبر برای تمدید یافت نشد'
      });
    }
    
    const source = sourceResult.recordset[0];
    const trackingNo = source.TrackingNo;
    console.log(`🔄 Renewing exploitation license ${trackingNo} from request ${source.RequestID}`);
    
    const duplicateCheck = await pool.request()
      .input('CompanyNationalId', sql.NVarChar(100), nationalId)
      .input('TrackingNo', sql.NVarChar(30), trackingNo)
      .query(`
        SELECT TOP 1 r.RequestID, r.TrackingNo, r.Status
        FROM VehicleRequests r
        WHERE LTRIM(RTRIM(r.CompanyNationalId)) = LTRIM(RTRIM(@CompanyNationalId))
          AND LTRIM(RTRIM(r.TrackingNo)) = LTRIM(RTRIM(@TrackingNo))
          AND (r.LicenseTypeId = 68 OR r.TrackingNo LIKE N'11%')
          AND r.Status IN (N'Pending', N'InProgress')
      `);

    if (duplicateCheck.recordset.length > 0) {
      const existing = duplicateCheck.recordset[0];
      console.log(`❌ Open exploitation renewal found: RequestID=${existing.RequestID}, Status=${existing.Status}`);
      return res.status(400).json({ 
        success: false,
        message: `برای این پروانه یک درخواست تمدید باز وجود دارد.\nشماره پیگیری: ${existing.TrackingNo}`,
        trackingNo: existing.TrackingNo,
        requestId: existing.RequestID,
        status: existing.Status
      });
    }

    const renewalTypeResult = await pool.request()
      .query(`SELECT TOP 1 Id FROM LookupValue WHERE Name = N'تمدید' ORDER BY Id`);
    const renewalOperationTypeId = renewalTypeResult.recordset[0]?.Id || 45;

    const fromTon = source.TonnageFromTon == null ? null : Number(source.TonnageFromTon);
    const toTon = source.TonnageToTon == null ? null : Number(source.TonnageToTon);
    let tariffAmount = Number(source.FinalAmount || source.OriginalAmount || 0);
    if (fromTon != null && !Number.isNaN(fromTon)) {
      const tariffResult = await pool.request()
        .input('LicenseType', sql.NVarChar(50), 'پروانه بهره برداری')
        .input('DocTypeId', sql.Int, renewalOperationTypeId)
        .input('FromTon', sql.Float, fromTon)
        .query(`
          SELECT TOP 1 Amount
          FROM Tariffs
          WHERE LicenseType = @LicenseType
            AND DocTypeId = @DocTypeId
            AND CAST(FromTon AS FLOAT) <= @FromTon
            AND CAST(ToTon AS FLOAT) >= @FromTon
          ORDER BY CAST(FromTon AS FLOAT) DESC
        `);
      if (tariffResult.recordset[0]?.Amount != null) {
        tariffAmount = Number(tariffResult.recordset[0].Amount);
      }
    }
    
    console.log(`📝 Exploitation renewal: manager=${managerNationalCode}, tracking=${trackingNo}, operation=${renewalOperationTypeId}, amount=${tariffAmount}`);
    
    const r = await pool.request()
      .input('NationalCode', sql.NVarChar(20), managerNationalCode)
      .input('CompanyNationalId', sql.NVarChar(100), nationalId)
      .input('LicenseTypeId', sql.Int, 68)
      .input('OperationTypeId', sql.Int, renewalOperationTypeId)
      .input('FinalDescription', sql.NVarChar(2000), finalDescription)
      .input('TrackingNo', sql.NVarChar(30), trackingNo)
      .input('SubmittedByUserId', sql.Int, userId)
      .input('OriginalAmount', sql.Decimal(18, 2), tariffAmount || 0)
      .input('FinalAmount', sql.Decimal(18, 2), tariffAmount || 0)
      .input('TonnageFromTon', sql.Float, fromTon)
      .input('TonnageToTon', sql.Float, toTon)
      .query(`
        INSERT INTO VehicleRequests (
          NationalCode, CompanyNationalId, LicenseTypeId, OperationTypeId, 
          FinalDescription, TrackingNo, SubmittedByUserId,
          OriginalAmount, FinalAmount, TonnageFromTon, TonnageToTon
        ) OUTPUT INSERTED.RequestID, INSERTED.TrackingNo
        VALUES (
          @NationalCode, @CompanyNationalId, @LicenseTypeId, @OperationTypeId,
          @FinalDescription, @TrackingNo, @SubmittedByUserId,
          @OriginalAmount, @FinalAmount, @TonnageFromTon, @TonnageToTon
        )
      `);
    
    const row = r.recordset?.[0];
    
    if (row?.RequestID) {
      console.log(`✅ Exploitation renewal request created: RequestID=${row.RequestID}, TrackingNo=${row.TrackingNo}`);
      
      let flowResult = await pool.request()
        .input('LicenseType', sql.NVarChar(30), 'Exploitation_Renewal')
        .query('SELECT StepOrder, RoleName FROM GlobalApprovalFlowSteps WHERE LicenseType = @LicenseType ORDER BY StepOrder');

      if (!flowResult.recordset?.length) {
        flowResult = await pool.request()
          .input('LicenseType', sql.NVarChar(30), 'Exploitation')
          .query('SELECT StepOrder, RoleName FROM GlobalApprovalFlowSteps WHERE LicenseType = @LicenseType ORDER BY StepOrder');
      }
      
      if (flowResult.recordset && flowResult.recordset.length > 0) {
        const firstStepOrder = Math.min(...flowResult.recordset.map(step => Number(step.StepOrder)))
        for (const step of flowResult.recordset) {
          const stepStatus = Number(step.StepOrder) === firstStepOrder ? 'Pending' : 'NotStarted'
          await pool.request()
            .input('RequestID', sql.BigInt, row.RequestID)
            .input('StepOrder', sql.Int, step.StepOrder)
            .input('RoleName', sql.NVarChar(50), step.RoleName)
            .input('Status', sql.NVarChar(20), stepStatus)
            .input('Notes', sql.NVarChar(2000), null)
            .query(`
              INSERT INTO RequestWorkflowSteps (RequestID, StepOrder, RoleName, Status, Notes, CreatedAt)
              VALUES (@RequestID, @StepOrder, @RoleName, @Status, @Notes, GETDATE())
            `);
        }
        
        await pool.request()
          .input('RequestID', sql.BigInt, row.RequestID)
          .input('Status', sql.NVarChar(20), 'InProgress')
          .input('CurrentStepOrder', sql.Int, firstStepOrder)
          .query(`
            UPDATE VehicleRequests 
            SET Status = @Status, CurrentStepOrder = @CurrentStepOrder
            WHERE RequestID = @RequestID
          `);
        
        console.log(`✅ Exploitation renewal workflow started at step ${firstStepOrder} for request ${row.RequestID}`);
      }
    }
    
    return res.status(201).json({ 
      requestId: row?.RequestID, 
      trackingNo: row?.TrackingNo
    });
  } catch (e) { next(e); }
}

// ---------------- Finalize Request -----------------
export async function createVehicleRequest(req, res, next) {
  try {
    const vehicleId = Number(req.params.vehicleId);
    const licenseTypeId = Number(req.body?.licenseTypeId);
    const operationTypeId = Number(req.body?.operationTypeId);
    const finalDescription = String(req.body?.finalDescription || '').trim() || null;
    const ownershipType = req.body?.ownershipType || 'حقیقی'; // 'حقیقی' (individual) or 'حقوقی' (legal entity)
    
    if (!vehicleId) return res.status(400).json({ message: 'Missing vehicleId' });
    if (!licenseTypeId) return res.status(400).json({ message: 'Missing licenseTypeId' });
    if (!operationTypeId) return res.status(400).json({ message: 'Missing operationTypeId' });

    const pool = await getPool();
    const userId = req.user?.id || null;
    
    // Get vehicle info to retrieve the registrar's national code
    const vehicleResult = await pool.request()
      .input('VehicleID', sql.BigInt, vehicleId)
      .query('SELECT RegistrarNationalCode FROM Vehicles WHERE VehicleID = @VehicleID');
    
    if (!vehicleResult.recordset || vehicleResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }
    
    let nationalCode = vehicleResult.recordset[0].RegistrarNationalCode;
    
    if (!nationalCode) {
      return res.status(400).json({ message: 'Vehicle must have a registrar national code' });
    }
    
    // Check data based on ownership type
    let companyNationalId = null;
    
    if (ownershipType === 'حقوقی') {
      // Legal entity (company) request
      // For legal entity licenses, we use CompanyNationalId field (which points to CompanyInfo.NationalId)
      // The RegistrarNationalCode in Vehicles table contains the company's NationalId (شناسه ملی)
      const companyResult = await pool.request()
        .input('NationalId', sql.NVarChar(100), nationalCode)
        .query('SELECT NationalId, NationalCode FROM CompanyInfo WHERE NationalId = @NationalId');
      
      if (!companyResult.recordset || companyResult.recordset.length === 0) {
        return res.status(400).json({ 
          message: 'اطلاعات شرکت یافت نشد. لطفاً ابتدا مرحله مشخصات شرکت را تکمیل کنید.',
          missingNationalId: nationalCode
        });
      }
      
      const companyNationalId_value = companyResult.recordset[0].NationalId;
      const managerNationalCode = companyResult.recordset[0].NationalCode;
      
      if (!managerNationalCode) {
        return res.status(400).json({ 
          message: 'کد ملی مدیر شرکت یافت نشد. لطفاً مشخصات مدیر را تکمیل کنید.'
        });
      }
      
      console.log(`🏢 Company found: NationalId=${companyNationalId_value}, Manager NationalCode=${managerNationalCode}`);
      
      // For legal entity activity licenses:
      // - VehicleRequests.CompanyNationalId = company's NationalId (شناسه ملی - 11 digits)
      // - VehicleRequests.NationalCode = NULL (this field is for Persons table FK, not used for companies)
      // This way, the system will find the correct company when editing the request
      companyNationalId = companyNationalId_value; // Store company's شناسه ملی in CompanyNationalId field
      nationalCode = null; // Set to NULL since this FK points to Persons table
    } else {
      // Individual request - check Persons table (required by foreign key constraint)
      const personCheck = await pool.request()
        .input('NationalCode', sql.NVarChar(20), nationalCode)
        .query('SELECT NationalCode FROM Persons WHERE NationalCode = @NationalCode');
      
      if (!personCheck.recordset || personCheck.recordset.length === 0) {
        return res.status(400).json({ 
          message: 'اطلاعات شخصی یافت نشد. لطفاً ابتدا مرحله مشخصات شخضی را تکمیل کنید.',
          missingNationalCode: nationalCode
        });
      }
    }
    
    // Generate new format tracking number: 3XYY-NNNNN
    const trackingNo = await generateTrackingNumber(pool, vehicleId);
    
    // Debug logging
    console.log('=== createVehicleRequest Debug ===');
    console.log('req.user:', req.user);
    console.log('userId:', userId);
    console.log('ownershipType:', ownershipType);
    console.log('nationalCode:', nationalCode);
    console.log('companyNationalId:', companyNationalId);
    console.log('isCompany:', ownershipType === 'حقوقی');
    console.log('vehicleId:', vehicleId);
    console.log('licenseTypeId:', licenseTypeId);
    console.log('operationTypeId:', operationTypeId);
    console.log('==================================');
    
    // Check if vehicle has discount documents
    const discountDocsCheck = await pool.request()
      .input('VehicleID', sql.BigInt, vehicleId)
      .query(`SELECT COUNT(*) AS Count FROM VehicleDiscountDocuments WHERE VehicleID = @VehicleID`);
    
    const hasDiscountDocs = discountDocsCheck.recordset[0].Count > 0;
    
    // Get vehicle details for tariff calculation
    const vehicleResult2 = await pool.request()
      .input('VehicleID', sql.BigInt, vehicleId)
      .query(`
        SELECT v.*, lv1.Name AS VehicleKindName, lv2.Name AS ActivityCategoryName
        FROM Vehicles v
        LEFT JOIN LookupValue lv1 ON lv1.Id = v.VehicleKindId
        LEFT JOIN LookupValue lv2 ON lv2.Id = v.ActivityCategoryId
        WHERE v.VehicleID = @VehicleID
      `);
    
    const vehicleData = vehicleResult2.recordset[0];
    const capacityTon = parseFloat(vehicleData?.Capacity) || 0;
    
    // Get the operation type name to determine the correct DocTypeId
    const opTypeResult = await pool.request()
      .input('OperationTypeId', sql.Int, operationTypeId)
      .query(`SELECT TOP 1 Id, Name FROM LookupValue WHERE Id = @OperationTypeId`);
    const operationTypeName = opTypeResult.recordset[0]?.Name || '';
    
    // Determine DocTypeId based on operation type
    let docTypeId;
    if (operationTypeName === 'تمدید اجباری') {
      docTypeId = operationTypeId; // Use the operationTypeId directly as DocTypeId for compulsory renewal
    } else if (operationTypeName === 'تمدید') {
      // Get normal renewal DocTypeId
      const renewalResult = await pool.request()
        .query(`SELECT TOP 1 Id FROM LookupValue WHERE Name = N'تمدید'`);
      docTypeId = renewalResult.recordset[0]?.Id || 45;
    } else {
      // For 'صدور' (issuance), use the operationTypeId directly
      docTypeId = operationTypeId;
    }
    
    console.log(`💰 Looking up tariff: LicenseType='پروانه فعالیت', DocTypeId=${docTypeId} (operation: ${operationTypeName}), CapacityTon=${capacityTon}`);
    
    // Get tariff amount based on LicenseType, DocType (operation type), and vehicle capacity/tonnage
    const tariffResult = await pool.request()
      .input('LicenseType', sql.NVarChar(200), 'پروانه فعالیت')
      .input('DocTypeId', sql.Int, docTypeId)
      .input('CapacityTon', sql.Float, capacityTon)
      .query(`
        SELECT TOP 1 Id, Amount, FromTon, ToTon
        FROM Tariffs
        WHERE LicenseType = @LicenseType
          AND DocTypeId = @DocTypeId
          AND CAST(FromTon AS FLOAT) <= @CapacityTon
          AND CAST(ToTon AS FLOAT) >= @CapacityTon
        ORDER BY CAST(FromTon AS FLOAT) DESC
      `);
    
    let tariffAmount = 0;
    if (tariffResult.recordset && tariffResult.recordset.length > 0) {
      tariffAmount = tariffResult.recordset[0]?.Amount || 0;
      const tariffFromTon = tariffResult.recordset[0]?.FromTon;
      const tariffToTon = tariffResult.recordset[0]?.ToTon;
      console.log(`💰 Tariff found: Amount=${tariffAmount}, Range=${tariffFromTon}-${tariffToTon} for capacity ${capacityTon} tons`);
    } else {
      // Fallback: try to find any tariff for the license type and doc type
      console.warn(`⚠️ No exact tariff found for capacity ${capacityTon} tons, trying fallback...`);
      const fallbackResult = await pool.request()
        .input('LicenseType', sql.NVarChar(200), 'پروانه فعالیت')
        .input('DocTypeId', sql.Int, docTypeId)
        .query(`
          SELECT TOP 1 Id, Amount, FromTon, ToTon
          FROM Tariffs
          WHERE LicenseType = @LicenseType
            AND DocTypeId = @DocTypeId
          ORDER BY Id DESC
        `);
      
      if (fallbackResult.recordset && fallbackResult.recordset.length > 0) {
        tariffAmount = fallbackResult.recordset[0]?.Amount || 0;
        console.log(`💰 Fallback tariff found: Amount=${tariffAmount}`);
      } else {
        // Default 1M if no tariff found
        tariffAmount = 1000000;
        console.warn(`⚠️ No tariff found at all, using default: ${tariffAmount}`);
      }
    }
    
    // Set discount status based on whether discount documents exist
    const discountStatus = hasDiscountDocs ? 'Pending' : 'None';
    
    console.log(`📝 Creating request for vehicle ${vehicleId}: NationalCode=${nationalCode}, CompanyNationalId=${companyNationalId}, hasDiscountDocs=${hasDiscountDocs}, discountStatus=${discountStatus}, tariffAmount=${tariffAmount}`);
    
    const r = await pool.request()
      .input('NationalCode', sql.NVarChar(20), nationalCode)
      .input('CompanyNationalId', sql.NVarChar(100), companyNationalId)
      .input('VehicleID', sql.BigInt, vehicleId)
      .input('LicenseTypeId', sql.Int, licenseTypeId)
      .input('OperationTypeId', sql.Int, operationTypeId)
      .input('FinalDescription', sql.NVarChar(2000), finalDescription)
      .input('TrackingNo', sql.NVarChar(30), trackingNo)
      .input('SubmittedByUserId', sql.Int, userId)
      .input('DiscountStatus', sql.NVarChar(20), discountStatus)
      .input('OriginalAmount', sql.Decimal(18, 2), tariffAmount)
      .input('FinalAmount', sql.Decimal(18, 2), tariffAmount)
      .query(`INSERT INTO VehicleRequests (NationalCode, CompanyNationalId, VehicleID, LicenseTypeId, OperationTypeId, FinalDescription, TrackingNo, SubmittedByUserId, DiscountStatus, OriginalAmount, FinalAmount)
              OUTPUT INSERTED.RequestID, INSERTED.TrackingNo, INSERTED.DiscountStatus
              VALUES (@NationalCode, @CompanyNationalId, @VehicleID, @LicenseTypeId, @OperationTypeId, @FinalDescription, @TrackingNo, @SubmittedByUserId, @DiscountStatus, @OriginalAmount, @FinalAmount)`);
    const row = r.recordset?.[0];
    
    // If discount is pending, create a workflow step for license specialist to review
    if (hasDiscountDocs && row?.RequestID) {
      console.log(`📝 Creating discount approval workflow step for request ${row.RequestID}`);
      
      // Link discount documents to this request
      const linkResult = await pool.request()
        .input('RequestID', sql.BigInt, row.RequestID)
        .input('VehicleID', sql.BigInt, vehicleId)
        .query(`
          UPDATE VehicleDiscountDocuments
          SET RequestID = @RequestID
          WHERE VehicleID = @VehicleID AND RequestID IS NULL
        `);
      
      console.log(`✅ Linked ${linkResult.rowsAffected[0]} discount documents to request ${row.RequestID}`);
      
      // Create discount approval workflow step (StepOrder 0)
      await pool.request()
        .input('RequestID', sql.BigInt, row.RequestID)
        .input('StepOrder', sql.Int, 0)
        .input('RoleName', sql.NVarChar(50), 'کارشناس صدور پروانه')
        .input('Status', sql.NVarChar(20), 'Pending')
        .input('Notes', sql.NVarChar(2000), 'بررسی و تایید تخفیف')
        .query(`
          INSERT INTO RequestWorkflowSteps (RequestID, StepOrder, RoleName, Status, Notes, CreatedAt)
          VALUES (@RequestID, @StepOrder, @RoleName, @Status, @Notes, GETDATE())
        `);
      
      console.log(`✅ Discount approval workflow step created for request ${row.RequestID}`);
    }
    
    // Initialize Activity approval workflow from GlobalApprovalFlowSteps
    // This will create the main workflow steps (StepOrder 1, 2, 3, etc.)
    if (row?.RequestID) {
      console.log(`📝 Initializing Activity approval workflow for request ${row.RequestID}`);
      
      // Get Activity approval flow
      const flowResult = await pool.request()
        .input('LicenseType', sql.NVarChar(20), 'Activity')
        .query('SELECT StepOrder, RoleName FROM GlobalApprovalFlowSteps WHERE LicenseType = @LicenseType ORDER BY StepOrder');
      
      if (flowResult.recordset && flowResult.recordset.length > 0) {
        // Create workflow steps based on Activity flow
        // ALL steps start as NotStarted - they will become Pending after payment
        // Activity licenses require payment first, so workflow doesn't start immediately
        
        for (const step of flowResult.recordset) {
          await pool.request()
            .input('RequestID', sql.BigInt, row.RequestID)
            .input('StepOrder', sql.Int, step.StepOrder)
            .input('RoleName', sql.NVarChar(50), step.RoleName)
            .input('Status', sql.NVarChar(20), 'NotStarted') // All steps NotStarted until payment
            .input('Notes', sql.NVarChar(2000), null)
            .query(`
              INSERT INTO RequestWorkflowSteps (RequestID, StepOrder, RoleName, Status, Notes, CreatedAt)
              VALUES (@RequestID, @StepOrder, @RoleName, @Status, @Notes, GETDATE())
            `);
        }
        
        console.log(`✅ Activity approval workflow initialized for request ${row.RequestID} with ${flowResult.recordset.length} steps (all NotStarted until payment)`);
      } else {
        console.warn('⚠️ No Activity approval flow defined in GlobalApprovalFlowSteps!');
      }
    }
    
    // Update request status based on whether there are discount docs
    if (hasDiscountDocs && row?.RequestID) {
      // If there are discount docs, set status to InProgress with discount step (0)
      await pool.request()
        .input('RequestID', sql.BigInt, row.RequestID)
        .input('Status', sql.NVarChar(20), 'InProgress')
        .input('CurrentStepOrder', sql.Int, 0)
        .query(`
          UPDATE VehicleRequests 
          SET Status = @Status, CurrentStepOrder = @CurrentStepOrder
          WHERE RequestID = @RequestID
        `);
    } else if (row?.RequestID) {
      // If no discount docs, request stays Pending until payment is recorded
      // CurrentStepOrder stays 0 (no active step yet)
      await pool.request()
        .input('RequestID', sql.BigInt, row.RequestID)
        .input('Status', sql.NVarChar(20), 'Pending') // Pending payment
        .input('CurrentStepOrder', sql.Int, 0)
        .query(`
          UPDATE VehicleRequests 
          SET Status = @Status, CurrentStepOrder = @CurrentStepOrder
          WHERE RequestID = @RequestID
        `);
    }
    
    return res.status(201).json({ 
      requestId: row?.RequestID, 
      trackingNo: row?.TrackingNo,
      discountStatus: row?.DiscountStatus,
      hasDiscountDocs: hasDiscountDocs,
      requiresDiscountApproval: hasDiscountDocs
    });
  } catch (e) { next(e); }
}

// ---------------- Renew Vehicle Request (Reuse Existing Tracking Number) -----------------
/**
 * For renewal, create a new VehicleRequests record but reuse the EXISTING tracking number
 * This is used when a user renews their activity license
 */
export async function renewVehicleRequest(req, res, next) {
  try {
    const vehicleId = Number(req.params.vehicleId);
    const { licenseTypeId, operationTypeId, finalDescription, existingTrackingNo, ownershipType } = req.body;
    const userId = req.user?.id;
    const nationalCode = req.user?.nationalCode;
    
    // Debug logging
    console.log('=== renewVehicleRequest Debug ===');
    console.log('req.user:', req.user);
    console.log('vehicleId:', vehicleId);
    console.log('licenseTypeId:', licenseTypeId);
    console.log('operationTypeId:', operationTypeId);
    console.log('existingTrackingNo:', existingTrackingNo);
    console.log('ownershipType:', ownershipType);
    
    // Validate required fields
    if (!vehicleId || !licenseTypeId || !operationTypeId || !existingTrackingNo) {
      return res.status(400).json({ 
        message: 'لطفاً شناسه خودرو، نوع پروانه، نوع عملیات و شماره پیگیری را وارد کنید' 
      });
    }
    
    const pool = await getPool();
    
    // Check if there's an ACTIVE request or license for this vehicle and license type
    // For renewal, we only block if there's a PENDING request (not yet processed)
    // Approved/Completed/Expired licenses should NOT block renewal
    const existingCheck = await pool.request()
      .input('VehicleID', sql.BigInt, vehicleId)
      .input('LicenseTypeId', sql.Int, licenseTypeId)
      .query(`
        SELECT TOP 1 RequestID, Status, TrackingNo 
        FROM VehicleRequests 
        WHERE VehicleID = @VehicleID AND LicenseTypeId = @LicenseTypeId AND Status = 'Pending'
        ORDER BY CreatedAt DESC
      `);
    
    if (existingCheck.recordset.length > 0) {
      const existing = existingCheck.recordset[0];
      return res.status(400).json({ 
        message: `شما یک درخواست فعال برای این خودرو دارید. وضعیت: ${existing.Status}\nشماره پیگیری: ${existing.TrackingNo}`,
        requestId: existing.RequestID,
        status: existing.Status
      });
    }
    
    // Check if there's an approved/completed license (this is normal for renewal)
    const approvedCheck = await pool.request()
      .input('VehicleID', sql.BigInt, vehicleId)
      .input('LicenseTypeId', sql.Int, licenseTypeId)
      .query(`
        SELECT TOP 1 RequestID, Status, TrackingNo 
        FROM VehicleRequests 
        WHERE VehicleID = @VehicleID AND LicenseTypeId = @LicenseTypeId AND Status IN ('Approved', 'Completed')
        ORDER BY CreatedAt DESC
      `);
    
    if (approvedCheck.recordset.length > 0) {
      // This is an expired/completed license - renewal is allowed
      const approved = approvedCheck.recordset[0];
      console.log(`ℹ️ Found existing approved license: ${approved.TrackingNo}, allowing renewal`);
    }
    
    // Get vehicle details
    const vehicleResult = await pool.request()
      .input('VehicleID', sql.BigInt, vehicleId)
      .query(`
        SELECT v.*,
               v.RegistrarNationalCode AS VehicleRegistrarCode,
               p.FirstName AS RegistrarFirstName,
               p.LastName AS RegistrarLastName
        FROM Vehicles v
        LEFT JOIN Persons p ON v.RegistrarNationalCode = p.NationalCode
        WHERE v.VehicleID = @VehicleID
      `);
    
    if (vehicleResult.recordset.length === 0) {
      return res.status(404).json({ message: 'خودرویی با این شناسه یافت نشد' });
    }
    
    const vehicle = vehicleResult.recordset[0];
    
    // Get activity category code from LookupValue table
    const categoryResult = await pool.request()
      .input('ActivityCategoryId', sql.Int, vehicle.ActivityCategoryId)
      .query(`SELECT TOP 1 Code FROM LookupValue WHERE Id = @ActivityCategoryId`);
    
    const activityCategoryCode = categoryResult.recordset[0]?.Code || '00';
    
    // Get the existing tracking number (don't generate new one)
    const trackingNo = existingTrackingNo;
    
    console.log(`📋 Using EXISTING tracking number for renewal: ${trackingNo}`);
    
    // ---- Calculate renewal tariff amount from Tariffs table ----
    // The tariff pricing depends on WHICH kind of renewal was selected:
    //   - Normal renewal            => LookupValue 'تمدید'         (DocTypeId 45)
    //   - Compulsory/forced renewal => LookupValue 'تمدید اجباری'  (DocTypeId 172)
    // The wizard's operationTypeId radio button may still be pointing at "صدور" by default,
    // so we resolve the REAL doc type to price/store based on the selected operation type's name,
    // falling back to normal renewal (تمدید) when it isn't explicitly "تمدید اجباری".
    const capacityTon = parseFloat(vehicle.Capacity) || 0;
    const renewalLicenseType = 'پروانه فعالیت'; // Tariffs table only has this LicenseType for renewal DocTypeIds

    const selectedOpTypeResult = await pool.request()
      .input('OperationTypeId', sql.Int, operationTypeId)
      .query(`SELECT TOP 1 Id, Name FROM LookupValue WHERE Id = @OperationTypeId`);
    const selectedOpTypeName = selectedOpTypeResult.recordset[0]?.Name || '';

    const isCompulsoryRenewal = selectedOpTypeName === 'تمدید اجباری';

    let RENEWAL_DOC_TYPE_ID;
    if (isCompulsoryRenewal) {
      RENEWAL_DOC_TYPE_ID = operationTypeId; // client already sent the "تمدید اجباری" LookupValue Id (used as DocTypeId directly)
    } else {
      const normalRenewalLookup = await pool.request()
        .query(`SELECT TOP 1 Id FROM LookupValue WHERE Name = N'تمدید'`);
      RENEWAL_DOC_TYPE_ID = normalRenewalLookup.recordset[0]?.Id || 45; // fallback to known Id
    }

    console.log(`💰 Looking up renewal tariff: LicenseType=${renewalLicenseType}, DocTypeId=${RENEWAL_DOC_TYPE_ID} (isCompulsoryRenewal=${isCompulsoryRenewal}), CapacityTon=${capacityTon}`);


    const renewalTariffResult = await pool.request()
      .input('LicenseType', sql.NVarChar(200), renewalLicenseType)
      .input('DocTypeId', sql.Int, RENEWAL_DOC_TYPE_ID)
      .input('CapacityTon', sql.Float, capacityTon)
      .query(`
        SELECT TOP 1 Id, Amount, FromTon, ToTon
        FROM Tariffs
        WHERE LicenseType = @LicenseType
          AND DocTypeId = @DocTypeId
          AND CAST(FromTon AS FLOAT) <= @CapacityTon
          AND CAST(ToTon AS FLOAT) >= @CapacityTon
        ORDER BY CAST(FromTon AS FLOAT) DESC
      `);

    let renewalTariff = renewalTariffResult.recordset[0];

    // Fallback: if no exact tonnage range matched, use the highest matching range for this LicenseType/DocTypeId
    if (!renewalTariff) {
      const fallbackResult = await pool.request()
        .input('LicenseType', sql.NVarChar(200), renewalLicenseType)
        .input('DocTypeId', sql.Int, RENEWAL_DOC_TYPE_ID)
        .query(`
          SELECT TOP 1 Id, Amount, FromTon, ToTon
          FROM Tariffs
          WHERE LicenseType = @LicenseType
            AND DocTypeId = @DocTypeId
          ORDER BY CAST(FromTon AS FLOAT) DESC
        `);
      renewalTariff = fallbackResult.recordset[0];
    }

    const renewalTariffAmount = renewalTariff?.Amount || 0;

    console.log(`💰 Renewal tariff resolved: Amount=${renewalTariffAmount} (TariffId=${renewalTariff?.Id ?? 'N/A'}, Range=${renewalTariff?.FromTon ?? '-'}-${renewalTariff?.ToTon ?? '-'})`);

    // Keep the applicant on the renewal row. Vehicles has RegistrarNationalCode,
    // not NationalCode, so older renewals were inserted with a null applicant and
    // the admin list showed "-".
    let requestNationalCode = null;
    let requestCompanyNationalId = null;

    const originalIdentity = await pool.request()
      .input('TrackingNo', sql.NVarChar(30), trackingNo)
      .query(`
        SELECT TOP 1
          NULLIF(LTRIM(RTRIM(NationalCode)), N'') AS NationalCode,
          NULLIF(LTRIM(RTRIM(CompanyNationalId)), N'') AS CompanyNationalId
        FROM VehicleRequests
        WHERE TrackingNo = @TrackingNo
          AND (
            NULLIF(LTRIM(RTRIM(NationalCode)), N'') IS NOT NULL
            OR NULLIF(LTRIM(RTRIM(CompanyNationalId)), N'') IS NOT NULL
          )
        ORDER BY CreatedAt ASC, RequestID ASC
      `);

    if (originalIdentity.recordset.length > 0) {
      requestNationalCode = originalIdentity.recordset[0].NationalCode || null;
      requestCompanyNationalId = originalIdentity.recordset[0].CompanyNationalId || null;
    } else {
      const ownerCode = String(vehicle.VehicleRegistrarCode || '').trim() || null;
      if (ownerCode) {
        if (ownershipType === 'حقوقی') {
          requestCompanyNationalId = ownerCode;
        } else {
          const companyMatch = await pool.request()
            .input('NationalId', sql.NVarChar(100), ownerCode)
            .query(`SELECT TOP 1 NationalId FROM CompanyInfo WHERE LTRIM(RTRIM(NationalId)) = LTRIM(RTRIM(@NationalId))`);
          if (companyMatch.recordset.length > 0) {
            requestCompanyNationalId = ownerCode;
          } else {
            requestNationalCode = ownerCode;
          }
        }
      }
    }

    if (requestNationalCode) {
      const personExists = await pool.request()
        .input('NationalCode', sql.NVarChar(20), requestNationalCode)
        .query(`SELECT TOP 1 NationalCode FROM Persons WHERE LTRIM(RTRIM(NationalCode)) = LTRIM(RTRIM(@NationalCode))`);
      if (!personExists.recordset.length) {
        console.warn(`⚠️ Renewal national code ${requestNationalCode} is not in Persons; storing NULL to satisfy FK`);
        requestNationalCode = null;
      }
    }

    console.log(`📝 Renewal applicant: NationalCode=${requestNationalCode}, CompanyNationalId=${requestCompanyNationalId}, ownershipType=${ownershipType}`);

    // Insert into VehicleRequests with EXISTING tracking number
    const r = await pool.request()
      .input('NationalCode', sql.NVarChar(20), requestNationalCode)
      .input('CompanyNationalId', sql.NVarChar(100), requestCompanyNationalId)
      .input('VehicleID', sql.BigInt, vehicleId)
      .input('LicenseTypeId', sql.Int, licenseTypeId)
      .input('OperationTypeId', sql.Int, operationTypeId)
      .input('FinalDescription', sql.NVarChar(2000), finalDescription || null)
      .input('TrackingNo', sql.NVarChar(30), trackingNo)
      .input('SubmittedByUserId', sql.Int, userId)
      .input('OriginalAmount', sql.Decimal(18, 2), renewalTariffAmount)
      .input('FinalAmount', sql.Decimal(18, 2), renewalTariffAmount)
      .query(`
        INSERT INTO VehicleRequests (
          NationalCode, CompanyNationalId, VehicleID, LicenseTypeId, OperationTypeId,
          FinalDescription, TrackingNo, SubmittedByUserId,
          DiscountStatus, OriginalAmount, FinalAmount
        )
        OUTPUT INSERTED.RequestID, INSERTED.TrackingNo
        VALUES (
          @NationalCode, @CompanyNationalId, @VehicleID, @LicenseTypeId, @OperationTypeId,
          @FinalDescription, @TrackingNo, @SubmittedByUserId,
          'None', @OriginalAmount, @FinalAmount
        )
      `);

    
    const row = r.recordset?.[0];
    
    if (!row?.RequestID) {
      return res.status(500).json({ message: 'خطا در ایجاد درخواست تمدید' });
    }
    
    console.log(`✅ Renewal request created: RequestID=${row.RequestID}, TrackingNo=${row.TrackingNo}`);
    
    // Initialize Activity approval workflow from GlobalApprovalFlowSteps
    const flowResult = await pool.request()
      .input('LicenseType', sql.NVarChar(20), 'Activity_Renewal')
      .query('SELECT StepOrder, RoleName FROM GlobalApprovalFlowSteps WHERE LicenseType = @LicenseType ORDER BY StepOrder');
    
    if (flowResult.recordset && flowResult.recordset.length > 0) {
      // Create workflow steps - ALL start as NotStarted
      for (const step of flowResult.recordset) {
        await pool.request()
          .input('RequestID', sql.BigInt, row.RequestID)
          .input('StepOrder', sql.Int, step.StepOrder)
          .input('RoleName', sql.NVarChar(50), step.RoleName)
          .input('Status', sql.NVarChar(20), 'NotStarted')
          .input('Notes', sql.NVarChar(2000), null)
          .query(`
            INSERT INTO RequestWorkflowSteps (RequestID, StepOrder, RoleName, Status, Notes, CreatedAt)
            VALUES (@RequestID, @StepOrder, @RoleName, @Status, @Notes, GETDATE())
          `);
      }
      
      // Update request status to Pending (awaiting payment)
      await pool.request()
        .input('RequestID', sql.BigInt, row.RequestID)
        .input('Status', sql.NVarChar(20), 'Pending')
        .input('CurrentStepOrder', sql.Int, 0)
        .query(`
          UPDATE VehicleRequests 
          SET Status = @Status, CurrentStepOrder = @CurrentStepOrder
          WHERE RequestID = @RequestID
        `);
      
      console.log(`✅ Activity renewal approval workflow initialized for request ${row.RequestID} with ${flowResult.recordset.length} steps`);
    } else {
      console.warn('⚠️ No Activity_Renewal approval flow defined in GlobalApprovalFlowSteps!');
      // Fallback: create a simple Pending status
      await pool.request()
        .input('RequestID', sql.BigInt, row.RequestID)
        .input('Status', sql.NVarChar(20), 'Pending')
        .query(`
          UPDATE VehicleRequests 
          SET Status = @Status, CurrentStepOrder = 0
          WHERE RequestID = @RequestID
        `);
    }
    
    return res.status(201).json({ 
      requestId: row?.RequestID, 
      trackingNo: row?.TrackingNo
    });
  } catch (e) {
    console.error('❌ renewVehicleRequest error:', e);
    next(e);
  }
}
// ---------------- Create Exploitation License Request -----------------
export async function createExploitationRequest(req, res, next) {
  try {
    const pool = await getPool();
    const nationalCode = req.user?.nationalCode;
    const userId = req.user?.id;
    const { finalDescription } = req.body;
    const licenseTypeId = 68; // Exploitation License
    const operationTypeId = 44; // Exploitation Operation

    if (!nationalCode) {
      return res.status(400).json({ message: 'شناسه ملی کاربر یافت نشد' });
    }

    console.log(`📝 Creating exploitation license request for national code: ${nationalCode}`);

    // 1) Verify person exists
    const personResult = await pool.request()
      .input('NationalCode', sql.NVarChar(20), nationalCode)
      .query('SELECT NationalCode, FirstName, LastName FROM Persons WHERE NationalCode = @NationalCode');
    
    if (!personResult.recordset || personResult.recordset.length === 0) {
      return res.status(400).json({ message: 'ابتدا باید اطلاعات شخصی را تکمیل کنید' });
    }

    const person = personResult.recordset[0];
    console.log(`✅ Person found: ${person.FirstName} ${person.LastName}`);
    
    // 2) Get company NationalId, TonnageRateId, and ActivityFieldId from CompanyInfo table
    const companyResult = await pool.request()
      .input('NationalCode', sql.NVarChar(50), nationalCode)
      .query('SELECT NationalId, TonnageRateId, ActivityFieldId FROM CompanyInfo WHERE NationalCode = @NationalCode');
    
    if (!companyResult.recordset || companyResult.recordset.length === 0) {
      return res.status(400).json({ message: 'شناسه ملی شرکت یافت نشد. لطفاً ابتدا اطلاعات شرکت را تکمیل کنید' });
    }
    
    const companyNationalId = companyResult.recordset[0].NationalId;
    const tonnageRateId = companyResult.recordset[0].TonnageRateId;
    const activityCategoryId = companyResult.recordset[0].ActivityFieldId; // رسته فعالیت
    console.log(`✅ Company found with NationalId: ${companyNationalId}, TonnageRateId: ${tonnageRateId}, ActivityFieldId: ${activityCategoryId}`);
    
    if (!tonnageRateId) {
      return res.status(400).json({ message: 'میزان تناژ شرکت مشخص نشده است' });
    }
    
    if (!activityCategoryId) {
      return res.status(400).json({ message: 'رسته فعالیت شرکت مشخص نشده است' });
    }

    // 3) Check for discount documents
    const discountDocsResult = await pool.request()
      .input('NationalCode', sql.NVarChar(20), nationalCode)
      .query(`
        SELECT COUNT(*) as DocCount 
        FROM EmploymentDiscountDocuments 
        WHERE NationalCode = @NationalCode AND RequestID IS NULL
      `);
    
    const hasDiscountDocs = (discountDocsResult.recordset?.[0]?.DocCount || 0) > 0;
    const discountStatus = hasDiscountDocs ? 'Pending' : 'None';
    
    console.log(`📄 Discount documents found: ${hasDiscountDocs ? 'Yes' : 'No'}`);

    // 4) Generate tracking number for exploitation license
    // Format: 11YY-NNNN
    // 11 = fixed digits for exploitation license
    // YY = activity category code (2 digits)
    // NNNN = sequential number starting from 1201
    
    // Get activity category code from activityCategoryId
    const activityCategoryResult = await pool.request()
      .input('ActivityCategoryId', sql.Int, activityCategoryId)
      .query(`
        SELECT Code 
        FROM LookupValue 
        WHERE Id = @ActivityCategoryId AND CategoryId = 5
      `);
    
    if (!activityCategoryResult.recordset || activityCategoryResult.recordset.length === 0) {
      return res.status(400).json({ message: 'کد رسته فعالیت یافت نشد' });
    }
    
    const activityCode = activityCategoryResult.recordset[0].Code || '00';
    const paddedActivityCode = activityCode.toString().padStart(2, '0');
    
    // Build prefix: 11 + activity code (2 digits)
    const prefix = `11${paddedActivityCode}`;
    
    console.log(`🏷️ Exploitation license prefix: ${prefix} (ActivityCode: ${paddedActivityCode})`);
    
    // Get the next sequential number from SequenceCounters table
    // This prevents duplicate numbers even if records are deleted
    // Use 'DEFAULT' as prefix since all exploitation licenses share the same counter
    const sequentialNumber = await getNextSequence(pool, 'Exploitation', 'DEFAULT');
    
    // Format: 11YY-NNNN (4 digits for sequence number)
    const trackingNo = `${prefix}-${sequentialNumber.toString().padStart(4, '0')}`;
    console.log(`🎫 Generated exploitation tracking number: ${trackingNo} (Prefix: ${prefix}, Seq: ${sequentialNumber})`);

    // 5) Get tonnage range from LookupValue table
    const tonnageLookupResult = await pool.request()
      .input('TonnageRateId', sql.Int, tonnageRateId)
      .query('SELECT Name FROM LookupValue WHERE Id = @TonnageRateId');
    
    if (!tonnageLookupResult.recordset || tonnageLookupResult.recordset.length === 0) {
      return res.status(400).json({ message: 'اطلاعات تناژ یافت نشد' });
    }
    
    const tonnageValue = tonnageLookupResult.recordset[0].Name || '';
    console.log(`📊 Tonnage value from lookup: ${tonnageValue}`);
    
    // Extract tonnage numbers from text
    // Match patterns like: 
    // - "از 0 تن تا 150 تن" (from 0 ton to 150 ton)
    // - "10-20 تن" or "10-20"
    // - "10 to 20" or "10تا 20"
    let tonnageMatch = tonnageValue.match(/از\s*([0-9.]+)\s*تن\s*تا\s*([0-9.]+)\s*تن/);
    
    // If Persian format didn't match, try simpler formats
    if (!tonnageMatch) {
      tonnageMatch = tonnageValue.match(/([0-9.]+)\s*[-تاto]+\s*([0-9.]+)/);
    }
    
    if (!tonnageMatch) {
      console.warn(`⚠️ Could not extract tonnage range from: ${tonnageValue}`);
      return res.status(400).json({ message: 'فرمت تناژ نامعتبر است' });
    }
    
    const fromTon = parseFloat(tonnageMatch[1]);
    const toTon = parseFloat(tonnageMatch[2]);
    console.log(`📊 Extracted tonnage range: ${fromTon} - ${toTon}`);
    
    // 6) Get tariff amount based on tonnage range
    // Find tariff where company's FROM tonnage falls within the tariff's range
    // This matches the company's capacity tier to the correct tariff bracket
    const tariffResult = await pool.request()
      .input('LicenseType', sql.NVarChar(50), 'پروانه بهره برداری') // Persian text for "Exploitation License"
      .input('DocTypeId', sql.Int, 44) // صدور (Issuance)
      .input('FromTon', sql.Float, fromTon)
      .query(`
        SELECT TOP 1 Id, Amount, FromTon, ToTon
        FROM Tariffs 
        WHERE LicenseType = @LicenseType
          AND DocTypeId = @DocTypeId
          AND CAST(FromTon AS FLOAT) <= @FromTon
          AND CAST(ToTon AS FLOAT) >= @FromTon
        ORDER BY CAST(FromTon AS FLOAT) DESC
      `);
    
    if (!tariffResult.recordset || tariffResult.recordset.length === 0) {
      console.error(`❌ No tariff found for tonnage range: ${fromTon} - ${toTon}`);
      return res.status(400).json({ message: 'تعرفه مناسب برای این میزان تناژ یافت نشد' });
    }
    
    const tariff = tariffResult.recordset[0];
    const tariffAmount = tariff.Amount || 0;
    const tariffFromTon = tariff.FromTon;
    const tariffToTon = tariff.ToTon;
    console.log(`💰 Tariff found: Amount=${tariffAmount}, Range=${tariffFromTon}-${tariffToTon} for company tonnage ${fromTon}-${toTon}`);

    // 7) Insert request into VehicleRequests (using both personal NationalCode and company NationalId)
    // Also store the tonnage range used for tariff calculation
    const r = await pool.request()
      .input('NationalCode', sql.NVarChar(20), nationalCode) // Person's NationalCode (for FK constraint)
      .input('CompanyNationalId', sql.NVarChar(100), companyNationalId) // Company's NationalId
      .input('LicenseTypeId', sql.Int, licenseTypeId)
      .input('OperationTypeId', sql.Int, operationTypeId)
      .input('FinalDescription', sql.NVarChar(2000), finalDescription)
      .input('TrackingNo', sql.NVarChar(30), trackingNo)
      .input('SubmittedByUserId', sql.Int, userId)
      .input('DiscountStatus', sql.NVarChar(20), discountStatus)
      .input('OriginalAmount', sql.Decimal(18, 2), tariffAmount)
      .input('FinalAmount', sql.Decimal(18, 2), tariffAmount)
      .input('TonnageFromTon', sql.Float, tariffFromTon)
      .input('TonnageToTon', sql.Float, tariffToTon)
      .query(`INSERT INTO VehicleRequests (NationalCode, CompanyNationalId, LicenseTypeId, OperationTypeId, FinalDescription, TrackingNo, SubmittedByUserId, DiscountStatus, OriginalAmount, FinalAmount, TonnageFromTon, TonnageToTon)
              OUTPUT INSERTED.RequestID, INSERTED.TrackingNo, INSERTED.DiscountStatus
              VALUES (@NationalCode, @CompanyNationalId, @LicenseTypeId, @OperationTypeId, @FinalDescription, @TrackingNo, @SubmittedByUserId, @DiscountStatus, @OriginalAmount, @FinalAmount, @TonnageFromTon, @TonnageToTon)`);
    const row = r.recordset?.[0];
    
    // 8) Link discount documents to this request if they exist
    if (hasDiscountDocs && row?.RequestID) {
      console.log(`📝 Linking discount documents to exploitation request ${row.RequestID}`);
      
      await pool.request()
        .input('RequestID', sql.BigInt, row.RequestID)
        .input('NationalCode', sql.NVarChar(20), nationalCode)
        .query(`
          UPDATE EmploymentDiscountDocuments
          SET RequestID = @RequestID
          WHERE NationalCode = @NationalCode AND RequestID IS NULL
        `);
    }
    
    // 9) Initialize Exploitation approval workflow from GlobalApprovalFlowSteps
    // IMPORTANT: Exploitation licenses do NOT require payment first
    // The workflow starts immediately after submission
    if (row?.RequestID) {
      console.log(`📝 Initializing Exploitation approval workflow for request ${row.RequestID}`);
      
      // Get Exploitation approval flow
      const flowResult = await pool.request()
        .input('LicenseType', sql.NVarChar(20), 'Exploitation')
        .query('SELECT StepOrder, RoleName FROM GlobalApprovalFlowSteps WHERE LicenseType = @LicenseType ORDER BY StepOrder');
      
      if (flowResult.recordset && flowResult.recordset.length > 0) {
        // Create workflow steps based on Exploitation flow
        // For Exploitation licenses, the FIRST step starts as Pending immediately
        // Other steps remain NotStarted until the previous step is completed
        for (const step of flowResult.recordset) {
          const stepStatus = (step.StepOrder === 1) ? 'Pending' : 'NotStarted';
          
          await pool.request()
            .input('RequestID', sql.BigInt, row.RequestID)
            .input('StepOrder', sql.Int, step.StepOrder)
            .input('RoleName', sql.NVarChar(50), step.RoleName)
            .input('Status', sql.NVarChar(20), stepStatus)
            .input('Notes', sql.NVarChar(2000), null)
            .query(`
              INSERT INTO RequestWorkflowSteps (RequestID, StepOrder, RoleName, Status, Notes, CreatedAt)
              VALUES (@RequestID, @StepOrder, @RoleName, @Status, @Notes, GETDATE())
            `);
        }
        
        // Update request status to InProgress (workflow started immediately)
        // CurrentStepOrder = 1 (first approval step is active)
        await pool.request()
          .input('RequestID', sql.BigInt, row.RequestID)
          .input('Status', sql.NVarChar(20), 'InProgress')
          .input('CurrentStepOrder', sql.Int, 1)
          .query(`
            UPDATE VehicleRequests 
            SET Status = @Status, CurrentStepOrder = @CurrentStepOrder
            WHERE RequestID = @RequestID
          `);
        
        console.log(`✅ Exploitation approval workflow initialized for request ${row.RequestID} with ${flowResult.recordset.length} steps (STARTED IMMEDIATELY - NO PAYMENT REQUIRED)`);
      } else {
        console.warn('⚠️ No Exploitation approval flow defined in GlobalApprovalFlowSteps!');
      }
    }
    
    return res.status(201).json({ 
      requestId: row?.RequestID, 
      trackingNo: row?.TrackingNo,
      discountStatus: row?.DiscountStatus,
      hasDiscountDocs: hasDiscountDocs,
      requiresDiscountApproval: hasDiscountDocs
    });
  } catch (e) { next(e); }
}

// ---------------- Vehicle Discount Documents -----------------
export async function listVehicleDiscountDocuments(req, res, next) {
  try {
    const vehicleId = Number(req.params.vehicleId);
    if (!vehicleId) return res.status(400).json({ message: 'Missing vehicleId' });
    const pool = await getPool();
    const q = await pool.request()
      .input('VehicleID', sql.BigInt, vehicleId)
      .query(`
        SELECT d.DocID, d.VehicleID, d.LookupDocTypeId, lv.Name AS DocTypeName,
               d.Description, d.MimeType, d.SizeBytes, d.CreatedAt
        FROM VehicleDiscountDocuments d
        LEFT JOIN LookupValue lv ON lv.Id = d.LookupDocTypeId
        WHERE d.VehicleID = @VehicleID
        ORDER BY d.DocID DESC
      `);
    res.json(q.recordset || []);
  } catch (e) { next(e); }
}

export async function saveVehicleDiscountDocument(req, res, next) {
  try {
    const vehicleId = Number(req.params.vehicleId);
    const docTypeId = Number(req.body?.docTypeId);
    const description = String(req.body?.description || '').trim() || null;
    const f = req.file;
    if (!vehicleId) return res.status(400).json({ message: 'Missing vehicleId' });
    if (!docTypeId) return res.status(400).json({ message: 'Missing docTypeId' });
    if (!f) return res.status(400).json({ message: 'No file uploaded' });
    if (!String(f.mimetype || '').startsWith('image/')) return res.status(400).json({ message: 'Only image files are allowed' });
    if (f.size > 2 * 1024 * 1024) return res.status(400).json({ message: 'File too large. Max 2MB' });

    const pool = await getPool();
    const r = await pool.request()
      .input('VehicleID', sql.BigInt, vehicleId)
      .input('LookupDocTypeId', sql.Int, docTypeId)
      .input('Description', sql.NVarChar(1000), description)
      .input('FileContent', sql.VarBinary(sql.MAX), f.buffer)
      .input('MimeType', sql.NVarChar(100), f.mimetype)
      .input('SizeBytes', sql.Int, f.size)
      .query(`INSERT INTO VehicleDiscountDocuments (VehicleID, LookupDocTypeId, Description, FileContent, MimeType, SizeBytes)
              OUTPUT INSERTED.*
              VALUES (@VehicleID, @LookupDocTypeId, @Description, @FileContent, @MimeType, @SizeBytes)`);
    res.status(201).json(r.recordset?.[0]);
  } catch (e) { next(e); }
}

export async function deleteVehicleDiscountDocument(req, res, next) {
  try {
    const vehicleId = Number(req.params.vehicleId);
    const docId = Number(req.params.docId);
    if (!vehicleId || !docId) return res.status(400).json({ message: 'Missing IDs' });
    const pool = await getPool();
    await pool.request().input('DocID', sql.BigInt, docId).query('DELETE FROM VehicleDiscountDocuments WHERE DocID=@DocID');
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function getVehicleDiscountDocumentContent(req, res, next) {
  try {
    const vehicleId = Number(req.params.vehicleId);
    const docId = Number(req.params.docId);
    if (!vehicleId || !docId) return res.status(400).json({ message: 'Missing IDs' });
    const pool = await getPool();
    const r = await pool.request()
      .input('DocID', sql.BigInt, docId)
      .input('VehicleID', sql.BigInt, vehicleId)
      .query('SELECT TOP 1 FileContent, MimeType FROM VehicleDiscountDocuments WHERE DocID=@DocID AND VehicleID=@VehicleID');
    const row = r.recordset?.[0];
    if (!row) return res.status(404).end();
    res.setHeader('Content-Type', row.MimeType || 'application/octet-stream');
    res.send(row.FileContent);
  } catch (e) { next(e); }
}

export async function getVehicleByChassis(req, res, next) {
  try {
    const chassis = String(req.params.chassis || '').trim();
    if (!chassis) return res.status(400).json({ message: 'Missing chassis' });
    const pool = await getPool();
    const r = await pool.request()
      .input('ChassisNo', sql.NVarChar(50), chassis)
      .query('SELECT TOP 1 * FROM Vehicles WHERE ChassisNo=@ChassisNo');
    const v = r.recordset?.[0];
    if (!v) return res.status(404).json({ message: 'NOT_FOUND' });
    return res.json({
      vehicleId: v.VehicleID,
      vehicle: {
        vehicleKindId: v.VehicleKindId,
        systemId: v.SystemId,
        systemTipId: v.SystemTipId,
        yearManufacture: v.YearManufacture,
        capacity: v.Capacity,
        fuelTypeId: v.FuelTypeId,
        trackerTypeId: v.TrackerTypeId,
        cylinders: v.Cylinders,
        axles: v.Axles,
        wheels: v.Wheels,
        vin: v.VIN,
        chassisNo: v.ChassisNo,
        engineNo: v.EngineNo,
        bodyColor: v.BodyColor,
        activityCategoryId: v.ActivityCategoryId,
        isContainer: v.IsContainer ? 'yes' : 'no',
        plateTypeId: v.PlateTypeId,
        plate: { p1_serial2: v.PlateSerial2, p2_three: v.PlateThreeDigits, p3_letter: v.PlateLetter, p4_two: v.PlateRegion2 },
        inspectionDate: v.InspectionDateJalali,
        greenCardDate: v.GreenCardDateJalali,
        insuranceCompanyId: v.InsuranceCompanyId,
        insurancePolicyNo: v.InsurancePolicyNo,
        insuranceIssueDate: v.InsuranceIssueDateJalali,
        insuranceValidDate: v.InsuranceValidDateJalali,
        techInspectSerial: v.TechInspectSerial,
        techInspectIssueDate: v.TechInspectIssueDateJalali,
        techInspectValidDate: v.TechInspectValidDateJalali
      }
    });
  } catch (e) { next(e); }
}

// Get vehicle by VIN, scoped to logged-in user's national code or company's NationalId
export async function getVehicleByVin(req, res, next) {
  try {
    const vin = String(req.params.vin || '').trim();
    if (!vin) return res.status(400).json({ message: 'Missing VIN' });
    const pool = await getPool();

    const r = await pool.request()
      .input('VIN', sql.NVarChar(50), vin)
      .query(`
        SELECT TOP 1 *
        FROM Vehicles
        WHERE VIN = @VIN
        ORDER BY VehicleID DESC
      `);
    const v = r.recordset?.[0];
    if (!v) {
      console.log(`❌ Vehicle not found by VIN: ${vin}`);
      return res.status(404).json({ message: 'NOT_FOUND' });
    }
    console.log(`✅ Vehicle found by VIN: ${vin}, VehicleID=${v.VehicleID}`);
    return res.json({
      vehicleId: v.VehicleID,
      vehicle: {
        vehicleKindId: v.VehicleKindId,
        systemId: v.SystemId,
        systemTipId: v.SystemTipId,
        yearManufacture: v.YearManufacture,
        capacity: v.Capacity,
        fuelTypeId: v.FuelTypeId,
        trackerTypeId: v.TrackerTypeId,
        cylinders: v.Cylinders,
        axles: v.Axles,
        wheels: v.Wheels,
        vin: v.VIN,
        chassisNo: v.ChassisNo,
        engineNo: v.EngineNo,
        bodyColor: v.BodyColor,
        activityCategoryId: v.ActivityCategoryId,
        isContainer: v.IsContainer ? 'yes' : 'no',
        plateTypeId: v.PlateTypeId,
        plate: { p1_serial2: v.PlateSerial2, p2_three: v.PlateThreeDigits, p3_letter: v.PlateLetter, p4_two: v.PlateRegion2 },
        inspectionDate: v.InspectionDateJalali,
        greenCardDate: v.GreenCardDateJalali,
        insuranceCompanyId: v.InsuranceCompanyId,
        insurancePolicyNo: v.InsurancePolicyNo,
        insuranceIssueDate: v.InsuranceIssueDateJalali,
        insuranceValidDate: v.InsuranceValidDateJalali,
        techInspectSerial: v.TechInspectSerial,
        techInspectIssueDate: v.TechInspectIssueDateJalali,
        techInspectValidDate: v.TechInspectValidDateJalali
      }
    });
  } catch (e) { next(e); }
}

export async function upsertPersonal(req, res, next) {
  try {
    const p = req.body || {};
    const required = ['firstName','lastName','nationalCode','fatherName','birthProvinceId','birthDate','gender','maritalStatus'];
    for (const k of required) {
      if (String(p?.[k] ?? '').trim().length === 0) {
        return res.status(400).json({ message: `Missing required field: ${k}` });
      }
    }

    const pool = await getPool();
    const tx = new sql.Transaction(await pool);
    await tx.begin();
    const r = new sql.Request(tx);

    // Normalize gender to Persian for consistency across the project
    const normalizedGender = (p.gender === 'male') ? 'مرد' : (p.gender === 'female') ? 'زن' : String(p.gender || '');
    // Normalize marital status to Persian for consistency (accept both English and Persian)
    let normalizedMaritalStatus = String(p.maritalStatus || '');
    if (p.maritalStatus === 'single' || p.maritalStatus === 'مجرد') {
      normalizedMaritalStatus = 'مجرد';
    } else if (p.maritalStatus === 'married' || p.maritalStatus === 'متأهل' || p.maritalStatus === 'متاهل') {
      normalizedMaritalStatus = 'متأهل';
    }

    // Upsert person by NationalCode as the key
    await r
      .input('NationalCode', sql.NVarChar(20), String(p.nationalCode))
      .input('FirstName', sql.NVarChar(100), String(p.firstName))
      .input('LastName', sql.NVarChar(100), String(p.lastName))
      .input('FatherName', sql.NVarChar(100), String(p.fatherName))
      .input('IdSerial', sql.NVarChar(50), p.idSerial || null)
      .input('BirthProvinceId', sql.Int, Number(p.birthProvinceId))
      .input('BirthCityId', sql.Int, p.birthCityId ? Number(p.birthCityId) : null)
      .input('BirthDateJalali', sql.NVarChar(10), String(p.birthDate))
      .input('Gender', sql.NVarChar(10), normalizedGender)
      .input('MaritalStatus', sql.NVarChar(20), normalizedMaritalStatus)
      .input('OtherBloodGroup', sql.NVarChar(10), p.otherBloodGroup || null)
      .input('OtherEducationLevel', sql.NVarChar(50), p.otherEducationLevel || null)
      .input('OtherPhysicalStatus', sql.NVarChar(50), p.otherPhysicalStatus || null)
      .input('OtherMilitaryStatus', sql.NVarChar(50), p.otherMilitaryStatus || null)
      .input('OtherEnglishLevel', sql.NVarChar(50), p.otherEnglishLevel || null)
      .input('OtherVeteranStatus', sql.NVarChar(50), p.otherVeteranStatus || null)
      .query(`
        MERGE Persons AS target
        USING (SELECT @NationalCode AS NationalCode) AS src
        ON target.NationalCode = src.NationalCode
        WHEN MATCHED THEN UPDATE SET
          FirstName=@FirstName, LastName=@LastName, FatherName=@FatherName,
          IdSerial=@IdSerial, BirthProvinceId=@BirthProvinceId, BirthCityId=@BirthCityId,
          BirthDateJalali=@BirthDateJalali, Gender=@Gender, MaritalStatus=@MaritalStatus,
          OtherBloodGroup=@OtherBloodGroup, OtherEducationLevel=@OtherEducationLevel,
          OtherPhysicalStatus=@OtherPhysicalStatus, OtherMilitaryStatus=@OtherMilitaryStatus,
          OtherEnglishLevel=@OtherEnglishLevel, OtherVeteranStatus=@OtherVeteranStatus,
          ModifiedAt=SYSUTCDATETIME()
        WHEN NOT MATCHED THEN INSERT (
          NationalCode, FirstName, LastName, FatherName, IdSerial, BirthProvinceId, BirthCityId,
          BirthDateJalali, Gender, MaritalStatus, OtherBloodGroup, OtherEducationLevel,
          OtherPhysicalStatus, OtherMilitaryStatus, OtherEnglishLevel, OtherVeteranStatus
        ) VALUES (
          @NationalCode, @FirstName, @LastName, @FatherName, @IdSerial, @BirthProvinceId, @BirthCityId,
          @BirthDateJalali, @Gender, @MaritalStatus, @OtherBloodGroup, @OtherEducationLevel,
          @OtherPhysicalStatus, @OtherMilitaryStatus, @OtherEnglishLevel, @OtherVeteranStatus
        );
      `);

    // Replace residences
    await new sql.Request(tx)
      .input('NationalCode', sql.NVarChar(20), String(p.nationalCode))
      .query('DELETE FROM PersonResidences WHERE NationalCode=@NationalCode');
    for (const rcv of (p.residences || [])) {
      await new sql.Request(tx)
        .input('NationalCode', sql.NVarChar(20), String(p.nationalCode))
        .input('ProvinceId', sql.Int, rcv.provinceId ? Number(rcv.provinceId) : null)
        .input('CityId', sql.Int, rcv.cityId ? Number(rcv.cityId) : null)
        .input('MainStreet', sql.NVarChar(200), rcv.mainStreet || null)
        .input('SideStreet', sql.NVarChar(200), rcv.sideStreet || null)
        .input('District', sql.NVarChar(100), rcv.district || null)
        .input('PostalCode', sql.NVarChar(20), rcv.postalCode || null)
        .input('Plaque', sql.NVarChar(50), rcv.plaque || null)
        .input('Unit', sql.NVarChar(50), rcv.unit || null)
        .input('Address', sql.NVarChar(500), rcv.address || null)
        .query(`INSERT INTO PersonResidences (
          NationalCode, ProvinceId, CityId, MainStreet, SideStreet, District, PostalCode, Plaque, Unit, Address
        ) VALUES (
          @NationalCode, @ProvinceId, @CityId, @MainStreet, @SideStreet, @District, @PostalCode, @Plaque, @Unit, @Address
        )`);
    }

    // Replace contacts
    await new sql.Request(tx)
      .input('NationalCode', sql.NVarChar(20), String(p.nationalCode))
      .query('DELETE FROM PersonContacts WHERE NationalCode=@NationalCode');
    for (const c of (p.contacts || [])) {
      await new sql.Request(tx)
        .input('NationalCode', sql.NVarChar(20), String(p.nationalCode))
        .input('Type', sql.NVarChar(20), String(c.type || ''))
        .input('Value', sql.NVarChar(255), String(c.value || ''))
        .input('IsActive', sql.Bit, c.isActive ? 1 : 0)
        .query(`INSERT INTO PersonContacts (NationalCode, Type, Value, IsActive)
                VALUES (@NationalCode, @Type, @Value, @IsActive)`);
    }

    // Upsert PersonOtherInfo table for additional fields
    // This table stores: PhysicalStatus, JobStatus, MilitaryStatus, EducationLevel, SelfSacrificeStatus, FluencyEnglish, etc.
    await new sql.Request(tx)
      .input('NationalCode', sql.NVarChar(20), String(p.nationalCode))
      .input('PhysicalStatus', sql.NVarChar(100), p.otherPhysicalStatus || null)
      .input('MilitaryStatus', sql.NVarChar(100), p.otherMilitaryStatus || null)
      .input('EducationLevel', sql.NVarChar(100), p.otherEducationLevel || null)
      .input('SelfSacrificeStatus', sql.NVarChar(100), p.otherVeteranStatus || null)
      .input('FluencyEnglish', sql.NVarChar(100), p.otherEnglishLevel || null)
      .query(`
        MERGE PersonOtherInfo AS target
        USING (SELECT @NationalCode AS NationalCode) AS src
        ON target.NationalCode = src.NationalCode
        WHEN MATCHED THEN UPDATE SET
          PhysicalStatus = @PhysicalStatus,
          MilitaryStatus = @MilitaryStatus,
          EducationLevel = @EducationLevel,
          SelfSacrificeStatus = @SelfSacrificeStatus,
          FluencyEnglish = @FluencyEnglish,
          ModifiedAt = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN INSERT (
          NationalCode, PhysicalStatus, MilitaryStatus, EducationLevel, SelfSacrificeStatus, FluencyEnglish
        ) VALUES (
          @NationalCode, @PhysicalStatus, @MilitaryStatus, @EducationLevel, @SelfSacrificeStatus, @FluencyEnglish
        );
      `);

    await tx.commit();
    return res.json({ inserted: true, changed: true, nationalCode: p.nationalCode });
  } catch (e) { 
    try { await tx?.rollback(); } catch {}
    next(e); 
  }
}

function rowsEqual(a, v) {
  // Compare relevant columns; returns true if no change
  const eq = (x, y) => String(x ?? '').trim() === String(y ?? '').trim();
  return (
    eq(a.VIN, v.vin) &&
    eq(a.ChassisNo, v.chassisNo) &&
    a.VehicleKindId === Number(v.vehicleKindId) &&
    a.SystemId === Number(v.systemId) &&
    a.SystemTipId === Number(v.systemTipId) &&
    a.YearManufacture === Number(v.yearManufacture) &&
    eq(a.Capacity, v.capacity) &&
    a.FuelTypeId === Number(v.fuelTypeId) &&
    a.TrackerTypeId === Number(v.trackerTypeId) &&
    a.Cylinders === Number(v.cylinders) &&
    a.Axles === Number(v.axles) &&
    a.Wheels === Number(v.wheels) &&
    eq(a.EngineNo, v.engineNo) &&
    eq(a.BodyColor, v.bodyColor) &&
    a.ActivityCategoryId === Number(v.activityCategoryId) &&
    a.IsContainer === (v.isContainer === 'yes' ? true : false) &&
    a.PlateTypeId === Number(v.plateTypeId) &&
    eq(a.PlateSerial2, v?.plate?.p1_serial2) &&
    eq(a.PlateThreeDigits, v?.plate?.p2_three) &&
    eq(a.PlateLetter, v?.plate?.p3_letter) &&
    eq(a.PlateRegion2, v?.plate?.p4_two) &&
    eq(a.RegistrarNationalCode, v.registrarNationalCode) &&
    eq(a.RegistrarNationality, v.registrarNationality) &&
    eq(a.InspectionDateJalali, v.inspectionDate) &&
    eq(a.GreenCardDateJalali, v.greenCardDate) &&
    a.InsuranceCompanyId === Number(v.insuranceCompanyId) &&
    eq(a.InsurancePolicyNo, v.insurancePolicyNo) &&
    eq(a.InsuranceIssueDateJalali, v.insuranceIssueDate) &&
    eq(a.InsuranceValidDateJalali, v.insuranceValidDate) &&
    eq(a.TechInspectSerial, v.techInspectSerial) &&
    eq(a.TechInspectIssueDateJalali, v.techInspectIssueDate) &&
    eq(a.TechInspectValidDateJalali, v.techInspectValidDate)
  );
}

export async function upsertVehicle(req, res, next) {
  try {
    const v = normalizeVehicle(req.body);
    // attach registrar fields from body if present
    v.registrarNationalCode = req.body?.registrarNationalCode || v.registrarNationalCode;
    v.registrarNationality = req.body?.registrarNationality || v.registrarNationality;

    // Validate
    for (const k of required) {
      if (String(v?.[k] ?? '').trim().length === 0) {
        return res.status(400).json({ message: `Missing required field: ${k}` });
      }
    }
    if (!v?.plate || !v.plate.p1_serial2 || !v.plate.p2_three || !v.plate.p3_letter || !v.plate.p4_two) {
      return res.status(400).json({ message: 'Plate parts are incomplete' });
    }

    const pool = await getPool();

    // Find existing by VIN or ChassisNo
    const existing = await pool.request()
      .input('VIN', sql.NVarChar(50), v.vin)
      .input('ChassisNo', sql.NVarChar(50), v.chassisNo)
      .query(`SELECT TOP 1 * FROM Vehicles WHERE VIN=@VIN OR ChassisNo=@ChassisNo ORDER BY CASE WHEN VIN=@VIN THEN 0 ELSE 1 END`);
    const cur = existing.recordset[0];

    if (!cur) {
      // Insert new
      const r = await pool.request()
        .input('VIN', sql.NVarChar(50), v.vin)
        .input('ChassisNo', sql.NVarChar(50), v.chassisNo)
        .input('VehicleKindId', sql.Int, Number(v.vehicleKindId))
        .input('SystemId', sql.Int, Number(v.systemId))
        .input('SystemTipId', sql.Int, Number(v.systemTipId))
        .input('YearManufacture', sql.Int, Number(v.yearManufacture))
        .input('Capacity', sql.NVarChar(50), String(v.capacity))
        .input('FuelTypeId', sql.Int, Number(v.fuelTypeId))
        .input('TrackerTypeId', sql.Int, Number(v.trackerTypeId))
        .input('Cylinders', sql.Int, Number(v.cylinders))
        .input('Axles', sql.Int, Number(v.axles))
        .input('Wheels', sql.Int, Number(v.wheels))
        .input('EngineNo', sql.NVarChar(50), String(v.engineNo))
        .input('BodyColor', sql.NVarChar(50), String(v.bodyColor))
        .input('ActivityCategoryId', sql.Int, Number(v.activityCategoryId))
        .input('IsContainer', sql.Bit, v.isContainer === 'yes' ? 1 : 0)
        .input('PlateTypeId', sql.Int, Number(v.plateTypeId))
        .input('PlateSerial2', sql.NVarChar(2), String(v.plate.p1_serial2))
        .input('PlateThreeDigits', sql.NVarChar(3), String(v.plate.p2_three))
        .input('PlateLetter', sql.NVarChar(3), String(v.plate.p3_letter))
        .input('PlateRegion2', sql.NVarChar(2), String(v.plate.p4_two))
        .input('RegistrarNationalCode', sql.NVarChar(20), v.registrarNationalCode ? String(v.registrarNationalCode) : null)
        .input('RegistrarNationality', sql.NVarChar(10), v.registrarNationality ? String(v.registrarNationality) : null)
        .input('InspectionDateJalali', sql.NVarChar(10), String(v.inspectionDate))
        .input('GreenCardDateJalali', sql.NVarChar(10), String(v.greenCardDate))
        .input('InsuranceCompanyId', sql.Int, Number(v.insuranceCompanyId))
        .input('InsurancePolicyNo', sql.NVarChar(50), String(v.insurancePolicyNo))
        .input('InsuranceIssueDateJalali', sql.NVarChar(10), String(v.insuranceIssueDate))
        .input('InsuranceValidDateJalali', sql.NVarChar(10), String(v.insuranceValidDate))
        .input('TechInspectSerial', sql.NVarChar(50), String(v.techInspectSerial))
        .input('TechInspectIssueDateJalali', sql.NVarChar(10), String(v.techInspectIssueDate))
        .input('TechInspectValidDateJalali', sql.NVarChar(10), String(v.techInspectValidDate))
        .query(`INSERT INTO Vehicles(
          VIN, ChassisNo, VehicleKindId, SystemId, SystemTipId, YearManufacture, Capacity, FuelTypeId, TrackerTypeId, Cylinders, Axles, Wheels,
          EngineNo, BodyColor, ActivityCategoryId, IsContainer, PlateTypeId, PlateSerial2, PlateThreeDigits, PlateLetter, PlateRegion2,
          RegistrarNationalCode, RegistrarNationality,
          InspectionDateJalali, GreenCardDateJalali, InsuranceCompanyId, InsurancePolicyNo, InsuranceIssueDateJalali, InsuranceValidDateJalali,
          TechInspectSerial, TechInspectIssueDateJalali, TechInspectValidDateJalali
        ) OUTPUT INSERTED.VehicleID
        VALUES(
          @VIN, @ChassisNo, @VehicleKindId, @SystemId, @SystemTipId, @YearManufacture, @Capacity, @FuelTypeId, @TrackerTypeId, @Cylinders, @Axles, @Wheels,
          @EngineNo, @BodyColor, @ActivityCategoryId, @IsContainer, @PlateTypeId, @PlateSerial2, @PlateThreeDigits, @PlateLetter, @PlateRegion2,
          @RegistrarNationalCode, @RegistrarNationality,
          @InspectionDateJalali, @GreenCardDateJalali, @InsuranceCompanyId, @InsurancePolicyNo, @InsuranceIssueDateJalali, @InsuranceValidDateJalali,
          @TechInspectSerial, @TechInspectIssueDateJalali, @TechInspectValidDateJalali
        )`);
      return res.json({ inserted: true, changed: true, vehicleId: r.recordset?.[0]?.VehicleID });
    }

    // Compare rows to avoid unnecessary update
    if (rowsEqual(cur, v)) {
      return res.json({ inserted: false, changed: false, vehicleId: cur.VehicleID });
    }

    // Update existing
    const r2 = await pool.request()
      .input('VehicleID', sql.BigInt, cur.VehicleID)
      .input('VIN', sql.NVarChar(50), v.vin)
      .input('ChassisNo', sql.NVarChar(50), v.chassisNo)
      .input('VehicleKindId', sql.Int, Number(v.vehicleKindId))
      .input('SystemId', sql.Int, Number(v.systemId))
      .input('SystemTipId', sql.Int, Number(v.systemTipId))
      .input('YearManufacture', sql.Int, Number(v.yearManufacture))
      .input('Capacity', sql.NVarChar(50), String(v.capacity))
      .input('FuelTypeId', sql.Int, Number(v.fuelTypeId))
      .input('TrackerTypeId', sql.Int, Number(v.trackerTypeId))
        .input('Cylinders', sql.Int, Number(v.cylinders))
        .input('Axles', sql.Int, Number(v.axles))
        .input('Wheels', sql.Int, Number(v.wheels))
        .input('EngineNo', sql.NVarChar(50), String(v.engineNo))
      .input('BodyColor', sql.NVarChar(50), String(v.bodyColor))
      .input('ActivityCategoryId', sql.Int, Number(v.activityCategoryId))
      .input('IsContainer', sql.Bit, v.isContainer === 'yes' ? 1 : 0)
      .input('PlateTypeId', sql.Int, Number(v.plateTypeId))
      .input('PlateSerial2', sql.NVarChar(2), String(v.plate.p1_serial2))
      .input('PlateThreeDigits', sql.NVarChar(3), String(v.plate.p2_three))
      .input('PlateLetter', sql.NVarChar(3), String(v.plate.p3_letter))
      .input('PlateRegion2', sql.NVarChar(2), String(v.plate.p4_two))
      .input('RegistrarNationalCode', sql.NVarChar(20), v.registrarNationalCode ? String(v.registrarNationalCode) : null)
      .input('RegistrarNationality', sql.NVarChar(10), v.registrarNationality ? String(v.registrarNationality) : null)
      .input('InspectionDateJalali', sql.NVarChar(10), String(v.inspectionDate))
      .input('GreenCardDateJalali', sql.NVarChar(10), String(v.greenCardDate))
      .input('InsuranceCompanyId', sql.Int, Number(v.insuranceCompanyId))
      .input('InsurancePolicyNo', sql.NVarChar(50), String(v.insurancePolicyNo))
      .input('InsuranceIssueDateJalali', sql.NVarChar(10), String(v.insuranceIssueDate))
      .input('InsuranceValidDateJalali', sql.NVarChar(10), String(v.insuranceValidDate))
      .input('TechInspectSerial', sql.NVarChar(50), String(v.techInspectSerial))
      .input('TechInspectIssueDateJalali', sql.NVarChar(10), String(v.techInspectIssueDate))
      .input('TechInspectValidDateJalali', sql.NVarChar(10), String(v.techInspectValidDate))
      .query(`UPDATE Vehicles SET
        VIN=@VIN, ChassisNo=@ChassisNo, VehicleKindId=@VehicleKindId, SystemId=@SystemId, SystemTipId=@SystemTipId,
        YearManufacture=@YearManufacture, Capacity=@Capacity, FuelTypeId=@FuelTypeId, TrackerTypeId=@TrackerTypeId,
        Cylinders=@Cylinders, Axles=@Axles, Wheels=@Wheels, EngineNo=@EngineNo, BodyColor=@BodyColor, ActivityCategoryId=@ActivityCategoryId,
        IsContainer=@IsContainer, PlateTypeId=@PlateTypeId, PlateSerial2=@PlateSerial2, PlateThreeDigits=@PlateThreeDigits,
        PlateLetter=@PlateLetter, PlateRegion2=@PlateRegion2, RegistrarNationalCode=@RegistrarNationalCode, RegistrarNationality=@RegistrarNationality,
        InspectionDateJalali=@InspectionDateJalali,
        GreenCardDateJalali=@GreenCardDateJalali, InsuranceCompanyId=@InsuranceCompanyId, InsurancePolicyNo=@InsurancePolicyNo,
        InsuranceIssueDateJalali=@InsuranceIssueDateJalali, InsuranceValidDateJalali=@InsuranceValidDateJalali,
        TechInspectSerial=@TechInspectSerial, TechInspectIssueDateJalali=@TechInspectIssueDateJalali,
        TechInspectValidDateJalali=@TechInspectValidDateJalali,
        ModifiedAt=SYSUTCDATETIME()
        WHERE VehicleID=@VehicleID`);

    return res.json({ inserted: false, changed: true, vehicleId: cur.VehicleID });
  } catch (e) { next(e); }
}

export async function getPersonByNationalCode(req, res, next) {
  try {
    const nationalCode = String(req.params.nationalCode || '').trim();
    if (!nationalCode) return res.status(400).json({ message: 'Missing nationalCode' });
    const pool = await getPool();
    const personQ = await pool.request()
      .input('NationalCode', sql.NVarChar(20), nationalCode)
      .query(`SELECT TOP 1 * FROM Persons WHERE NationalCode=@NationalCode`);
    const person = personQ.recordset?.[0];
    if (!person) return res.status(404).json({ message: 'NOT_FOUND' });
    
    // Get PersonOtherInfo data
    const otherInfoQ = await pool.request()
      .input('NationalCode', sql.NVarChar(20), nationalCode)
      .query(`SELECT TOP 1 * FROM PersonOtherInfo WHERE NationalCode=@NationalCode`);
    const otherInfo = otherInfoQ.recordset?.[0];
    
    const residencesQ = await pool.request()
      .input('NationalCode', sql.NVarChar(20), nationalCode)
      .query(`SELECT * FROM PersonResidences WHERE NationalCode=@NationalCode ORDER BY ResidenceID`);
    const contactsQ = await pool.request()
      .input('NationalCode', sql.NVarChar(20), nationalCode)
      .query(`SELECT * FROM PersonContacts WHERE NationalCode=@NationalCode ORDER BY ContactID`);
    return res.json({
      firstName: person.FirstName,
      lastName: person.LastName,
      fatherName: person.FatherName,
      nationalCode: person.NationalCode,
      idSerial: person.IdSerial,
      birthProvinceId: person.BirthProvinceId,
      birthCityId: person.BirthCityId,
      birthDate: person.BirthDateJalali,
      gender: person.Gender,
      maritalStatus: person.MaritalStatus,
      otherBloodGroup: person.OtherBloodGroup,
      // Get these fields from PersonOtherInfo table if available, otherwise fall back to Persons table
      otherEducationLevel: otherInfo?.EducationLevel || person.OtherEducationLevel,
      otherPhysicalStatus: otherInfo?.PhysicalStatus || person.OtherPhysicalStatus,
      otherMilitaryStatus: otherInfo?.MilitaryStatus || person.OtherMilitaryStatus,
      otherEnglishLevel: otherInfo?.FluencyEnglish || person.OtherEnglishLevel,
      otherVeteranStatus: otherInfo?.SelfSacrificeStatus || person.OtherVeteranStatus,
      residences: (residencesQ.recordset || []).map(r => ({
        provinceId: r.ProvinceId,
        cityId: r.CityId,
        mainStreet: r.MainStreet,
        sideStreet: r.SideStreet,
        district: r.District,
        postalCode: r.PostalCode,
        plaque: r.Plaque,
        unit: r.Unit,
        address: r.Address
      })),
      contacts: (contactsQ.recordset || []).map(c => ({
        type: c.Type,
        value: c.Value,
        isActive: !!c.IsActive
      }))
    });
  } catch (e) { next(e); }
}

export async function getPersonalDocumentContent(req, res, next) {
  try {
    const nationalCode = String(req.params.nationalCode || '').trim();
    const docId = Number(req.params.docId);
    if (!nationalCode || !docId) return res.status(400).json({ message: 'Missing IDs' });
    const pool = await getPool();
    const r = await pool.request()
      .input('DocID', sql.BigInt, docId)
      .input('NationalCode', sql.NVarChar(20), nationalCode)
      .query('SELECT TOP 1 FileContent, MimeType FROM PersonDocuments WHERE DocID=@DocID AND NationalCode=@NationalCode');
    const row = r.recordset?.[0];
    if (!row) return res.status(404).end();
    res.setHeader('Content-Type', row.MimeType || 'application/octet-stream');
    res.send(row.FileContent);
  } catch (e) { next(e); }
}

// ---------------- Company Documents -----------------
export async function listCompanyDocuments(req, res, next) {
  try {
    const nationalId = String(req.params.nationalId || '').trim();
    if (!nationalId) return res.status(400).json({ message: 'Missing nationalId' });
    const pool = await getPool();
    const q = await pool.request()
      .input('NationalId', sql.NVarChar(100), nationalId)
      .query(`
        SELECT d.DocID, d.NationalId, d.LookupDocTypeId, lv.Name AS DocTypeName,
               d.MimeType, d.SizeBytes, d.CreatedAt
        FROM CompanyDocuments d
        LEFT JOIN LookupValue lv ON lv.Id = d.LookupDocTypeId
        WHERE d.NationalId = @NationalId
        ORDER BY d.DocID DESC
      `);
    res.json(q.recordset || []);
  } catch (e) { next(e); }
}

export async function saveCompanyDocument(req, res, next) {
  try {
    const nationalId = String(req.params.nationalId || '').trim();
    const docTypeId = Number(req.body?.docTypeId);
    const f = req.file;
    if (!nationalId) return res.status(400).json({ message: 'Missing nationalId' });
    if (!docTypeId) return res.status(400).json({ message: 'Missing docTypeId' });
    if (!f) return res.status(400).json({ message: 'No file uploaded' });
    if (!String(f.mimetype || '').startsWith('image/')) return res.status(400).json({ message: 'Only image files are allowed' });
    if (f.size > 2 * 1024 * 1024) return res.status(400).json({ message: 'File too large. Max 2MB' });

    const pool = await getPool();
    // Use MERGE to prevent duplicates: if document type exists, UPDATE; otherwise INSERT
    const r = await pool.request()
      .input('NationalId', sql.NVarChar(100), nationalId)
      .input('LookupDocTypeId', sql.Int, docTypeId)
      .input('FileContent', sql.VarBinary(sql.MAX), f.buffer)
      .input('MimeType', sql.NVarChar(100), f.mimetype)
      .input('SizeBytes', sql.Int, f.size)
      .query(`
        MERGE CompanyDocuments AS target
        USING (SELECT @NationalId AS NationalId, @LookupDocTypeId AS LookupDocTypeId) AS source
        ON (target.NationalId = source.NationalId AND target.LookupDocTypeId = source.LookupDocTypeId)
        WHEN MATCHED THEN
          UPDATE SET 
            FileContent = @FileContent,
            MimeType = @MimeType,
            SizeBytes = @SizeBytes,
            CreatedAt = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (NationalId, LookupDocTypeId, FileContent, MimeType, SizeBytes)
          VALUES (@NationalId, @LookupDocTypeId, @FileContent, @MimeType, @SizeBytes)
        OUTPUT INSERTED.*;
      `);
    res.status(201).json(r.recordset?.[0]);
  } catch (e) { next(e); }
}

export async function deleteCompanyDocument(req, res, next) {
  try {
    const nationalId = String(req.params.nationalId || '').trim();
    const docId = Number(req.params.docId);
    if (!nationalId || !docId) return res.status(400).json({ message: 'Missing IDs' });
    const pool = await getPool();
    await pool.request().input('DocID', sql.BigInt, docId).query('DELETE FROM CompanyDocuments WHERE DocID=@DocID');
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function getCompanyDocumentContent(req, res, next) {
  try {
    const nationalId = String(req.params.nationalId || '').trim();
    const docId = Number(req.params.docId);
    if (!nationalId || !docId) return res.status(400).json({ message: 'Missing IDs' });
    const pool = await getPool();
    const r = await pool.request()
      .input('DocID', sql.BigInt, docId)
      .input('NationalId', sql.NVarChar(100), nationalId)
      .query('SELECT TOP 1 FileContent, MimeType FROM CompanyDocuments WHERE DocID=@DocID AND NationalId=@NationalId');
    const row = r.recordset?.[0];
    if (!row) return res.status(404).end();
    res.setHeader('Content-Type', row.MimeType || 'application/octet-stream');
    res.send(row.FileContent);
  } catch (e) { next(e); }
}

// ---------------- Personal Documents -----------------
export async function listPersonalDocuments(req, res, next) {
  try {
    const nationalCode = String(req.params.nationalCode || '').trim();
    if (!nationalCode) return res.status(400).json({ message: 'Missing nationalCode' });
    const pool = await getPool();
    const q = await pool.request()
      .input('NationalCode', sql.NVarChar(20), nationalCode)
      .query(`
        SELECT d.DocID, d.NationalCode, d.LookupDocTypeId, lv.Name AS DocTypeName,
               d.MimeType, d.SizeBytes, d.CreatedAt
        FROM PersonDocuments d
        LEFT JOIN LookupValue lv ON lv.Id = d.LookupDocTypeId
        WHERE d.NationalCode = @NationalCode
        ORDER BY d.DocID DESC
      `);
    res.json(q.recordset || []);
  } catch (e) { next(e); }
}

export async function savePersonalDocument(req, res, next) {
  try {
    const nationalCode = String(req.params.nationalCode || '').trim();
    const docTypeId = Number(req.body?.docTypeId);
    const f = req.file;
    if (!nationalCode) return res.status(400).json({ message: 'Missing nationalCode' });
    if (!docTypeId) return res.status(400).json({ message: 'Missing docTypeId' });
    if (!f) return res.status(400).json({ message: 'No file uploaded' });
    if (!String(f.mimetype || '').startsWith('image/')) return res.status(400).json({ message: 'Only image files are allowed' });
    if (f.size > 2 * 1024 * 1024) return res.status(400).json({ message: 'File too large. Max 2MB' });

    const pool = await getPool();
    // Use MERGE to prevent duplicates: if document type exists, UPDATE; otherwise INSERT
    const r = await pool.request()
      .input('NationalCode', sql.NVarChar(20), nationalCode)
      .input('LookupDocTypeId', sql.Int, docTypeId)
      .input('FileContent', sql.VarBinary(sql.MAX), f.buffer)
      .input('MimeType', sql.NVarChar(100), f.mimetype)
      .input('SizeBytes', sql.Int, f.size)
      .query(`
        MERGE PersonDocuments AS target
        USING (SELECT @NationalCode AS NationalCode, @LookupDocTypeId AS LookupDocTypeId) AS source
        ON (target.NationalCode = source.NationalCode AND target.LookupDocTypeId = source.LookupDocTypeId)
        WHEN MATCHED THEN
          UPDATE SET 
            FileContent = @FileContent,
            MimeType = @MimeType,
            SizeBytes = @SizeBytes,
            CreatedAt = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (NationalCode, LookupDocTypeId, FileContent, MimeType, SizeBytes)
          VALUES (@NationalCode, @LookupDocTypeId, @FileContent, @MimeType, @SizeBytes)
        OUTPUT INSERTED.*;
      `);
    res.status(201).json(r.recordset?.[0]);
  } catch (e) { next(e); }
}

export async function deletePersonalDocument(req, res, next) {
  try {
    const nationalCode = String(req.params.nationalCode || '').trim();
    const docId = Number(req.params.docId);
    if (!nationalCode || !docId) return res.status(400).json({ message: 'Missing IDs' });
    const pool = await getPool();
    await pool.request().input('DocID', sql.BigInt, docId).query('DELETE FROM PersonDocuments WHERE DocID=@DocID');
    res.json({ success: true });
  } catch (e) { next(e); }
}

// ---------------- Vehicle Documents -----------------
export async function listVehicleDocuments(req, res, next) {
  try {
    const vehicleId = Number(req.params.vehicleId);
    if (!vehicleId) return res.status(400).json({ message: 'Missing vehicleId' });
    const pool = await getPool();
    const q = await pool.request()
      .input('VehicleID', sql.BigInt, vehicleId)
      .query(`
        SELECT d.DocID, d.VehicleID, d.LookupDocTypeId, lv.Name AS DocTypeName,
               d.MimeType, d.SizeBytes, d.CreatedAt
        FROM VehicleDocuments d
        LEFT JOIN LookupValue lv ON lv.Id = d.LookupDocTypeId
        WHERE d.VehicleID = @VehicleID
        ORDER BY d.DocID DESC
      `);
    res.json(q.recordset || []);
  } catch (e) { next(e); }
}

export async function saveVehicleDocument(req, res, next) {
  try {
    const vehicleId = Number(req.params.vehicleId);
    const docTypeId = Number(req.body?.docTypeId);
    const f = req.file;
    if (!vehicleId) return res.status(400).json({ message: 'Missing vehicleId' });
    if (!docTypeId) return res.status(400).json({ message: 'Missing docTypeId' });
    if (!f) return res.status(400).json({ message: 'No file uploaded' });
    if (!String(f.mimetype || '').startsWith('image/')) return res.status(400).json({ message: 'Only image files are allowed' });
    if (f.size > 2 * 1024 * 1024) return res.status(400).json({ message: 'File too large. Max 2MB' });

    const pool = await getPool();
    // Use MERGE to prevent duplicates: if document type exists, UPDATE; otherwise INSERT
    const r = await pool.request()
      .input('VehicleID', sql.BigInt, vehicleId)
      .input('LookupDocTypeId', sql.Int, docTypeId)
      .input('FileContent', sql.VarBinary(sql.MAX), f.buffer)
      .input('MimeType', sql.NVarChar(100), f.mimetype)
      .input('SizeBytes', sql.Int, f.size)
      .query(`
        MERGE VehicleDocuments AS target
        USING (SELECT @VehicleID AS VehicleID, @LookupDocTypeId AS LookupDocTypeId) AS source
        ON (target.VehicleID = source.VehicleID AND target.LookupDocTypeId = source.LookupDocTypeId)
        WHEN MATCHED THEN
          UPDATE SET 
            FileContent = @FileContent,
            MimeType = @MimeType,
            SizeBytes = @SizeBytes,
            CreatedAt = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (VehicleID, LookupDocTypeId, FileContent, MimeType, SizeBytes)
          VALUES (@VehicleID, @LookupDocTypeId, @FileContent, @MimeType, @SizeBytes)
        OUTPUT INSERTED.*;
      `);
    res.status(201).json(r.recordset?.[0]);
  } catch (e) { next(e); }
}

export async function deleteVehicleDocument(req, res, next) {
  try {
    const vehicleId = Number(req.params.vehicleId);
    const docId = Number(req.params.docId);
    if (!vehicleId || !docId) return res.status(400).json({ message: 'Missing IDs' });
    const pool = await getPool();
    await pool.request().input('DocID', sql.BigInt, docId).query('DELETE FROM VehicleDocuments WHERE DocID=@DocID');
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function getVehicleDocumentContent(req, res, next) {
  try {
    const vehicleId = Number(req.params.vehicleId);
    const docId = Number(req.params.docId);
    if (!vehicleId || !docId) return res.status(400).json({ message: 'Missing IDs' });
    const pool = await getPool();
    const r = await pool.request()
      .input('DocID', sql.BigInt, docId)
      .input('VehicleID', sql.BigInt, vehicleId)
      .query('SELECT TOP 1 FileContent, MimeType FROM VehicleDocuments WHERE DocID=@DocID AND VehicleID=@VehicleID');
    const row = r.recordset?.[0];
    if (!row) return res.status(404).end();
    res.setHeader('Content-Type', row.MimeType || 'application/octet-stream');
    res.send(row.FileContent);
  } catch (e) { next(e); }
}

// ---------------- Employment Discount Documents -----------------
export async function listEmploymentDiscountDocuments(req, res, next) {
  try {
    const nationalCode = String(req.params.nationalCode || '').trim();
    if (!nationalCode) return res.status(400).json({ message: 'Missing nationalCode' });
    const pool = await getPool();
    const q = await pool.request()
      .input('NationalCode', sql.NVarChar(20), nationalCode)
      .query(`
        SELECT d.DocID, d.NationalCode, d.LookupDocTypeId, lv.Name AS DocTypeName,
               d.Description, d.MimeType, d.SizeBytes, d.CreatedAt
        FROM EmploymentDiscountDocuments d
        LEFT JOIN LookupValue lv ON lv.Id = d.LookupDocTypeId
        WHERE d.NationalCode = @NationalCode
        ORDER BY d.DocID DESC
      `);
    res.json(q.recordset || []);
  } catch (e) { next(e); }
}

export async function saveEmploymentDiscountDocument(req, res, next) {
  try {
    const nationalCode = String(req.params.nationalCode || '').trim();
    const docTypeId = Number(req.body?.docTypeId);
    const description = String(req.body?.description || '').trim();
    const f = req.file;
    if (!nationalCode) return res.status(400).json({ message: 'Missing nationalCode' });
    if (!docTypeId) return res.status(400).json({ message: 'Missing docTypeId' });
    if (!f) return res.status(400).json({ message: 'No file uploaded' });
    if (!String(f.mimetype || '').startsWith('image/')) return res.status(400).json({ message: 'Only image files are allowed' });
    if (f.size > 2 * 1024 * 1024) return res.status(400).json({ message: 'File too large. Max 2MB' });

    const pool = await getPool();
    
    // Delete existing document of the same type for this person
    await pool.request()
      .input('NationalCode', sql.NVarChar(20), nationalCode)
      .input('LookupDocTypeId', sql.Int, docTypeId)
      .query('DELETE FROM EmploymentDiscountDocuments WHERE NationalCode=@NationalCode AND LookupDocTypeId=@LookupDocTypeId');

    // Insert new document (store file in database as VARBINARY)
    const r = await pool.request()
      .input('NationalCode', sql.NVarChar(20), nationalCode)
      .input('LookupDocTypeId', sql.Int, docTypeId)
      .input('FileContent', sql.VarBinary(sql.MAX), f.buffer)
      .input('MimeType', sql.NVarChar(100), f.mimetype)
      .input('SizeBytes', sql.Int, f.size)
      .input('Description', sql.NVarChar(1000), description)
      .query(`
        INSERT INTO EmploymentDiscountDocuments (NationalCode, LookupDocTypeId, FileContent, MimeType, SizeBytes, Description)
        OUTPUT INSERTED.DocID, INSERTED.NationalCode, INSERTED.LookupDocTypeId, INSERTED.CreatedAt, INSERTED.Description, INSERTED.MimeType, INSERTED.SizeBytes
        VALUES (@NationalCode, @LookupDocTypeId, @FileContent, @MimeType, @SizeBytes, @Description)
      `);
    
    const inserted = r.recordset?.[0];
    if (inserted) {
      // Get document type name
      const docTypeResult = await pool.request()
        .input('LookupDocTypeId', sql.Int, docTypeId)
        .query('SELECT Name FROM LookupValue WHERE Id = @LookupDocTypeId');
      inserted.DocTypeName = docTypeResult.recordset?.[0]?.Name || '';
    }
    
    res.status(201).json(inserted);
  } catch (e) { next(e); }
}

export async function deleteEmploymentDiscountDocument(req, res, next) {
  try {
    const nationalCode = String(req.params.nationalCode || '').trim();
    const docId = Number(req.params.docId);
    if (!nationalCode || !docId) return res.status(400).json({ message: 'Missing IDs' });
    const pool = await getPool();
    await pool.request()
      .input('DocID', sql.BigInt, docId)
      .input('NationalCode', sql.NVarChar(20), nationalCode)
      .query('DELETE FROM EmploymentDiscountDocuments WHERE DocID=@DocID AND NationalCode=@NationalCode');
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function getEmploymentDiscountDocumentContent(req, res, next) {
  try {
    const nationalCode = String(req.params.nationalCode || '').trim();
    const docId = Number(req.params.docId);
    if (!nationalCode || !docId) return res.status(400).json({ message: 'Missing IDs' });
    const pool = await getPool();
    const r = await pool.request()
      .input('DocID', sql.BigInt, docId)
      .input('NationalCode', sql.NVarChar(20), nationalCode)
      .query('SELECT TOP 1 FileContent, MimeType FROM EmploymentDiscountDocuments WHERE DocID=@DocID AND NationalCode=@NationalCode');
    const row = r.recordset?.[0];
    if (!row || !row.FileContent) return res.status(404).end();
    res.setHeader('Content-Type', row.MimeType || 'application/octet-stream');
    res.send(row.FileContent);
  } catch (e) { next(e); }
}

// ---------------- Create Employment License Request -----------------
export async function createEmploymentRequest(req, res, next) {
  try {
    const nationalCode = String(req.body?.nationalCode || '').trim();
    const licenseTypeId = Number(req.body?.licenseTypeId);
    const operationTypeId = Number(req.body?.operationTypeId);
    const finalDescription = String(req.body?.finalDescription || '').trim() || null;
    const vehicleId = req.body?.vehicleId ? Number(req.body.vehicleId) : null;
    
    if (!nationalCode) return res.status(400).json({ message: 'Missing nationalCode' });
    if (!licenseTypeId) return res.status(400).json({ message: 'Missing licenseTypeId' });
    if (!operationTypeId) return res.status(400).json({ message: 'Missing operationTypeId' });

    const pool = await getPool();
    const userId = req.user?.id || null;
    
    // Generate tracking number for employment license
    // Format: 2XYY-NNNNN (similar to activity but starts with 2)
    // 2 = fixed digit for employment
    // X = Vehicle type based on capacity (1-4 based on kg) - same as activity license
    // YY = Activity category code from lookup table - same as activity license
    // NNNNN = sequential number per prefix
    
    if (!vehicleId) {
      return res.status(400).json({ message: 'Missing vehicleId for employment license' });
    }
    
    // Check if this is a renewal request with an existing tracking number
    const existingTrackingNo = req.body?.existingTrackingNo || null;
    const isRenewal = req.body?.isRenewal || false;
    
    if (isRenewal && existingTrackingNo) {
      console.log(`🔄 Employment license renewal - using EXISTING tracking number: ${existingTrackingNo}`);
    }
    
    // Get vehicle capacity and activity category (same as activity license logic)
    const vehicleResult = await pool.request()
      .input('VehicleID', sql.BigInt, vehicleId)
      .query(`
        SELECT 
          v.Capacity,
          v.ActivityCategoryId,
          lv.Code AS ActivityCategoryCode
        FROM Vehicles v
        LEFT JOIN LookupValue lv ON lv.Id = v.ActivityCategoryId
        WHERE v.VehicleID = @VehicleID
      `);
    
    if (!vehicleResult.recordset || vehicleResult.recordset.length === 0) {
      return res.status(400).json({ message: 'Vehicle not found' });
    }
    
    const vehicle = vehicleResult.recordset[0];
    const capacityTon = parseFloat(vehicle.Capacity) || 0;
    const capacityKg = capacityTon * 1000; // Convert ton to kg
    const activityCode = vehicle.ActivityCategoryCode || '00';
    
    // Determine vehicle type based on capacity (in kg) - same logic as activity license
    let vehicleType;
    if (capacityKg >= 0 && capacityKg <= 499) {
      vehicleType = '1';
    } else if (capacityKg >= 500 && capacityKg <= 3500) {
      vehicleType = '2';
    } else if (capacityKg >= 3501 && capacityKg <= 6000) {
      vehicleType = '3';
    } else if (capacityKg >= 6001 && capacityKg <= 100000) {
      vehicleType = '4';
    } else {
      vehicleType = '4'; // Default to 4 if out of range
    }
    
    // Pad activity code to ensure it's always 2 digits
    const paddedActivityCode = activityCode.toString().padStart(2, '0');
    
    // Build the prefix for this vehicle type and activity: 2XYY
    const prefix = `2${vehicleType}${paddedActivityCode}`;
    
    // Generate tracking number - use existing one for renewal
    let trackingNo;
    if (isRenewal && existingTrackingNo) {
      // For renewal, reuse the existing tracking number (same license number)
      trackingNo = existingTrackingNo;
      console.log(`🔄 Using EXISTING tracking number for renewal: ${trackingNo}`);
    } else {
      // For new requests, generate a new tracking number
      // Get the next sequential number from SequenceCounters table
      // Use 'DEFAULT' to have a single shared counter for all employment licenses
      // This prevents duplicate numbers even if records are deleted
      const sequentialNumber = await getNextSequence(pool, 'Employment', 'DEFAULT');
      
      // Format: 2XYY-NNNNN
      trackingNo = `${prefix}-${sequentialNumber.toString().padStart(5, '0')}`;
      console.log(`📊 Generated employment tracking number: ${trackingNo} (Capacity: ${capacityKg}kg, Type: ${vehicleType}, Activity: ${paddedActivityCode}, Seq: ${sequentialNumber})`);
    }
    
    console.log('=== createEmploymentRequest Debug ===');
    console.log('nationalCode:', nationalCode);
    console.log('licenseTypeId:', licenseTypeId);
    console.log('operationTypeId:', operationTypeId);
    console.log('vehicleId:', vehicleId);
    console.log('trackingNo:', trackingNo);
    console.log('userId:', userId);
    console.log('=====================================');
    
    // Check for existing PENDING employment request for this person and vehicle
    // For renewal (تمدید), we only block if there's a PENDING request (not yet processed)
    // Approved/Completed/Expired licenses should NOT block renewal
    const duplicateCheck = await pool.request()
      .input('NationalCode', sql.NVarChar(20), nationalCode)
      .input('VehicleID', sql.Int, vehicleId)
      .query(`
        SELECT TOP 1 r.RequestID, r.TrackingNo, r.Status
        FROM VehicleRequests r
        WHERE r.NationalCode = @NationalCode 
          AND r.VehicleID = @VehicleID
          AND r.LicenseTypeId = 67 -- Employment License Type ID
          AND r.Status = 'Pending'
      `);

    if (duplicateCheck.recordset.length > 0) {
      const existing = duplicateCheck.recordset[0];
      console.log(`❌ Duplicate employment request found: RequestID=${existing.RequestID}, Status=${existing.Status}`);
      return res.status(400).json({ 
        success: false,
        message: `شما یک درخواست فعال برای این خودرو دارید. وضعیت: ${existing.Status}\nشماره پیگیری: ${existing.TrackingNo}`,
        trackingNo: existing.TrackingNo,
        requestId: existing.RequestID,
        status: existing.Status
      });
    }
    
    // Check if there's an approved/completed license (this is normal for renewal)
    const approvedCheck = await pool.request()
      .input('NationalCode', sql.NVarChar(20), nationalCode)
      .input('VehicleID', sql.Int, vehicleId)
      .query(`
        SELECT TOP 1 r.RequestID, r.TrackingNo, r.Status
        FROM VehicleRequests r
        WHERE r.NationalCode = @NationalCode 
          AND r.VehicleID = @VehicleID
          AND r.LicenseTypeId = 67 -- Employment License Type ID
          AND r.Status IN ('Approved', 'Completed')
        ORDER BY r.CreatedAt DESC
      `);
    
    if (approvedCheck.recordset.length > 0) {
      // This is an expired/completed license - renewal is allowed
      const approved = approvedCheck.recordset[0];
      console.log(`ℹ️ Found existing approved employment license: ${approved.TrackingNo}, allowing renewal`);
    }

    // Check if person has discount documents
    const discountDocsCheck = await pool.request()
      .input('NationalCode', sql.NVarChar(20), nationalCode)
      .query(`SELECT COUNT(*) AS Count FROM EmploymentDiscountDocuments WHERE NationalCode = @NationalCode`);
    
    const hasDiscountDocs = discountDocsCheck.recordset[0].Count > 0;
    
    // Get tariff amount
    const tariffResult = await pool.request()
      .query(`SELECT TOP 1 Amount FROM Tariffs ORDER BY Id DESC`);
    
    const tariffAmount = tariffResult.recordset[0]?.Amount || 500000; // Default 500K for employment
    
    // Set discount status
    const discountStatus = hasDiscountDocs ? 'Pending' : 'None';
    
    console.log(`📝 Creating employment request for ${nationalCode}: hasDiscountDocs=${hasDiscountDocs}, discountStatus=${discountStatus}, tariffAmount=${tariffAmount}`);
    
    const r = await pool.request()
      .input('NationalCode', sql.NVarChar(20), nationalCode)
      .input('VehicleID', sql.BigInt, vehicleId)
      .input('LicenseTypeId', sql.Int, licenseTypeId)
      .input('OperationTypeId', sql.Int, operationTypeId)
      .input('FinalDescription', sql.NVarChar(2000), finalDescription)
      .input('TrackingNo', sql.NVarChar(30), trackingNo)
      .input('SubmittedByUserId', sql.Int, userId)
      .input('DiscountStatus', sql.NVarChar(20), discountStatus)
      .input('OriginalAmount', sql.Decimal(18, 2), tariffAmount)
      .input('FinalAmount', sql.Decimal(18, 2), tariffAmount)
      .query(`INSERT INTO VehicleRequests (NationalCode, VehicleID, LicenseTypeId, OperationTypeId, FinalDescription, TrackingNo, SubmittedByUserId, DiscountStatus, OriginalAmount, FinalAmount)
              OUTPUT INSERTED.RequestID, INSERTED.TrackingNo, INSERTED.DiscountStatus
              VALUES (@NationalCode, @VehicleID, @LicenseTypeId, @OperationTypeId, @FinalDescription, @TrackingNo, @SubmittedByUserId, @DiscountStatus, @OriginalAmount, @FinalAmount)`);
    const row = r.recordset?.[0];
    
    // Link discount documents to this request if they exist
    if (hasDiscountDocs && row?.RequestID) {
      console.log(`📝 Linking discount documents to employment request ${row.RequestID}`);
      
      await pool.request()
        .input('RequestID', sql.BigInt, row.RequestID)
        .input('NationalCode', sql.NVarChar(20), nationalCode)
        .query(`
          UPDATE EmploymentDiscountDocuments
          SET RequestID = @RequestID
          WHERE NationalCode = @NationalCode AND RequestID IS NULL
        `);
    }
    
    // Initialize Employment approval workflow from GlobalApprovalFlowSteps
    if (row?.RequestID) {
      console.log(`📝 Initializing Employment approval workflow for request ${row.RequestID}`);
      
      // Determine which license type to use for workflow
      // For renewal (existingTrackingNo provided), use 'Employment_Renewal'
      // For new requests, use 'Employment'
      const licenseTypeForWorkflow = existingTrackingNo ? 'Employment_Renewal' : 'Employment';
      console.log(`📝 Using license type for workflow: ${licenseTypeForWorkflow} (existingTrackingNo: ${existingTrackingNo ? 'yes' : 'no'})`);
      
      // Get Employment approval flow
      const flowResult = await pool.request()
        .input('LicenseType', sql.NVarChar(20), licenseTypeForWorkflow)
        .query('SELECT StepOrder, RoleName FROM GlobalApprovalFlowSteps WHERE LicenseType = @LicenseType ORDER BY StepOrder');
      
      if (flowResult.recordset && flowResult.recordset.length > 0) {
        // Create workflow steps based on Employment flow
        // ALL steps start as NotStarted - they will become Pending after payment
        // Employment licenses require payment first, so workflow doesn't start immediately
        for (const step of flowResult.recordset) {
          await pool.request()
            .input('RequestID', sql.BigInt, row.RequestID)
            .input('StepOrder', sql.Int, step.StepOrder)
            .input('RoleName', sql.NVarChar(50), step.RoleName)
            .input('Status', sql.NVarChar(20), 'NotStarted') // All steps NotStarted until payment
            .input('Notes', sql.NVarChar(2000), null)
            .query(`
              INSERT INTO RequestWorkflowSteps (RequestID, StepOrder, RoleName, Status, Notes, CreatedAt)
              VALUES (@RequestID, @StepOrder, @RoleName, @Status, @Notes, GETDATE())
            `);
        }
        
        // Update request status to Pending (awaiting payment)
        // CurrentStepOrder stays 0 (no active step yet)
        await pool.request()
          .input('RequestID', sql.BigInt, row.RequestID)
          .input('Status', sql.NVarChar(20), 'Pending') // Pending payment
          .input('CurrentStepOrder', sql.Int, 0)
          .query(`
            UPDATE VehicleRequests 
            SET Status = @Status, CurrentStepOrder = @CurrentStepOrder
            WHERE RequestID = @RequestID
          `);
        
        console.log(`✅ Employment approval workflow initialized for request ${row.RequestID} with ${flowResult.recordset.length} steps (all NotStarted until payment)`);
      } else {
        console.warn('⚠️ No Employment approval flow defined in GlobalApprovalFlowSteps!');
      }
    }
    
    return res.status(201).json({ 
      requestId: row?.RequestID, 
      trackingNo: row?.TrackingNo,
      discountStatus: row?.DiscountStatus,
      hasDiscountDocs: hasDiscountDocs,
      requiresDiscountApproval: hasDiscountDocs
    });
  } catch (e) { next(e); }
}

