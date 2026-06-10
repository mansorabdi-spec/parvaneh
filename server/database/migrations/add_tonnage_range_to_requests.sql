USE [parvaneh]
GO

-- =============================================
-- Migration: Add Tonnage Range Fields to VehicleRequests
-- Purpose: Store the tonnage range used for tariff calculation
-- Date: 2025-11-03
-- =============================================

PRINT '========================================='
PRINT 'Adding tonnage range fields to VehicleRequests table'
PRINT '========================================='
GO

-- Add TonnageFromTon column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.VehicleRequests') AND name = 'TonnageFromTon')
BEGIN
    ALTER TABLE [dbo].[VehicleRequests] ADD [TonnageFromTon] [float] NULL;
    PRINT '  ✓ Added TonnageFromTon column'
END
ELSE
    PRINT '  - TonnageFromTon column already exists'
GO

-- Add TonnageToTon column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.VehicleRequests') AND name = 'TonnageToTon')
BEGIN
    ALTER TABLE [dbo].[VehicleRequests] ADD [TonnageToTon] [float] NULL;
    PRINT '  ✓ Added TonnageToTon column'
END
ELSE
    PRINT '  - TonnageToTon column already exists'
GO

PRINT '========================================='
PRINT '✅ Migration completed successfully!'
PRINT '========================================='
PRINT 'VehicleRequests table now has:'
PRINT '  - TonnageFromTon: Lower bound of tonnage range'
PRINT '  - TonnageToTon: Upper bound of tonnage range'
PRINT ''
PRINT 'These fields will be used to display the tonnage range'
PRINT 'for exploitation licenses on the payment page.'
PRINT '========================================='
GO
