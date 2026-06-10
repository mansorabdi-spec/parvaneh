import express from 'express';
import { sql, getPool } from '../lib/db.js';

const router = express.Router();

/**
 * Get plate expiry dates for specific license types
 * Returns IssueDate and ExpiryDate for LicenseTypeId 66 or 137
 */
router.get('/plate-expiry', async (req, res) => {
  try {
    const { 
      plateNumber,
      plateThreeDigits,
      plateLetter,
      plateRegion2,
      plateSerial2 
    } = req.query;
    
    // If individual plate parts are provided, use them
    if (plateThreeDigits && plateLetter && plateRegion2 && plateSerial2) {
      const pool = await getPool();
      
      const result = await pool.request()
        .input('PlateThreeDigits', sql.NVarChar, plateThreeDigits.trim())
        .input('PlateLetter', sql.NVarChar, plateLetter.trim())
        .input('PlateRegion2', sql.NVarChar, plateRegion2.trim())
        .input('PlateSerial2', sql.NVarChar, plateSerial2.trim())
        .query(`
          SELECT TOP 1
            lh.IssueDate,
            lh.ExpiryDate
          FROM LicenseHistory lh
          INNER JOIN Vehicles v ON lh.VehicleID = v.VehicleID
          WHERE lh.LicenseTypeId IN (66, 137)
            AND TRIM(v.PlateThreeDigits) = @PlateThreeDigits
            AND TRIM(v.PlateLetter) = @PlateLetter
            AND TRIM(v.PlateRegion2) = @PlateRegion2
            AND TRIM(v.PlateSerial2) = @PlateSerial2
          ORDER BY lh.CreatedAt DESC
        `);

      if (!result.recordset || result.recordset.length === 0) {
        const oldResult = await pool.request()
          .input('PlateThreeDigits', sql.NVarChar, plateThreeDigits.trim())
          .input('PlateLetter', sql.NVarChar, plateLetter.trim())
          .input('PlateRegion2', sql.NVarChar, plateRegion2.trim())
          .input('PlateSerial2', sql.NVarChar, plateSerial2.trim())
          .query(`
            SELECT TOP 1
              ol.IssueDate,
              ol.ExpiryDate
            FROM oldlicense ol
            WHERE TRIM(ol.PlateThreeDigits) = @PlateThreeDigits
              AND TRIM(ol.PlateLetter) = @PlateLetter
              AND TRIM(ol.PlateRegion2) = @PlateRegion2
              AND TRIM(ol.PlateSerial2) = @PlateSerial2
            ORDER BY ol.Id DESC
          `);

        return res.json({
          success: true,
          data: oldResult.recordset?.[0] || null,
          count: oldResult.recordset?.[0] ? 1 : 0
        });
      }

      res.json({
        success: true,
        data: result.recordset?.[0] || null,
        count: result.recordset?.[0] ? 1 : 0
      });
      return;
    }
    
    // Original logic for full plate number
    if (!plateNumber) {
      return res.status(400).json({ 
        message: 'شماره پلاک یا اجزای پلاک الزامی است' 
      });
    }

    const pool = await getPool();
    
    const result = await pool.request()
      .input('PlateNumber', sql.NVarChar, plateNumber)
      .query(`
        SELECT TOP 1
          lh.IssueDate,
          lh.ExpiryDate
        FROM LicenseHistory lh
        INNER JOIN Vehicles v ON lh.VehicleID = v.VehicleID
        WHERE lh.LicenseTypeId IN (66, 137)
          AND (
            -- Plate format: ThreeDigits + Letter + TwoDigits + Region + Serial
            -- Trim char fields to remove padding
            TRIM(v.PlateThreeDigits) + TRIM(v.PlateLetter) + TRIM(v.PlateRegion2) + TRIM(v.PlateSerial2) LIKE @PlateNumber OR
            -- Alternative plate formats
            TRIM(v.PlateThreeDigits) LIKE @PlateNumber OR
            TRIM(v.PlateLetter) LIKE @PlateNumber OR
            TRIM(v.PlateRegion2) LIKE @PlateNumber OR
            TRIM(v.PlateSerial2) LIKE @PlateNumber
          )
        ORDER BY lh.CreatedAt DESC
      `);

    if (!result.recordset || result.recordset.length === 0) {
      const oldResult = await pool.request()
        .input('PlateNumber', sql.NVarChar, plateNumber)
        .query(`
          SELECT TOP 1
            ol.IssueDate,
            ol.ExpiryDate
          FROM oldlicense ol
          WHERE (
            TRIM(ol.PlateThreeDigits) + TRIM(ol.PlateLetter) + TRIM(ol.PlateRegion2) + TRIM(ol.PlateSerial2) LIKE @PlateNumber OR
            TRIM(ol.PlateThreeDigits) LIKE @PlateNumber OR
            TRIM(ol.PlateLetter) LIKE @PlateNumber OR
            TRIM(ol.PlateRegion2) LIKE @PlateNumber OR
            TRIM(ol.PlateSerial2) LIKE @PlateNumber
          )
          ORDER BY ol.Id DESC
        `);

      return res.json({
        success: true,
        data: oldResult.recordset?.[0] || null,
        count: oldResult.recordset?.[0] ? 1 : 0
      });
    }

    res.json({
      success: true,
      data: result.recordset?.[0] || null,
      count: result.recordset?.[0] ? 1 : 0
    });

  } catch (error) {
    console.error('Error getting plate expiry dates:', error);
    res.status(500).json({ 
      message: 'خطا در دریافت اطلاعات پلاک',
      error: error.message 
    });
  }
});

/**
 * Get plate expiry details by HistoryID
 */
router.get('/plate-expiry/:historyId', async (req, res) => {
  try {
    const { historyId } = req.params;
    
    if (!historyId) {
      return res.status(400).json({ 
        message: 'شناسه تاریخچه الزامی است' 
      });
    }

    const pool = await getPool();
    
    const result = await pool.request()
      .input('HistoryID', sql.BigInt, historyId)
      .query(`
        SELECT 
          lh.HistoryID,
          lh.TrackingNo,
          lh.LicenseTypeId,
          lh.LicenseTypeName,
          lh.EventType,
          lh.IssueDate,
          lh.ExpiryDate,
          lh.IssueDateGregorian,
          lh.ExpiryDateGregorian,
          lh.ValidityDurationMonths,
          lh.Status,
          lh.NationalCode,
          lh.CompanyNationalId,
          lh.VehicleID,
          lh.IssuedByUserId,
          lh.IssuedByUsername,
          lh.IssuedByRole,
          lh.CreatedAt,
          lh.UpdatedAt,
          -- Vehicle information
          v.VIN,
          v.ChassisNo,
          v.PlateThreeDigits,
          v.PlateLetter,
          v.PlateRegion2,
          v.PlateSerial2,
          -- Person/Company information
          p.FirstName,
          p.LastName,
          ci.CompanyName
        FROM LicenseHistory lh
        LEFT JOIN Vehicles v ON lh.VehicleID = v.VehicleID
        LEFT JOIN Persons p ON lh.NationalCode = p.NationalCode
        LEFT JOIN CompanyInfo ci ON lh.CompanyNationalId = ci.NationalId
        WHERE lh.HistoryID = @HistoryID
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ 
        message: 'رکوردی با این شناسه یافت نشد' 
      });
    }

    res.json({
      success: true,
      data: result.recordset[0]
    });

  } catch (error) {
    console.error('Error getting plate expiry details:', error);
    res.status(500).json({ 
      message: 'خطا در دریافت جزئیات پلاک',
      error: error.message 
    });
  }
});

export default router;
