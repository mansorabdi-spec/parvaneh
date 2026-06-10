USE [parvaneh]
GO

-- Check if CompanyDocuments category exists
SELECT 
    'Category Check' as CheckType,
    Id, 
    [Key], 
    [Name], 
    IsActive
FROM LookupCategory 
WHERE [Key] = 'CompanyDocuments'
GO

-- Check CompanyDocuments values
SELECT 
    'Values Check' as CheckType,
    lv.Id,
    lv.CategoryId,
    lv.Code,
    lv.Name,
    lv.IsActive,
    lv.IsRequired,
    lv.SortOrder
FROM LookupValue lv
JOIN LookupCategory lc ON lv.CategoryId = lc.Id
WHERE lc.[Key] = 'CompanyDocuments'
ORDER BY lv.SortOrder, lv.Name
GO
