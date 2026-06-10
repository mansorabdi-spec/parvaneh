-- =============================================
-- Migration: Update Users Table
-- Date: 2025-10-10
-- Description: Split FullName into FirstName and LastName, add Mobile and ProfilePicture fields
-- =============================================

USE [parvaneh]
GO

-- Step 1: Add new columns (only if they don't exist)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'FirstName')
BEGIN
    ALTER TABLE [dbo].[Users] ADD [FirstName] [nvarchar](100) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'LastName')
BEGIN
    ALTER TABLE [dbo].[Users] ADD [LastName] [nvarchar](100) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'Mobile')
BEGIN
    ALTER TABLE [dbo].[Users] ADD [Mobile] [nvarchar](11) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'ProfilePicture')
BEGIN
    ALTER TABLE [dbo].[Users] ADD [ProfilePicture] [varbinary](max) NULL;
END
GO

-- Step 2: Migrate existing FullName data to FirstName and LastName (only if FullName column exists)
-- This splits the FullName by space, putting first word in FirstName and rest in LastName
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'FullName')
BEGIN
    UPDATE [dbo].[Users]
    SET 
        [FirstName] = CASE 
            WHEN CHARINDEX(' ', [FullName]) > 0 
            THEN LEFT([FullName], CHARINDEX(' ', [FullName]) - 1)
            ELSE [FullName]
        END,
        [LastName] = CASE 
            WHEN CHARINDEX(' ', [FullName]) > 0 
            THEN SUBSTRING([FullName], CHARINDEX(' ', [FullName]) + 1, LEN([FullName]))
            ELSE ''
        END
    WHERE [FirstName] IS NULL OR [FirstName] = '';
END
GO

-- Step 3: Make FirstName and LastName NOT NULL after data migration
-- Only if they are currently nullable
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'FirstName' AND is_nullable = 1)
BEGIN
    ALTER TABLE [dbo].[Users] ALTER COLUMN [FirstName] [nvarchar](100) NOT NULL;
END
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'LastName' AND is_nullable = 1)
BEGIN
    ALTER TABLE [dbo].[Users] ALTER COLUMN [LastName] [nvarchar](100) NOT NULL;
END
GO

-- Step 4: Drop the old FullName column (optional - uncomment if you want to remove it)
-- ALTER TABLE [dbo].[Users]
-- DROP COLUMN [FullName];
-- GO

-- Step 5: Add index on Mobile for faster lookups (only if it doesn't exist)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Users_Mobile' AND object_id = OBJECT_ID('dbo.Users'))
BEGIN
    SET QUOTED_IDENTIFIER ON;
    CREATE NONCLUSTERED INDEX [IX_Users_Mobile] ON [dbo].[Users]
    (
        [Mobile] ASC
    )
    WHERE [Mobile] IS NOT NULL;
END
GO

PRINT 'Users table updated successfully';
GO
