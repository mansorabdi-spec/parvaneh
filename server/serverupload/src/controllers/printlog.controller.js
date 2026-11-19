import { sql, getPool } from '../lib/db.js'

/**
 * Log a license print event
 * POST /api/printlog/log
 */
export const logPrint = async (req, res) => {
  try {
    const { requestId, trackingNo, licenseType } = req.body
    const userId = req.user?.id || null
    const username = req.user?.username || 'Anonymous'
    
    // Get IP address
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']
    
    // Get user agent
    const userAgent = req.headers['user-agent'] || null

    if (!requestId || !trackingNo || !licenseType) {
      return res.status(400).json({ 
        message: 'requestId, trackingNo, and licenseType are required' 
      })
    }

    const pool = await getPool()
    
    // Insert print log
    const result = await pool.request()
      .input('RequestID', sql.BigInt, requestId)
      .input('TrackingNo', sql.NVarChar(30), trackingNo)
      .input('LicenseType', sql.NVarChar(50), licenseType)
      .input('PrintedByUserId', sql.Int, userId)
      .input('PrintedByUsername', sql.NVarChar(100), username)
      .input('IpAddress', sql.NVarChar(50), ipAddress)
      .input('UserAgent', sql.NVarChar(500), userAgent)
      .query(`
        INSERT INTO LicensePrintLog (
          RequestID, TrackingNo, LicenseType, 
          PrintedByUserId, PrintedByUsername, 
          IpAddress, UserAgent, PrintedAt
        )
        VALUES (
          @RequestID, @TrackingNo, @LicenseType,
          @PrintedByUserId, @PrintedByUsername,
          @IpAddress, @UserAgent, GETDATE()
        );
        
        SELECT SCOPE_IDENTITY() AS PrintLogId;
      `)

    const printLogId = result.recordset[0].PrintLogId

    res.json({
      message: 'Print event logged successfully',
      printLogId
    })
  } catch (error) {
    console.error('Error logging print event:', error)
    res.status(500).json({ 
      message: 'خطا در ثبت رویداد چاپ',
      error: error.message 
    })
  }
}

/**
 * Get print logs for a specific request
 * GET /api/printlog/request/:requestId
 */
export const getPrintLogsByRequest = async (req, res) => {
  try {
    const { requestId } = req.params
    const pool = await getPool()
    
    const result = await pool.request()
      .input('RequestID', sql.BigInt, requestId)
      .query(`
        SELECT 
          PrintLogId,
          RequestID,
          TrackingNo,
          LicenseType,
          PrintedByUserId,
          PrintedByUsername,
          PrintedAt,
          IpAddress,
          UserAgent,
          Notes
        FROM LicensePrintLog
        WHERE RequestID = @RequestID
        ORDER BY PrintedAt DESC
      `)

    res.json({
      logs: result.recordset,
      totalPrints: result.recordset.length
    })
  } catch (error) {
    console.error('Error fetching print logs:', error)
    res.status(500).json({ 
      message: 'خطا در دریافت تاریخچه چاپ',
      error: error.message 
    })
  }
}

/**
 * Get all print logs with filters and pagination
 * GET /api/printlog/all
 */
export const getAllPrintLogs = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      licenseType, 
      startDate, 
      endDate,
      trackingNo,
      userId
    } = req.query

    const offset = (page - 1) * limit
    const pool = await getPool()
    
    let whereConditions = []
    let queryParams = {}

    if (licenseType) {
      whereConditions.push('pl.LicenseType = @LicenseType')
      queryParams.LicenseType = { type: sql.NVarChar(50), value: licenseType }
    }

    if (startDate) {
      whereConditions.push('pl.PrintedAt >= @StartDate')
      queryParams.StartDate = { type: sql.DateTime2, value: new Date(startDate) }
    }

    if (endDate) {
      whereConditions.push('pl.PrintedAt <= @EndDate')
      queryParams.EndDate = { type: sql.DateTime2, value: new Date(endDate) }
    }

    if (trackingNo) {
      whereConditions.push('pl.TrackingNo LIKE @TrackingNo')
      queryParams.TrackingNo = { type: sql.NVarChar(30), value: `%${trackingNo}%` }
    }

    if (userId) {
      whereConditions.push('pl.PrintedByUserId = @UserId')
      queryParams.UserId = { type: sql.Int, value: parseInt(userId) }
    }

    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ')
      : ''

    // Build query with parameters
    let request = pool.request()
    Object.keys(queryParams).forEach(key => {
      request = request.input(key, queryParams[key].type, queryParams[key].value)
    })
    request = request.input('Offset', sql.Int, offset)
    request = request.input('Limit', sql.Int, parseInt(limit))

    const result = await request.query(`
      SELECT 
        pl.PrintLogId,
        pl.RequestID,
        pl.TrackingNo,
        pl.LicenseType,
        pl.PrintedByUserId,
        pl.PrintedByUsername,
        pl.PrintedAt,
        pl.IpAddress,
        vr.Status as RequestStatus,
        vr.CompletedAt,
        p.FirstName + ' ' + p.LastName as ApplicantName,
        ci.CompanyName
      FROM LicensePrintLog pl
      LEFT JOIN VehicleRequests vr ON pl.RequestID = vr.RequestID
      LEFT JOIN Persons p ON vr.NationalCode = p.NationalCode
      LEFT JOIN CompanyInfo ci ON vr.CompanyNationalId = ci.NationalId
      ${whereClause}
      ORDER BY pl.PrintedAt DESC
      OFFSET @Offset ROWS
      FETCH NEXT @Limit ROWS ONLY;

      -- Get total count
      SELECT COUNT(*) as TotalCount
      FROM LicensePrintLog pl
      ${whereClause};
    `)

    const logs = result.recordsets[0]
    const totalCount = result.recordsets[1][0].TotalCount

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching all print logs:', error)
    res.status(500).json({ 
      message: 'خطا در دریافت لیست چاپ‌ها',
      error: error.message 
    })
  }
}

