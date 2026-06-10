import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import { getPool, DB_ERROR_MESSAGE, closePool, getPoolStats } from './lib/db.js';
import apiRouter from './routes/index.js';
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

app.use('/api', apiRouter);

// Database error handler middleware - must be after all routes
app.use(dbErrorHandler);

const server = app.listen(port, async () => {
  try {
    await getPool();
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
