import sql from 'mssql';

const config = {
  server: 'DESKTOP-U61G9KA',
  database: 'fromserver-parvaneh2',
  user: 'barzm',
  password: 'barzm901280',
  options: {
    encrypt: true,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  connectionTimeout: 30000,
  requestTimeout: 30000,
};

try {
  const pool = await sql.connect(config);
  
  // Check all exploitation_renew permissions
  const result = await pool.request()
    .query(`
      SELECT p.PageKey, rpp.CanAccess, r.Name as RoleName
      FROM RolePagePermissions rpp
      JOIN Pages p ON p.Id = rpp.PageId
      JOIN Roles r ON r.Id = rpp.RoleId
      WHERE p.PageKey = 'exploitation_renew'
    `);
  
  console.log('=== exploitation_renew Permissions ===');
  result.recordset.forEach(row => {
    console.log(`${row.RoleName} | CanAccess: ${row.CanAccess}`);
  });
  
  process.exit(0);
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}