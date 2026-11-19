import { DB_ERROR_MESSAGE, cleanupStaleConnections } from '../lib/db.js';

// Track cleanup attempts to prevent race conditions
let cleanupInProgress = false;

/**
 * Middleware to catch and handle database errors consistently across all routes
 * This should be used as the last error handler in the middleware chain
 * Automatically cleans up stale connections when EINVALIDSTATE error occurs
 */
export async function dbErrorHandler(err, req, res, next) {
  console.error('Error caught by dbErrorHandler:', err);
  
  // Automatically cleanup stale connections on EINVALIDSTATE error
  if ((err.code === 'EINVALIDSTATE' || err.originalError?.code === 'EINVALIDSTATE') && !cleanupInProgress) {
    cleanupInProgress = true;
    try {
      console.log('[dbErrorHandler] Auto-cleaning stale connections due to EINVALIDSTATE error...');
      await cleanupStaleConnections();
      console.log('[dbErrorHandler] Stale connections cleaned up successfully');
    } catch (cleanupError) {
      console.error('[dbErrorHandler] Error during cleanup:', cleanupError.message);
    } finally {
      // Reset flag after a delay
      setTimeout(() => {
        cleanupInProgress = false;
      }, 5000);
    }
  }

  // Check if it's our custom database connection error
  if (err.isDbConnectionError || err.message === DB_ERROR_MESSAGE) {
    return res.status(503).json({ 
      success: false, 
      message: DB_ERROR_MESSAGE 
    });
  }

  // Check for common SQL connection errors
  if (err.code === 'ECONNREFUSED' || 
      err.code === 'ETIMEOUT' || 
      err.code === 'ESOCKET' ||
      err.code === 'ENOTFOUND' ||
      err.code === 'ELOGIN' ||
      err.originalError?.code === 'ECONNREFUSED' ||
      err.originalError?.code === 'ETIMEOUT' ||
      err.originalError?.code === 'ESOCKET' ||
      err.name === 'ConnectionError') {
    return res.status(503).json({ 
      success: false, 
      message: DB_ERROR_MESSAGE 
    });
  }

  // SQL constraint error (e.g., FK) should not be shown as DB disconnected
  if (err.name === 'RequestError' && (err.number === 547 || err.originalError?.number === 547)) {
    return res.status(409).json({
      success: false,
      message: 'امکان حذف پرونده وجود ندارد چون داده‌های وابسته به آن در سیستم ثبت شده است.'
    });
  }

  // If it's already been handled, pass it on
  if (res.headersSent) {
    return next(err);
  }

  // For any other unhandled errors, return generic message
  return res.status(500).json({ 
    success: false, 
    message: 'خطای داخلی سرور'
  });
}

/**
 * Async handler wrapper to catch errors in async route handlers
 * Usage: router.get('/path', asyncHandler(async (req, res) => { ... }))
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
