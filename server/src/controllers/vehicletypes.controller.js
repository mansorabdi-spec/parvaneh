import { sql, getPool } from '../lib/db.js'
import Joi from 'joi'

// Schema for vehicle type validation
const vehicleTypeSchema = Joi.object({
  vehicleTypeName: Joi.string().trim().min(1).max(100).required()
    .messages({
      'string.empty': 'نام نوع وسیله نقلیه الزامی است',
      'string.min': 'نام نوع وسیله نقلیه باید حداقل ۱ کاراکتر باشد',
      'string.max': 'نام نوع وسیله نقلیه نمی‌تواند بیشتر از ۱۰۰ کاراکتر باشد',
      'any.required': 'نام نوع وسیله نقلیه الزامی است'
    })
})

/**
 * Get all vehicle types
 * GET /api/vehicletypes
 */
export async function getAllVehicleTypes(req, res) {
  try {
    const pool = await getPool()
    const result = await pool.request().query(`
      SELECT 
        v.ID, 
        v.VehicleTypeName, 
        v.CreatedAt, 
        v.UpdatedAt,
        (SELECT COUNT(*) FROM Systemtype s WHERE s.VehicleTypeID = v.ID) AS SystemCount
      FROM VehicleType v
      ORDER BY v.VehicleTypeName
    `)
    res.json(result.recordset)
  } catch (err) {
    console.error('Error fetching vehicle types:', err)
    res.status(500).json({ message: 'خطا در دریافت انواع وسیله نقلیه' })
  }
}

/**
 * Get all system types for a specific vehicle type
 * GET /api/vehicletypes/:vehicleTypeId/systems
 */
export async function getSystemsByVehicleType(req, res) {
  try {
    const { vehicleTypeId } = req.params
    const pool = await getPool()
    
    // First verify vehicle type exists
    const vehicleTypeCheck = await pool
      .request()
      .input('vehicleTypeId', sql.Int, vehicleTypeId)
      .query('SELECT ID FROM VehicleType WHERE ID = @vehicleTypeId')
    
    if (vehicleTypeCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'نوع وسیله نقلیه یافت نشد' })
    }
    
    const result = await pool
      .request()
      .input('vehicleTypeId', sql.Int, vehicleTypeId)
      .query(`
        SELECT 
          s.ID, 
          s.systemname, 
          s.VehicleTypeID,
          (SELECT COUNT(*) FROM Tiptype t WHERE t.SystemtypeID = s.ID) AS TipCount
        FROM Systemtype s
        WHERE s.VehicleTypeID = @vehicleTypeId
        ORDER BY s.systemname
      `)
    
    res.json({
      vehicleType: vehicleTypeCheck.recordset[0],
      systems: result.recordset
    })
  } catch (err) {
    console.error('Error fetching systems by vehicle type:', err)
    res.status(500).json({ message: 'خطا در دریافت سیستم‌های ناوگان' })
  }
}

/**
 * Get all system types with vehicle type info
 * GET /api/vehicletypes/systems/all
 */
export async function getAllSystems(req, res) {
  try {
    const pool = await getPool()
    const result = await pool.request().query(`
      SELECT 
        s.ID, 
        s.systemname, 
        s.VehicleTypeID,
        v.VehicleTypeName,
        (SELECT COUNT(*) FROM Tiptype t WHERE t.SystemtypeID = s.ID) AS TipCount
      FROM Systemtype s
      LEFT JOIN VehicleType v ON s.VehicleTypeID = v.ID
      ORDER BY v.VehicleTypeName, s.systemname
    `)
    res.json(result.recordset)
  } catch (err) {
    console.error('Error fetching all systems:', err)
    res.status(500).json({ message: 'خطا در دریافت سیستم‌های ناوگان' })
  }
}

/**
 * Get all tip types for a specific system type
 * GET /api/vehicletypes/systems/:systemId/tips
 */
