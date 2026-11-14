# راهنمای تنظیم نقش superadmin (SuperAdmin)

## خلاصه
نقش "superadmin" یک نقش با دسترسی‌های بالا است که تقریباً تمام دسترسی‌های ادمین را دارد، اما محدودیت‌های زیر را دارد:

### محدودیت‌ها
1. **دسترسی به صفحات زیر ندارد:**
   - فرآیند تأیید (Admin Approval Flow)
   - تنظیمات سایت (Site Settings)
   - نقش‌ها (Roles)
   - دسترسی نقش‌ها (Role Permissions)
   - مدیریت دسترسی‌ها (Role Permissions Management)

2. **در صفحه `/admin/users`:**
   - نمی‌تواند کاربران ادمین را ببیند
   - نمی‌تواند کاربران ادمین را ویرایش کند
   - نمی‌تواند نقش کاربران را تغییر دهد

## فایل‌های تغییر یافته

### Backend
1. **`server/src/middleware/roleExempt.js`** (جدید)
   - `excludeRole()`: middleware برای محدود کردن دسترسی نقش‌های خاص
   - `requireRoleExempt()`: middleware برای بررسی نقش‌های مجاز
   - `filterExcludedRoles()`: middleware برای فیلتر کردن نتایج بر اساس نقش

2. **`server/src/controllers/users.controller.js`**
   - `listUsers()`: فیلتر کردن کاربران Admin برای superadmin
   - `setUserRoles()`: محدودیت تغییر نقش کاربران برای superadmin

3. **`server/src/routes/modules/users.js`**
   - اضافه کردن `excludeRole('superadmin')` به روت‌های نقش‌ها

4. **`server/src/routes/modules/approvals.js`**
   - اضافه کردن `excludeRole('superadmin')` به روت‌های فرآیند تأیید

5. **`server/src/routes/modules/siteSettings.js`**
   - اضافه کردن `excludeRole('superadmin')` به روت‌های تنظیمات سایت

6. **`server/src/routes/modules/permissions.js`**
   - اضافه کردن `excludeRole('superadmin')` به روت‌های مدیریت دسترسی‌ها

### Frontend
1. **`client/src/lib/DynamicNav.jsx`**
   - اضافه کردن تابع `getUserRoleInfo()` برای تشخیص نقش superadmin
   - مخفی کردن منوهای محدود شده برای superadmin

2. **`client/src/App.jsx`**
   - صفحه‌های محدود شده با ProtectedRoute محافظت می‌شوند

## نحوه استفاده

### 1. اجرای Migration دیتابیس
فایل `database/migrations/add_superadmin_role.sql` را اجرا کنید:

```sql
-- در SQL Server Management Studio اجرا کنید
USE [parvaneh]
GO
-- محتوای فایل migration را اینجا paste کنید
GO
```

### 2. اختصاص نقش به کاربر
پس از ایجاد نقش، می‌توانید از طریق صفحه `/admin/users` یا مستقیماً در دیتابیس نقش "superadmin" را به کاربر مورد نظر اختصاص دهید.

#### از طریق دیتابیس:
```sql
-- اضافه کردن نقش superadmin به کاربر
INSERT INTO UserRoles (UserId, RoleId)
SELECT @userId, Id FROM Roles WHERE Name = 'superadmin'
```

### 3. تنظیم دسترسی‌ها (اختیاری)
اگر می‌خواهید دسترسی‌های superadmin را از طریق دیتابیس تنظیم کنید، می‌توانید از جدول `RolePermissions` استفاده کنید.

## تست
پس از تنظیم نقش:
1. با کاربر superadmin وارد شوید
2. باید بتوانید به صفحه `/admin/users` دسترسی داشته باشید
3. نباید کاربران با نقش "Admin" را در لیست ببینید
4. منوهای "نقش‌ها"، "دسترسی‌های نقش‌ها"، "فرآیند تأیید" و "تنظیمات سایت" نباید نمایش داده شوند