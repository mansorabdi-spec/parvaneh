import Joi from 'joi';
import { getPool, sql } from '../lib/db.js';
import PDFDocument from 'pdfkit';

const issueSchema = Joi.object({
  applicantId: Joi.number().integer().required(),
  activityType: Joi.string().max(100).required(),
  validFrom: Joi.date().required(),
  validTo: Joi.date().greater(Joi.ref('validFrom')).required(),
  notes: Joi.string().allow('', null)
});

export async function listLicenses(req, res, next) {
  try {
    const pool = await getPool();
    const isAdmin = req.user?.role === 'Admin' || (req.user?.roles || []).includes('Admin');
    const isOfficer = req.user?.role === 'Officer' || (req.user?.roles || []).includes('Officer');
    let request = pool.request();
    let query = `
      SELECT l.*, a.FirstName, a.LastName, a.NationalId
      FROM Licenses l
      JOIN Applicants a ON a.Id = l.ApplicantId
    `;
    if (!isAdmin && !isOfficer) {
      request = request.input('UserId', sql.Int, req.user?.id || 0);
      query += ' WHERE l.CreatedByUserId=@UserId';
    }
    query += ' ORDER BY l.Id DESC';
    const { recordset } = await request.query(query);
    res.json(recordset);
  } catch (e) {
    next(e);
  }
}

export async function listMyLicenses(req, res, next) {
  try {
    const pool = await getPool();
    const { recordset } = await pool.request()
      .input('UserId', sql.Int, req.user?.id || 0)
      .query(`
        SELECT l.*, a.FirstName, a.LastName, a.NationalId
        FROM Licenses l
        JOIN Applicants a ON a.Id = l.ApplicantId
        WHERE l.CreatedByUserId=@UserId
        ORDER BY l.Id DESC
      `);
    res.json(recordset);
  } catch (e) { next(e); }
}

export async function issueLicense(req, res, next) {
  try {
    const { error, value } = issueSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const pool = await getPool();

    // Verify applicant exists
    const applicant = await pool
      .request()
      .input('ApplicantId', sql.Int, value.applicantId)
      .query('SELECT Id FROM Applicants WHERE Id=@ApplicantId');
    if (!applicant.recordset[0]) return res.status(400).json({ message: 'Invalid applicantId' });

    // Insert license
    // Insert license (Pending)
    const result = await pool
      .request()
      .input('ApplicantId', sql.Int, value.applicantId)
      .input('ActivityType', sql.NVarChar(100), value.activityType)
      .input('ValidFrom', sql.Date, new Date(value.validFrom))
      .input('ValidTo', sql.Date, new Date(value.validTo))
      .input('Notes', sql.NVarChar(sql.MAX), value.notes || null)
      .input('CreatedByUserId', sql.Int, req.user?.id || null)
      .query(`
        INSERT INTO Licenses (ApplicantId, ActivityType, ValidFrom, ValidTo, Status, Notes, CreatedByUserId)
        OUTPUT INSERTED.*
        VALUES (@ApplicantId, @ActivityType, @ValidFrom, @ValidTo, 'Pending', @Notes, @CreatedByUserId)
      `);

    const license = result.recordset[0];

    // Create approval steps from global flow
    const flow = await pool.request().query('SELECT StepOrder, RoleName FROM GlobalApprovalFlowSteps ORDER BY StepOrder');
    if (flow.recordset.length > 0) {
      const table = new sql.Table('LicenseApprovals');
      table.create = false;
      table.columns.add('LicenseId', sql.Int, { nullable: false });
      table.columns.add('ApproverRole', sql.NVarChar(50), { nullable: false });
      table.columns.add('StepOrder', sql.Int, { nullable: false });
      table.columns.add('ApproverUserId', sql.Int, { nullable: true });
      table.columns.add('Decision', sql.NVarChar(10), { nullable: true });
      table.columns.add('Notes', sql.NVarChar(sql.MAX), { nullable: true });
      table.columns.add('DecidedAt', sql.DateTime2, { nullable: true });
      table.columns.add('CreatedAt', sql.DateTime2, { nullable: false });
      const now = new Date();
      for (const s of flow.recordset) {
        table.rows.add(license.Id, s.RoleName, s.StepOrder, null, null, null, null, now);
      }
      const bulk = pool.request();
      await bulk.bulk(table);
    }

    res.status(201).json(license);
  } catch (e) {
    next(e);
  }
}

export async function getLicensePdf(req, res, next) {
  try {
    const id = Number(req.params.id);
    const pool = await getPool();
    const q = await pool.request()
      .input('Id', sql.Int, id)
      .query(`
        SELECT l.*, a.FirstName, a.LastName, a.NationalId
        FROM Licenses l JOIN Applicants a ON a.Id = l.ApplicantId
        WHERE l.Id=@Id
      `);
    const lic = q.recordset[0];
    if (!lic) return res.status(404).json({ message: 'License not found' });
    if (lic.Status !== 'Approved') return res.status(400).json({ message: 'License is not approved yet' });

    // Authorization: owner or Admin/Officer only
    const isAdmin = req.user?.role === 'Admin' || (req.user?.roles || []).includes('Admin');
    const isOfficer = req.user?.role === 'Officer' || (req.user?.roles || []).includes('Officer');
    const isOwner = req.user?.id && lic.CreatedByUserId === req.user.id;
    if (!isAdmin && !isOfficer && !isOwner) return res.status(403).json({ message: 'Not allowed to access this PDF' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=license-${lic.Id}.pdf`);
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.pipe(res);

    doc.fontSize(18).text('Activity License', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`License ID: ${lic.Id}`);
    doc.text(`Applicant: ${lic.FirstName} ${lic.LastName} (NID: ${lic.NationalId})`);
    doc.text(`Activity Type: ${lic.ActivityType}`);
    doc.text(`Valid From: ${new Date(lic.ValidFrom).toISOString().slice(0,10)}  To: ${new Date(lic.ValidTo).toISOString().slice(0,10)}`);
    doc.text(`Status: ${lic.Status}`);
    if (lic.Notes) { doc.moveDown().text(`Notes: ${lic.Notes}`); }

    doc.end();
  } catch (e) { next(e); }
}
