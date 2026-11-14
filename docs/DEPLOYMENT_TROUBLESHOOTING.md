# راهنمای رفع مشکلات استقرار (Deployment Troubleshooting)

## مشکل: Frontend نمی‌تواند به Backend متصل شود (404 Error)

### علائم:
```
POST https://ftml.tabriz.ir/api/auth/login 404 (Not Found)
```

### دلیل:
Frontend در حال تلاش برای دسترسی به API در `https://ftml.tabriz.ir/api/...` است، اما Backend روی پورت 4000 در حال اجرا است و وب سرور نمی‌داند که درخواست‌های `/api` را به کجا هدایت کند.

### راه‌حل‌ها:

---

## راه‌حل 1: پیکربندی Reverse Proxy (توصیه می‌شود) ⭐

### برای Nginx:

1. **ویرایش فایل پیکربندی Nginx:**
   ```bash
   sudo nano /etc/nginx/sites-available/ftml.tabriz.ir
   ```

2. **افزودن پیکربندی زیر:**
   ```nginx
   server {
       listen 80;
       server_name ftml.tabriz.ir;
       
       # Frontend files
       root /home/hamrahim/domains/ftml.tabriz.ir/public_html/client/dist;
       index index.html;
       
       # Serve frontend
       location / {
           try_files $uri $uri/ /index.html;
       }
       
       # Proxy API to backend
       location /api {
           proxy_pass http://localhost:4000;
           proxy_http_version 1.1;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
       
       # Health check
       location /health {
           proxy_pass http://localhost:4000;
       }
       
       # Uploads
       location /uploads {
           alias /home/hamrahim/domains/ftml.tabriz.ir/public_html/server/uploads;
       }
   }
   ```

3. **تست و راه‌اندازی مجدد:**
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

### برای Apache:

1. **فعال‌سازی ماژول‌های لازم:**
   ```bash
   sudo a2enmod proxy
   sudo a2enmod proxy_http
   sudo a2enmod rewrite
   sudo systemctl restart apache2
   ```

2. **ایجاد/ویرایش `.htaccess` در روت سایت:**
   
   مسیر: `/home/hamrahim/domains/ftml.tabriz.ir/public_html/.htaccess`
   
   ```apache
   <IfModule mod_rewrite.c>
       RewriteEngine On
       RewriteBase /
       
       # Proxy API requests to backend
       RewriteCond %{REQUEST_URI} ^/api/ [OR]
       RewriteCond %{REQUEST_URI} ^/health
       RewriteRule ^(.*)$ http://localhost:4000/$1 [P,L]
       
       # SPA routing
       RewriteCond %{REQUEST_FILENAME} !-f
       RewriteCond %{REQUEST_FILENAME} !-d
       RewriteCond %{REQUEST_URI} !^/api/
       RewriteCond %{REQUEST_URI} !^/uploads/
       RewriteRule ^(.*)$ /index.html [L]
   </IfModule>
   ```

3. **یا در VirtualHost اصلی:**
   ```apache
   <VirtualHost *:80>
       ServerName ftml.tabriz.ir
       DocumentRoot /home/hamrahim/domains/ftml.tabriz.ir/public_html/client/dist
       
       ProxyPreserveHost On
       ProxyPass /api http://localhost:4000/api
       ProxyPassReverse /api http://localhost:4000/api
       ProxyPass /health http://localhost:4000/health
       ProxyPassReverse /health http://localhost:4000/health
       
       <Directory /home/hamrahim/domains/ftml.tabriz.ir/public_html/client/dist>
           Options -Indexes +FollowSymLinks
           AllowOverride All
           Require all granted
           
           # SPA routing
           RewriteEngine On
           RewriteBase /
           RewriteCond %{REQUEST_FILENAME} !-f
           RewriteCond %{REQUEST_FILENAME} !-d
           RewriteRule . /index.html [L]
       </Directory>
   </VirtualHost>
   ```

---

## راه‌حل 2: استفاده از پورت در URL (موقت)

اگر نمی‌توانید reverse proxy راه‌اندازی کنید:

