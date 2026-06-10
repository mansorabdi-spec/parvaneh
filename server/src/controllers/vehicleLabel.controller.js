import { getPool, sql } from '../lib/db.js';
import multer from 'multer';

// Configure multer for memory storage (max 4MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 4 * 1024 * 1024 // 4MB max
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('فقط فایل‌های تصویری مجاز هستند'), false);
    }
  }
}).single('labelImage');

// Middleware wrapper for multer
export const uploadLabelImage = (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'حجم فایل نباید بیشتر از 4 مگابایت باشد' });
      }
      return res.status(400).json({ message: 'خطا در آپلود فایل: ' + err.message });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

/**
 * Upload vehicle label image
 * POST /api/vehicle-labels
 */
export async function uploadVehicleLabel(req, res, next) {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { vehicleId, notes } = req.body;
    
    if (!vehicleId) {
      return res.status(400).json({ message: 'شناسه خودرو الزامی است' });
    }
    
    if (!req.file) {
      return res.status(400).json({ message: 'تصویر برچسب الزامی است' });
    }
    
    // Only label attachment specialists can upload
    if (userRole !== 'کارشناس الصاق برچسب' && userRole !== 'Admin') {
      return res.status(403).json({ message: 'فقط کارشناس الصاق برچسب می‌تواند تصویر برچسب آپلود کند' });
    }
    
    console.log(`📎 User ${userId} (${userRole}) uploading label for vehicle ${vehicleId}`);
    console.log(`📷 Image: ${req.file.originalname}, Size: ${req.file.size} bytes, Type: ${req.file.mimetype}`);
    
    const pool = await getPool();
    
    // Check if vehicle exists and get the most recent request
    const vehicleCheck = await pool.request()
      .input('VehicleID', sql.BigInt, vehicleId)
      .query(`
        SELECT v.VehicleID,
               (SELECT TOP 1 RequestID 
                FROM VehicleRequests 
                WHERE VehicleID = v.VehicleID 
                ORDER BY CreatedAt DESC) AS RequestID
        FROM Vehicles v
        WHERE v.VehicleID = @VehicleID
      `);
    
    if (vehicleCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'خودرو یافت نشد' });
    }
    
    const requestId = vehicleCheck.recordset[0].RequestID;
    console.log(`📋 Linking label to RequestID: ${requestId}`);
    
    // Insert label image with RequestID
    const result = await pool.request()
      .input('VehicleID', sql.BigInt, vehicleId)
      .input('LabelImage', sql.VarBinary(sql.MAX), req.file.buffer)
      .input('ImageContentType', sql.NVarChar(100), req.file.mimetype)
      .input('ImageFileName', sql.NVarChar(255), req.file.originalname)
      .input('ImageSize', sql.Int, req.file.size)
      .input('UserID', sql.Int, userId)
      .input('Notes', sql.NVarChar(1000), notes || null)
      .input('RequestID', sql.BigInt, requestId)
      .query(`
        INSERT INTO VehicleLabel 
        (VehicleID, LabelImage, ImageContentType, ImageFileName, ImageSize, UserID, Notes, RequestID)
        OUTPUT INSERTED.Id, INSERTED.VehicleID, INSERTED.ImageFileName, INSERTED.ImageSize, INSERTED.CreatedAt, INSERTED.RequestID
        VALUES (@VehicleID, @LabelImage, @ImageContentType, @ImageFileName, @ImageSize, @UserID, @Notes, @RequestID)
      `);
    
    const insertedLabel = result.recordset[0];
    
    console.log(`✅ Label uploaded successfully: ID ${insertedLabel.Id}`);
    
    res.status(201).json({
      message: 'تصویر برچسب با موفقیت آپلود شد',
      labelId: insertedLabel.Id,
      vehicleId: insertedLabel.VehicleID,
      fileName: insertedLabel.ImageFileName,
      fileSize: insertedLabel.ImageSize,
      createdAt: insertedLabel.CreatedAt
    });
  } catch (e) {
    console.error('❌ Error uploading vehicle label:', e);
    next(e);
  }
}

/**
 * Get vehicle label image
 * GET /api/vehicle-labels/:vehicleId/image
 */
export async function getVehicleLabelImage(req, res, next) {
  try {
    const vehicleId = Number(req.params.vehicleId);
    
    if (!vehicleId) {
      return res.status(400).json({ message: 'شناسه خودرو الزامی است' });
    }
    
    const pool = await getPool();
    
    const result = await pool.request()
      .input('VehicleID', sql.BigInt, vehicleId)
      .query(`
        SELECT TOP 1 LabelImage, ImageContentType, ImageFileName
        FROM VehicleLabel
        WHERE VehicleID = @VehicleID
        ORDER BY CreatedAt DESC
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'تصویر برچسب یافت نشد' });
    }
    
    const label = result.recordset[0];
    
    res.setHeader('Content-Type', label.ImageContentType || 'image/jpeg');
    res.setHeader('Content-Disposition', `inline; filename="${label.ImageFileName || 'label.jpg'}"`);
    res.send(label.LabelImage);
  } catch (e) {
    console.error('❌ Error retrieving vehicle label:', e);
    next(e);
  }
}

/**
 * Get vehicle label metadata
 * GET /api/vehicle-labels/:vehicleId
 */
export async function getVehicleLabelMetadata(req, res, next) {
  try {
    const vehicleId = Number(req.params.vehicleId);
    
    if (!vehicleId) {
      return res.status(400).json({ message: 'شناسه خودرو الزامی است' });
    }
    
    const pool = await getPool();
    
    const result = await pool.request()
      .input('VehicleID', sql.BigInt, vehicleId)
      .query(`
        SELECT 
          vl.Id,
          vl.VehicleID,
          vl.ImageFileName,
          vl.ImageContentType,
          vl.ImageSize,
          vl.UserID,
          vl.CreatedAt,
          vl.Notes,
          u.FullName AS UploadedByName
        FROM VehicleLabel vl
        LEFT JOIN Users u ON vl.UserID = u.Id
        WHERE vl.VehicleID = @VehicleID
        ORDER BY vl.CreatedAt DESC
      `);
    
    res.json(result.recordset);
  } catch (e) {
    console.error('❌ Error retrieving vehicle label metadata:', e);
    next(e);
  }
}

/**
 * Check if vehicle has label
 * GET /api/vehicle-labels/:vehicleId/exists
 */
export async function checkVehicleLabelExists(req, res, next) {
  try {
    const vehicleId = Number(req.params.vehicleId);
    
    if (!vehicleId) {
      return res.status(400).json({ message: 'شناسه خودرو الزامی است' });
    }
    
    const pool = await getPool();
    
    const result = await pool.request()
      .input('VehicleID', sql.BigInt, vehicleId)
      .query(`
        SELECT COUNT(*) AS Count
        FROM VehicleLabel
        WHERE VehicleID = @VehicleID
      `);
    
    const exists = result.recordset[0].Count > 0;
    
    res.json({ exists, count: result.recordset[0].Count });
  } catch (e) {
    console.error('❌ Error checking vehicle label:', e);
    next(e);
  }
}
