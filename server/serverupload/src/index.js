import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import { getPool, DB_ERROR_MESSAGE, closePool, getPoolStats, cleanupStaleConnections, getPoolWithRetry } from './lib/db.js';
import apiRouter from './routes/index.js';
import { ensureRenewalWindowLookup } from './controllers/lookups.controller.js';
import { ensureComprehensiveReportPage } from './lib/comprehensiveReport.js';
import { ensureApplicantLicensePages } from './lib/ensureApplicantLicensePages.js';
import { ensureSiteSettingsPage } from './lib/ensureSiteSettingsPage.js';
import { renameDeputyAdminRole } from './lib/renameSuperadminRole.js';
import { dbErrorHandler } from './middleware/dbErrorHandler.js';

if (process.env.NODE_ENV === 'production') {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
} else {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

const app = express();
const port = process.env.PORT || 4000;

// CORS configuration - use environment variable for allowed origins
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '20mb' }));
// Parse application/x-www-form-urlencoded (needed for payment gateway POST callbacks)
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Serve uploads statically
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/uploads', express.static(path.resolve(__dirname, '../../uploads')));

// Static uploads
const uploadsDir = path.join(__dirname, '..', 'uploads');
try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch {}
app.use('/uploads', express.static(uploadsDir));

// Serve public folder statically
app.use(express.static(path.resolve(__dirname, '../../public')));

app.get('/health', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1 as ok');
    const stats = getPoolStats();
    res.json({ 
      status: 'ok',
      database: 'connected',
      poolStats: stats
    });
  } catch (err) {
    const stats = getPoolStats();
    res.status(503).json({ 
      status: 'error', 
      database: 'disconnected',
      message: DB_ERROR_MESSAGE,
      poolStats: stats
    });
  }
});

// Admin endpoint to cleanup stale connections (called automatically when errors occur)
app.post('/api/admin/cleanup-pool', async (req, res) => {
  try {
    await cleanupStaleConnections();
    res.json({ 
      success: true, 
      message: 'Connection pool cleaned up successfully' 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: err.message || 'Failed to cleanup pool' 
    });
  }
});

app.use('/api', apiRouter);

// Database error handler middleware - must be after all routes
app.use(dbErrorHandler);

const server = app.listen(port, async () => {
  server.requestTimeout = 360000;
  server.headersTimeout = 370000;
  server.timeout = 0;
  try {
    await getPool();
    try {
      await ensureRenewalWindowLookup();
    } catch (seedError) {
      console.error('✗ Failed to ensure renewal window lookup:', seedError.message);
    }
    try {
      const pool = await getPool();
      await renameDeputyAdminRole(pool);
    } catch (renameError) {
      console.error('✗ Failed to rename deputy admin role:', renameError.message);
    }
    try {
      const pool = await getPool();
      await ensureComprehensiveReportPage(pool);
    } catch (pageError) {
      console.error('✗ Failed to ensure comprehensive report page:', pageError.message);
    }
    try {
      const pool = await getPool();
      await ensureApplicantLicensePages(pool);
    } catch (licensePageError) {
      console.error('✗ Failed to ensure applicant renew/change pages:', licensePageError.message);
    }
    try {
      const pool = await getPool();
      await ensureSiteSettingsPage(pool);
    } catch (siteSettingsPageError) {
      console.error('✗ Failed to ensure site settings page:', siteSettingsPageError.message);
    }
    const env = process.env.NODE_ENV || 'development';
    console.log(`✓ Server is running on port ${port}`);
    console.log(`✓ Environment: ${env}`);
    console.log(`✓ Database connected successfully`);
    if (env === 'development') {
      console.log(`✓ Local URL: http://localhost:${port}`);
    }
  } catch (e) {
    console.error('✗ Failed to connect to SQL Server. Check your .env configuration.');
    console.error('Error:', e.message);
  }
});

// Graceful shutdown
async function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  // Stop accepting new connections
  server.close(async () => {
    console.log('HTTP server closed');
    
    // Close database pool
    await closePool();
    
    console.log('Graceful shutdown completed');
    process.exit(0);
  });
  
  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