1. **ویرایش `client/.env.production`:**
   ```env
   VITE_API_BASE_URL=https://ftml.tabriz.ir:4000
   ```

2. **Build مجدد Frontend:**
   ```bash
   cd client
   npm run build
   ```

3. **آپلود مجدد `dist` folder**

⚠️ **نکته:** این روش نیاز به باز بودن پورت 4000 در فایروال دارد و امنیت کمتری دارد.

---

## راه‌حل 3: تغییر پورت Backend به 80 (توصیه نمی‌شود)

این روش مشکلات امنیتی و مدیریتی دارد و توصیه نمی‌شود.

---

## بررسی وضعیت Backend

### 1. بررسی Backend در حال اجرا است:
```bash
ps aux | grep node
```

### 2. بررسی پورت 4000 در حال گوش دادن است:
```bash
netstat -tlnp | grep 4000
# یا
ss -tlnp | grep 4000
```

### 3. تست مستقیم Backend:
```bash
curl http://localhost:4000/health
```

باید پاسخ JSON دریافت کنید:
```json
{"status":"ok"}
```

### 4. تست از خارج سرور (اگر پورت باز باشد):
```bash
curl http://ftml.tabriz.ir:4000/health
```

---

## بررسی Frontend

### 1. بررسی فایل‌های Build شده:
```bash
ls -la /home/hamrahim/domains/ftml.tabriz.ir/public_html/client/dist/
```

باید شامل `index.html` و فایل‌های JS/CSS باشد.

### 2. بررسی متغیرهای محیطی در Build:
فایل‌های JS را باز کنید و دنبال `VITE_API_BASE_URL` بگردید تا مطمئن شوید مقدار صحیح است.

---

## ساختار پیشنهادی فایل‌ها روی سرور

```
/home/hamrahim/domains/ftml.tabriz.ir/public_html/
├── client/
│   └── dist/              # Frontend build files
│       ├── index.html
│       ├── assets/
│       └── ...
├── server/                # Backend source
│   ├── src/
│   ├── uploads/
│   ├── .env              # Production environment (create manually!)
│   ├── package.json
│   └── node_modules/
└── .htaccess             # Apache config (if using Apache)
```

---

## چک‌لیست رفع مشکل

- [ ] Backend در حال اجرا است (`npm run dev` یا `pm2 list`)
- [ ] Backend روی پورت 4000 گوش می‌دهد
- [ ] `/health` endpoint پاسخ می‌دهد: `curl http://localhost:4000/health`
- [ ] Reverse proxy پیکربندی شده (Nginx یا Apache)
- [ ] Frontend با `VITE_API_BASE_URL` صحیح build شده
- [ ] فایل‌های frontend در مسیر صحیح قرار دارند
- [ ] CORS در backend به درستی تنظیم شده (`CORS_ORIGIN` در `.env`)

---

## اجرای Backend با PM2 (توصیه برای Production)

به جای `npm run dev`، از PM2 استفاده کنید:

```bash
# نصب PM2
npm install -g pm2

# اجرای backend
cd /home/hamrahim/domains/ftml.tabriz.ir/public_html/server
pm2 start src/index.js --name parvaneh-api

# ذخیره برای راه‌اندازی خودکار
pm2 save
pm2 startup

# مشاهده لاگ‌ها
pm2 logs parvaneh-api

# مشاهده وضعیت
pm2 status
```

---

## لاگ‌های مفید برای عیب‌یابی

### Nginx:
```bash
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Apache:
```bash
sudo tail -f /var/log/apache2/error.log
sudo tail -f /var/log/apache2/access.log
```

### PM2:
```bash
pm2 logs parvaneh-api
```

---

## تماس با پشتیبانی

اگر مشکل حل نشد، اطلاعات زیر را جمع‌آوری کنید:

1. خروجی `curl http://localhost:4000/health`
2. خروجی `ps aux | grep node`
3. محتوای `client/.env.production`
4. لاگ‌های وب سرور (Nginx/Apache)
5. لاگ‌های PM2 یا console backend
