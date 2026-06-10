USE [parvaneh]
GO

-- =============================================
-- Migration: Fix EmploymentDiscountDocuments Foreign Key
-- Purpose: Update FK to point to VehicleRequests instead of EmploymentRequests
-- Date: 2025-10-15
-- =============================================

PRINT 'Fixing EmploymentDiscountDocuments foreign key constraint...'
GO

-- Step 1: Drop existing foreign key constraint to EmploymentRequests (if exists)
IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_EmploymentDiscountDocs_Request')
BEGIN
    ALTER TABLE [dbo].[EmploymentDiscountDocuments]
    DROP CONSTRAINT [FK_EmploymentDiscountDocs_Request];
    PRINT '  ✓ Dropped old FK_EmploymentDiscountDocs_Request constraint'
END
ELSE
    PRINT '  - FK_EmploymentDiscountDocs_Request constraint does not exist'
GO

-- Step 2: Add new foreign key constraint to VehicleRequests (unified table)
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_EmploymentDiscountDocs_VehicleRequests')
BEGIN
    ALTER TABLE [dbo].[EmploymentDiscountDocuments]
    WITH CHECK ADD CONSTRAINT [FK_EmploymentDiscountDocs_VehicleRequests] FOREIGN KEY([RequestID])
    REFERENCES [dbo].[VehicleRequests] ([RequestID]);
    
    ALTER TABLE [dbo].[EmploymentDiscountDocuments]
    CHECK CONSTRAINT [FK_EmploymentDiscountDocs_VehicleRequests];
    
    PRINT '  ✓ Added FK_EmploymentDiscountDocs_VehicleRequests constraint'
END
ELSE
    PRINT '  - FK_EmploymentDiscountDocs_VehicleRequests already exists'
GO

PRINT '✅ Migration completed successfully!'
PRINT 'EmploymentDiscountDocuments.RequestID now references VehicleRequests.RequestID'
GO
