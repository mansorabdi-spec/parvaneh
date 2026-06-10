-- Provinces and Cities tables and seed data (Iran)

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Provinces')
BEGIN
  CREATE TABLE Provinces (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100) NOT NULL UNIQUE
  );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Cities')
BEGIN
  CREATE TABLE Cities (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(120) NOT NULL,
    ProvinceID INT NOT NULL,
    CONSTRAINT UQ_Cities_Province_Name UNIQUE (ProvinceID, name),
    CONSTRAINT FK_Cities_Province FOREIGN KEY (ProvinceID) REFERENCES Provinces(ID) ON DELETE CASCADE
  );
END;

-- Seed provinces (only if table is empty)
IF NOT EXISTS (SELECT 1 FROM Provinces)
BEGIN
  INSERT INTO Provinces(name) VALUES
    (N'آذربایجان شرقی'),(N'آذربایجان غربی'),(N'اردبیل'),(N'اصفهان'),(N'البرز'),(N'ایلام'),(N'بوشهر'),(N'تهران'),
    (N'چهارمحال و بختیاری'),(N'خراسان جنوبی'),(N'خراسان رضوی'),(N'خراسان شمالی'),(N'خوزستان'),(N'زنجان'),(N'سمنان'),
    (N'سیستان و بلوچستان'),(N'فارس'),(N'قزوین'),(N'قم'),(N'کردستان'),(N'کرمان'),(N'کرمانشاه'),(N'کهگیلویه و بویراحمد'),
    (N'گلستان'),(N'گیلان'),(N'لرستان'),(N'مازندران'),(N'مرکزی'),(N'هرمزگان'),(N'همدان'),(N'یزد');
END;

