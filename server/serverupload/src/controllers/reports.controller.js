import { getPool, sql } from '../lib/db.js';
import {
  getFieldCatalog,
  queryComprehensiveReport,
  buildExcelXml,
  statusLabel
} from '../lib/comprehensiveReport.js';

// Get all activity license reports (vehicles with person and contact info)
export async function getActivityLicenseReports(req, res, next) {
  try {
    const pool = await getPool();
    const query = `
      SELECT 
        v.*,
        p.FirstName,
        p.LastName,
        p.FatherName,
        p.BirthDateJalali,
        p.Gender,
        p.MaritalStatus,
        p.IdSerial,
        p.BirthProvinceId,
        p.BirthCityId,
        (
          SELECT TOP 1 Value 
          FROM PersonContacts 
          WHERE NationalCode = v.RegistrarNationalCode AND Type = 'mobile'
          ORDER BY IsActive DESC, CreatedAt DESC
        ) AS MobilePhone
      FROM Vehicles v
      LEFT JOIN Persons p ON p.NationalCode = v.RegistrarNationalCode
      ORDER BY v.CreatedAt DESC
    `;
    const result = await pool.request().query(query);
    res.json(result.recordset || []);
  } catch (e) {
    next(e);
  }
}

// Get detailed vehicle report by VehicleID
export async function getVehicleDetailReport(req, res, next) {
  try {
    const vehicleId = Number(req.params.vehicleId);
    if (!vehicleId) return res.status(400).json({ message: 'Missing vehicleId' });

    const pool = await getPool();

    // Get vehicle info
    const vehicleResult = await pool.request()
      .input('VehicleID', sql.BigInt, vehicleId)
      .query('SELECT * FROM Vehicles WHERE VehicleID = @VehicleID');
    const vehicle = vehicleResult.recordset[0];
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });

    // Get person info
    const personResult = await pool.request()
      .input('NationalCode', sql.NVarChar(20), vehicle.RegistrarNationalCode)
      .query('SELECT * FROM Persons WHERE NationalCode = @NationalCode');
    const person = personResult.recordset[0] || null;

    // Get person residences
    const residencesResult = await pool.request()
      .input('NationalCode', sql.NVarChar(20), vehicle.RegistrarNationalCode)
      .query('SELECT * FROM PersonResidences WHERE NationalCode = @NationalCode');
    const residences = residencesResult.recordset || [];

    // Get person contacts
    const contactsResult = await pool.request()
      .input('NationalCode', sql.NVarChar(20), vehicle.RegistrarNationalCode)
      .query('SELECT * FROM PersonContacts WHERE NationalCode = @NationalCode ORDER BY CreatedAt DESC');
    const contacts = contactsResult.recordset || [];

    // Get person documents
    const personDocsResult = await pool.request()
      .input('NationalCode', sql.NVarChar(20), vehicle.RegistrarNationalCode)
      .query(`
        SELECT pd.DocID, pd.NationalCode, pd.LookupDocTypeId, lv.Name AS DocTypeName, 
               pd.MimeType, pd.SizeBytes, pd.CreatedAt
        FROM PersonDocuments pd
        LEFT JOIN LookupValue lv ON lv.Id = pd.LookupDocTypeId
        WHERE pd.NationalCode = @NationalCode
        ORDER BY pd.CreatedAt DESC
      `);
    const personDocuments = personDocsResult.recordset || [];

    // Get vehicle documents
    const vehicleDocsResult = await pool.request()
      .input('VehicleID', sql.BigInt, vehicleId)
      .query(`
        SELECT vd.DocID, vd.VehicleID, vd.LookupDocTypeId, lv.Name AS DocTypeName,
               vd.MimeType, vd.SizeBytes, vd.CreatedAt
        FROM VehicleDocuments vd
        LEFT JOIN LookupValue lv ON lv.Id = vd.LookupDocTypeId
        WHERE vd.VehicleID = @VehicleID
        ORDER BY vd.CreatedAt DESC
      `);
    const vehicleDocuments = vehicleDocsResult.recordset || [];

    // Get vehicle discount documents
    const discountDocsResult = await pool.request()
      .input('VehicleID', sql.BigInt, vehicleId)
      .query(`
        SELECT vdd.DocID, vdd.VehicleID, vdd.LookupDocTypeId, lv.Name AS DocTypeName,
               vdd.Description, vdd.MimeType, vdd.SizeBytes, vdd.CreatedAt
        FROM VehicleDiscountDocuments vdd
        LEFT JOIN LookupValue lv ON lv.Id = vdd.LookupDocTypeId
        WHERE vdd.VehicleID = @VehicleID
        ORDER BY vdd.CreatedAt DESC
      `);
    const discountDocuments = discountDocsResult.recordset || [];

    // Get payment info (online payments)
    const paymentsResult = await pool.request()
      .input('VehicleID', sql.BigInt, vehicleId)
      .query(`
        SELECT * FROM OnlinePayment 
        WHERE VehicleID = @VehicleID 
        ORDER BY CreatedAt DESC
      `);
    const payments = paymentsResult.recordset || [];

    // Return comprehensive report
    res.json({
      vehicle,
      person,
      residences,
      contacts,
      personDocuments,
      vehicleDocuments,
      discountDocuments,
      payments
    });
  } catch (e) {
    next(e);
  }
}

