# Database Error Handling Documentation

## Overview
This document describes the centralized database error handling system implemented across the entire project. When any database connection error occurs, users will see a consistent Persian error message.

## Error Message
```
بنا به مشکلی که در سرور بوجود آمده امکان دسترسی به دیتابیس وجود ندارد ، لطفا چند ثانیه بعد امتحان فرمایید اگر تا 5 دقیقه مشکل حل نشد با پشتیبانی تماس بگیرید . از بابت مشکل بوجود آمده عذرخواهی می نماییم
```

Translation: "Due to a problem that occurred on the server, access to the database is not available. Please try again in a few seconds. If the problem is not resolved within 5 minutes, contact support. We apologize for the problem."

## Implementation Components

### 1. Database Connection Module (`server/src/lib/db.js`)

**Key Features:**
- Exports `DB_ERROR_MESSAGE` constant with the standardized Persian error message
- Enhanced `getPool()` function with try-catch error handling
- Automatic pool reset on connection failure for retry capability
- `handleDbError()` helper function for manual error handling in controllers

**Usage in Controllers:**
```javascript
import { getPool, sql, handleDbError } from '../lib/db.js';

export async function myController(req, res) {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT * FROM MyTable');
    res.json({ data: result.recordset });
  } catch (error) {
    // Option 1: Use handleDbError helper
    return handleDbError(error, res);
    
    // Option 2: Pass to next middleware (recommended)
    // next(error);
  }
}
```

### 2. Error Handler Middleware (`server/src/middleware/dbErrorHandler.js`)

**Key Features:**
- Centralized error handling for all routes
- Automatically detects database connection errors
- Returns consistent error message with HTTP 503 status
- Includes `asyncHandler` wrapper for cleaner async route handling

**Detected Error Types:**
- Custom database connection errors (isDbConnectionError flag)
- ECONNREFUSED - Connection refused
- ETIMEOUT - Connection timeout
- ESOCKET - Socket errors
- ENOTFOUND - Server not found
- ELOGIN - Authentication errors
- ConnectionError - MSSQL connection errors
- RequestError - MSSQL request errors

**Usage:**
The middleware is automatically applied to all routes in `server/src/index.js`. No additional configuration needed in individual routes.

**Optional: Using asyncHandler wrapper:**
```javascript
import { asyncHandler } from '../middleware/dbErrorHandler.js';

router.get('/my-route', asyncHandler(async (req, res) => {
  const pool = await getPool();
  const result = await pool.request().query('SELECT * FROM MyTable');
  res.json({ data: result.recordset });
  // No try-catch needed - asyncHandler will catch and pass to middleware
}));
```

### 3. Error Utilities (`server/src/utils/errorUtils.js`)

**Exported Functions:**

- **`sendDbError(res, error)`** - Send standardized database error response
- **`isDbConnectionError(error)`** - Check if error is a database connection error
- **`DB_ERROR_MESSAGE`** - The standardized error message constant
- **`handleDbError(error, res)`** - Re-exported from db.js for convenience

**Usage:**
```javascript
import { sendDbError, isDbConnectionError } from '../utils/errorUtils.js';

export async function myController(req, res) {
  try {
    const pool = await getPool();
    // ... database operations
  } catch (error) {
    if (isDbConnectionError(error)) {
      return sendDbError(res, error);
    }
    // Handle other errors
    res.status(500).json({ message: 'Other error' });
  }
}
```

### 4. Server Configuration (`server/src/index.js`)

**Changes Made:**
- Imported `dbErrorHandler` middleware
- Applied middleware after all routes: `app.use(dbErrorHandler)`
- Updated `/health` endpoint to use `DB_ERROR_MESSAGE`
- Database connection errors during startup are logged to console

## Best Practices for Controllers

### Recommended Pattern (Using next middleware):
```javascript
import { getPool, sql } from '../lib/db.js';

export async function myController(req, res, next) {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT * FROM MyTable WHERE Id=@id');
    
    res.json({ success: true, data: result.recordset });
  } catch (error) {
    // Pass error to middleware - it will handle DB errors automatically
    next(error);
  }
}
```

