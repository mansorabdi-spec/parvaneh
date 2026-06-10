-- Migration: Add sample renewal (تمدید) tariffs
-- These tariffs will be used when users select "تمدید" operation type
-- Date: 2024-11-27

-- First, get the DocTypeId for "تمدید" (Renewal) from LookupValue table
DECLARE @RenewalDocTypeId INT;

SELECT @RenewalDocTypeId = Id 
FROM LookupValue lv
INNER JOIN LookupCategory lc ON lv.CategoryId = lc.Id
WHERE lc.CategoryKey = 'LicenseDocumentType' 
AND lv.Name = N'تمدید';

IF @RenewalDocTypeId IS NULL
BEGIN
    PRINT N'❌ ERROR: "تمدید" operation type not found in LookupValue table'
    PRINT N'Please ensure "تمدید" exists in LicenseDocumentType lookup category'
    RETURN;
END

PRINT N'✅ Found "تمدید" operation type with ID: ' + CAST(@RenewalDocTypeId AS NVARCHAR(10));

-- Add sample renewal tariffs for activity licenses (پروانه فعالیت)
-- These are typically lower than issuance tariffs since renewal is simpler

-- Check if renewal tariffs already exist
IF NOT EXISTS (
    SELECT 1 
    FROM Tariffs 
    WHERE DocTypeId = @RenewalDocTypeId 
    AND LicenseType LIKE N'%فعالیت%'
)
BEGIN
    PRINT N'📝 Adding sample renewal tariffs for activity licenses...';
    
    -- Renewal tariffs for different tonnage ranges
    -- Adjust amounts based on your business requirements
    
    INSERT INTO Tariffs (LicenseType, DocTypeId, FromTon, ToTon, Amount, Year, Description, CreatedAt)
    VALUES 
        (N'پروانه فعالیت', @RenewalDocTypeId, '0', '1', 300000, '1403', N'تعرفه تمدید پروانه فعالیت 0-1 تن', GETDATE()),
        (N'پروانه فعالیت', @RenewalDocTypeId, '1', '3', 400000, '1403', N'تعرفه تمدید پروانه فعالیت 1-3 تن', GETDATE()),
        (N'پروانه فعالیت', @RenewalDocTypeId, '3', '5', 500000, '1403', N'تعرفه تمدید پروانه فعالیت 3-5 تن', GETDATE()),
        (N'پروانه فعالیت', @RenewalDocTypeId, '5', '10', 750000, '1403', N'تعرفه تمدید پروانه فعالیت 5-10 تن', GETDATE()),
        (N'پروانه فعالیت', @RenewalDocTypeId, '10', '20', 1000000, '1403', N'تعرفه تمدید پروانه فعالیت 10-20 تن', GETDATE()),
        (N'پروانه فعالیت', @RenewalDocTypeId, '20', '30', 1500000, '1403', N'تعرفه تمدید پروانه فعالیت 20-30 تن', GETDATE()),
        (N'پروانه فعالیت', @RenewalDocTypeId, '30', '100', 2000000, '1403', N'تعرفه تمدید پروانه فعالیت 30-100 تن', GETDATE());
    
    PRINT N'✅ Added ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + N' renewal tariffs for activity licenses';
END
ELSE
BEGIN
    PRINT N'ℹ️ Renewal tariffs for activity licenses already exist';
END

-- Add sample renewal tariffs for legal entity activity licenses (پروانه فعالیت حقوقی)
IF NOT EXISTS (
    SELECT 1 
    FROM Tariffs 
    WHERE DocTypeId = @RenewalDocTypeId 
    AND LicenseType LIKE N'%فعالیت حقوقی%'
)
BEGIN
    PRINT N'📝 Adding sample renewal tariffs for legal entity activity licenses...';
    
    INSERT INTO Tariffs (LicenseType, DocTypeId, FromTon, ToTon, Amount, Year, Description, CreatedAt)
    VALUES 
        (N'پروانه فعالیت حقوقی', @RenewalDocTypeId, '0', '1', 350000, '1403', N'تعرفه تمدید پروانه فعالیت حقوقی 0-1 تن', GETDATE()),
        (N'پروانه فعالیت حقوقی', @RenewalDocTypeId, '1', '3', 450000, '1403', N'تعرفه تمدید پروانه فعالیت حقوقی 1-3 تن', GETDATE()),
        (N'پروانه فعالیت حقوقی', @RenewalDocTypeId, '3', '5', 600000, '1403', N'تعرفه تمدید پروانه فعالیت حقوقی 3-5 تن', GETDATE()),
        (N'پروانه فعالیت حقوقی', @RenewalDocTypeId, '5', '10', 850000, '1403', N'تعرفه تمدید پروانه فعالیت حقوقی 5-10 تن', GETDATE()),
        (N'پروانه فعالیت حقوقی', @RenewalDocTypeId, '10', '20', 1200000, '1403', N'تعرفه تمدید پروانه فعالیت حقوقی 10-20 تن', GETDATE()),
        (N'پروانه فعالیت حقوقی', @RenewalDocTypeId, '20', '30', 1800000, '1403', N'تعرفه تمدید پروانه فعالیت حقوقی 20-30 تن', GETDATE()),
        (N'پروانه فعالیت حقوقی', @RenewalDocTypeId, '30', '100', 2500000, '1403', N'تعرفه تمدید پروانه فعالیت حقوقی 30-100 تن', GETDATE());
    
    PRINT N'✅ Added ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + N' renewal tariffs for legal entity activity licenses';
END
ELSE
BEGIN
    PRINT N'ℹ️ Renewal tariffs for legal entity activity licenses already exist';
END

PRINT N'';
PRINT N'✅ Migration completed: Renewal tariffs added successfully';
PRINT N'';
PRINT N'📋 Summary:';
PRINT N'   - Renewal operation DocTypeId: ' + CAST(@RenewalDocTypeId AS NVARCHAR(10));
PRINT N'   - Tariffs added for both individual and legal entity activity licenses';
PRINT N'   - Renewal tariffs are typically 60-70% of issuance tariffs';
PRINT N'';
PRINT N'⚠️ Note: Please adjust the tariff amounts according to your organization''s pricing policy';
