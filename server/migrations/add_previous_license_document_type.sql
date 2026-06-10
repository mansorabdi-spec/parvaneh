-- Migration: Add "پروانه قبلی" (Previous License) document type
-- This document is OPTIONAL for renewal (تمدید) operations
-- Date: 2024-11-27

-- Add to PersonalDocuments category (for حقیقی - individual applicants)
IF NOT EXISTS (
    SELECT 1 
    FROM LookupValue lv
    INNER JOIN LookupCategory lc ON lv.CategoryId = lc.Id
    WHERE lc.CategoryKey = 'PersonalDocuments' 
    AND lv.Name = N'پروانه قبلی'
)
BEGIN
    INSERT INTO LookupValue (CategoryId, Name, Code, IsActive, IsRequired, CreatedAt)
    SELECT 
        lc.Id as CategoryId,
        N'پروانه قبلی' as Name,
        N'PREV_LICENSE_PERSONAL' as Code,
        1 as IsActive,
        0 as IsRequired,  -- Mark as optional (not required)
        GETDATE() as CreatedAt
    FROM LookupCategory lc
    WHERE lc.CategoryKey = 'PersonalDocuments'
    
    PRINT N'✅ Added "پروانه قبلی" to PersonalDocuments (optional)'
END
ELSE
BEGIN
    PRINT N'ℹ️ "پروانه قبلی" already exists in PersonalDocuments'
END

-- Add to CompanyDocuments category (for حقوقی - legal entity applicants)
IF NOT EXISTS (
    SELECT 1 
    FROM LookupValue lv
    INNER JOIN LookupCategory lc ON lv.CategoryId = lc.Id
    WHERE lc.CategoryKey = 'CompanyDocuments' 
    AND lv.Name = N'پروانه قبلی'
)
BEGIN
    INSERT INTO LookupValue (CategoryId, Name, Code, IsActive, IsRequired, CreatedAt)
    SELECT 
        lc.Id as CategoryId,
        N'پروانه قبلی' as Name,
        N'PREV_LICENSE_COMPANY' as Code,
        1 as IsActive,
        0 as IsRequired,  -- Mark as optional (not required)
        GETDATE() as CreatedAt
    FROM LookupCategory lc
    WHERE lc.CategoryKey = 'CompanyDocuments'
    
    PRINT N'✅ Added "پروانه قبلی" to CompanyDocuments (optional)'
END
ELSE
BEGIN
    PRINT N'ℹ️ "پروانه قبلی" already exists in CompanyDocuments'
END

PRINT N'✅ Migration completed: Previous license document type added as optional for renewal operations'
