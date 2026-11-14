-- =============================================
-- Table: LicenseRenewalHistory
-- Description: ذخیره تاریخچه تمدید پروانه‌ها
-- هر بار که یک پروانه تمدید می‌شود، یک رکورد در این جدول ذخیره می‌شود
-- TrackingNo ثابت است و تاریخچه تمدید را نگه می‌دارد
-- =============================================

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name = 'LicenseRenewalHistory' AND xtype = 'U')
BEGIN
    CREATE TABLE LicenseRenewalHistory (
        Id BIGINT IDENTITY(1,1) PRIMARY KEY,
        TrackingNo NVARCHAR(30) NOT NULL,  -- شماره پروانه (ثابت)
        RequestID BIGINT NOT NULL,  -- شناسه درخواست تمدید
        LicenseHistoryId BIGINT NOT NULL,  -- شناسه رکورد مربوط در جدول LicenseHistory
        RenewalDate NVARCHAR(10) NOT NULL,  -- تاریخ شمسی تمدید (مثال: 1405/05/23)
        RenewalDateGregorian DATETIME NOT NULL,  -- تاریخ میلادی تمدید
        ExpiryDate NVARCHAR(10) NOT NULL,  -- تاریخ انقضای پروانه جدید (شمسی)
        ExpiryDateGregorian DATETIME NOT NULL,  -- تاریخ انقضای میلادی
        ValidityDurationMonths INT NOT NULL DEFAULT 12,  -- مدت اعتبار به ماه
        RenewedByUserId INT NULL,  -- شناسه کاربر تمدید کننده
        RenewedByUsername NVARCHAR(100) NULL,  -- نام کاربر تمدید کننده
        RenewedByRole NVARCHAR(100) NULL,  -- نقش کاربر تمدید کننده
        RenewalAmount DECIMAL(18, 2) NULL,  -- مبلغ تمدید
        DiscountAmount DECIMAL(18, 2) NULL,  -- مبلغ تخفیف
        FinalAmount DECIMAL(18, 2) NULL,  -- مبلغ نهایی پس از تخفیف
        RenewalNotes NVARCHAR(MAX) NULL,  -- توضیحات تمدید
        Metadata NVARCHAR(MAX) NULL,  -- اطلاعات اضافی (JSON)
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NULL,
        CONSTRAINT FK_LicenseRenewalHistory_LicenseHistory 
            FOREIGN KEY (LicenseHistoryId) REFERENCES LicenseHistory(HistoryID)
            ON DELETE CASCADE
            ON UPDATE NO ACTION,
        CONSTRAINT FK_LicenseRenewalHistory_Users_RenewedBy 
            FOREIGN KEY (RenewedByUserId) REFERENCES Users(Id)
            ON DELETE SET NULL
            ON UPDATE NO ACTION,
        CONSTRAINT FK_LicenseRenewalHistory_VehicleRequests 
            FOREIGN KEY (RequestID) REFERENCES VehicleRequests(RequestID)
            ON DELETE CASCADE
            ON UPDATE NO ACTION
    );
    
    PRINT '✅ Table LicenseRenewalHistory created successfully';
END
ELSE
BEGIN
    PRINT 'ℹ️ Table LicenseRenewalHistory already exists';
END
GO

-- =============================================
-- Indexes
-- =============================================

-- Index بر روی TrackingNo برای جستجوی سریع تمدیدهای یک پروانه
IF NOT EXISTS (SELECT * FROM sysindexes WHERE name = 'IX_LicenseRenewalHistory_TrackingNo')
BEGIN
    CREATE NONCLUSTERED INDEX IX_LicenseRenewalHistory_TrackingNo 
    ON LicenseRenewalHistory(TrackingNo)
    INCLUDE (RenewalDate, RenewedByUserId, LicenseHistoryId)
    ON [PRIMARY];
    
    PRINT '✅ Index IX_LicenseRenewalHistory_TrackingNo created';
END
ELSE
BEGIN
    PRINT 'ℹ️ Index IX_LicenseRenewalHistory_TrackingNo already exists';
END
GO

-- Index بر روی LicenseHistoryId برای جستجوی سریع
IF NOT EXISTS (SELECT * FROM sysindexes WHERE name = 'IX_LicenseRenewalHistory_LicenseHistoryId')
BEGIN
    CREATE NONCLUSTERED INDEX IX_LicenseRenewalHistory_LicenseHistoryId 
    ON LicenseRenewalHistory(LicenseHistoryId)
    ON [PRIMARY];
    
    PRINT '✅ Index IX_LicenseRenewalHistory_LicenseHistoryId created';
END
ELSE
BEGIN
    PRINT 'ℹ️ Index IX_LicenseRenewalHistory_LicenseHistoryId already exists';
END
GO

-- Index بر روی RenewedByUserId برای جستجوی تمدیدهای یک کاربر
IF NOT EXISTS (SELECT * FROM sysindexes WHERE name = 'IX_LicenseRenewalHistory_RenewedByUserId')
BEGIN
    CREATE NONCLUSTERED INDEX IX_LicenseRenewalHistory_RenewedByUserId 
    ON LicenseRenewalHistory(RenewedByUserId)
    INCLUDE (TrackingNo, RenewalDate)
    ON [PRIMARY];
    
    PRINT '✅ Index IX_LicenseRenewalHistory_RenewedByUserId created';
END
ELSE
BEGIN
    PRINT 'ℹ️ Index IX_LicenseRenewalHistory_RenewedByUserId already exists';
END
GO

