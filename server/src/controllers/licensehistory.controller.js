import { sql, getPool } from '../lib/db.js';

export async function createLicenseHistory(req, res, next) {
  try {
    const {
      requestId,
      trackingNo,
      licenseTypeId,
      licenseTypeName,
      operationTypeId,
      operationTypeName,
      eventType,
      vehicleId,
      nationalCode,
      companyNationalId,
      issueDate,
      expiryDate,
      issueDateGregorian,
      expiryDateGregorian,
      validityDurationMonths,
      status,
      issuedByUserId,
      issuedByUsername,
      issuedByRole,
      notes,
      metadata
    } = req.body;

    const pool = await getPool();

    const result = await pool.request()
      .input('RequestID', sql.BigInt, requestId)
      .input('TrackingNo', sql.NVarChar(30), trackingNo)
      .input('LicenseTypeId', sql.Int, licenseTypeId)
      .input('LicenseTypeName', sql.NVarChar(200), licenseTypeName)
      .input('OperationTypeId', sql.Int, operationTypeId)
      .input('OperationTypeName', sql.NVarChar(200), operationTypeName)
      .input('EventType', sql.NVarChar(50), eventType)
      .input('VehicleID', sql.BigInt, vehicleId || null)
      .input('NationalCode', sql.NVarChar(20), nationalCode || null)
      .input('CompanyNationalId', sql.NVarChar(100), companyNationalId || null)
      .input('IssueDate', sql.NVarChar(10), issueDate)
      .input('ExpiryDate', sql.NVarChar(10), expiryDate)
      .input('IssueDateGregorian', sql.DateTime2, issueDateGregorian || null)
      .input('ExpiryDateGregorian', sql.DateTime2, expiryDateGregorian || null)
      .input('ValidityDurationMonths', sql.Int, validityDurationMonths || null)
      .input('Status', sql.NVarChar(20), status)
      .input('IssuedByUserId', sql.Int, issuedByUserId || null)
      .input('IssuedByUsername', sql.NVarChar(150), issuedByUsername || null)
      .input('IssuedByRole', sql.NVarChar(50), issuedByRole || null)
      .input('Notes', sql.NVarChar(sql.MAX), notes || null)
      .input('Metadata', sql.NVarChar(sql.MAX), metadata || null)
      .query(`
        INSERT INTO LicenseHistory (
          RequestID, TrackingNo, LicenseTypeId, LicenseTypeName, OperationTypeId, OperationTypeName,
          EventType, VehicleID, NationalCode, CompanyNationalId, IssueDate, ExpiryDate,
          IssueDateGregorian, ExpiryDateGregorian, ValidityDurationMonths, Status,
          IssuedByUserId, IssuedByUsername, IssuedByRole, Notes, Metadata
        )
        OUTPUT INSERTED.HistoryID
        VALUES (
          @RequestID, @TrackingNo, @LicenseTypeId, @LicenseTypeName, @OperationTypeId, @OperationTypeName,
          @EventType, @VehicleID, @NationalCode, @CompanyNationalId, @IssueDate, @ExpiryDate,
          @IssueDateGregorian, @ExpiryDateGregorian, @ValidityDurationMonths, @Status,
          @IssuedByUserId, @IssuedByUsername, @IssuedByRole, @Notes, @Metadata
        )
      `);

    res.status(201).json({
      success: true,
      message: 'License history record created successfully',
      historyId: result.recordset[0].HistoryID
    });
  } catch (error) {
    next(error);
  }
}

export async function getLicenseHistoryByRequest(req, res, next) {
  try {
    const { requestId } = req.params;
    const pool = await getPool();

    const result = await pool.request()
      .input('RequestID', sql.BigInt, requestId)
      .query(`
        SELECT 
          lh.*,
          lt.Name AS LicenseTypeDisplayName,
          ot.Name AS OperationTypeDisplayName
        FROM LicenseHistory lh
        LEFT JOIN LookupValue lt ON lh.LicenseTypeId = lt.Id
        LEFT JOIN LookupValue ot ON lh.OperationTypeId = ot.Id
        WHERE lh.RequestID = @RequestID
        ORDER BY lh.CreatedAt DESC
      `);

    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    next(error);
  }
}

