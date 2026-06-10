import sql from 'mssql';

let poolPromise;
let poolHealthCheckInterval;
let lastHealthCheck = null;
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 3;

// Standardized database error message in Persian
export const DB_ERROR_MESSAGE = 'بنا به مشکلی که در سرور بوجود آمده امکان دسترسی به دیتابیس وجود ندارد ، لطفا چند ثانیه بعد امتحان فرمایید اگر تا 5 دقیقه مشکل حل نشد با پشتیبانی تماس بگیرید . از بابت مشکل بوجود آمده عذرخواهی می نماییم';

export function getConfig() {
  const rawServer = process.env.DB_SERVER || 'localhost';
  const explicitInstance = process.env.DB_INSTANCE; // optional
  let server = rawServer;
  let instanceName = undefined;

  // If DB_INSTANCE provided, use it. Else try parse from DB_SERVER like HOST\\INSTANCE
  if (explicitInstance && explicitInstance.trim()) {
    instanceName = explicitInstance.trim();
  } else if (rawServer.includes('\\')) {
    const [host, inst] = rawServer.split('\\');
    server = host;
    instanceName = inst;
  }

  const config = {
    server,
    database: process.env.DB_DATABASE || 'LicenseDB',
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'YourStrong!Passw0rd',
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
      enableArithAbort: true,
    },
    pool: {
      max: 50, // Increased from 10 to handle more concurrent requests
      min: 5, // Keep minimum connections alive
      idleTimeoutMillis: 300000, // 5 minutes (increased from 30 seconds)
      acquireTimeoutMillis: 60000, // 60 seconds to acquire connection from pool
    },
    connectionTimeout: 60000, // 60 seconds for initial connection
    requestTimeout: 120000, // 120 seconds for queries (some reports may take longer)
  };

  if (instanceName) {
    config.options.instanceName = instanceName;
    // For named instances, usually dynamic ports are used. Avoid setting port unless you know it.
  } else {
    // Default instance path uses a specific port
    const port = Number(process.env.DB_PORT || 1433);
    config.port = port;
  }

  return config;
}

export async function getPool() {
  try {
    if (!poolPromise) {
      console.log('Creating new database connection pool...');
      poolPromise = sql.connect(getConfig());
      
      // Setup pool event listeners
      const pool = await poolPromise;
      
      pool.on('error', (err) => {
        console.error('Database pool error:', err);
        consecutiveFailures++;
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          console.error('Max consecutive failures reached, resetting pool...');
          resetPool();
        }
      });
      
      // Start health check monitoring
      startHealthCheck();
      
      console.log('Database connection pool created successfully');
    }
    
    const pool = await poolPromise;
    consecutiveFailures = 0; // Reset on successful connection
    return pool;
  } catch (error) {
    // Reset poolPromise so next attempt will try to reconnect
    poolPromise = null;
    consecutiveFailures++;
    console.error('Database connection error:', error);
    
    // Create a custom error with the Persian message
    const dbError = new Error(DB_ERROR_MESSAGE);
    dbError.isDbConnectionError = true;
    dbError.originalError = error;
    throw dbError;
  }
}

// Helper function to handle database errors in controllers
export function handleDbError(error, res) {
  console.error('Database error:', error);
  
  // Check if it's our custom database connection error
  if (error.isDbConnectionError || error.message === DB_ERROR_MESSAGE) {
    return res.status(503).json({ 
      success: false, 
      message: DB_ERROR_MESSAGE 
    });
  }
  
  // Check for common SQL connection errors
  if (error.code === 'ECONNREFUSED' || 
      error.code === 'ETIMEOUT' || 
      error.code === 'ESOCKET' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ELOGIN' ||
      error.originalError?.code === 'ECONNREFUSED' ||
      error.originalError?.code === 'ETIMEOUT' ||
      error.originalError?.code === 'ESOCKET') {
    return res.status(503).json({ 
      success: false, 
      message: DB_ERROR_MESSAGE 
    });
  }
  
  // For other database errors, still return the same message to users
  // but log the actual error for debugging
  return res.status(500).json({ 
    success: false, 
    message: DB_ERROR_MESSAGE 
  });
}

// Reset the connection pool
export function resetPool() {
  console.log('Resetting database connection pool...');
  
  if (poolHealthCheckInterval) {
    clearInterval(poolHealthCheckInterval);
    poolHealthCheckInterval = null;
  }
  
  if (poolPromise) {
    poolPromise.then(pool => {
      if (pool && pool.close) {
        pool.close().catch(err => console.error('Error closing pool:', err));
      }
    }).catch(() => {});
    poolPromise = null;
  }
  
  consecutiveFailures = 0;
  lastHealthCheck = null;
  console.log('Database connection pool reset complete');
}

// Start periodic health checks
function startHealthCheck() {
  if (poolHealthCheckInterval) {
    return; // Already running
  }
  
  poolHealthCheckInterval = setInterval(async () => {
    try {
      if (!poolPromise) return;
      
      const pool = await poolPromise;
      const result = await pool.request().query('SELECT 1 AS HealthCheck');
      
      if (result && result.recordset && result.recordset.length > 0) {
        lastHealthCheck = new Date();
        consecutiveFailures = 0;
        // console.log('Database health check: OK');
      }
    } catch (error) {
      console.error('Database health check failed:', error.message);
      consecutiveFailures++;
      
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.error('Health check failed multiple times, resetting pool...');
        resetPool();
      }
    }
  }, 60000); // Check every 60 seconds
}

// Get pool statistics
export function getPoolStats() {
  return {
    lastHealthCheck,
    consecutiveFailures,
    isHealthy: consecutiveFailures < MAX_CONSECUTIVE_FAILURES,
    poolExists: !!poolPromise
  };
}

// Graceful shutdown
export async function closePool() {
  console.log('Closing database connection pool...');
  
  if (poolHealthCheckInterval) {
    clearInterval(poolHealthCheckInterval);
    poolHealthCheckInterval = null;
  }
  
  if (poolPromise) {
    try {
      const pool = await poolPromise;
      await pool.close();
      console.log('Database connection pool closed successfully');
    } catch (error) {
      console.error('Error closing pool:', error);
    }
    poolPromise = null;
  }
}

// Helper function to execute queries with automatic connection cleanup
export async function executeQuery(queryFn) {
  const pool = await getPool();
  const request = pool.request();
  
  try {
    return await queryFn(request, pool);
  } finally {
    // Request objects don't need explicit cleanup in mssql
    // The pool handles connection lifecycle
  }
}

export { sql };
