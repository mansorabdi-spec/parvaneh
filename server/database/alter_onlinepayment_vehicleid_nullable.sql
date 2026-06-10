-- Migration: Make VehicleID nullable in OnlinePayment table
-- Purpose: Support exploitation licenses and other requests without vehicle data
-- Date: 2025-11-03

-- Check if there are any foreign key constraints on VehicleID that need to be dropped first
-- (There shouldn't be any based on the schema provided, but this is a safety check)

-- Alter the VehicleID column to allow NULL values
ALTER TABLE [dbo].[OnlinePayment]
ALTER COLUMN [VehicleID] [bigint] NULL;

GO

-- Verify the change
SELECT 
    COLUMN_NAME,
    IS_NULLABLE,
    DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'OnlinePayment' 
  AND COLUMN_NAME = 'VehicleID';

GO

PRINT 'VehicleID column in OnlinePayment table is now nullable';
PRINT 'This allows payments for exploitation licenses without vehicle data';
