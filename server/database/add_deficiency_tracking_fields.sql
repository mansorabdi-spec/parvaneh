-- =============================================
-- Add Deficiency Tracking Fields to VehicleRequests
-- =============================================
-- This adds fields to track when a request is sent for deficiency fix
-- and which step it should return to after editing
-- =============================================

USE [parvaneh]
GO

-- Add DeficiencySenderStepOrder column if it doesn't exist
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_NAME = 'VehicleRequests' 
               AND COLUMN_NAME = 'DeficiencySenderStepOrder')
BEGIN
    ALTER TABLE [dbo].[VehicleRequests]
    ADD [DeficiencySenderStepOrder] [int] NULL
    
    PRINT 'Added DeficiencySenderStepOrder column to VehicleRequests'
END
ELSE
BEGIN
    PRINT 'DeficiencySenderStepOrder column already exists'
END
GO

-- Add DeficiencySenderUserId column if it doesn't exist
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_NAME = 'VehicleRequests' 
               AND COLUMN_NAME = 'DeficiencySenderUserId')
BEGIN
    ALTER TABLE [dbo].[VehicleRequests]
    ADD [DeficiencySenderUserId] [int] NULL
    
    PRINT 'Added DeficiencySenderUserId column to VehicleRequests'
END
ELSE
BEGIN
    PRINT 'DeficiencySenderUserId column already exists'
END
GO

-- Add HasDeficiency flag column if it doesn't exist
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_NAME = 'VehicleRequests' 
               AND COLUMN_NAME = 'HasDeficiency')
BEGIN
    ALTER TABLE [dbo].[VehicleRequests]
    ADD [HasDeficiency] [bit] NOT NULL DEFAULT 0
    
    PRINT 'Added HasDeficiency column to VehicleRequests'
END
ELSE
BEGIN
    PRINT 'HasDeficiency column already exists'
END
GO

PRINT 'Deficiency tracking fields setup complete'
GO
