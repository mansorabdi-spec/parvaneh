-- =============================================
-- Migration: Add RequestID to VehicleDiscountDocuments and VehicleLabel
-- Date: 2025-10-09
-- Purpose: Link discount documents and vehicle labels to specific requests
-- =============================================

USE [parvaneh]
GO

PRINT '========================================='
PRINT 'Starting migration: Add RequestID columns'
PRINT '========================================='
GO

-- =============================================
-- 1. Add RequestID to VehicleDiscountDocuments
-- =============================================

IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[VehicleDiscountDocuments]') 
    AND name = 'RequestID'
)
BEGIN
    PRINT 'Adding RequestID column to VehicleDiscountDocuments...'
    
    ALTER TABLE [dbo].[VehicleDiscountDocuments]
    ADD RequestID BIGINT NULL
    
    PRINT '✓ RequestID column added to VehicleDiscountDocuments'
END
ELSE
BEGIN
    PRINT '⚠ RequestID column already exists in VehicleDiscountDocuments'
END
GO

-- Add foreign key constraint
IF NOT EXISTS (
    SELECT * FROM sys.foreign_keys 
    WHERE name = 'FK_VehicleDiscountDocuments_Request'
)
BEGIN
    ALTER TABLE [dbo].[VehicleDiscountDocuments]
    ADD CONSTRAINT FK_VehicleDiscountDocuments_Request 
    FOREIGN KEY (RequestID) REFERENCES [dbo].[VehicleRequests](RequestID)
    
    PRINT '✓ Foreign key constraint added to VehicleDiscountDocuments'
END
GO

-- Update existing records
UPDATE vdd
SET vdd.RequestID = (
    SELECT TOP 1 vr.RequestID
    FROM VehicleRequests vr
    WHERE vr.VehicleID = vdd.VehicleID
    ORDER BY vr.CreatedAt DESC
)
FROM VehicleDiscountDocuments vdd
WHERE vdd.RequestID IS NULL

PRINT '✓ Existing VehicleDiscountDocuments records updated with RequestID'
GO

-- =============================================
-- 2. Add RequestID to VehicleLabel
-- =============================================

IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[VehicleLabel]') 
    AND name = 'RequestID'
)
BEGIN
    PRINT 'Adding RequestID column to VehicleLabel...'
    
    ALTER TABLE [dbo].[VehicleLabel]
    ADD RequestID BIGINT NULL
    
    PRINT '✓ RequestID column added to VehicleLabel'
END
ELSE
BEGIN
    PRINT '⚠ RequestID column already exists in VehicleLabel'
END
GO

-- Add foreign key constraint
IF NOT EXISTS (
    SELECT * FROM sys.foreign_keys 
    WHERE name = 'FK_VehicleLabel_Request'
)
BEGIN
    ALTER TABLE [dbo].[VehicleLabel]
    ADD CONSTRAINT FK_VehicleLabel_Request 
    FOREIGN KEY (RequestID) REFERENCES [dbo].[VehicleRequests](RequestID)
    
    PRINT '✓ Foreign key constraint added to VehicleLabel'
END
GO

-- Update existing records
UPDATE vl
SET vl.RequestID = (
    SELECT TOP 1 vr.RequestID
    FROM VehicleRequests vr
    WHERE vr.VehicleID = vl.VehicleID
    ORDER BY vr.CreatedAt DESC
)
FROM VehicleLabel vl
WHERE vl.RequestID IS NULL

PRINT '✓ Existing VehicleLabel records updated with RequestID'
GO

-- =============================================
-- 3. Create indexes for performance
-- =============================================

IF NOT EXISTS (
    SELECT * FROM sys.indexes 
    WHERE name = 'IX_VehicleDiscountDocuments_RequestID' 
    AND object_id = OBJECT_ID('VehicleDiscountDocuments')
)
BEGIN
    CREATE INDEX IX_VehicleDiscountDocuments_RequestID 
    ON VehicleDiscountDocuments(RequestID)
    
    PRINT '✓ Index created on VehicleDiscountDocuments.RequestID'
END
GO

IF NOT EXISTS (
    SELECT * FROM sys.indexes 
    WHERE name = 'IX_VehicleLabel_RequestID' 
    AND object_id = OBJECT_ID('VehicleLabel')
)
BEGIN
    CREATE INDEX IX_VehicleLabel_RequestID 
    ON VehicleLabel(RequestID)
    
    PRINT '✓ Index created on VehicleLabel.RequestID'
END
GO

PRINT '========================================='
PRINT 'Migration completed successfully!'
PRINT 'Tables updated:'
PRINT '  - VehicleDiscountDocuments: RequestID added'
PRINT '  - VehicleLabel: RequestID added'
PRINT '========================================='
GO

-- =============================================
-- Verification queries
-- =============================================

PRINT ''
PRINT 'Verification:'
PRINT '-------------'

-- Check VehicleDiscountDocuments
SELECT 
    COUNT(*) AS TotalRecords,
    COUNT(RequestID) AS RecordsWithRequestID,
    COUNT(*) - COUNT(RequestID) AS RecordsWithoutRequestID
FROM VehicleDiscountDocuments

PRINT 'VehicleDiscountDocuments: See results above'

-- Check VehicleLabel
SELECT 
    COUNT(*) AS TotalRecords,
    COUNT(RequestID) AS RecordsWithRequestID,
    COUNT(*) - COUNT(RequestID) AS RecordsWithoutRequestID
FROM VehicleLabel

PRINT 'VehicleLabel: See results above'
GO
