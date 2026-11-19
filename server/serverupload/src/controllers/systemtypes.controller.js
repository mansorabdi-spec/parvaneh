import Joi from 'joi';
import { getPool, sql } from '../lib/db.js';

const systemSchema = Joi.object({
  systemname: Joi.string().min(1).max(100).required(),
  vehicleTypeId: Joi.number().integer().min(1).required()
});

const tipSchema = Joi.object({
  tipname: Joi.string().min(1).max(100).required()
});

export async function listSystems(req, res, next) {
  try {
    const pool = await getPool();
    const query = `
      SELECT 
        s.ID, 
        s.systemname, 
        s.ID_User,
        v.ID as VehicleTypeID,
        v.VehicleTypeName
      FROM Systemtype s
      LEFT JOIN VehicleType v ON s.VehicleTypeID = v.ID
      ORDER BY s.systemname
    `;
    const { recordset } = await pool.request().query(query);
    res.json(recordset);
  } catch (e) { next(e); }
}

export async function createSystem(req, res, next) {
  try {
    // Normalize payload to accept both vehicleTypeId and VehicleTypeID
    const normalized = {
      systemname: req.body?.systemname,
      vehicleTypeId: req.body?.vehicleTypeId ?? req.body?.VehicleTypeID
    };

    const { error, value } = systemSchema.validate(normalized);
    if (error) return res.status(400).json({ message: error.message });
    
    const pool = await getPool();
    
    // Check if system name already exists for this vehicle type
    const exists = await pool.request()
      .input('name', sql.NVarChar(100), value.systemname.trim())
      .input('vehicleTypeId', sql.Int, value.vehicleTypeId)
      .query('SELECT 1 FROM Systemtype WHERE systemname = @name AND VehicleTypeID = @vehicleTypeId');
      
    if (exists.recordset[0]) {
      return res.status(409).json({ message: 'این سیستم با این نوع وسیله نقلیه قبلاً ثبت شده است' });
    }
    
    // Check if vehicle type exists
    const vehicleTypeExists = await pool.request()
      .input('vehicleTypeId', sql.Int, value.vehicleTypeId)
      .query('SELECT 1 FROM VehicleType WHERE ID = @vehicleTypeId');
      
    if (!vehicleTypeExists.recordset[0]) {
      return res.status(404).json({ message: 'نوع وسیله نقلیه یافت نشد' });
    }
    
    const result = await pool.request()
      .input('systemname', sql.NVarChar(100), value.systemname.trim())
      .input('vehicleTypeId', sql.Int, value.vehicleTypeId)
      .input('userId', sql.Int, req.user?.id || null)
      .query(`
        INSERT INTO Systemtype (systemname, VehicleTypeID, ID_User)
        OUTPUT INSERTED.*
        VALUES (@systemname, @vehicleTypeId, @userId)
      `);
      
    res.status(201).json(result.recordset[0]);
  } catch (e) { next(e); }
}

export async function updateSystem(req, res, next) {
  try {
    const id = Number(req.params.id);
    // Normalize payload to accept both vehicleTypeId and VehicleTypeID
    const normalized = {
      systemname: req.body?.systemname,
      vehicleTypeId: req.body?.vehicleTypeId ?? req.body?.VehicleTypeID
    };
    const { error, value } = systemSchema.validate(normalized);
    if (error) return res.status(400).json({ message: error.message });
    
    const pool = await getPool();
    const request = pool.request();
    
    // Check for duplicate system name for the same vehicle type
    const dup = await pool.request()
      .input('id', sql.Int, id)
      .input('name', sql.NVarChar(100), value.systemname.trim())
      .input('vehicleTypeId', sql.Int, value.vehicleTypeId)
      .query('SELECT 1 FROM Systemtype WHERE systemname = @name AND ID <> @id AND VehicleTypeID = @vehicleTypeId');
      
    if (dup.recordset[0]) {
      return res.status(409).json({ message: 'این نام برای نوع وسیله نقلیه انتخاب شده قبلاً ثبت شده است' });
    }
    
    // Check if vehicle type exists
    const vehicleTypeExists = await request
      .input('vehicleTypeId', sql.Int, value.vehicleTypeId)
      .query('SELECT 1 FROM VehicleType WHERE ID = @vehicleTypeId');
      
    if (!vehicleTypeExists.recordset[0]) {
      return res.status(404).json({ message: 'نوع وسیله نقلیه یافت نشد' });
    }
    
    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('systemname', sql.NVarChar(100), value.systemname.trim())
      .input('vehicleTypeId', sql.Int, value.vehicleTypeId)
      .input('userId', sql.Int, req.user?.id || null)
      .query(`
        UPDATE Systemtype 
        SET 
          systemname = @systemname, 
          VehicleTypeID = @vehicleTypeId,
          ID_User = @userId
        OUTPUT INSERTED.*
        WHERE ID = @id
      `);
      
    if (!result.recordset[0]) {
      return res.status(404).json({ message: 'سیستم مورد نظر یافت نشد' });
    }
    
    res.json(result.recordset[0]);
  } catch (e) { next(e); }
}

