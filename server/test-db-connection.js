import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '1433'),
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
    enableArithAbort: true,
  },
  connectionTimeout: 30000,
  requestTimeout: 30000,
};

console.log('Testing database connection with config:');
console.log({
  server: config.server,
  database: config.database,
  user: config.user,
  port: config.port,
  encrypt: config.options.encrypt,
  trustServerCertificate: config.options.trustServerCertificate,
});

async function testConnection() {
  try {
    console.log('\nConnecting to SQL Server...');
    const pool = await sql.connect(config);
    console.log('✅ Connection successful!');
    
    const result = await pool.request().query('SELECT @@VERSION AS Version');
    console.log('\n✅ Query successful!');
    console.log('SQL Server Version:', result.recordset[0].Version);
    
    await pool.close();
    console.log('\n✅ Connection closed successfully');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Connection failed!');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

testConnection();
