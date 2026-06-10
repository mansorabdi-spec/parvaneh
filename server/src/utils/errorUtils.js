import { DB_ERROR_MESSAGE, handleDbError } from '../lib/db.js';

/**
 * Standardized error response helper
 * Use this in try-catch blocks to ensure consistent error messages
 */
export function sendDbError(res, error) {
  console.error('Database error:', error);
  return res.status(503).json({ 
    success: false, 
    message: DB_ERROR_MESSAGE 
  });
}

/**
 * Check if error is a database connection error
 */
export function isDbConnectionError(error) {
  return (
    error.isDbConnectionError ||
    error.message === DB_ERROR_MESSAGE ||
    error.code === 'ECONNREFUSED' ||
    error.code === 'ETIMEOUT' ||
    error.code === 'ESOCKET' ||
    error.code === 'ENOTFOUND' ||
    error.code === 'ELOGIN' ||
    error.originalError?.code === 'ECONNREFUSED' ||
    error.originalError?.code === 'ETIMEOUT' ||
    error.originalError?.code === 'ESOCKET' ||
    error.name === 'ConnectionError' ||
    error.name === 'RequestError'
  );
}

export { DB_ERROR_MESSAGE, handleDbError };