/**
 * Get print statistics
 * GET /api/printlog/statistics
 */
export const getPrintStatistics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query
    const pool = await getPool()
    
    let request = pool.request()
    let dateFilter = ''

    if (startDate && endDate) {
      dateFilter = 'WHERE PrintedAt BETWEEN @StartDate AND @EndDate'
      request = request
        .input('StartDate', sql.DateTime2, new Date(startDate))
        .input('EndDate', sql.DateTime2, new Date(endDate))
    }

    const result = await request.query(`
      -- Total prints
      SELECT COUNT(*) as TotalPrints
      FROM LicensePrintLog
      ${dateFilter};

      -- Prints by license type
      SELECT 
        LicenseType,
        COUNT(*) as PrintCount
      FROM LicensePrintLog
      ${dateFilter}
      GROUP BY LicenseType
      ORDER BY PrintCount DESC;

      -- Prints by user (top 10)
      SELECT TOP 10
        PrintedByUsername,
        COUNT(*) as PrintCount
      FROM LicensePrintLog
      ${dateFilter}
      GROUP BY PrintedByUsername
      ORDER BY PrintCount DESC;

      -- Prints by date (last 30 days)
      SELECT 
        CAST(PrintedAt AS DATE) as PrintDate,
        COUNT(*) as PrintCount
      FROM LicensePrintLog
      WHERE PrintedAt >= DATEADD(day, -30, GETDATE())
      GROUP BY CAST(PrintedAt AS DATE)
      ORDER BY PrintDate DESC;

      -- Requests with multiple prints
      SELECT 
        RequestID,
        TrackingNo,
        COUNT(*) as PrintCount
      FROM LicensePrintLog
      ${dateFilter}
      GROUP BY RequestID, TrackingNo
      HAVING COUNT(*) > 1
      ORDER BY PrintCount DESC;
    `)

    res.json({
      totalPrints: result.recordsets[0][0].TotalPrints,
      printsByLicenseType: result.recordsets[1],
      printsByUser: result.recordsets[2],
      printsByDate: result.recordsets[3],
      multiPrintRequests: result.recordsets[4]
    })
  } catch (error) {
    console.error('Error fetching print statistics:', error)
    res.status(500).json({ 
      message: 'خطا در دریافت آمار چاپ',
      error: error.message 
    })
  }
}

/**
 * Check if a request has been printed
 * GET /api/printlog/check/:requestId
 */
export const checkIfPrinted = async (req, res) => {
  try {
    const { requestId } = req.params
    const pool = await getPool()
    
    const result = await pool.request()
      .input('RequestID', sql.BigInt, requestId)
      .query(`
        SELECT 
          COUNT(*) as PrintCount,
          MAX(PrintedAt) as LastPrintedAt,
          MAX(PrintedByUsername) as LastPrintedBy
        FROM LicensePrintLog
        WHERE RequestID = @RequestID
      `)

    const data = result.recordset[0]
    const isPrinted = data.PrintCount > 0

    res.json({
      isPrinted,
      printCount: data.PrintCount,
      lastPrintedAt: data.LastPrintedAt,
      lastPrintedBy: data.LastPrintedBy
    })
  } catch (error) {
    console.error('Error checking print status:', error)
    res.status(500).json({ 
      message: 'خطا در بررسی وضعیت چاپ',
      error: error.message 
    })
  }
}
