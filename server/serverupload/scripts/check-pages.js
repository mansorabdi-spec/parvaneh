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
  
  // Check if exploitation_renew page exists
  const result = await pool.request()
    .query("SELECT PageKey, PagePath, PageTitle FROM Pages ORDER BY PageKey");
  
  console.log('=== Pages in Database ===');
  result.recordset.forEach(row => {
    console.log(`${row.PageKey} | ${row.PagePath} | ${row.PageTitle}`);
  });
  
  // Check if exploitation_renew permission exists
  const permResult = await pool.request()
    .query(`
      SELECT p.PageKey, r.Name as RoleName, rpp.CanAccess
      FROM RolePagePermissions rpp
      JOIN Pages p ON p.Id = rpp.PageId
      JOIN Roles r ON r.Id = rpp.RoleId
      WHERE p.PageKey LIKE '%exploitation%' OR p.PageKey LIKE '%renew%'
      ORDER BY r.Name, p.PageKey
    `);
  
  console.log('\n=== Exploitation and Renew Permissions ===');
  permResult.recordset.forEach(row => {
    console.log(`${row.RoleName} | ${row.PageKey} | CanAccess: ${row.CanAccess}`);
  });
  
  process.exit(0);
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}