-- =============================================
-- View: vw_LicenseRenewalSummary
-- Description: خلاصه تاریخچه تمدید یک پروانه
-- =============================================

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name = 'vw_LicenseRenewalSummary' AND xtype = 'V')
BEGIN
    EXEC sp_executesql N'
    CREATE VIEW vw_LicenseRenewalSummary AS
    SELECT 
        lrh.TrackingNo,
        lrh.RequestID,
        lrh.LicenseHistoryId,
        lrh.RenewalDate,
        lrh.RenewalDateGregorian,
        lrh.ExpiryDate,
        lrh.ExpiryDateGregorian,
        lrh.ValidityDurationMonths,
        lrh.RenewedByUserId,
        u.FullName AS RenewedByUserName,
        lrh.RenewedByRole,
        lrh.RenewalAmount,
        lrh.DiscountAmount,
        lrh.FinalAmount,
        lrh.RenewalNotes,
        lrh.CreatedAt,
        lrh.UpdatedAt,
        -- شماره تمدید (مثال: تمدید اول، دوم، ...)
        ROW_NUMBER() OVER (PARTITION BY lrh.TrackingNo ORDER BY lrh.RenewalDate) AS RenewalSequence,
        -- تعداد کل تمدیدها
        (SELECT COUNT(*) FROM LicenseRenewalHistory WHERE TrackingNo = lrh.TrackingNo) AS TotalRenewals
    FROM LicenseRenewalHistory lrh
    LEFT JOIN Users u ON lrh.RenewedByUserId = u.Id
    '
    
    PRINT '✅ View vw_LicenseRenewalSummary created';
END
ELSE
BEGIN
    PRINT 'ℹ️ View vw_LicenseRenewalSummary already exists';
END
GO

-- =============================================
-- Trigger: trg_AfterLicenseRenewed
-- Description: خودکار پس از ثبت تمدید در LicenseHistory
-- این trigger پس از insert در LicenseHistory فعال می‌شود
-- و رکورد مربوط را در LicenseRenewalHistory ثبت می‌کند
-- =============================================

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name = 'trg_AfterLicenseRenewed' AND xtype = 'TR')
BEGIN
    EXEC sp_executesql N'
    CREATE TRIGGER trg_AfterLicenseRenewed
    ON LicenseHistory
    AFTER INSERT
    AS
    BEGIN
        SET NOCOUNT ON;
        
        -- فقط برای EventType = Renewed
        DECLARE @EventType NVARCHAR(50)
        DECLARE @TrackingNo NVARCHAR(30)
        DECLARE @RequestID BIGINT
        DECLARE @HistoryID BIGINT
        DECLARE @IssueDate NVARCHAR(10)
        DECLARE @ExpiryDate NVARCHAR(10)
        DECLARE @ValidityMonths INT
        DECLARE @IssuedByUserId INT
        DECLARE @IssuedByUsername NVARCHAR(100)
        DECLARE @IssuedByRole NVARCHAR(100)
        DECLARE @Notes NVARCHAR(MAX)
        DECLARE @Metadata NVARCHAR(MAX)
        
        SELECT @EventType = EventType,
               @TrackingNo = TrackingNo,
               @RequestID = RequestID,
               @HistoryID = HistoryID,
               @IssueDate = IssueDate,
               @ExpiryDate = ExpiryDate,
               @ValidityMonths = ValidityDurationMonths,
               @IssuedByUserId = IssuedByUserId,
               @IssuedByUsername = IssuedByUsername,
               @IssuedByRole = IssuedByRole,
               @Notes = Notes,
               @Metadata = Metadata
        FROM inserted
        
        IF @EventType = ''Renewed''
        BEGIN
            -- بررسی اینکه آیا رکورد قبلاً ثبت شده است
            IF NOT EXISTS (
                SELECT 1 FROM LicenseRenewalHistory 
                WHERE LicenseHistoryId = @HistoryID
            )
            BEGIN
                INSERT INTO LicenseRenewalHistory (
                    TrackingNo,
                    RequestID,
                    LicenseHistoryId,
                    RenewalDate,
                    RenewalDateGregorian,
                    ExpiryDate,
                    ExpiryDateGregorian,
                    ValidityDurationMonths,
                    RenewedByUserId,
                    RenewedByUsername,
                    RenewedByRole,
                    RenewalNotes,
                    Metadata
                )
                VALUES (
                    @TrackingNo,
                    @RequestID,
                    @HistoryID,
                    @IssueDate,  -- IssueDate در واقع تاریخ تمدید است
                    SYSUTCDATETIME(),
                    @ExpiryDate,
                    SYSUTCDATETIME(),
                    @ValidityMonths,
                    @IssuedByUserId,
                    @IssuedByUsername,
                    @IssuedByRole,
                    @Notes,
                    @Metadata
                )
            END
        END
    END
    '
    
    PRINT '✅ Trigger trg_AfterLicenseRenewed created';
END
ELSE
BEGIN
    PRINT 'ℹ️ Trigger trg_AfterLicenseRenewed already exists';
END
GO

-- =============================================
-- Sample Query Examples
-- =============================================

-- مشاهده تاریخچه تمدید یک پروانه
-- SELECT * FROM vw_LicenseRenewalSummary WHERE TrackingNo = '3411-30012' ORDER BY RenewalDate DESC

-- مشاهده آخرین تمدید هر پروانه
-- SELECT * FROM (
--     SELECT *, ROW_NUMBER() OVER (PARTITION BY TrackingNo ORDER BY RenewalDate DESC) AS rn
--     FROM vw_LicenseRenewalSummary
-- ) t WHERE rn = 1

-- مشاهده تعداد تمدیدهای هر پروانه
-- SELECT TrackingNo, COUNT(*) AS TotalRenewals
-- FROM LicenseRenewalHistory
-- GROUP BY TrackingNo
-- ORDER BY TotalRenewals DESC