-- Migration: Make VehicleID nullable in OfflinePayment table
-- Purpose: Support exploitation licenses and other requests without vehicle data
-- Date: 2025-11-03

-- Alter the VehicleID column to allow NULL values
ALTER TABLE [dbo].[OfflinePayment]
ALTER COLUMN [VehicleID] [bigint] NULL;

GO

-- Verify the change
SELECT 
    COLUMN_NAME,
    IS_NULLABLE,
    DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'OfflinePayment' 
  AND COLUMN_NAME = 'VehicleID';

GO

PRINT 'VehicleID column in OfflinePayment table is now nullable';
PRINT 'This allows payments for exploitation licenses without vehicle data';
