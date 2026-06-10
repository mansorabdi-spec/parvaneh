USE [parvaneh]
GO

-- Verify the Persons table schema
SELECT 
    c.name AS ColumnName,
    t.name AS DataType,
    c.max_length AS MaxLength,
    c.is_nullable AS IsNullable,
    c.column_id AS ColumnOrder
FROM sys.columns c
INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.Persons')
ORDER BY c.column_id;
GO
