import Joi from 'joi';
import { getPool, sql } from '../lib/db.js';

export async function getFlow(req, res, next) {
  try {
    const pool = await getPool();
    const licenseType = req.query.licenseType || 'Activity'; // Default to Activity for backwards compatibility
    const { recordset } = await pool.request()
      .input('LicenseType', sql.NVarChar(20), licenseType)
      .query('SELECT Id, StepOrder, RoleName, LicenseType FROM GlobalApprovalFlowSteps WHERE LicenseType = @LicenseType ORDER BY StepOrder');
    res.json(recordset);
  } catch (e) { next(e); }
}

const flowSchema = Joi.object({
  licenseType: Joi.string().valid('Activity', 'Employment', 'Exploitation', 'Activity_Renewal', 'Employment_Renewal', 'Exploitation_Renewal').required(),
  steps: Joi.array().items(Joi.object({
    stepOrder: Joi.number().integer().min(1).required(),
    roleName: Joi.string().min(2).max(50).required()
  })).min(1).required()
});

export async function setFlow(req, res, next) {
  try {
    const { error, value } = flowSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const pool = await getPool();
    const tx = new sql.Transaction(await pool);
    await tx.begin();
    try {
      // Delete only steps for this license type
      await new sql.Request(tx)
        .input('LicenseType', sql.NVarChar(20), value.licenseType)
        .query('DELETE FROM GlobalApprovalFlowSteps WHERE LicenseType = @LicenseType');
      
      const table = new sql.Table('GlobalApprovalFlowSteps');
      table.create = false;
      table.columns.add('StepOrder', sql.Int, { nullable: false });
      table.columns.add('RoleName', sql.NVarChar(50), { nullable: false });
      table.columns.add('LicenseType', sql.NVarChar(20), { nullable: false });
      table.columns.add('CreatedAt', sql.DateTime2, { nullable: false });
      const now = new Date();
      for (const s of value.steps) {
        table.rows.add(s.stepOrder, s.roleName, value.licenseType, now);
      }
      await new sql.Request(tx).bulk(table);
      await tx.commit();
      res.json({ success: true });
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  } catch (e) { next(e); }
}

export async function myTasks(req, res, next) {
  try {
    const pool = await getPool();
    // Determine user roles from token (primary + roles array)
    const roles = new Set([req.user?.role, ...(req.user?.roles || [])].filter(Boolean));
    if (roles.size === 0) return res.json([]);

    // Get approvals where ApproverRole in roles and previous steps for same license are approved
    const rolesList = Array.from(roles);
    const roleParams = rolesList.map((r, i) => `@role${i}`).join(',');
    const request = pool.request();
    rolesList.forEach((r, i) => request.input(`role${i}`, sql.NVarChar(50), r));
    const { recordset } = await request.query(`
      WITH pending AS (
        SELECT la.*
        FROM LicenseApprovals la
        WHERE la.Decision IS NULL AND la.ApproverRole IN (${roleParams})
      )
      SELECT p.*
      FROM pending p
      WHERE NOT EXISTS (
        SELECT 1 FROM LicenseApprovals prev
        WHERE prev.LicenseId = p.LicenseId AND prev.StepOrder < p.StepOrder AND (prev.Decision IS NULL OR prev.Decision = 'Rejected')
      )
      ORDER BY p.LicenseId, p.StepOrder
    `);

    res.json(recordset);
  } catch (e) { next(e); }
}

const decisionSchema = Joi.object({
  decision: Joi.string().valid('Approved', 'Rejected').required(),
  notes: Joi.string().allow('', null)
});

export async function decideApproval(req, res, next) {
  try {
    const approvalId = Number(req.params.id);
    const { error, value } = decisionSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const pool = await getPool();
    // Load approval
    const ares = await pool.request().input('Id', sql.Int, approvalId).query('SELECT * FROM LicenseApprovals WHERE Id=@Id');
    const appr = ares.recordset[0];
    if (!appr) return res.status(404).json({ message: 'Approval not found' });
    // Check role permission
    const roles = new Set([req.user?.role, ...(req.user?.roles || [])].filter(Boolean));
    if (!roles.has(appr.ApproverRole)) return res.status(403).json({ message: 'Not allowed' });
    // Check previous steps approved
    const prev = await pool.request().input('LicenseId', sql.Int, appr.LicenseId).input('StepOrder', sql.Int, appr.StepOrder)
      .query('SELECT 1 FROM LicenseApprovals WHERE LicenseId=@LicenseId AND StepOrder<@StepOrder AND (Decision IS NULL OR Decision = \'Rejected\')');
    if (prev.recordset[0]) return res.status(400).json({ message: 'Previous steps are not approved yet' });
    // Ensure not already decided
    if (appr.Decision) return res.status(400).json({ message: 'Already decided' });

    // Apply decision
    await pool.request()
      .input('Id', sql.Int, approvalId)
      .input('Decision', sql.NVarChar(10), value.decision)
      .input('Notes', sql.NVarChar(sql.MAX), value.notes || null)
      .input('ApproverUserId', sql.Int, req.user.id)
      .input('DecidedAt', sql.DateTime2, new Date())
      .query('UPDATE LicenseApprovals SET Decision=@Decision, Notes=@Notes, ApproverUserId=@ApproverUserId, DecidedAt=@DecidedAt WHERE Id=@Id');

    // Update license status
    if (value.decision === 'Rejected') {
      await pool.request().input('LicenseId', sql.Int, appr.LicenseId).query("UPDATE Licenses SET Status='Rejected' WHERE Id=@LicenseId");
    } else {
      // If this was the last step (no more undecided), set Approved
      const remaining = await pool.request().input('LicenseId', sql.Int, appr.LicenseId)
        .query("SELECT 1 FROM LicenseApprovals WHERE LicenseId=@LicenseId AND Decision IS NULL");
      if (!remaining.recordset[0]) {
        await pool.request().input('LicenseId', sql.Int, appr.LicenseId).query("UPDATE Licenses SET Status='Approved' WHERE Id=@LicenseId");
      }
    }

    res.json({ success: true });
  } catch (e) { next(e); }
}
