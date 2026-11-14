# راهنمای استقرار پروژه (Deployment Guide)

این راهنما به شما کمک می‌کند تا پروژه را در محیط‌های مختلف (لوکال و پروداکشن) راه‌اندازی کنید.

## فهرست مطالب
1. [تنظیمات محیط لوکال](#local-setup)
2. [تنظیمات محیط پروداکشن](#production-setup)
3. [استقرار Backend](#backend-deployment)
4. [استقرار Frontend](#frontend-deployment)
5. [نکات امنیتی](#security-notes)

---

## 🏠 تنظیمات محیط لوکال (Local Setup) {#local-setup}

### Backend (Server)

1. **کپی کردن فایل تنظیمات:**
   ```bash
   cd server
   copy .env.local .env
   ```

2. **ویرایش فایل `.env`:**
   - اطلاعات دیتابیس SQL Server خود را وارد کنید
   - `DB_SERVER`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD` را تنظیم کنید

3. **نصب وابستگی‌ها و اجرا:**
   ```bash
   npm install
   npm run dev
   ```

### Frontend (Client)

1. **کپی کردن فایل تنظیمات:**
   ```bash
   cd client
   copy .env.local .env
   ```

2. **فایل `.env` باید حاوی این تنظیمات باشد:**
   ```
   VITE_API_BASE_URL=http://localhost:4000
   ```

3. **نصب وابستگی‌ها و اجرا:**
   ```bash
   npm install
   npm run dev
   ```

---

## 🚀 تنظیمات محیط پروداکشن (Production Setup) {#production-setup}

### مرحله 1: آماده‌سازی Backend

1. **کپی کردن فایل تنظیمات پروداکشن:**
   ```bash
   cd server
   copy .env.production .env
   ```

2. **ویرایش فایل `.env` برای پروداکشن:**
   ```env
   PORT=4001
   NODE_ENV=production
   
   # اطلاعات دیتابیس پروداکشن
   DB_SERVER=your-production-db-server.com
   DB_DATABASE=parvaneh
   DB_USER=your_production_user
   DB_PASSWORD=your_strong_production_password
   DB_PORT=1433
   DB_ENCRYPT=true
   DB_TRUST_CERT=false
   
   # JWT Secret - حتماً یک کلید قوی تولید کنید!
   JWT_SECRET=YOUR_GENERATED_STRONG_SECRET_HERE
   JWT_EXPIRES_IN=7d
   
   # دامنه فرانت‌اند پروداکشن
   CORS_ORIGIN=https://your-domain.com
   
   UPLOAD_DIR=./uploads
   ```

3. **تولید JWT Secret قوی:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
   خروجی را در `JWT_SECRET` قرار دهید.

### مرحله 2: آماده‌سازی Frontend

1. **کپی کردن فایل تنظیمات پروداکشن:**
   ```bash
   cd client
   copy .env.production .env.production
   ```

2. **ویرایش فایل `.env.production`:**
   ```env
   # آدرس API پروداکشن (بدون / در انتها)
   VITE_API_BASE_URL=https://api.your-domain.com
   
   # یا اگر API و Frontend روی یک دامنه هستند:
   VITE_API_BASE_URL=https://your-domain.com
   
   VITE_PAYMENT_GATEWAY_URL=https://pay.tabriz.ir
   ```

---

## 🔧 استقرار Backend {#backend-deployment}

### روش 1: استقرار مستقیم روی سرور

1. **آپلود فایل‌ها به سرور:**
   - تمام فایل‌های پوشه `server` را به سرور آپلود کنید
   - **مهم:** فایل `.env` را جداگانه ایجاد کنید (آپلود نکنید!)

2. **روی سرور:**
   ```bash
   cd /path/to/server
   npm install --production
   ```

3. **ایجاد فایل `.env` روی سرور:**
   - فایل `.env` را با تنظیمات پروداکشن ایجاد کنید
   - از `.env.production` به عنوان الگو استفاده کنید

4. **اجرای برنامه:**
   
   **با PM2 (توصیه می‌شود):**
   ```bash
   npm install -g pm2
   pm2 start src/index.js --name parvaneh-api
   pm2 save
   pm2 startup
   ```

   **یا با Node مستقیم:**
   ```bash
   node src/index.js
   ```

### روش 2: استفاده از Docker (اختیاری)

اگر از Docker استفاده می‌کنید، می‌توانید یک `Dockerfile` ایجاد کنید.

---

## 🎨 استقرار Frontend {#frontend-deployment}

### مرحله 1: Build کردن پروژه

1. **اطمینان از وجود فایل `.env.production`:**
   ```bash
   cd client
   # بررسی محتوای فایل
   type .env.production
   ```

2. **Build کردن:**
   ```bash
   npm run build
   ```
   
   این دستور یک پوشه `dist` ایجاد می‌کند که شامل فایل‌های آماده استقرار است.

### مرحله 2: آپلود به هاست

**برای هاست‌های معمولی (Apache/Nginx):**

1. محتویات پوشه `dist` را به روت وب‌سایت آپلود کنید
2. اطمینان حاصل کنید که سرور وب برای SPA تنظیم شده است

**تنظیمات Nginx:**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**تنظیمات Apache (.htaccess):**
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

---

## 🔒 نکات امنیتی {#security-notes}

### ⚠️ مهم - قبل از استقرار حتماً بخوانید!

1. **هرگز فایل‌های `.env` را در Git قرار ندهید:**
   - فایل `.gitignore` این کار را انجام می‌دهد
   - همیشه قبل از commit بررسی کنید

2. **JWT Secret قوی:**
   - از دستور زیر برای تولید استفاده کنید:
     ```bash
     node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
     ```
   - هرگز از مقدار پیش‌فرض استفاده نکنید

3. **رمز عبور دیتابیس:**
   - از رمز عبور قوی استفاده کنید
   - رمز عبور لوکال و پروداکشن باید متفاوت باشد

4. **CORS:**
   - در پروداکشن، `CORS_ORIGIN` را به دامنه دقیق خود محدود کنید
   - از `*` در پروداکشن استفاده نکنید

5. **HTTPS:**
   - حتماً از SSL/TLS برای پروداکشن استفاده کنید
   - می‌توانید از Let's Encrypt استفاده کنید (رایگان)

6. **دیتابیس:**
   - در پروداکشن `DB_ENCRYPT=true` قرار دهید
   - از کاربر دیتابیس با دسترسی محدود استفاده کنید

---

## 📋 چک‌لیست استقرار

### Backend:
- [ ] فایل `.env` با تنظیمات صحیح ایجاد شده
- [ ] JWT_SECRET قوی تولید شده
- [ ] اطلاعات دیتابیس پروداکشن صحیح است
- [ ] CORS_ORIGIN به دامنه فرانت‌اند تنظیم شده
- [ ] پوشه `uploads` ایجاد شده و دسترسی نوشتن دارد
- [ ] دیتابیس با اسکریپت `script.sql` راه‌اندازی شده
- [ ] سرور روی پورت صحیح در حال اجرا است

### Frontend:
- [ ] فایل `.env.production` با آدرس API صحیح ایجاد شده
- [ ] پروژه با `npm run build` ساخته شده
- [ ] محتویات `dist` به سرور آپلود شده
- [ ] تنظیمات SPA روی سرور وب انجام شده
- [ ] HTTPS فعال است (برای پروداکشن)

---

## 🆘 عیب‌یابی

### مشکل: Frontend نمی‌تواند به Backend متصل شود

**راه‌حل:**
1. بررسی کنید `VITE_API_BASE_URL` در `.env.production` صحیح است
2. مطمئن شوید Backend در حال اجرا است
3. بررسی کنید CORS در Backend به درستی تنظیم شده

### مشکل: خطای 404 در Refresh صفحه

**راه‌حل:**
- تنظیمات SPA را در سرور وب (Nginx/Apache) پیکربندی کنید

### مشکل: خطای اتصال به دیتابیس

**راه‌حل:**
1. بررسی اطلاعات دیتابیس در `.env`
2. مطمئن شوید SQL Server در حال اجرا است
3. بررسی فایروال و دسترسی‌های شبکه

---

## 📞 پشتیبانی

برای سوالات بیشتر، به فایل‌های زیر مراجعه کنید:
- `README.md` - اطلاعات کلی پروژه
- `QUICK_START.md` - راه‌اندازی سریع
- `TROUBLESHOOTING.md` - رفع مشکلات رایج

---

**تاریخ آخرین بروزرسانی:** 2025-10-06