export async function getLicenseHistoryByTracking(req, res, next) {
  try {
    const { trackingNo } = req.params;
    const pool = await getPool();

    const result = await pool.request()
      .input('TrackingNo', sql.NVarChar(30), trackingNo)
      .query(`
        SELECT 
          lh.*,
          lt.Name AS LicenseTypeDisplayName,
          ot.Name AS OperationTypeDisplayName
        FROM LicenseHistory lh
        LEFT JOIN LookupValue lt ON lh.LicenseTypeId = lt.Id
        LEFT JOIN LookupValue ot ON lh.OperationTypeId = ot.Id
        WHERE lh.TrackingNo = @TrackingNo
        ORDER BY lh.CreatedAt DESC
      `);

    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    next(error);
  }
}

export async function getAllLicenseHistory(req, res, next) {
  try {
    const { 
      eventType, 
      status, 
      licenseTypeId,
      fromold,
      fuelTypeId,
      tonnageRateId,
      fromDate,
      toDate,
      page = 1, 
      limit = 50 
    } = req.query;

    const pool = await getPool();
    const offset = (page - 1) * limit;

    let whereConditions = [];
    const request = pool.request();

    if (eventType) {
      whereConditions.push('lh.EventType = @EventType');
      request.input('EventType', sql.NVarChar(50), eventType);
    }

    if (status) {
      whereConditions.push('lh.Status = @Status');
      request.input('Status', sql.NVarChar(20), status);
    }

    if (licenseTypeId) {
      whereConditions.push('lh.LicenseTypeId = @LicenseTypeId');
      request.input('LicenseTypeId', sql.Int, parseInt(licenseTypeId));
    }

    if (fromold !== undefined && fromold !== '') {
      const fromoldBit = fromold === '1' || fromold === 'true' || fromold === true ? 1 : 0;
      whereConditions.push('ISNULL(lh.Fromold, 0) = @Fromold');
      request.input('Fromold', sql.Bit, fromoldBit);
    }

    if (fuelTypeId) {
      whereConditions.push('v.FuelTypeId = @FuelTypeId');
      request.input('FuelTypeId', sql.Int, parseInt(fuelTypeId));
    }

    if (tonnageRateId) {
      whereConditions.push('ci.TonnageRateId = @TonnageRateId');
      request.input('TonnageRateId', sql.Int, parseInt(tonnageRateId));
    }

    if (fromDate) {
      whereConditions.push('lh.IssueDate >= @FromDate');
      request.input('FromDate', sql.NVarChar(10), fromDate);
    }

    if (toDate) {
      whereConditions.push('lh.IssueDate <= @ToDate');
      request.input('ToDate', sql.NVarChar(10), toDate);
    }

    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ') 
      : '';

    request.input('Offset', sql.Int, offset);
    request.input('Limit', sql.Int, parseInt(limit));

    const countResult = await request.query(`
      SELECT COUNT(*) as Total
      FROM LicenseHistory lh
      LEFT JOIN Vehicles v ON lh.VehicleID = v.VehicleID
      LEFT JOIN CompanyInfo ci ON lh.CompanyNationalId = ci.NationalId
      ${whereClause}
    `);

    const dataResult = await request.query(`
      SELECT 
        lh.*,
        lt.Name AS LicenseTypeDisplayName,
        ot.Name AS OperationTypeDisplayName,
        v.VehicleKindId,
        v.SystemId,
        v.SystemTipId,
        v.Capacity AS VehicleCapacity,
        st.systemname AS SystemTypeName,
        tt.tipname AS SystemTipName,
        vk.Name AS VehicleTypeName,
        v.FuelTypeId,
        ft.Name AS FuelTypeName,
        ci.TonnageRateId,
        tr.Name AS TonnageRateName,
        COALESCE(op.Amount, ofp.Amount) AS PaidAmount,
        CASE 
          WHEN op.CalculatedAmount IS NOT NULL THEN op.CalculatedAmount
          WHEN ofp.CalculatedAmount IS NOT NULL THEN ofp.CalculatedAmount
          ELSE NULL
        END AS CalculatedAmount,
        CASE 
          WHEN op.Amount IS NOT NULL THEN 'Online'
          WHEN ofp.Amount IS NOT NULL THEN 'Offline'
          ELSE 'None'
        END AS PaymentType,
        COALESCE(op.ReceiptNo, ofp.ReceiptNo) AS PaymentReceiptNo,
        COALESCE(CONVERT(VARCHAR, op.PaidAt, 23), CONVERT(VARCHAR, ofp.CreatedAt, 23)) AS PaymentDate
      FROM LicenseHistory lh
      LEFT JOIN LookupValue lt ON lh.LicenseTypeId = lt.Id
      LEFT JOIN LookupValue ot ON lh.OperationTypeId = ot.Id
      LEFT JOIN Vehicles v ON lh.VehicleID = v.VehicleID
      LEFT JOIN Systemtype st ON v.SystemId = st.ID
      LEFT JOIN Tiptype tt ON v.SystemTipId = tt.ID
      LEFT JOIN LookupValue vk ON v.VehicleKindId = vk.Id
      LEFT JOIN LookupValue ft ON v.FuelTypeId = ft.Id
      LEFT JOIN CompanyInfo ci ON lh.CompanyNationalId = ci.NationalId
      LEFT JOIN LookupValue tr ON ci.TonnageRateId = tr.Id
      OUTER APPLY (
        SELECT TOP 1 Amount, CalculatedAmount, PaidAt,
          COALESCE(GatewayRef, GatewayAuthority, CAST(Id AS nvarchar(50))) AS ReceiptNo
        FROM OnlinePayment
        WHERE RequestID = lh.RequestID AND PayedBit = 1
        ORDER BY CASE WHEN CalculatedAmount IS NULL THEN 1 ELSE 0 END, PaidAt DESC, Id DESC
      ) op
      OUTER APPLY (
        SELECT TOP 1 Amount, CalculatedAmount, CreatedAt,
          COALESCE(ReceiptNo, CAST(Id AS nvarchar(50))) AS ReceiptNo
        FROM OfflinePayment
        WHERE RequestID = lh.RequestID
        ORDER BY CASE WHEN CalculatedAmount IS NULL THEN 1 ELSE 0 END, CreatedAt DESC, Id DESC
      ) ofp
      ${whereClause}
      ORDER BY lh.CreatedAt DESC
      OFFSET @Offset ROWS
      FETCH NEXT @Limit ROWS ONLY
    `);

    const total = countResult.recordset[0].Total;

    res.json({
      success: true,
      data: dataResult.recordset,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function updatePaidAmount(req, res, next) {
  try {
    const { historyId } = req.params;
    const { paidAmount } = req.body;

    if (paidAmount === undefined || paidAmount === null || paidAmount === '') {
      return res.status(400).json({ success: false, message: 'مبلغ پرداختی الزامی است' });
    }
    const amount = Number(paidAmount);
    if (isNaN(amount) || amount < 0) {
      return res.status(400).json({ success: false, message: 'مبلغ پرداختی نامعتبر است' });
    }

    const pool = await getPool();

    const lhResult = await pool.request()
      .input('HistoryID', sql.BigInt, historyId)
      .query('SELECT RequestID FROM LicenseHistory WHERE HistoryID = @HistoryID');

    if (!lhResult.recordset.length) {
      return res.status(404).json({ success: false, message: 'رکورد یافت نشد' });
    }
    const { RequestID } = lhResult.recordset[0];

    const onlineResult = await pool.request()
      .input('RequestID', sql.BigInt, RequestID)
      .query('SELECT TOP 1 Id FROM OnlinePayment WHERE RequestID = @RequestID AND PayedBit = 1 ORDER BY PaidAt DESC');

    if (onlineResult.recordset.length) {
      await pool.request()
        .input('Amount', sql.Decimal(18, 2), amount)
        .input('Id', sql.BigInt, onlineResult.recordset[0].Id)
        .query('UPDATE OnlinePayment SET Amount = @Amount WHERE Id = @Id');
    } else {
      const offlineResult = await pool.request()
        .input('RequestID', sql.BigInt, RequestID)
        .query('SELECT TOP 1 Id FROM OfflinePayment WHERE RequestID = @RequestID ORDER BY CreatedAt DESC');

      if (offlineResult.recordset.length) {
        await pool.request()
          .input('Amount', sql.Decimal(18, 2), amount)
          .input('Id', sql.BigInt, offlineResult.recordset[0].Id)
          .query('UPDATE OfflinePayment SET Amount = @Amount WHERE Id = @Id');
      } else {
        return res.status(400).json({ success: false, message: 'پرداختی برای این رکورد یافت نشد' });
      }
    }

    res.json({ success: true, message: 'مبلغ پرداختی با موفقیت بروزرسانی شد' });
  } catch (error) {
    next(error);
  }
}

export async function getLicenseHistoryStatistics(req, res, next) {
  try {
    const pool = await getPool();

    const statsResult = await pool.request().query(`
      SELECT 
        COUNT(*) AS TotalRecords,
        SUM(CASE WHEN EventType = 'Issued' THEN 1 ELSE 0 END) AS TotalIssued,
        SUM(CASE WHEN EventType = 'Renewed' THEN 1 ELSE 0 END) AS TotalRenewed,
        SUM(CASE WHEN EventType = 'Revoked' THEN 1 ELSE 0 END) AS TotalRevoked,
        SUM(CASE WHEN EventType = 'Cancelled' THEN 1 ELSE 0 END) AS TotalCancelled,
        SUM(CASE WHEN Status = 'Active' THEN 1 ELSE 0 END) AS TotalActive,
        SUM(CASE WHEN Status = 'Expired' THEN 1 ELSE 0 END) AS TotalExpired,
        SUM(CASE WHEN Status = 'Revoked' THEN 1 ELSE 0 END) AS TotalRevokedStatus,
        SUM(CASE WHEN Status = 'Cancelled' THEN 1 ELSE 0 END) AS TotalCancelledStatus
      FROM LicenseHistory
    `);

    const byLicenseTypeResult = await pool.request().query(`
      SELECT 
        lh.LicenseTypeId,
        lt.Name AS LicenseTypeName,
        COUNT(*) AS Count,
        SUM(CASE WHEN lh.EventType = 'Issued' THEN 1 ELSE 0 END) AS IssuedCount,
        SUM(CASE WHEN lh.EventType = 'Renewed' THEN 1 ELSE 0 END) AS RenewedCount,
        SUM(CASE WHEN lh.Status = 'Active' THEN 1 ELSE 0 END) AS ActiveCount
      FROM LicenseHistory lh
      LEFT JOIN LookupValue lt ON lh.LicenseTypeId = lt.Id
      GROUP BY lh.LicenseTypeId, lt.Name
      ORDER BY Count DESC
    `);

    const recentActivityResult = await pool.request().query(`
      SELECT TOP 10
        lh.*,
        lt.Name AS LicenseTypeDisplayName,
        ot.Name AS OperationTypeDisplayName
      FROM LicenseHistory lh
      LEFT JOIN LookupValue lt ON lh.LicenseTypeId = lt.Id
      LEFT JOIN LookupValue ot ON lh.OperationTypeId = ot.Id
      ORDER BY lh.CreatedAt DESC
    `);

    res.json({
      success: true,
      statistics: statsResult.recordset[0],
      byLicenseType: byLicenseTypeResult.recordset,
      recentActivity: recentActivityResult.recordset
    });
  } catch (error) {
    next(error);
  }
}

export async function revokeLicense(req, res, next) {
  try {
    const { historyId } = req.params;
    const { revokedByUserId, revokedByUsername, revocationReason } = req.body;

    const pool = await getPool();

    const result = await pool.request()
      .input('HistoryID', sql.BigInt, historyId)
      .input('RevokedByUserId', sql.Int, revokedByUserId)
      .input('RevokedByUsername', sql.NVarChar(150), revokedByUsername)
      .input('RevocationReason', sql.NVarChar(2000), revocationReason || null)
      .input('RevokedAt', sql.DateTime2, new Date())
      .query(`
        UPDATE LicenseHistory
        SET 
          Status = 'Revoked',
          RevokedByUserId = @RevokedByUserId,
          RevokedByUsername = @RevokedByUsername,
          RevokedAt = @RevokedAt,
          RevocationReason = @RevocationReason,
          UpdatedAt = SYSUTCDATETIME()
        WHERE HistoryID = @HistoryID
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        success: false,
        message: 'License history record not found'
      });
    }

    res.json({
      success: true,
      message: 'License revoked successfully'
    });
  } catch (error) {
    next(error);
  }
}

export async function getActiveLicensesByVehicle(req, res, next) {
  try {
    const { vehicleId } = req.params;
    const pool = await getPool();

    const result = await pool.request()
      .input('VehicleID', sql.BigInt, vehicleId)
      .query(`
        SELECT 
          lh.*,
          lt.Name AS LicenseTypeDisplayName,
          ot.Name AS OperationTypeDisplayName
        FROM LicenseHistory lh
        LEFT JOIN LookupValue lt ON lh.LicenseTypeId = lt.Id
        LEFT JOIN LookupValue ot ON lh.OperationTypeId = ot.Id
        WHERE lh.VehicleID = @VehicleID AND lh.Status = 'Active'
        ORDER BY lh.CreatedAt DESC
      `);

    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    next(error);
  }
}

export async function getActiveLicensesByPerson(req, res, next) {
  try {
    const { nationalCode } = req.params;
    const pool = await getPool();

    const result = await pool.request()
      .input('NationalCode', sql.NVarChar(20), nationalCode)
      .query(`
        SELECT 
          lh.*,
          lt.Name AS LicenseTypeDisplayName,
          ot.Name AS OperationTypeDisplayName
        FROM LicenseHistory lh
        LEFT JOIN LookupValue lt ON lh.LicenseTypeId = lt.Id
        LEFT JOIN LookupValue ot ON lh.OperationTypeId = ot.Id
        WHERE lh.NationalCode = @NationalCode AND lh.Status = 'Active'
        ORDER BY lh.CreatedAt DESC
      `);

    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    next(error);
  }
}

export async function updateExpiringLicenses(req, res, next) {
  try {
    const pool = await getPool();

    const result = await pool.request()
      .query(`
        UPDATE LicenseHistory
        SET Status = 'Expired', UpdatedAt = SYSUTCDATETIME()
        WHERE Status = 'Active' 
          AND ExpiryDateGregorian IS NOT NULL 
          AND ExpiryDateGregorian < GETDATE()
      `);

    res.json({
      success: true,
      message: `Updated ${result.rowsAffected[0]} expired licenses`,
      updatedCount: result.rowsAffected[0]
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyLicenses(req, res, next) {
  try {
    const userId = req.user?.id || req.user?.Id;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'کاربر یافت نشد'
      });
    }

    const { 
      trackingNo,
      licenseTypeId,
      fromold,
      page = 1,
      limit = 50
    } = req.query;

    const pool = await getPool();
    const offset = (page - 1) * limit;

    // Get user's national code
    const userResult = await pool.request()
      .input('UserId', sql.Int, userId)
      .query('SELECT NationalCode FROM Users WHERE Id = @UserId');
    
    const userNationalCode = userResult.recordset[0]?.NationalCode;

    // Query from LicenseHistory based on user's national code OR SubmittedByUserId
    let whereConditions = ['(lh.NationalCode = @NationalCode OR lh.SubmittedByUserId = @UserId)'];
    const request = pool.request();
    request.input('NationalCode', sql.NVarChar(20), userNationalCode || '');
    request.input('UserId', sql.Int, userId);

    if (trackingNo) {
      whereConditions.push('lh.TrackingNo LIKE @TrackingNo');
      request.input('TrackingNo', sql.NVarChar(30), `%${trackingNo}%`);
    }

    if (licenseTypeId) {
      whereConditions.push('lh.LicenseTypeId = @LicenseTypeId');
      request.input('LicenseTypeId', sql.Int, parseInt(licenseTypeId));
    }

    if (fromold !== undefined && fromold !== '') {
      const fromoldBit = fromold === '1' || fromold === 'true' || fromold === true ? 1 : 0;
      whereConditions.push('ISNULL(lh.Fromold, 0) = @Fromold');
      request.input('Fromold', sql.Bit, fromoldBit);
    }

    const whereClause = 'WHERE ' + whereConditions.join(' AND ');

    request.input('Offset', sql.Int, offset);
    request.input('Limit', sql.Int, parseInt(limit));

    const countResult = await request.query(`
      SELECT COUNT(*) as Total
      FROM LicenseHistory lh
      ${whereClause}
    `);

    const dataResult = await request.query(`
      SELECT 
        lh.RequestID,
        lh.TrackingNo,
        lh.NationalCode,
        lh.Status,
        lh.LicenseTypeId,
        lh.OperationTypeId,
        lh.CreatedAt,
        lh.IssueDate,
        lh.ExpiryDate,
        lh.EventType,
        lh.Fromold,
        lh.LicenseTypeName,
        lh.OperationTypeName
      FROM LicenseHistory lh
      ${whereClause}
      ORDER BY lh.CreatedAt DESC
      OFFSET @Offset ROWS
      FETCH NEXT @Limit ROWS ONLY
    `);

    const total = countResult.recordset[0].Total;

    res.json({
      success: true,
      data: dataResult.recordset,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
}
