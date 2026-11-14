-- Renewal window: days before license expiry when the renew action becomes available.
-- The number is stored in LookupValue.Code and edited from /admin/lookups.

IF NOT EXISTS (SELECT 1 FROM LookupCategory WHERE [Key] = N'RenewalWindowDays')
BEGIN
    INSERT INTO LookupCategory ([Key], [Name], [Description], IsActive, SortOrder)
    VALUES (
        N'RenewalWindowDays',
        N'مهلت تمدید پروانه',
        N'تعداد روز مانده تا انقضای پروانه که دکمه تمدید فعال می‌شود',
        1,
        200
    );
END

DECLARE @CategoryId INT;
SELECT @CategoryId = Id FROM LookupCategory WHERE [Key] = N'RenewalWindowDays';

IF NOT EXISTS (SELECT 1 FROM LookupValue WHERE CategoryId = @CategoryId)
BEGIN
    INSERT INTO LookupValue (CategoryId, Code, Name, NameEn, Description, IsActive, IsRequired, SortOrder)
    VALUES (
        @CategoryId,
        N'10',
        N'تعداد روز',
        N'Renewal window days',
        N'مقدار پیش‌فرض ۱۰ روز',
        1,
        0,
        1
    );
END
GO
