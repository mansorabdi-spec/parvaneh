USE [parvaneh]
GO

-- Find all tables with 'Company' or 'National' in the name
SELECT 
    TABLE_NAME,
    TABLE_TYPE
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME LIKE '%Company%' 
   OR TABLE_NAME LIKE '%National%'
   OR TABLE_NAME LIKE '%Business%'
ORDER BY TABLE_NAME;
GO

-- Also check for tables that might store company info
SELECT 
    TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;
GO
