-- Drop the FK_CompanyInfo_Manager foreign key constraint
-- This constraint is too restrictive because:
-- 1. Manager information might not be entered when creating a company
-- 2. Manager might be entered later in the workflow
-- 3. The ManagerNationalCode field should be allowed to be NULL or reference a person that doesn't exist yet

USE [parvaneh2]
GO

-- Check if the constraint exists before dropping it
IF EXISTS (
    SELECT 1 
    FROM sys.foreign_keys 
    WHERE name = 'FK_CompanyInfo_Manager' 
    AND parent_object_id = OBJECT_ID('dbo.CompanyInfo')
)
BEGIN
    ALTER TABLE [dbo].[CompanyInfo] DROP CONSTRAINT [FK_CompanyInfo_Manager]
    PRINT 'Foreign key constraint FK_CompanyInfo_Manager has been dropped successfully.'
END
ELSE
BEGIN
    PRINT 'Foreign key constraint FK_CompanyInfo_Manager does not exist.'
END
GO
