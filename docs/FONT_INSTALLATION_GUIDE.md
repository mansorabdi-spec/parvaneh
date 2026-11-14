# راهنمای نصب فونت نستعلیق (Nastaliq Font Installation Guide)

## مشکل فعلی (Current Issue)
عبارت "سامانه صدور پروانه" با فونت نستعلیق نمایش داده نمی‌شود.

## راه حل (Solution)

### گزینه 1: استفاده از فونت IranNastaliq (توصیه می‌شود)

#### مرحله 1: دانلود فونت
1. فونت **IranNastaliq** را از یکی از منابع زیر دانلود کنید:
   - https://github.com/font-store/font-IranNastaliq
   - https://fontlibrary.org/en/font/iran-nastaliq

2. فایل‌های فونت با فرمت‌های زیر را دانلود کنید:
   - `IranNastaliq.woff2`
   - `IranNastaliq.woff`
   - `IranNastaliq.ttf`

#### مرحله 2: ایجاد پوشه fonts
در مسیر `client/public` یک پوشه به نام `fonts` ایجاد کنید:
```
client/
  public/
    fonts/          ← پوشه جدید
      IranNastaliq.woff2
      IranNastaliq.woff
      IranNastaliq.ttf
    logo/
      Logo.png
```

#### مرحله 3: اضافه کردن فونت به CSS
فایل `client/src/styles.css` را باز کنید و در ابتدای فایل، قبل از `:root`، کد زیر را اضافه کنید:

```css
/* Import Nastaliq Font */
@font-face {
  font-family: 'IranNastaliq';
  src: url('/fonts/IranNastaliq.woff2') format('woff2'),
       url('/fonts/IranNastaliq.woff') format('woff'),
       url('/fonts/IranNastaliq.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
```

#### مرحله 4: به‌روزرسانی استایل عنوان
کلاس `.system-title` در `styles.css` را به صورت زیر تغییر دهید:

```css
.system-title {
  font-family: 'IranNastaliq', 'Vazirmatn', serif;
  font-size: 2em;
  color: #fff;
  margin: 0;
  font-weight: 700;
}
```

---

### گزینه 2: استفاده از فونت Noto Nastaliq Urdu (Google Fonts)

#### مرحله 1: اضافه کردن به HTML
فایل `client/index.html` را باز کنید و در بخش `<head>` کد زیر را اضافه کنید:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&display=swap" rel="stylesheet">
```

#### مرحله 2: به‌روزرسانی CSS
در فایل `client/src/styles.css`، کلاس `.system-title` را به صورت زیر تغییر دهید:

```css
.system-title {
  font-family: 'Noto Nastaliq Urdu', 'Vazirmatn', serif;
  font-size: 2em;
  color: #fff;
  margin: 0;
  font-weight: 700;
}
```

---

### گزینه 3: استفاده از فونت Amiri (فونت عربی با پشتیبانی نستعلیق)

#### مرحله 1: نصب از npm
```bash
cd client
npm install @fontsource/amiri
```

#### مرحله 2: Import در App.jsx
در ابتدای فایل `client/src/App.jsx` اضافه کنید:

```javascript
import '@fontsource/amiri/400.css';
import '@fontsource/amiri/700.css';
```

#### مرحله 3: به‌روزرسانی CSS
```css
.system-title {
  font-family: 'Amiri', 'Vazirmatn', serif;
  font-size: 2em;
  color: #fff;
  margin: 0;
  font-weight: 700;
}
```

---

## تست کردن (Testing)

بعد از اعمال تغییرات:
1. سرور را مجدداً راه‌اندازی کنید (Restart)
2. کش مرورگر را پاک کنید (Ctrl+Shift+Delete)
3. صفحه را رفرش کنید (F5 یا Ctrl+R)
4. عبارت "سامانه صدور پروانه" باید با فونت نستعلیق نمایش داده شود

---

## توصیه (Recommendation)

**گزینه 1 (IranNastaliq)** را توصیه می‌کنم چون:
- ✅ فونت فارسی اصیل است
- ✅ بدون نیاز به اینترنت کار می‌کند
- ✅ سرعت بارگذاری بالاتر
- ✅ زیبایی بیشتر برای متن‌های فارسی

---

## ساختار نهایی پروژه (Final Project Structure)

```
client/
  public/
    fonts/
      IranNastaliq.woff2
      IranNastaliq.woff
      IranNastaliq.ttf
    logo/
      Logo.png
    index.html
  src/
    styles.css    ← @font-face اضافه شده
    App.jsx
    ...
```

---

## نکات مهم (Important Notes)

1. **مسیر فونت**: مطمئن شوید مسیر `/fonts/` در `url()` صحیح است
2. **فرمت فونت**: ترتیب `woff2`, `woff`, `ttf` مهم است (از جدید به قدیم)
3. **Fallback**: همیشه فونت‌های جایگزین (Vazirmatn, serif) را نگه دارید
4. **کش مرورگر**: بعد از تغییر فونت، حتماً کش را پاک کنید

---

## عیب‌یابی (Troubleshooting)

### فونت نمایش داده نمی‌شود؟
1. ✓ مسیر فایل فونت را بررسی کنید
2. ✓ Console مرورگر را چک کنید (F12)
3. ✓ Network tab را بررسی کنید که فونت دانلود شده باشد
4. ✓ مطمئن شوید سرور در حال اجرا است

### فونت خیلی کوچک یا بزرگ است؟
`font-size` در `.system-title` را تغییر دهید (مثلاً `2.5em` یا `1.8em`)

### فونت خیلی نازک یا ضخیم است؟
`font-weight` را تغییر دهید (400 = نرمال، 700 = بولد)
