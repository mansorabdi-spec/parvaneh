# Database Connection Pool Fix - حل مشکل اتصال به دیتابیس

## مشکل (Problem)

برنامه چندین بار در روز خطای زیر را نمایش می‌داد:
```
بنا به مشکلی که در سرور بوجود آمده امکان دسترسی به دیتابیس وجود ندارد ، لطفا چند ثانیه بعد امتحان فرمایید اگر تا 5 دقیقه مشکل حل نشد با پشتیبانی تماس بگیرید . از بابت مشکل بوجود آمده عذرخواهی می نماییم
```

## علت اصلی (Root Cause)

1. **Connection Pool Exhaustion** - تمام شدن کانکشن‌های موجود در Pool
   - تعداد کانکشن‌های Pool: فقط 10 عدد
   - تعداد درخواست‌های همزمان: بیش از 371 مورد در 27 فایل
   - عدم آزادسازی کانکشن‌ها پس از استفاده
   - Idle Timeout کوتاه: 30 ثانیه

2. **عدم مدیریت خطا و بازیابی خودکار**
   - عدم وجود Health Check
   - عدم وجود Auto-Recovery
   - عدم Graceful Shutdown

## راه‌حل پیاده‌سازی شده (Implemented Solution)

### 1. افزایش ظرفیت Connection Pool

**قبل:**
```javascript
pool: {
  max: 10,
  min: 0,
  idleTimeoutMillis: 30000,
}
connectionTimeout: 30000,
requestTimeout: 30000,
```

**بعد:**
```javascript
pool: {
  max: 50,                          // 5x افزایش
  min: 5,                           // حداقل کانکشن همیشه فعال
  idleTimeoutMillis: 300000,        // 5 دقیقه (10x افزایش)
  acquireTimeoutMillis: 60000,      // 60 ثانیه برای گرفتن کانکشن
}
connectionTimeout: 60000,           // 2x افزایش
requestTimeout: 120000,             // 4x افزایش (برای گزارش‌های سنگین)
```

### 2. سیستم Health Check خودکار

```javascript
// بررسی سلامت هر 60 ثانیه
setInterval(async () => {
  const result = await pool.request().query('SELECT 1 AS HealthCheck');
  if (result) {
    lastHealthCheck = new Date();
    consecutiveFailures = 0;
  }
}, 60000);
```

### 3. Auto-Recovery پس از خطا

```javascript
pool.on('error', (err) => {
  console.error('Database pool error:', err);
  consecutiveFailures++;
  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    resetPool(); // بازنشانی خودکار Pool
  }
});
```

### 4. Graceful Shutdown

```javascript
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown(signal) {
  server.close();      // بستن HTTP Server
  await closePool();   // بستن صحیح Database Pool
  process.exit(0);
}
```

### 5. بهبود Health Endpoint

```
GET /health
```

**پاسخ موفق:**
```json
{
  "status": "ok",
  "database": "connected",
  "poolStats": {
    "lastHealthCheck": "2024-12-19T09:00:00.000Z",
    "consecutiveFailures": 0,
    "isHealthy": true,
    "poolExists": true
  }
}
```

## فایل‌های تغییر یافته (Modified Files)

1. **server/src/lib/db.js**
   - افزایش Pool Size و Timeouts
   - اضافه شدن Health Check
   - اضافه شدن Auto-Recovery
   - توابع جدید: `resetPool()`, `closePool()`, `getPoolStats()`, `executeQuery()`

2. **server/src/index.js**
   - اضافه شدن Graceful Shutdown
   - بهبود Health Endpoint
   - نمایش آمار Pool در Health Check

## توابع جدید (New Functions)

### `resetPool()`
بازنشانی کامل Connection Pool در صورت بروز خطاهای متوالی

### `closePool()`
بستن صحیح Pool هنگام خاموش شدن سرور

### `getPoolStats()`
دریافت آمار و وضعیت Pool

### `executeQuery(queryFn)`
اجرای Query با مدیریت خودکار کانکشن (برای استفاده در آینده)

## نحوه استفاده (Usage)

### استفاده عادی (همان روش قبلی)
```javascript
import { getPool } from '../lib/db.js';

export async function myController(req, res, next) {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM Table WHERE Id = @id');
    res.json(result.recordset);
  } catch (error) {
    next(error); // خطا به middleware ارسال می‌شود
  }
}
```

### استفاده با executeQuery (روش پیشنهادی برای آینده)
```javascript
import { executeQuery, sql } from '../lib/db.js';

export async function myController(req, res, next) {
  try {
    const result = await executeQuery(async (request) => {
      return await request
        .input('id', sql.Int, id)
        .query('SELECT * FROM Table WHERE Id = @id');
    });
    res.json(result.recordset);
  } catch (error) {
    next(error);
  }
}
```

## مانیتورینگ (Monitoring)

### بررسی وضعیت Pool
```bash
curl http://localhost:4000/health
```

### لاگ‌های مهم
```
✓ Database connection pool created successfully
✓ Database health check: OK
⚠ Database health check failed: [error message]
⚠ Max consecutive failures reached, resetting pool...
✓ Database connection pool reset complete
```

## نتایج مورد انتظار (Expected Results)

1. ✅ کاهش چشمگیر خطاهای اتصال به دیتابیس
2. ✅ بازیابی خودکار پس از قطع موقت ارتباط
3. ✅ پشتیبانی از تعداد بیشتر کاربران همزمان (5x افزایش)
4. ✅ مدیریت بهتر منابع سرور
5. ✅ خاموش شدن صحیح سرور بدون از دست رفتن داده

## توصیه‌های بعدی (Future Recommendations)

1. **مانیتورینگ حرفه‌ای:**
   - نصب Prometheus + Grafana
   - ثبت metrics برای Pool Usage
   - Alert برای Connection Failures

2. **بهینه‌سازی Query‌ها:**
   - استفاده از Index‌های مناسب
   - کاهش زمان اجرای Query‌های سنگین
   - استفاده از Caching برای داده‌های ثابت

3. **Load Balancing:**
   - استفاده از چند Database Server
   - Read Replicas برای Query‌های خواندنی

4. **Connection Pooling پیشرفته:**
   - استفاده از Connection Pooler خارجی (مثل PgBouncer برای PostgreSQL)
   - تنظیم دقیق‌تر Pool Parameters بر اساس Load واقعی

## تاریخچه تغییرات (Change History)

- **2024-12-19:** پیاده‌سازی اولیه - حل مشکل Connection Pool Exhaustion