export async function getComprehensiveReportMeta(req, res, next) {
  try {
    const pool = await getPool();
    const [licenseTypes, operationTypes, statuses] = await Promise.all([
      pool.request().query(`
        SELECT DISTINCT lt.Id, lt.Name
        FROM VehicleRequests vr
        INNER JOIN LookupValue lt ON vr.LicenseTypeId = lt.Id
        WHERE lt.Name IS NOT NULL
        ORDER BY lt.Name
      `),
      pool.request().query(`
        SELECT DISTINCT ot.Id, ot.Name
        FROM VehicleRequests vr
        INNER JOIN LookupValue ot ON vr.OperationTypeId = ot.Id
        WHERE ot.Name IS NOT NULL
        ORDER BY ot.Name
      `),
      pool.request().query(`
        SELECT DISTINCT Status
        FROM VehicleRequests
        WHERE Status IS NOT NULL AND LTRIM(RTRIM(Status)) <> ''
        ORDER BY Status
      `)
    ]);

    res.json({
      ...getFieldCatalog(),
      licenseTypes: (licenseTypes.recordset || []).map((row) => ({ id: row.Id, name: row.Name })),
      operationTypes: (operationTypes.recordset || []).map((row) => ({ id: row.Id, name: row.Name })),
      statuses: (statuses.recordset || []).map((row) => ({
        value: row.Status,
        label: statusLabel(row.Status)
      }))
    });
  } catch (e) {
    next(e);
  }
}

export async function postComprehensiveReport(req, res, next) {
  try {
    const pool = await getPool();
    const result = await queryComprehensiveReport(pool, {
      fieldKeys: req.body?.fields,
      filters: req.body?.filters || {},
      page: req.body?.page,
      pageSize: req.body?.pageSize
    });
    res.json({
      columns: result.fields.map(({ key, label, type }) => ({ key, label, type: type || 'text' })),
      rows: result.rows,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    });
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ message: e.message });
    next(e);
  }
}

export async function exportComprehensiveReport(req, res, next) {
  try {
    const pool = await getPool();
    const result = await queryComprehensiveReport(pool, {
      fieldKeys: req.body?.fields,
      filters: req.body?.filters || {},
      forExport: true
    });
    const xml = buildExcelXml(result.fields, result.rows);
    const filename = encodeURIComponent(`گزارش_جامع_${new Date().toISOString().slice(0, 10)}.xls`);
    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="comprehensive-report.xls"; filename*=UTF-8''${filename}`);
    res.send(xml);
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ message: e.message });
    next(e);
  }
}
