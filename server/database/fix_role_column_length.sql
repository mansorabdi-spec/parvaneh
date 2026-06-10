-- Fix Role column length in Users table
-- The current NVARCHAR(20) is too short for role names like "کارشناس الصاق برچسب"
-- This script increases it to NVARCHAR(50) to accommodate longer Persian role names

USE BarnamehGPS;
GO

PRINT 'Starting Role column length fix...';
GO

-- Check current column definition
SELECT 
    c.name AS ColumnName,
    t.name AS DataType,
    c.max_length AS MaxLength,
    c.max_length / 2 AS ActualCharLength  -- For NVARCHAR, divide by 2
FROM sys.columns c
JOIN sys.types t ON c.user_type_id = t.user_type_id
WHERE c.object_id = OBJECT_ID('Users')
  AND c.name = 'Role';
GO

-- Alter the Role column to NVARCHAR(50)
BEGIN TRY
    ALTER TABLE Users 
    ALTER COLUMN Role NVARCHAR(50) NOT NULL;
    
    PRINT '✅ Users.Role column updated to NVARCHAR(50)';
END TRY
BEGIN CATCH
    PRINT '❌ Error updating Users.Role column: ' + ERROR_MESSAGE();
END CATCH;
GO

-- Verify the change
SELECT 
    c.name AS ColumnName,
    t.name AS DataType,
    c.max_length AS MaxLength,
    c.max_length / 2 AS ActualCharLength
FROM sys.columns c
JOIN sys.types t ON c.user_type_id = t.user_type_id
WHERE c.object_id = OBJECT_ID('Users')
  AND c.name = 'Role';
GO

-- Check if any role names are currently longer than 20 characters
SELECT 
    Id,
    Username,
    Role,
    LEN(Role) AS RoleLength,
    FullName
FROM Users
WHERE LEN(Role) > 20
ORDER BY LEN(Role) DESC;
GO

PRINT 'Role column length fix complete!';
GO