export async function getTipsBySystem(req, res) {
  try {
    const { systemId } = req.params
    const pool = await getPool()
    
    // First verify system exists and get its details
    const systemCheck = await pool
      .request()
      .input('systemId', sql.Int, systemId)
      .query(`
        SELECT 
          s.ID, 
          s.systemname, 
          s.VehicleTypeID,
          v.VehicleTypeName
        FROM Systemtype s
        LEFT JOIN VehicleType v ON s.VehicleTypeID = v.ID
        WHERE s.ID = @systemId
      `)
    
    if (systemCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'سیستم مورد نظر یافت نشد' })
    }
    
    const tips = await pool
      .request()
      .input('systemId', sql.Int, systemId)
      .query(`
        SELECT 
          t.ID, 
          t.tipname, 
          t.SystemtypeID
        FROM Tiptype t
        WHERE t.SystemtypeID = @systemId
        ORDER BY t.tipname
      `)
    
    res.json({
      system: systemCheck.recordset[0],
      tips: tips.recordset
    })
  } catch (err) {
    console.error('Error fetching tips by system:', err)
    res.status(500).json({ message: 'خطا در دریافت تیپ‌های ناوگان' })
  }
}

/**
 * Create a new vehicle type (Admin only)
 * POST /api/vehicletypes
 */
export async function createVehicleType(req, res) {
  try {
    // Validate request body
    const { error, value } = vehicleTypeSchema.validate(req.body, { abortEarly: false })
    
    if (error) {
      const errors = error.details.map(detail => detail.message)
      return res.status(400).json({ 
        message: 'خطا در اعتبارسنجی داده‌ها',
        errors 
      })
    }
    
    const { vehicleTypeName } = value
    const userId = req.user?.id
    
    if (!userId) {
      return res.status(401).json({ message: 'احراز هویت ناموفق بود' })
    }
    
    const pool = await getPool()
    const request = pool.request()
    
    // Check for duplicate name (case-insensitive, trimmed)
    const duplicateCheck = await request
      .input('name', sql.NVarChar(100), vehicleTypeName.trim())
      .query(`
        SELECT 1 
        FROM VehicleType 
        WHERE LOWER(TRIM(VehicleTypeName)) = LOWER(TRIM(@name))
      `)
    
    if (duplicateCheck.recordset.length > 0) {
      return res.status(409).json({ 
        message: 'نوع وسیله نقلیه با این نام قبلاً ثبت شده است' 
      })
    }
    
    // Create new vehicle type with audit fields
    const result = await pool.request()
      .input('name', sql.NVarChar(100), vehicleTypeName.trim())
      .input('userId', sql.Int, userId)
      .query(`
        INSERT INTO VehicleType (VehicleTypeName, ID_User, CreatedAt, UpdatedAt)
        OUTPUT INSERTED.*
        VALUES (
          @name, 
          @userId, 
          GETDATE(), 
          GETDATE()
        )
      `)
    
    res.status(201).json({
      ...result.recordset[0],
      CreatedBy: req.user?.username || 'سیستم'
    })
  } catch (err) {
    console.error('Error creating vehicle type:', err)
    res.status(500).json({ 
      message: 'خطا در ایجاد نوع وسیله نقلیه',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    })
  }
}

/**
 * Update a vehicle type (Admin only)
 * PUT /api/vehicletypes/:id
 */
export async function updateVehicleType(req, res) {
  try {
    const { id } = req.params
    
    // Validate request body
    const { error, value } = vehicleTypeSchema.validate(req.body, { abortEarly: false })
    
    if (error) {
      const errors = error.details.map(detail => detail.message)
      return res.status(400).json({ 
        message: 'خطا در اعتبارسنجی داده‌ها',
        errors 
      })
    }
    
    const { vehicleTypeName } = value
    const userId = req.user?.id
    
    if (!userId) {
      return res.status(401).json({ message: 'احراز هویت ناموفق بود' })
    }
    
    const pool = await getPool()
    const request = pool.request()
    
    // Check if vehicle type exists and get current data
    const exists = await request
      .input('id', sql.Int, id)
      .query('SELECT * FROM VehicleType WHERE ID = @id')
    
    if (exists.recordset.length === 0) {
      return res.status(404).json({ 
        message: 'نوع وسیله نقلیه یافت نشد' 
      })
    }
    
    const currentData = exists.recordset[0]
    
    // Check if name has actually changed
    if (currentData.VehicleTypeName.trim().toLowerCase() === vehicleTypeName.trim().toLowerCase()) {
      return res.status(200).json({
        ...currentData,
        message: 'تغییری در اطلاعات ایجاد نشد'
      })
    }
    
    // Check for duplicate name (case-insensitive, trimmed, excluding current record)
    const duplicateCheck = await pool.request()
      .input('name', sql.NVarChar(100), vehicleTypeName.trim())
      .input('id', sql.Int, id)
      .query(`
        SELECT 1 
        FROM VehicleType 
        WHERE LOWER(TRIM(VehicleTypeName)) = LOWER(TRIM(@name)) 
        AND ID != @id
      `)
    
    if (duplicateCheck.recordset.length > 0) {
      return res.status(409).json({ 
        message: 'نوع وسیله نقلیه با این نام قبلاً ثبت شده است' 
      })
    }
    
    // Update vehicle type with audit fields
    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('name', sql.NVarChar(100), vehicleTypeName.trim())
      .input('userId', sql.Int, userId)
      .query(`
        UPDATE VehicleType 
        SET 
          VehicleTypeName = @name, 
          ID_User = @userId, 
          UpdatedAt = GETDATE() 
        OUTPUT INSERTED.*
        WHERE ID = @id
      `)
    
    res.json({
      ...result.recordset[0],
      UpdatedBy: req.user?.username || 'سیستم'
    })
  } catch (err) {
    console.error('Error updating vehicle type:', err)
    res.status(500).json({ 
      message: 'خطا در به‌روزرسانی نوع وسیله نقلیه',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    })
  }
}

