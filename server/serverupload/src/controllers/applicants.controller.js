import Joi from 'joi';
import { getPool, sql } from '../lib/db.js';

const applicantSchema = Joi.object({
  nationalId: Joi.string().min(5).max(20).required(),
  firstName: Joi.string().max(100).required(),
  lastName: Joi.string().max(100).required(),
  phone: Joi.string().max(20).allow('', null),
  email: Joi.string().email().allow('', null),
  address: Joi.string().allow('', null)
});

export async function listApplicants(req, res, next) {
  try {
    const pool = await getPool();
    const { recordset } = await pool.request().query('SELECT * FROM Applicants ORDER BY Id DESC');
    res.json(recordset);
  } catch (e) {
    next(e);
  }
}

export async function getApplicantById(req, res, next) {
  try {
    const pool = await getPool();
    const { recordset } = await pool
      .request()
      .input('Id', sql.Int, Number(req.params.id))
      .query('SELECT * FROM Applicants WHERE Id = @Id');
    if (!recordset[0]) return res.status(404).json({ message: 'Not found' });
    res.json(recordset[0]);
  } catch (e) {
    next(e);
  }
}

export async function createApplicant(req, res, next) {
  try {
    const { error, value } = applicantSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const pool = await getPool();
    const result = await pool
      .request()
      .input('NationalId', sql.NVarChar(20), value.nationalId)
      .input('FirstName', sql.NVarChar(100), value.firstName)
      .input('LastName', sql.NVarChar(100), value.lastName)
      .input('Phone', sql.NVarChar(20), value.phone || null)
      .input('Email', sql.NVarChar(255), value.email || null)
      .input('Address', sql.NVarChar(sql.MAX), value.address || null)
      .query(`
        INSERT INTO Applicants (NationalId, FirstName, LastName, Phone, Email, Address)
        OUTPUT INSERTED.*
        VALUES (@NationalId, @FirstName, @LastName, @Phone, @Email, @Address)
      `);
    res.status(201).json(result.recordset[0]);
  } catch (e) {
    next(e);
  }
}

export async function updateApplicant(req, res, next) {
  try {
    const { error, value } = applicantSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const id = Number(req.params.id);
    const pool = await getPool();
    const result = await pool
      .request()
      .input('Id', sql.Int, id)
      .input('NationalId', sql.NVarChar(20), value.nationalId)
      .input('FirstName', sql.NVarChar(100), value.firstName)
      .input('LastName', sql.NVarChar(100), value.lastName)
      .input('Phone', sql.NVarChar(20), value.phone || null)
      .input('Email', sql.NVarChar(255), value.email || null)
      .input('Address', sql.NVarChar(sql.MAX), value.address || null)
      .query(`
        UPDATE Applicants
        SET NationalId=@NationalId, FirstName=@FirstName, LastName=@LastName,
            Phone=@Phone, Email=@Email, Address=@Address
        OUTPUT INSERTED.*
        WHERE Id=@Id
      `);
    if (!result.recordset[0]) return res.status(404).json({ message: 'Not found' });
    res.json(result.recordset[0]);
  } catch (e) {
    next(e);
  }
}

export async function deleteApplicant(req, res, next) {
  try {
    const id = Number(req.params.id);
    const pool = await getPool();
    const result = await pool
      .request()
      .input('Id', sql.Int, id)
      .query('DELETE FROM Applicants WHERE Id=@Id');
    res.json({ success: true, affected: result.rowsAffected?.[0] || 0 });
  } catch (e) {
    next(e);
  }
}
