import sql from 'mssql';

let poolPromise;
let poolHealthCheckInterval;
let lastHealthCheck = null;
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 3;

// Track active connections for debugging
const activeConnections = new Set();
let poolClosed = false;

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
      idleTimeoutMillis: 300000, // 5 minutes
      acquireTimeoutMillis: 30000, // 30 seconds to acquire connection from pool
      createTimeoutMillis: 30000, // 30 seconds to create a new connection
    },
    connectionTimeout: 30000, // 30 seconds for initial connection
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
      
      // Check pool stats to detect connection leaks
      const stats = pool.request().connectionPool?.stats;
      if (stats) {
        console.log(`[Pool Stats] Active: ${stats.activeConnections}, Idle: ${stats.idleConnections}, Pending: ${stats.pendingRequests}`);
      }
      
      const result = await pool.request().query('SELECT 1 AS HealthCheck');
      
      if (result && result.recordset && result.recordset.length > 0) {
        lastHealthCheck = new Date();
        consecutiveFailures = 0;
      }
    } catch (error) {
      console.error('Database health check failed:', error.message);
      consecutiveFailures++;
      
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.error('Health check failed multiple times, resetting pool...');
        resetPool();
      }
    }
  }, 30000); // Check every 30 seconds
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
  poolClosed = true;
  
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

// Force cleanup stale connections in the pool
export async function cleanupStaleConnections() {
  if (!poolPromise || poolClosed) return;
  
  try {
    const pool = await poolPromise;
    
    // Check if pool is in a valid state before attempting cleanup
    if (pool && !pool.closed) {
      // Close and recreate the pool to clear stale connections
      console.log('[Pool] Cleaning up stale connections...');
      
      try {
        await pool.close();
      } catch (e) {
        console.error('[Pool] Error during cleanup close:', e.message);
      }
      
      poolPromise = null;
      
      // Recreate the pool
      try {
        poolPromise = sql.connect(getConfig());
        const newPool = await poolPromise;
        console.log('[Pool] Stale connections cleaned up, new pool created');
        startHealthCheck();
      } catch (e) {
        console.error('[Pool] Error recreating pool after cleanup:', e.message);
        poolPromise = null;
        throw e;
      }
    }
  } catch (error) {
    console.error('[Pool] Error in cleanupStaleConnections:', error.message);
    throw error;
  }
}

// Get pool with automatic retry and stale connection handling
export async function getPoolWithRetry(maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await getPool();
    } catch (error) {
      if (error.code === 'EINVALIDSTATE' || error.code === 'ECONNCLOSED') {
        console.warn(`[Pool] Connection error (attempt ${i + 1}/${maxRetries}): ${error.message}`);
        
        if (i < maxRetries - 1) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
          
          try {
            await cleanupStaleConnections();
          } catch (cleanupError) {
            console.error('[Pool] Failed to cleanup stale connections:', cleanupError.message);
          }
        }
      } else {
        throw error;
      }
    }
  }
  throw new Error('Failed to get pool connection after retries');
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