export async function deleteSystem(req, res, next) {
  try {
    const id = Number(req.params.id);
    const pool = await getPool();
    await pool.request().input('id', sql.Int, id).query('DELETE FROM Tiptype WHERE SystemtypeID=@id; DELETE FROM Systemtype WHERE ID=@id;');
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function listTips(req, res, next) {
  try {
    const systemId = Number(req.params.id);
    const pool = await getPool();
    const { recordset } = await pool.request()
      .input('systemId', sql.Int, systemId)
      .query(`
        SELECT 
          t.ID, 
          t.tipname, 
          t.SystemtypeID,
          t.ID_User
        FROM Tiptype t
        WHERE t.SystemtypeID = @systemId 
        ORDER BY t.tipname
      `);
    res.json(recordset);
  } catch (e) { next(e); }
}

export async function createTip(req, res, next) {
  try {
    const systemId = Number(req.params.id);
    const { error, value } = tipSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });
    
    const pool = await getPool();
    
    // Check if system exists
    const systemExists = await pool.request()
      .input('systemId', sql.Int, systemId)
      .query('SELECT 1 FROM Systemtype WHERE ID = @systemId');
      
    if (!systemExists.recordset[0]) {
      return res.status(404).json({ message: 'سیستم مورد نظر یافت نشد' });
    }
    
    // Check for duplicate tip name in the same system
    const dup = await pool.request()
      .input('systemId', sql.Int, systemId)
      .input('tipname', sql.NVarChar(100), value.tipname.trim())
      .query('SELECT 1 FROM Tiptype WHERE SystemtypeID = @systemId AND tipname = @tipname');
      
    if (dup.recordset[0]) {
      return res.status(409).json({ message: 'این تیپ قبلاً برای این سیستم ثبت شده است' });
    }
    
    // Create the tip
    const result = await pool.request()
      .input('tipname', sql.NVarChar(100), value.tipname.trim())
      .input('systemId', sql.Int, systemId)
      .input('userId', sql.Int, req.user?.id || null)
      .query(`
        INSERT INTO Tiptype (tipname, SystemtypeID, ID_User)
        OUTPUT INSERTED.*
        VALUES (@tipname, @systemId, @userId)
      `);
      
    res.status(201).json(result.recordset[0]);
  } catch (e) { next(e); }
}

export async function updateTip(req, res, next) {
  try {
    const tipId = Number(req.params.tipId);
    const { error, value } = tipSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });
    const pool = await getPool();
    // need SystemtypeID for uniqueness check
    const current = await pool.request().input('tipId', sql.Int, tipId).query('SELECT SystemtypeID FROM Tiptype WHERE ID=@tipId');
    const row = current.recordset[0];
    if (!row) return res.status(404).json({ message: 'یافت نشد' });
    const dup = await pool.request().input('sid', sql.Int, row.SystemtypeID).input('name', sql.NVarChar(100), value.tipname.trim()).input('tipId', sql.Int, tipId)
      .query('SELECT 1 FROM Tiptype WHERE SystemtypeID=@sid AND tipname=@name AND ID<>@tipId');
    if (dup.recordset[0]) return res.status(409).json({ message: 'نام تیپ تکراری است' });
    const r = await pool.request().input('tipId', sql.Int, tipId).input('name', sql.NVarChar(100), value.tipname.trim())
      .query('UPDATE Tiptype SET tipname=@name OUTPUT INSERTED.* WHERE ID=@tipId');
    res.json(r.recordset[0]);
  } catch (e) { next(e); }
}

export async function deleteTip(req, res, next) {
  try {
    const tipId = Number(req.params.tipId);
    const pool = await getPool();
    
    // First check if the tip exists
    const tipExists = await pool.request()
      .input('tipId', sql.Int, tipId)
      .query('SELECT 1 FROM Tiptype WHERE ID = @tipId');
      
    if (!tipExists.recordset[0]) {
      return res.status(404).json({ message: 'تیپ مورد نظر یافت نشد' });
    }
    
    // Delete the tip
    const { rowsAffected } = await pool.request()
      .input('tipId', sql.Int, tipId)
      .query('DELETE FROM Tiptype WHERE ID = @tipId');
    
    if (rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'حذف تیپ انجام نشد' });
    }
    
    res.status(204).send();
  } catch (e) { 
    if (e.number === 547) { // Foreign key constraint
      return res.status(400).json({ 
        message: 'امکان حذف این تیپ وجود ندارد زیرا در حال استفاده است' 
      });
    }
    next(e); 
  }
}
