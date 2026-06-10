import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sql from 'mssql';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
const envPath = path.join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

console.log('📝 Using database configuration:');
console.log('   Server:', process.env.DB_SERVER);
console.log('   Database:', process.env.DB_DATABASE);
console.log('   User:', process.env.DB_USER);

// Database configuration
const config = {
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_DATABASE || 'parvaneh',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'YourStrong!Passw0rd',
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_CERT !== 'false',
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

// Only set port if explicitly defined (don't use default for named instances)
if (process.env.DB_PORT) {
  config.port = Number(process.env.DB_PORT);
}

async function runMigration() {
  let pool;
  try {
    console.log('🔌 Connecting to database...');
    pool = await sql.connect(config);
    console.log('✅ Connected successfully\n');

    // Read the SQL file
    const sqlFilePath = path.join(__dirname, 'add_location_verification_expert_role.sql');
    const sqlScript = fs.readFileSync(sqlFilePath, 'utf8');

    console.log('📋 Running migration script to add کارشناس تایید محل role...\n');
    
    // Execute the script
    const result = await pool.request().query(sqlScript);
    
    console.log('\n✅ Migration completed successfully!');
    
    // Show the messages from SQL Server
    if (result.recordsets && result.recordsets.length > 0) {
      console.log('\nDatabase results:');
      result.recordsets.forEach((recordset, index) => {
        if (recordset.length > 0) {
          console.log(`\nRecordset ${index + 1}:`);
          console.table(recordset);
        }
      });
    }

    console.log('\n🎉 Role and permissions added successfully!');
    console.log('📝 Next steps:');
    console.log('   1. Assign the role to a user in the Users table or via UserRoles');
    console.log('   2. The role should now appear in the role dropdown for users with multiple roles');
    console.log('   3. Users with this role can now access workflow requests');
    
  } catch (err) {
    console.error('❌ Error running migration:', err.message);
    if (err.precedingErrors) {
      err.precedingErrors.forEach((e, i) => {
        console.error(`  Preceding error ${i + 1}:`, e.message);
      });
    }
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
      console.log('\n🔌 Database connection closed');
    }
  }
}

runMigration();