### Alternative Pattern (Manual handling):
```javascript
import { getPool, sql, handleDbError } from '../lib/db.js';

export async function myController(req, res) {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT * FROM MyTable WHERE Id=@id');
    
    res.json({ success: true, data: result.recordset });
  } catch (error) {
    return handleDbError(error, res);
  }
}
```

### Using asyncHandler wrapper:
```javascript
import { getPool, sql } from '../lib/db.js';
import { asyncHandler } from '../middleware/dbErrorHandler.js';

export const myController = asyncHandler(async (req, res) => {
  const pool = await getPool();
  const result = await pool.request()
    .input('id', sql.Int, req.params.id)
    .query('SELECT * FROM MyTable WHERE Id=@id');
  
  res.json({ success: true, data: result.recordset });
  // No try-catch needed!
});
```

## Error Response Format

All database connection errors return:
```json
{
  "success": false,
  "message": "بنا به مشکلی که در سرور بوجود آمده امکان دسترسی به دیتابیس وجود ندارد ، لطفا چند ثانیه بعد امتحان فرمایید اگر تا 5 دقیقه مشکل حل نشد با پشتیبانی تماس بگیرید . از بابت مشکل بوجود آمده عذرخواهی می نماییم"
}
```

HTTP Status Code: **503 Service Unavailable**

## Frontend Handling

Frontend components should check for this error message and display it to users:

```javascript
try {
  const response = await fetch('/api/some-endpoint');
  const data = await response.json();
  
  if (!response.ok) {
    // Display error message to user
    alert(data.message);
  }
} catch (error) {
  console.error('Request failed:', error);
}
```

## Testing Database Connection Errors

To test the error handling:

1. **Stop SQL Server** or change database credentials in `.env`
2. **Make any API request** - you should see the Persian error message
3. **Check server logs** - detailed error information is logged for debugging
4. **Restart SQL Server** - the connection pool will automatically reconnect on next request

## Migration Guide for Existing Controllers

Most controllers already use the `next(error)` pattern, which means they're already compatible with the new error handling system. No changes needed!

For controllers that don't use `next(error)`:

**Before:**
```javascript
export async function myController(req, res) {
  try {
    const pool = await getPool();
    // ... operations
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}
```

**After (Option 1 - Recommended):**
```javascript
export async function myController(req, res, next) {
  try {
    const pool = await getPool();
    // ... operations
  } catch (error) {
    next(error); // Let middleware handle it
  }
}
```

**After (Option 2):**
```javascript
import { handleDbError } from '../lib/db.js';

export async function myController(req, res) {
  try {
    const pool = await getPool();
    // ... operations
  } catch (error) {
    return handleDbError(error, res);
  }
}
```

## Logging

All database errors are logged to the console with full details for debugging:
- Error message
- Error code
- Stack trace
- Original error (if wrapped)

This helps administrators diagnose connection issues while users see a friendly message.

## Connection Pool Behavior

- On connection failure, the pool promise is reset to `null`
- Next request will attempt to reconnect automatically
- No manual intervention needed for transient connection issues
- Persistent connection issues will show the error message on every request

## Summary

✅ **Centralized** - One error message defined in one place  
✅ **Consistent** - Same message across all endpoints  
✅ **User-friendly** - Clear Persian message with instructions  
✅ **Developer-friendly** - Detailed logging for debugging  
✅ **Automatic** - Works with existing controller patterns  
✅ **Resilient** - Automatic reconnection attempts  

## Files Modified/Created

1. `server/src/lib/db.js` - Enhanced with error handling
2. `server/src/middleware/dbErrorHandler.js` - New middleware
3. `server/src/utils/errorUtils.js` - New utility functions
4. `server/src/index.js` - Applied middleware
5. `docs/DATABASE_ERROR_HANDLING.md` - This documentation
