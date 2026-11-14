import { getPool, sql } from '../lib/db.js';

// Ensure SiteSettings table exists and has default popup rows
async function ensureTable(pool) {
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SiteSettings' AND xtype='U')
    BEGIN
      CREATE TABLE SiteSettings (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        [Key] NVARCHAR(100) NOT NULL UNIQUE,
        [Value] NVARCHAR(MAX) NULL,
        UpdatedAt DATETIME DEFAULT GETDATE(),
        UpdatedBy NVARCHAR(200) NULL
      );
    END
  `);

  // Insert defaults if not present
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM SiteSettings WHERE [Key]='popup_enabled')
      INSERT INTO SiteSettings ([Key],[Value],UpdatedAt) VALUES ('popup_enabled','0',GETDATE());
    IF NOT EXISTS (SELECT 1 FROM SiteSettings WHERE [Key]='popup_message')
      INSERT INTO SiteSettings ([Key],[Value],UpdatedAt) VALUES ('popup_message',N'به سامانه صدور پروانه خوش آمدید.',GETDATE());
  `);
}

// GET /api/site-settings/popup  (public - no auth required)
export async function getPopupSettings(req, res, next) {
  try {
    const pool = await getPool();
    await ensureTable(pool);

    const { recordset } = await pool.request().query(
      `SELECT [Key],[Value] FROM SiteSettings WHERE [Key] IN ('popup_enabled','popup_message')`
    );

    const settings = {};
    for (const row of recordset) {
      settings[row.Key] = row.Value;
    }

    res.json({
      enabled: settings['popup_enabled'] === '1',
      message: settings['popup_message'] || ''
    });
  } catch (e) { next(e); }
}

// GET /api/site-settings  (admin - get all settings)
export async function getAllSettings(req, res, next) {
  try {
    const pool = await getPool();
    await ensureTable(pool);

    const { recordset } = await pool.request().query(
      `SELECT [Key],[Value],UpdatedAt,UpdatedBy FROM SiteSettings ORDER BY [Key]`
    );
    res.json(recordset);
  } catch (e) { next(e); }
}

// PUT /api/site-settings/popup  (admin only)
export async function updatePopupSettings(req, res, next) {
  try {
    const { enabled, message } = req.body;

    if (enabled === undefined && message === undefined) {
      return res.status(400).json({ message: 'حداقل یکی از فیلدها (enabled یا message) باید ارسال شود' });
    }

    const pool = await getPool();
    await ensureTable(pool);

    const updatedBy = req.user?.username || req.user?.nationalCode || 'admin';

    if (enabled !== undefined) {
      const enabledVal = enabled ? '1' : '0';
      await pool.request()
        .input('Value', sql.NVarChar(sql.MAX), enabledVal)
        .input('UpdatedBy', sql.NVarChar(200), updatedBy)
        .query(`UPDATE SiteSettings SET [Value]=@Value, UpdatedAt=GETDATE(), UpdatedBy=@UpdatedBy WHERE [Key]='popup_enabled'`);
    }

    if (message !== undefined) {
      await pool.request()
        .input('Value', sql.NVarChar(sql.MAX), String(message))
        .input('UpdatedBy', sql.NVarChar(200), updatedBy)
        .query(`UPDATE SiteSettings SET [Value]=@Value, UpdatedAt=GETDATE(), UpdatedBy=@UpdatedBy WHERE [Key]='popup_message'`);
    }

    // Return updated settings
    const { recordset } = await pool.request().query(
      `SELECT [Key],[Value] FROM SiteSettings WHERE [Key] IN ('popup_enabled','popup_message')`
    );
    const settings = {};
    for (const row of recordset) {
      settings[row.Key] = row.Value;
    }

    res.json({
      success: true,
      enabled: settings['popup_enabled'] === '1',
      message: settings['popup_message'] || ''
    });
  } catch (e) { next(e); }
}
