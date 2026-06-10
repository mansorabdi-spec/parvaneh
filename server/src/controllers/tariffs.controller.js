import Joi from 'joi';
import { getPool, sql } from '../lib/db.js';

const tariffSchema = Joi.object({
  licenseType: Joi.string().max(200).required(),
  docTypeId: Joi.number().integer().required(),
  amount: Joi.number().integer().min(0).required(),
  fromDate: Joi.string().allow('', null), // expect YYYY/MM/DD (jalali) or yyyy-mm-dd converted by client if needed
  toDate: Joi.string().allow('', null),
  fromTon: Joi.string().allow('', null),
  toTon: Joi.string().allow('', null),
  year: Joi.string().max(10).required(),
  description: Joi.string().allow('', null)
});

const tariffUpdateSchema = Joi.object({
  licenseType: Joi.string().max(200),
  docTypeId: Joi.number().integer(),
  amount: Joi.number().integer().min(0),
  fromDate: Joi.string().allow('', null),
  toDate: Joi.string().allow('', null),
  fromTon: Joi.string().allow('', null),
  toTon: Joi.string().allow('', null),
  year: Joi.string().max(10),
  description: Joi.string().allow('', null)
}).min(1);

export async function listTariffs(req, res, next) {
  try {
    const pool = await getPool();
    const { recordset } = await pool.request().query(`
      SELECT 
        t.Id, 
        t.Code, 
        t.LicenseType, 
        t.DocTypeId, 
        v.Name as DocTypeName,
        t.FromDate, 
        t.ToDate, 
        t.FromTon, 
        t.ToTon, 
        t.Amount, 
        t.[Year], 
        t.[Description]
      FROM Tariffs t
      LEFT JOIN LookupValue v ON v.Id = t.DocTypeId
      ORDER BY t.Id DESC
    `);
    res.json(recordset);
  } catch (e) { next(e); }
}

export async function createTariff(req, res, next) {
  try {
    const { error, value } = tariffSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const pool = await getPool();
    const r = await pool.request()
      .input('LicenseType', sql.NVarChar(200), value.licenseType)
      .input('DocTypeId', sql.Int, value.docTypeId)
      .input('Amount', sql.Int, value.amount)
      .input('FromDate', sql.NVarChar(20), value.fromDate || null)
      .input('ToDate', sql.NVarChar(20), value.toDate || null)
      .input('FromTon', sql.NVarChar(50), value.fromTon || null)
      .input('ToTon', sql.NVarChar(50), value.toTon || null)
      .input('Year', sql.NVarChar(10), value.year)
      .input('Description', sql.NVarChar(500), value.description || null)
      .query(`INSERT INTO Tariffs(LicenseType, DocTypeId, Amount, FromDate, ToDate, FromTon, ToTon, [Year], [Description], CreatedAt)
              OUTPUT INSERTED.* VALUES(@LicenseType, @DocTypeId, @Amount, @FromDate, @ToDate, @FromTon, @ToTon, @Year, @Description, GETDATE())`);

    const row = r.recordset[0];
    // attach doc type name
    const doc = await pool.request().input('Id', sql.Int, row.DocTypeId).query('SELECT Name FROM LookupValue WHERE Id=@Id');
    row.DocTypeName = doc.recordset[0]?.Name || null;
    res.status(201).json(row);
  } catch (e) { next(e); }
}

export async function updateTariff(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { error, value } = tariffUpdateSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const pool = await getPool();
    const cur = await pool.request().input('Id', sql.Int, id).query('SELECT * FROM Tariffs WHERE Id=@Id');
    if (!cur.recordset[0]) return res.status(404).json({ message: 'رکورد یافت نشد' });
    const c = cur.recordset[0];

    const r = await pool.request()
      .input('Id', sql.Int, id)
      .input('LicenseType', sql.NVarChar(200), value.licenseType ?? c.LicenseType)
      .input('DocTypeId', sql.Int, value.docTypeId ?? c.DocTypeId)
      .input('Amount', sql.Int, value.amount ?? c.Amount)
      .input('FromDate', sql.NVarChar(20), value.fromDate === undefined ? c.FromDate : (value.fromDate || null))
      .input('ToDate', sql.NVarChar(20), value.toDate === undefined ? c.ToDate : (value.toDate || null))
      .input('FromTon', sql.NVarChar(50), value.fromTon === undefined ? c.FromTon : (value.fromTon || null))
      .input('ToTon', sql.NVarChar(50), value.toTon === undefined ? c.ToTon : (value.toTon || null))
      .input('Year', sql.NVarChar(10), value.year ?? c.Year)
      .input('Description', sql.NVarChar(500), value.description === undefined ? c.Description : (value.description || null))
      .query(`UPDATE Tariffs SET LicenseType=@LicenseType, DocTypeId=@DocTypeId, Amount=@Amount,
              FromDate=@FromDate, ToDate=@ToDate, FromTon=@FromTon, ToTon=@ToTon, [Year]=@Year, [Description]=@Description
              OUTPUT INSERTED.* WHERE Id=@Id`);

    const row = r.recordset[0];
    const doc = await pool.request().input('Id', sql.Int, row.DocTypeId).query('SELECT Name FROM LookupValue WHERE Id=@Id');
    row.DocTypeName = doc.recordset[0]?.Name || null;
    res.json(row);
  } catch (e) { next(e); }
}

export async function deleteTariff(req, res, next) {
  try {
    const id = Number(req.params.id);
    const pool = await getPool();
    await pool.request().input('Id', sql.Int, id).query('DELETE FROM Tariffs WHERE Id=@Id');
    res.json({ success: true });
  } catch (e) { next(e); }
}
