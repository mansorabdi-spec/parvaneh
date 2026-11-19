import { getPool, sql } from '../lib/db.js';

// ---------------- Get Request Details by Tracking Number -----------------
export async function getRequestByTracking(req, res, next) {
  try {
    const trackingNo = String(req.params.trackingNo || '').trim();
    if (!trackingNo) return res.status(400).json({ message: 'Missing trackingNo' });

    const pool = await getPool();
    const result = await pool.request()
      .input('TrackingNo', sql.NVarChar(30), trackingNo)
      .query(`
        SELECT TOP 1
          r.RequestID,
          r.VehicleID,
          r.NationalCode,
          r.CompanyNationalId,
          r.LicenseTypeId,
          r.OperationTypeId,
          r.TrackingNo,
          r.Status,
          r.DiscountStatus,
          r.OriginalAmount,
          r.FinalAmount,
          r.FinalDescription,
          r.SubmittedByUserId,
          r.CreatedAt,
          r.TonnageFromTon,
          r.TonnageToTon,
          lt.Name as LicenseTypeName,
          ot.Name as OperationTypeName
        FROM VehicleRequests r
        LEFT JOIN LookupValue lt ON r.LicenseTypeId = lt.Id
        LEFT JOIN LookupValue ot ON r.OperationTypeId = ot.Id
        WHERE r.TrackingNo = @TrackingNo
        ORDER BY r.RequestID DESC
      `);

    if (!result.recordset || result.recordset.length === 0) {
      return res.status(404).json({ message: 'Request not found' });
    }

    return res.json(result.recordset[0]);
  } catch (e) { 
    console.error('Error fetching request by tracking:', e);
    next(e); 
  }
}

// ---------------- Get Request Details by RequestID -----------------
export async function getRequestDetails(req, res, next) {
  try {
    const requestId = Number(req.params.requestId);
    if (!requestId) return res.status(400).json({ message: 'Missing requestId' });

    const pool = await getPool();
    const result = await pool.request()
      .input('RequestID', sql.BigInt, requestId)
      .query(`
        SELECT 
          r.RequestID,
          r.VehicleID,
          r.NationalCode,
          r.CompanyNationalId,
          r.LicenseTypeId,
          r.OperationTypeId,
          r.TrackingNo,
          r.Status,
          r.DiscountStatus,
          r.OriginalAmount,
          r.FinalAmount,
          r.FinalDescription,
          r.SubmittedByUserId,
          r.CreatedAt,
          r.TonnageFromTon,
          r.TonnageToTon,
          lt.Name as LicenseTypeName,
          ot.Name as OperationTypeName
        FROM VehicleRequests r
        LEFT JOIN LookupValue lt ON r.LicenseTypeId = lt.Id
        LEFT JOIN LookupValue ot ON r.OperationTypeId = ot.Id
        WHERE r.RequestID = @RequestID
      `);

    if (!result.recordset || result.recordset.length === 0) {
      return res.status(404).json({ message: 'Request not found' });
    }

    return res.json(result.recordset[0]);
  } catch (e) { 
    console.error('Error fetching request details:', e);
    next(e); 
  }
}

// ---------------- Get Vehicle by National Code -----------------
export async function getVehicleByNationalCode(req, res, next) {
  try {
    const nationalCode = String(req.params.nationalCode || '').trim();
    if (!nationalCode) return res.status(400).json({ message: 'Missing nationalCode' });

    const pool = await getPool();
    
    // Find the most recent vehicle registered by this person
    // Vehicles are linked to persons through RegistrarNationalCode column
    const result = await pool.request()
      .input('NationalCode', sql.NVarChar(20), nationalCode)
      .query(`
        SELECT TOP 1
          VehicleID,
          PlateTypeId,
          PlateSerial2,
          PlateThreeDigits,
          PlateLetter,
          PlateRegion2,
          VIN,
          ChassisNo,
          EngineNo,
          YearManufacture,
          BodyColor,
          Capacity,
          VehicleKindId,
          SystemId,
          SystemTipId,
          FuelTypeId,
          TrackerTypeId,
          Cylinders,
          Axles,
          ActivityCategoryId,
          IsContainer,
          InsuranceCompanyId,
          InsurancePolicyNo,
          TechInspectSerial,
          RegistrarNationalCode,
          CreatedAt
        FROM Vehicles
        WHERE RegistrarNationalCode = @NationalCode
        ORDER BY CreatedAt DESC
      `);

    if (!result.recordset || result.recordset.length === 0) {
      console.log(`⚠️ No vehicle found for national code: ${nationalCode}`);
      return res.status(404).json({ message: 'No vehicle found for this national code' });
    }

    console.log(`✅ Vehicle found for national code ${nationalCode}:`, result.recordset[0].VehicleID);
    return res.json(result.recordset[0]);
  } catch (e) { 
    console.error('Error fetching vehicle by national code:', e);
    next(e); 
  }
}