-- Seed a representative list of cities per province (only if Cities is empty)
IF NOT EXISTS (SELECT 1 FROM Cities)
BEGIN
  -- Tehran
  DECLARE @pid INT; SELECT @pid = ID FROM Provinces WHERE name = N'تهران';
  IF @pid IS NOT NULL BEGIN
    INSERT INTO Cities(name, ProvinceID) VALUES (N'تهران', @pid),(N'شهریار', @pid),(N'قدس', @pid),(N'اسلامشهر', @pid),(N'ری', @pid);
  END
  -- Alborz
  SELECT @pid = ID FROM Provinces WHERE name = N'البرز';
  IF @pid IS NOT NULL BEGIN
    INSERT INTO Cities(name, ProvinceID) VALUES (N'کرج', @pid),(N'هشتگرد', @pid),(N'نظرآباد', @pid),(N'فردیس', @pid);
  END
  -- Isfahan
  SELECT @pid = ID FROM Provinces WHERE name = N'اصفهان';
  IF @pid IS NOT NULL BEGIN
    INSERT INTO Cities(name, ProvinceID) VALUES (N'اصفهان', @pid),(N'کاشان', @pid),(N'نجف‌آباد', @pid),(N'خمینی‌شهر', @pid),(N'شاهین‌شهر', @pid);
  END
  -- Fars
  SELECT @pid = ID FROM Provinces WHERE name = N'فارس';
  IF @pid IS NOT NULL BEGIN
    INSERT INTO Cities(name, ProvinceID) VALUES (N'شیراز', @pid),(N'مرودشت', @pid),(N'کازرون', @pid),(N'جهرم', @pid),(N'لار', @pid);
  END
  -- Khorasan Razavi
  SELECT @pid = ID FROM Provinces WHERE name = N'خراسان رضوی';
  IF @pid IS NOT NULL BEGIN
    INSERT INTO Cities(name, ProvinceID) VALUES (N'مشهد', @pid),(N'نیشابور', @pid),(N'سبزوار', @pid),(N'تربت‌حیدریه', @pid),(N'قوچان', @pid);
  END
  -- Khuzestan
  SELECT @pid = ID FROM Provinces WHERE name = N'خوزستان';
  IF @pid IS NOT NULL BEGIN
    INSERT INTO Cities(name, ProvinceID) VALUES (N'اهواز', @pid),(N'آبادان', @pid),(N'خرمشهر', @pid),(N'دزفول', @pid),(N'بهبهان', @pid);
  END
  -- East Azerbaijan
  SELECT @pid = ID FROM Provinces WHERE name = N'آذربایجان شرقی';
  IF @pid IS NOT NULL BEGIN
    INSERT INTO Cities(name, ProvinceID) VALUES (N'تبریز', @pid),(N'مراغه', @pid),(N'مرند', @pid),(N'اهر', @pid),(N'شبستر', @pid);
  END
  -- West Azerbaijan
  SELECT @pid = ID FROM Provinces WHERE name = N'آذربایجان غربی';
  IF @pid IS NOT NULL BEGIN
    INSERT INTO Cities(name, ProvinceID) VALUES (N'ارومیه', @pid),(N'خوی', @pid),(N'میاندوآب', @pid),(N'بوکان', @pid),(N'سلماس', @pid);
  END
  -- Gilan
  SELECT @pid = ID FROM Provinces WHERE name = N'گیلان';
  IF @pid IS NOT NULL BEGIN
    INSERT INTO Cities(name, ProvinceID) VALUES (N'رشت', @pid),(N' بندرانزلی', @pid),(N'لاهیجان', @pid),(N'آستانه‌اشرفیه', @pid);
  END
  -- Mazandaran
  SELECT @pid = ID FROM Provinces WHERE name = N'مازندران';
  IF @pid IS NOT NULL BEGIN
    INSERT INTO Cities(name, ProvinceID) VALUES (N'ساری', @pid),(N'بابل', @pid),(N'آمل', @pid),(N'قائم‌شهر', @pid),(N'تنکابن', @pid);
  END
  -- Kerman
  SELECT @pid = ID FROM Provinces WHERE name = N'کرمان';
  IF @pid IS NOT NULL BEGIN
    INSERT INTO Cities(name, ProvinceID) VALUES (N'کرمان', @pid),(N'رفسنجان', @pid),(N'سیرجان', @pid),(N'جیرفت', @pid);
  END
  -- Kermanshah
  SELECT @pid = ID FROM Provinces WHERE name = N'کرمانشاه';
  IF @pid IS NOT NULL BEGIN
    INSERT INTO Cities(name, ProvinceID) VALUES (N'کرمانشاه', @pid),(N'اسلام‌آبادغرب', @pid),(N'هرسین', @pid),(N'سنقر', @pid);
  END
  -- Yazd
  SELECT @pid = ID FROM Provinces WHERE name = N'یزد';
  IF @pid IS NOT NULL BEGIN
    INSERT INTO Cities(name, ProvinceID) VALUES (N'یزد', @pid),(N'میبد', @pid),(N'اردکان', @pid);
  END
  -- Hamedan
  SELECT @pid = ID FROM Provinces WHERE name = N'همدان';
  IF @pid IS NOT NULL BEGIN
    INSERT INTO Cities(name, ProvinceID) VALUES (N'همدان', @pid),(N'ملایر', @pid),(N'نهاوند', @pid),(N'تویسرکان', @pid);
  END
  -- Qom
  SELECT @pid = ID FROM Provinces WHERE name = N'قم';
  IF @pid IS NOT NULL BEGIN
    INSERT INTO Cities(name, ProvinceID) VALUES (N'قم', @pid);
  END
  -- Qazvin
  SELECT @pid = ID FROM Provinces WHERE name = N'قزوین';
  IF @pid IS NOT NULL BEGIN
    INSERT INTO Cities(name, ProvinceID) VALUES (N'قزوین', @pid),(N'البرز', @pid),(N'تاکستان', @pid);
  END
  -- Lorestan
  SELECT @pid = ID FROM Provinces WHERE name = N'لرستان';
  IF @pid IS NOT NULL BEGIN
    INSERT INTO Cities(name, ProvinceID) VALUES (N'خرم‌آباد', @pid),(N'بروجرد', @pid),(N'الیگودرز', @pid);
  END
  -- Golestan
  SELECT @pid = ID FROM Provinces WHERE name = N'گلستان';
  IF @pid IS NOT NULL BEGIN
    INSERT INTO Cities(name, ProvinceID) VALUES (N'گرگان', @pid),(N'گنبدکاووس', @pid),(N'آق‌قلا', @pid);
  END
  -- Sistan and Baluchestan
  SELECT @pid = ID FROM Provinces WHERE name = N'سیستان و بلوچستان';
  IF @pid IS NOT NULL BEGIN
    INSERT INTO Cities(name, ProvinceID) VALUES (N'زاهدان', @pid),(N'چابهار', @pid),(N'زابل', @pid);
  END
  -- Bushehr
  SELECT @pid = ID FROM Provinces WHERE name = N'بوشهر';
  IF @pid IS NOT NULL BEGIN
    INSERT INTO Cities(name, ProvinceID) VALUES (N'بوشهر', @pid),(N'برازجان', @pid),(N'کنگان', @pid);
  END
  -- Hormozgan
  SELECT @pid = ID FROM Provinces WHERE name = N'هرمزگان';
  IF @pid IS NOT NULL BEGIN
    INSERT INTO Cities(name, ProvinceID) VALUES (N'بندرعباس', @pid),(N'میناب', @pid),(N'بندرلنگه', @pid),(N'قشم', @pid);
  END
  -- Zanjan
  SELECT @pid = ID FROM Provinces WHERE name = N'زنجان';
  IF @pid IS NOT NULL BEGIN
    INSERT INTO Cities(name, ProvinceID) VALUES (N'زنجان', @pid),(N'ابهر', @pid),(N'خرمدره', @pid);
  END
  -- Semnan
  SELECT @pid = ID FROM Provinces WHERE name = N'سمنان';
  IF @pid IS NOT NULL BEGIN
    INSERT INTO Cities(name, ProvinceID) VALUES (N'سمنان', @pid),(N'شاهرود', @pid),(N'دامغان', @pid);
  END
  -- Markazi
  SELECT @pid = ID FROM Provinces WHERE name = N'مرکزی';
  IF @pid IS NOT NULL BEGIN
    INSERT INTO Cities(name, ProvinceID) VALUES (N'اراک', @pid),(N'ساوه', @pid),(N'خمین', @pid);
  END
  -- Kordestan
  SELECT @pid = ID FROM Provinces WHERE name = N'کردستان';
  IF @pid IS NOT NULL BEGIN
    INSERT INTO Cities(name, ProvinceID) VALUES (N'سنندج', @pid),(N'سقز', @pid),(N'مریوان', @pid);
  END
  -- Ilam
  SELECT @pid = ID FROM Provinces WHERE name = N'ایلام';
  IF @pid IS NOT NULL BEGIN
    INSERT INTO Cities(name, ProvinceID) VALUES (N'ایلام', @pid),(N'دهلران', @pid),(N'ایوان', @pid);
  END
  -- Kohgiluyeh and Boyer-Ahmad
  SELECT @pid = ID FROM Provinces WHERE name = N'کهگیلویه و بویراحمد';
  IF @pid IS NOT NULL BEGIN
    INSERT INTO Cities(name, ProvinceID) VALUES (N'یاسوج', @pid),(N'گچساران', @pid),(N'دهدشت', @pid);
  END
  -- Ardabil
  SELECT @pid = ID FROM Provinces WHERE name = N'اردبیل';
  IF @pid IS NOT NULL BEGIN
    INSERT INTO Cities(name, ProvinceID) VALUES (N'اردبیل', @pid),(N'مشگین‌شهر', @pid),(N'پارس‌آباد', @pid);
  END
  -- North Khorasan
  SELECT @pid = ID FROM Provinces WHERE name = N'خراسان شمالی';
  IF @pid IS NOT NULL BEGIN
    INSERT INTO Cities(name, ProvinceID) VALUES (N'بجنورد', @pid),(N'شیروان', @pid),(N'اسفراین', @pid);
  END
  -- South Khorasan
  SELECT @pid = ID FROM Provinces WHERE name = N'خراسان جنوبی';
  IF @pid IS NOT NULL BEGIN
    INSERT INTO Cities(name, ProvinceID) VALUES (N'بیرجند', @pid),(N'طبس', @pid),(N'فردوس', @pid);
  END
  -- Chaharmahal and Bakhtiari
  SELECT @pid = ID FROM Provinces WHERE name = N'چهارمحال و بختیاری';
  IF @pid IS NOT NULL BEGIN
    INSERT INTO Cities(name, ProvinceID) VALUES (N'شهرکرد', @pid),(N'بروجن', @pid),(N'فارسان', @pid);
  END
END;
