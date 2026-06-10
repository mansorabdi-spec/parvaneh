import { sql, getPool } from '../lib/db.js';

/**
 * Search for a vehicle by VIN and check if it belongs to the logged-in user
 * Returns vehicle and license information if found and belongs to user
 */
export const searchVehicleByVIN = async (req, res) => {
  try {
    const { vin } = req.params;
    const userId = req.user.id;

    const pool = await getPool();

    // Search for vehicle with active license that belongs to the user
    const result = await pool
      .request()
      .input('VIN', sql.NVarChar, vin)
      .input('UserId', sql.Int, userId)
      .query(`
        SELECT 
          v.VehicleID,
          v.VIN,
          v.ChassisNo,
          vr.RequestID,
          vr.TrackingNo,
          vr.CreatedAt as IssueDate,
          vr.Status,
          ISNULL(p.FirstName + ' ' + p.LastName, u.FirstName + ' ' + u.LastName) as OwnerName,
          st.SystemName as VehicleName,
          vl.Id as LabelID,
          DATEADD(YEAR, 1, vr.CreatedAt) as ExpiryDate
        FROM Vehicles v
        INNER JOIN VehicleRequests vr ON v.VehicleID = vr.VehicleID
        LEFT JOIN Persons p ON v.RegistrarNationalCode = p.NationalCode
        LEFT JOIN Users u ON vr.SubmittedByUserId = u.Id
        INNER JOIN tblSystemType st ON v.SystemId = st.ID
        LEFT JOIN VehicleLabel vl ON vr.RequestID = vl.RequestID
        WHERE v.VIN = @VIN
          AND vr.SubmittedByUserId = @UserId
          AND vr.Status = 'Approved'
          AND NOT EXISTS (
            SELECT 1 FROM LicenseCancellationRequests lcr
            WHERE lcr.RequestID = vr.RequestID
              AND lcr.Status IN ('Pending', 'Approved')
          )
        ORDER BY vr.CreatedAt DESC
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        message: 'خودرو با این VIN یافت نشد یا متعلق به شما نیست یا پروانه فعالی ندارد.'
      });
    }

    const vehicleData = result.recordset[0];

    res.json({
      vehicleId: vehicleData.VehicleID,
      requestId: vehicleData.RequestID,
      vin: vehicleData.VIN,
      chassisNo: vehicleData.ChassisNo,
      ownerName: vehicleData.OwnerName,
      vehicleName: vehicleData.VehicleName,
      licenseNumber: vehicleData.TrackingNo,
      issueDate: vehicleData.IssueDate,
      expiryDate: vehicleData.ExpiryDate,
      hasLabel: vehicleData.LabelID !== null
    });
  } catch (error) {
    console.error('Error searching vehicle by VIN:', error);
    res.status(500).json({
      message: 'خطا در جستجوی خودرو',
      error: error.message
    });
  }
};

/**
 * Submit a license cancellation request
 */
export const submitCancellationRequest = async (req, res) => {
  try {
    const { requestId, vehicleId, reason } = req.body;
    const userId = req.user.id;
    const file = req.file;

    // Validate required fields
    if (!requestId || !vehicleId || !reason) {
      return res.status(400).json({
        message: 'اطلاعات ناقص است. لطفاً تمام فیلدهای الزامی را پر کنید.'
      });
    }

    // Validate file size (max 2MB)
    if (file && file.size > 2 * 1024 * 1024) {
      return res.status(400).json({
        message: 'حجم فایل نباید بیشتر از 2 مگابایت باشد.'
      });
    }

    const pool = await getPool();

    // Verify that the request belongs to the user
    const verifyResult = await pool
      .request()
      .input('RequestID', sql.BigInt, requestId)
      .input('UserId', sql.Int, userId)
      .query(`
        SELECT RequestID
        FROM VehicleRequests
        WHERE RequestID = @RequestID
          AND SubmittedByUserId = @UserId
          AND Status = 'Approved'
      `);

    if (verifyResult.recordset.length === 0) {
      return res.status(403).json({
        message: 'شما مجاز به ثبت درخواست ابطال برای این پروانه نیستید.'
      });
    }

    // Check if there's already a pending or approved cancellation request
    const existingResult = await pool
      .request()
      .input('RequestID', sql.BigInt, requestId)
      .query(`
        SELECT CancellationID
        FROM LicenseCancellationRequests
        WHERE RequestID = @RequestID
          AND Status IN ('Pending', 'Approved')
      `);

    if (existingResult.recordset.length > 0) {
      return res.status(400).json({
        message: 'برای این پروانه قبلاً درخواست ابطال ثبت شده است.'
      });
    }

    // Insert cancellation request
    const insertRequest = pool
      .request()
      .input('RequestID', sql.BigInt, requestId)
      .input('VehicleID', sql.BigInt, vehicleId)
      .input('SubmittedByUserId', sql.Int, userId)
      .input('Reason', sql.NVarChar, reason)
      .input('Status', sql.NVarChar, 'Pending');

    if (file) {
      insertRequest
        .input('AttachmentFile', sql.VarBinary, file.buffer)
        .input('AttachmentFileName', sql.NVarChar, file.originalname)
        .input('AttachmentMimeType', sql.NVarChar, file.mimetype)
        .input('AttachmentSize', sql.Int, file.size);
    }

    const insertResult = await insertRequest.query(`
      INSERT INTO LicenseCancellationRequests (
        RequestID,
        VehicleID,
        SubmittedByUserId,
        Reason,
        AttachmentFile,
        AttachmentFileName,
        AttachmentMimeType,
        AttachmentSize,
        Status,
        CreatedAt
      )
      VALUES (
        @RequestID,
        @VehicleID,
        @SubmittedByUserId,
        @Reason,
        ${file ? '@AttachmentFile' : 'NULL'},
        ${file ? '@AttachmentFileName' : 'NULL'},
        ${file ? '@AttachmentMimeType' : 'NULL'},
        ${file ? '@AttachmentSize' : 'NULL'},
        @Status,
        GETDATE()
      );
      SELECT SCOPE_IDENTITY() as CancellationID;
    `);

    const cancellationId = insertResult.recordset[0].CancellationID;

    res.status(201).json({
      message: 'درخواست ابطال پروانه با موفقیت ثبت شد.',
      cancellationId: cancellationId
    });
  } catch (error) {
    console.error('Error submitting cancellation request:', error);
    res.status(500).json({
      message: 'خطا در ثبت درخواست ابطال',
      error: error.message
    });
  }
};

/**
 * Get all cancellation requests for the logged-in user
 */
export const getMyCancellationRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const pool = await getPool();

    const result = await pool
      .request()
      .input('UserId', sql.Int, userId)
      .query(`
        SELECT 
          lcr.CancellationID,
          lcr.RequestID,
          lcr.Reason,
          lcr.Status,
          lcr.CreatedAt,
          lcr.ReviewNotes,
          lcr.ReviewedAt,
          lcr.AttachmentFileName,
          lcr.AttachmentSize,
          vr.TrackingNo,
          v.VIN,
          v.ChassisNo,
          ISNULL(p.FirstName + ' ' + p.LastName, u.FirstName + ' ' + u.LastName) as OwnerName,
          st.SystemName as VehicleName,
          reviewer.FirstName + ' ' + reviewer.LastName as ReviewerName
        FROM LicenseCancellationRequests lcr
        INNER JOIN VehicleRequests vr ON lcr.RequestID = vr.RequestID
        INNER JOIN Vehicles v ON lcr.VehicleID = v.VehicleID
        LEFT JOIN Persons p ON v.RegistrarNationalCode = p.NationalCode
        LEFT JOIN Users u ON vr.SubmittedByUserId = u.Id
        INNER JOIN tblSystemType st ON v.SystemId = st.ID
        LEFT JOIN Users reviewer ON lcr.ReviewedBy = reviewer.Id
        WHERE lcr.SubmittedByUserId = @UserId
        ORDER BY lcr.CreatedAt DESC
      `);

    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching cancellation requests:', error);
    res.status(500).json({
      message: 'خطا در دریافت درخواست‌های ابطال',
      error: error.message
    });
  }
};

/**
 * Get cancellation request details by ID
 */
export const getCancellationRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const pool = await getPool();

    const result = await pool
      .request()
      .input('CancellationID', sql.BigInt, id)
      .input('UserId', sql.Int, userId)
      .query(`
        SELECT 
          lcr.*,
          vr.TrackingNo,
          v.VIN,
          v.ChassisNo,
          ISNULL(p.FirstName + ' ' + p.LastName, u.FirstName + ' ' + u.LastName) as OwnerName,
          st.SystemName as VehicleName,
          reviewer.FirstName + ' ' + reviewer.LastName as ReviewerName
        FROM LicenseCancellationRequests lcr
        INNER JOIN VehicleRequests vr ON lcr.RequestID = vr.RequestID
        INNER JOIN Vehicles v ON lcr.VehicleID = v.VehicleID
        LEFT JOIN Persons p ON v.RegistrarNationalCode = p.NationalCode
        LEFT JOIN Users u ON vr.SubmittedByUserId = u.Id
        INNER JOIN tblSystemType st ON v.SystemId = st.ID
        LEFT JOIN Users reviewer ON lcr.ReviewedBy = reviewer.Id
        WHERE lcr.CancellationID = @CancellationID
          AND lcr.SubmittedByUserId = @UserId
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        message: 'درخواست ابطال یافت نشد.'
      });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Error fetching cancellation request:', error);
    res.status(500).json({
      message: 'خطا در دریافت اطلاعات درخواست ابطال',
      error: error.message
    });
  }
};
