import Joi from 'joi';
import { getPool, sql } from '../lib/db.js';

const provinceSchema = Joi.object({
  name: Joi.string().min(1).max(100).required()
});

const citySchema = Joi.object({
  name: Joi.string().min(1).max(120).required()
});

export async function listProvinces(req, res, next) {
  try {
    const pool = await getPool();
    const { recordset } = await pool.request().query('SELECT ID, name FROM Provinces ORDER BY name');
    res.json(recordset);
  } catch (e) { next(e); }
}

export async function createProvince(req, res, next) {
  try {
    const { error, value } = provinceSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });
    const pool = await getPool();
    const dup = await pool.request().input('name', sql.NVarChar(100), value.name.trim())
      .query('SELECT 1 FROM Provinces WHERE name=@name');
    if (dup.recordset[0]) return res.status(409).json({ message: 'این استان قبلاً وجود دارد' });
    const r = await pool.request().input('name', sql.NVarChar(100), value.name.trim())
      .query('INSERT INTO Provinces(name) OUTPUT INSERTED.* VALUES(@name)');
    res.status(201).json(r.recordset[0]);
  } catch (e) { next(e); }
}

export async function updateProvince(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { error, value } = provinceSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });
    const pool = await getPool();
    const dup = await pool.request().input('id', sql.Int, id).input('name', sql.NVarChar(100), value.name.trim())
      .query('SELECT 1 FROM Provinces WHERE name=@name AND ID<>@id');
    if (dup.recordset[0]) return res.status(409).json({ message: 'نام تکراری است' });
    const r = await pool.request().input('id', sql.Int, id).input('name', sql.NVarChar(100), value.name.trim())
      .query('UPDATE Provinces SET name=@name OUTPUT INSERTED.* WHERE ID=@id');
    if (!r.recordset[0]) return res.status(404).json({ message: 'یافت نشد' });
    res.json(r.recordset[0]);
  } catch (e) { next(e); }
}

export async function deleteProvince(req, res, next) {
  try {
    const id = Number(req.params.id);
    const pool = await getPool();
    await pool.request().input('id', sql.Int, id)
      .query('DELETE FROM Cities WHERE ProvinceID=@id; DELETE FROM Provinces WHERE ID=@id;');
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function listCities(req, res, next) {
  try {
    const provinceId = Number(req.params.id);
    const pool = await getPool();
    const { recordset } = await pool.request().input('id', sql.Int, provinceId)
      .query('SELECT ID, name, ProvinceID FROM Cities WHERE ProvinceID=@id ORDER BY name');
    res.json(recordset);
  } catch (e) { next(e); }
}

export async function createCity(req, res, next) {
  try {
    const provinceId = Number(req.params.id);
    const { error, value } = citySchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });
    const pool = await getPool();
    const dup = await pool.request().input('id', sql.Int, provinceId).input('name', sql.NVarChar(120), value.name.trim())
      .query('SELECT 1 FROM Cities WHERE ProvinceID=@id AND name=@name');
    if (dup.recordset[0]) return res.status(409).json({ message: 'این شهر قبلاً برای این استان ثبت شده است' });
    const r = await pool.request().input('id', sql.Int, provinceId).input('name', sql.NVarChar(120), value.name.trim())
      .query('INSERT INTO Cities(name, ProvinceID) OUTPUT INSERTED.* VALUES(@name, @id)');
    res.status(201).json(r.recordset[0]);
  } catch (e) { next(e); }
}

export async function updateCity(req, res, next) {
  try {
    const cityId = Number(req.params.cityId);
    const { error, value } = citySchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });
    const pool = await getPool();
    const current = await pool.request().input('cityId', sql.Int, cityId)
      .query('SELECT ProvinceID FROM Cities WHERE ID=@cityId');
    const row = current.recordset[0];
    if (!row) return res.status(404).json({ message: 'یافت نشد' });
    const dup = await pool.request().input('pid', sql.Int, row.ProvinceID).input('name', sql.NVarChar(120), value.name.trim()).input('cityId', sql.Int, cityId)
      .query('SELECT 1 FROM Cities WHERE ProvinceID=@pid AND name=@name AND ID<>@cityId');
    if (dup.recordset[0]) return res.status(409).json({ message: 'نام شهر تکراری است' });
    const r = await pool.request().input('cityId', sql.Int, cityId).input('name', sql.NVarChar(120), value.name.trim())
      .query('UPDATE Cities SET name=@name OUTPUT INSERTED.* WHERE ID=@cityId');
    res.json(r.recordset[0]);
  } catch (e) { next(e); }
}

export async function deleteCity(req, res, next) {
  try {
    const cityId = Number(req.params.cityId);
    const pool = await getPool();
    await pool.request().input('cityId', sql.Int, cityId).query('DELETE FROM Cities WHERE ID=@cityId');
    res.json({ success: true });
  } catch (e) { next(e); }
}
