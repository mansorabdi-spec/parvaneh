import { getPool, sql } from '../lib/db.js';

export async function getVehicleByTracking(req, res, next) {
  try {
    const trackingNo = String(req.params.trackingNo || '').trim();
    if (!trackingNo) return res.status(400).json({ message: 'trackingNo is required' });
    const pool = await getPool();
    const q = await pool.request().input('t', sql.NVarChar(30), trackingNo)
      .query(`SELECT v.VehicleID, v.Capacity, r.RequestID, r.TrackingNo
              FROM VehicleRequests r
              JOIN Vehicles v ON v.VehicleID = r.VehicleID
              WHERE r.TrackingNo = @t`);
    const row = q.recordset[0];
    if (!row) return res.status(404).json({ message: 'Vehicle not found for this tracking number' });
    res.json(row);
  } catch (e) { next(e); }
}

export async function getVehicleById(req, res, next) {
  try {
    const vehicleId = Number(req.params.vehicleId)
    if (!vehicleId) return res.status(400).json({ message: 'vehicleId is required' })

    const pool = await getPool()
    const q = await pool.request()
      .input('VehicleID', sql.BigInt, vehicleId)
      .query(`
        SELECT TOP 1 *
        FROM Vehicles
        WHERE VehicleID = @VehicleID
      `)

    const row = q.recordset[0]
    if (!row) return res.status(404).json({ message: 'Vehicle not found' })
    res.json(row)
  } catch (e) { next(e) }
}

export async function validateVehiclePlate(req, res, next) {
  try {
    const { plateTypeId, p1_serial2, p2_three, p3_letter, p4_two } = req.body;
    
    console.log('🔍 Validating plate with data:', { 
      plateTypeId, 
      p1_serial2, 
      p2_three, 
      p3_letter, 
      p4_two,
      body: req.body
    });
    
    // Validate required fields
    if (!plateTypeId || !p1_serial2 || !p2_three || !p3_letter || !p4_two) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ 
        exists: false, 
        message: 'تمام فیلدهای پلاک الزامی است' 
      });
    }

    const pool = await getPool();
    
    // Check if vehicle exists with this plate (regardless of owner)
    const query = `
      SELECT TOP 1 
        v.VehicleID, 
        v.PlateTypeId,
        v.PlateSerial2,
        v.PlateThreeDigits,
        v.PlateLetter,
        v.PlateRegion2,
        v.Capacity,
        v.RegistrarNationalCode
      FROM Vehicles v
      WHERE v.PlateTypeId = @plateTypeId
        AND v.PlateSerial2 = @p1
        AND v.PlateThreeDigits = @p2
        AND v.PlateLetter = @p3
        AND v.PlateRegion2 = @p4
    `;
    
    const request = pool.request()
      .input('plateTypeId', sql.Int, plateTypeId)
      .input('p1', sql.NVarChar(2), p1_serial2)
      .input('p2', sql.NVarChar(3), p2_three)
      .input('p3', sql.NVarChar(10), p3_letter)
      .input('p4', sql.NVarChar(2), p4_two);
    
    console.log('🔍 Executing SQL with parameters:', {
      plateTypeId: { type: 'Int', value: plateTypeId },
      p1: { type: 'NVarChar(2)', value: p1_serial2 },
      p2: { type: 'NVarChar(3)', value: p2_three },
      p3: { type: 'NVarChar(10)', value: p3_letter },
      p4: { type: 'NVarChar(2)', value: p4_two }
    });
    console.log('🔍 SQL Query:', query);
    
    const result = await request.query(query);
    
    console.log('🔍 Query result:', {
      recordCount: result.recordset.length,
      records: result.recordset
    });

    if (result.recordset.length > 0) {
      const vehicle = result.recordset[0];
      return res.json({ 
        exists: true, 
        message: 'پلاک خودرو در سیستم موجود است',
        vehicle: vehicle
      });
    } else {
      return res.json({ 
        exists: false, 
        message: 'پلاک خودرو در سیستم موجود نیست. لطفاً ابتدا خودرو را ثبت کنید.' 
      });
    }
  } catch (error) {
    console.error('Error validating vehicle plate:', error);
    next(error);
  }
}
