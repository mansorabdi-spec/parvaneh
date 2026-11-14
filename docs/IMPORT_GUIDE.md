# راهنمای Import داده‌های خودرو از فایل متنی

## مرحله 1: آماده‌سازی فایل data.txt

در ریشه پروژه (کنار فولدرهای `client` و `server`) یک فایل به نام `data.txt` بسازید.

### فرمت فایل

هر خط باید شامل سه ستون باشد که با TAB از هم جدا شده‌اند:

```
نوع وسیله [TAB] سیستم ناوگان [TAB] تیپ ناوگان
```

**مثال:**
```
وانت	نیسان	2400
کامیون	بنز	LK2624/40
کامیونت	ایسوزو	NKR55
```

### نکات مهم:
- ✅ هر خط یک رکورد است
- ✅ از TAB برای جدا کردن ستون‌ها استفاده کنید (در اکسل وقتی کپی می‌کنید، خودکار TAB قرار می‌گیرد)
- ✅ خط اول می‌تواند عنوان ستون‌ها باشد (خودکار skip می‌شود)
- ✅ اگر رکوردی تکراری باشد، skip می‌شود
- ✅ اگر فایلی در جداول از قبل وجود داشته باشد، خراب نمی‌شود

## مرحله 2: کپی کردن از Excel

1. در Excel، سه ستون را انتخاب کنید:
   - ستون A: نوع وسیله (وانت، کامیون، کامیونت، ...)
   - ستون B: سیستم ناوگان (بنز، نیسان، مزدا، ...)
   - ستون C: تیپ ناوگان (LK2624/40, 2400, ...)

2. همه ردیف‌ها را Select کنید (می‌توانید از Ctrl+Shift+End استفاده کنید)

3. Copy کنید (Ctrl+C)

4. فایل `data.txt` را با Notepad باز کنید

5. Paste کنید (Ctrl+V)

6. Save کنید

## مرحله 3: اجرای اسکریپت

در ترمینال، به پوشه `server` بروید:

```powershell
cd d:\jari\bargps\parvaneh\server
```

اسکریپت را اجرا کنید:

```powershell
node scripts/import_vehicle_data_from_txt.js
```

## خروجی نمونه

```
🚀 Starting vehicle data import from text file...
📂 Reading from: d:\jari\bargps\parvaneh\data.txt

🔌 Connecting to database...
✅ Connected to database

📄 Found 850 lines in file
⚙️  Processing data...

  ✅ Created VehicleType: وانت (ID: 1)
  ✅ Created Systemtype: نیسان (ID: 15)
  ✅ Created Tiptype: 2400 (ID: 125)
  ✅ Created VehicleType: کامیون (ID: 2)
  ✅ Created Systemtype: بنز (ID: 16)
  ✅ Created Tiptype: LK2624/40 (ID: 126)

📊 Progress: 50 lines processed...
📊 Progress: 100 lines processed...
...

═══════════════════════════════════════
📊 IMPORT SUMMARY
═══════════════════════════════════════
✅ Lines Processed: 847
✅ Vehicle Types Created: 6
✅ Systems Created: 45
✅ Tips Created: 650
❌ Errors: 3
═══════════════════════════════════════

📊 FINAL DATABASE COUNTS
═══════════════════════════════════════
VehicleType: 6 records
Systemtype: 52 records
Tiptype: 723 records
═══════════════════════════════════════

✅ Import completed successfully!
```

## رفع مشکلات احتمالی

### خطا: File not found
اطمینان حاصل کنید که فایل `data.txt` در مسیر زیر وجود دارد:
```
d:\jari\bargps\parvaneh\data.txt
```

### خطا: Not enough columns
- مطمئن شوید که بین ستون‌ها TAB است (نه Space)
- در Notepad++، می‌توانید TAB را به صورت → ببینید (از منوی View → Show Symbol → Show White Space and TAB)

### خطا: Database connection failed
- مطمئن شوید SQL Server در حال اجرا است
- فایل `.env` در پوشه `server` را چک کنید

### برخی رکوردها skip شدند
این طبیعی است! اسکریپت رکوردهای تکراری را skip می‌کند تا از duplicate جلوگیری کند.

## بررسی نتایج

بعد از import، می‌توانید در SQL Server بررسی کنید:

```sql
-- تعداد کل رکوردها
SELECT 'VehicleType' AS Table_Name, COUNT(*) AS Count FROM VehicleType
UNION ALL
SELECT 'Systemtype', COUNT(*) FROM Systemtype
UNION ALL
SELECT 'Tiptype', COUNT(*) FROM Tiptype

-- مشاهده ساختار درختی
SELECT 
    VT.VehicleTypeName AS [نوع وسیله],
    ST.systemname AS [سیستم],
    TT.tipname AS [تیپ]
FROM VehicleType VT
INNER JOIN Systemtype ST ON ST.VehicleTypeID = VT.ID
INNER JOIN Tiptype TT ON TT.SystemtypeID = ST.ID
ORDER BY VT.VehicleTypeName, ST.systemname, TT.tipname
```

## تست با Frontend

بعد از import موفق، بروید به صفحه ثبت پروانه:
```
http://localhost:5173/licenses/activity/issue
```

در مرحله سوم (مشخصات خودرو):
1. نوع وسیله نقلیه را انتخاب کنید → سیستم ناوگان populate می‌شود
2. سیستم ناوگان را انتخاب کنید → تیپ ناوگان populate می‌شود

✅ اگر cascading dropdown کار کرد، همه چیز درست است!

---

## نکات مهم

- ⚠️ قبل از اجرای اسکریپت، backup از دیتابیس بگیرید
- ⚠️ اسکریپت رکوردهای موجود را تغییر نمی‌دهد، فقط جدید اضافه می‌کند
- ⚠️ اگر می‌خواهید دوباره import کنید، مشکلی نیست - duplicate ها skip می‌شوند
- ✅ اسکریپت foreign key ها را خودکار handle می‌کند