/**
 * Delete a vehicle type (Admin only)
 * DELETE /api/vehicletypes/:id
 */
export async function deleteVehicleType(req, res) {
  try {
    const { id } = req.params
    const userId = req.user?.id
    
    if (!userId) {
      return res.status(401).json({ message: 'احراز هویت ناموفق بود' })
    }
    
    const pool = await getPool()
    const transaction = new sql.Transaction(pool)
    
    try {
      await transaction.begin()
      
      // Check if vehicle type exists and get details for logging
      const vehicleTypeCheck = await new sql.Request(transaction)
        .input('id', sql.Int, id)
        .query('SELECT ID, VehicleTypeName FROM VehicleType WITH (TABLOCKX) WHERE ID = @id')
      
      if (vehicleTypeCheck.recordset.length === 0) {
        await transaction.rollback()
        return res.status(404).json({ 
          message: 'نوع وسیله نقلیه یافت نشد' 
        })
      }
      
      const vehicleType = vehicleTypeCheck.recordset[0]
      
      // Check for associated systems with count
      const systemsCheck = await new sql.Request(transaction)
        .input('id', sql.Int, id)
        .query(`
          SELECT 
            COUNT(*) AS SystemCount,
            STRING_AGG(systemname, ', ') AS SystemNames
          FROM Systemtype 
          WHERE VehicleTypeID = @id
        `)
      
      const systemCount = parseInt(systemsCheck.recordset[0].SystemCount) || 0
      
      if (systemCount > 0) {
        await transaction.rollback()
        return res.status(400).json({ 
          message: `امکان حذف این نوع وسیله نقلیه وجود ندارد زیرا ${systemCount} سیستم به آن وابسته است`,
          systemCount,
          systemNames: systemsCheck.recordset[0].SystemNames
        })
      }
      
      // Log the deletion (you might want to create an audit log table)
      await new sql.Request(transaction)
        .input('userId', sql.Int, userId)
        .input('vehicleTypeId', sql.Int, id)
        .input('action', sql.NVarChar(50), 'DELETE')
        .input('details', sql.NVarChar(1000), 
          `حذف نوع وسیله نقلیه: ${vehicleType.VehicleTypeName}`)
        .query(`
          INSERT INTO AuditLog (UserID, Action, Details, CreatedAt)
          VALUES (@userId, @action, @details, GETDATE())
        `)
      
      // Delete vehicle type
      await new sql.Request(transaction)
        .input('id', sql.Int, id)
        .query('DELETE FROM VehicleType WHERE ID = @id')
      
      await transaction.commit()
      
      res.json({ 
        success: true,
        message: `نوع وسیله نقلیه "${vehicleType.VehicleTypeName}" با موفقیت حذف شد`,
        deletedId: id
      })
      
    } catch (err) {
      await transaction.rollback()
      throw err
    }
  } catch (err) {
    console.error('Error deleting vehicle type:', err)
    res.status(500).json({ 
      success: false,
      message: 'خطا در حذف نوع وسیله نقلیه',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    })
  }
}
