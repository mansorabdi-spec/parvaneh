-- Migration script to rename Username to NationalCode and update related logic
-- This version avoids using GO statements and handles everything in a single batch

-- 1. First, check if we need to run this migration
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'Username')
BEGIN
    -- 2. Add the NationalCode column if it doesn't exist
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'NationalCode')
    BEGIN
        -- Add the column as nullable first
        ALTER TABLE Users ADD NationalCode NVARCHAR(10) NULL;
        PRINT 'Added NationalCode column to Users table';
        
        -- Use dynamic SQL to update the new column with existing usernames
        DECLARE @updateSql NVARCHAR(MAX) = 'UPDATE Users SET NationalCode = Username';
        EXEC sp_executesql @updateSql;
        PRINT 'Copied Username values to NationalCode';
        
        -- Now make the column non-nullable
        ALTER TABLE Users ALTER COLUMN NationalCode NVARCHAR(10) NOT NULL;
        PRINT 'Set NationalCode as NOT NULL';
        
        -- Add unique constraint for NationalCode
        IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Users_NationalCode' AND object_id = OBJECT_ID('Users'))
        BEGIN
            CREATE UNIQUE INDEX IX_Users_NationalCode ON Users(NationalCode);
            PRINT 'Created unique index on NationalCode';
        END
    END
    
    -- 3. Drop the old Username column if it exists
    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'Username')
    BEGIN
        -- First drop the unique constraint on Username
        DECLARE @constraintName NVARCHAR(128);
        SELECT @constraintName = name 
        FROM sys.key_constraints 
        WHERE type = 'UQ' AND parent_object_id = OBJECT_ID('Users') 
        AND EXISTS (
            SELECT 1 
            FROM sys.index_columns ic 
            JOIN sys.columns c ON ic.column_id = c.column_id AND ic.object_id = c.object_id
            WHERE ic.object_id = OBJECT_ID('Users') AND c.name = 'Username'
        );
        
        IF @constraintName IS NOT NULL
        BEGIN
            DECLARE @dropConstraintSql NVARCHAR(200) = 'ALTER TABLE Users DROP CONSTRAINT ' + QUOTENAME(@constraintName);
            EXEC sp_executesql @dropConstraintSql;
            PRINT 'Dropped unique constraint on Username column';
        END
        
        -- Now drop the Username column
        ALTER TABLE Users DROP COLUMN Username;
        PRINT 'Dropped Username column';
    END
    
    PRINT 'Migration 001 completed: Renamed Username to NationalCode';
END
ELSE IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'NationalCode')
BEGIN
    -- If Username column doesn't exist but NationalCode also doesn't exist, create it
    ALTER TABLE Users ADD NationalCode NVARCHAR(10) NOT NULL;
    PRINT 'Added NationalCode column to Users table';
END
ELSE
BEGIN
    PRINT 'Migration 001 already applied - no changes needed';
END