-- Migration: Add RequestID column to OnlinePayment and OfflinePayment tables
-- This links payments to specific vehicle requests

USE [parvaneh]
GO

-- Add RequestID to OnlinePayment table
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE Name = N'RequestID' 
    AND Object_ID = Object_ID(N'OnlinePayment')
)
BEGIN
    ALTER TABLE [dbo].[OnlinePayment] 
    ADD [RequestID] [bigint] NULL;
    
    PRINT 'Added RequestID column to OnlinePayment table';
END
ELSE
BEGIN
    PRINT 'RequestID column already exists in OnlinePayment table';
END
GO

-- Add RequestID to OfflinePayment table
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE Name = N'RequestID' 
    AND Object_ID = Object_ID(N'OfflinePayment')
)
BEGIN
    ALTER TABLE [dbo].[OfflinePayment] 
    ADD [RequestID] [bigint] NULL;
    
    PRINT 'Added RequestID column to OfflinePayment table';
END
ELSE
BEGIN
    PRINT 'RequestID column already exists in OfflinePayment table';
END
GO

-- Add foreign key constraint for OnlinePayment.RequestID
IF NOT EXISTS (
    SELECT * FROM sys.foreign_keys 
    WHERE name = 'FK_OnlinePayment_VehicleRequests'
)
BEGIN
    ALTER TABLE [dbo].[OnlinePayment]
    ADD CONSTRAINT [FK_OnlinePayment_VehicleRequests] 
    FOREIGN KEY ([RequestID]) 
    REFERENCES [dbo].[VehicleRequests]([RequestID]);
    
    PRINT 'Added foreign key constraint FK_OnlinePayment_VehicleRequests';
END
ELSE
BEGIN
    PRINT 'Foreign key FK_OnlinePayment_VehicleRequests already exists';
END
GO

-- Add foreign key constraint for OfflinePayment.RequestID
IF NOT EXISTS (
    SELECT * FROM sys.foreign_keys 
    WHERE name = 'FK_OfflinePayment_VehicleRequests'
)
BEGIN
    ALTER TABLE [dbo].[OfflinePayment]
    ADD CONSTRAINT [FK_OfflinePayment_VehicleRequests] 
    FOREIGN KEY ([RequestID]) 
    REFERENCES [dbo].[VehicleRequests]([RequestID]);
    
    PRINT 'Added foreign key constraint FK_OfflinePayment_VehicleRequests';
END
ELSE
BEGIN
    PRINT 'Foreign key FK_OfflinePayment_VehicleRequests already exists';
END
GO

-- Create index on OnlinePayment.RequestID for better query performance
IF NOT EXISTS (
    SELECT * FROM sys.indexes 
    WHERE name = 'IX_OnlinePayment_RequestID' 
    AND object_id = OBJECT_ID('OnlinePayment')
)
BEGIN
    CREATE INDEX [IX_OnlinePayment_RequestID] 
    ON [dbo].[OnlinePayment]([RequestID]);
    
    PRINT 'Created index IX_OnlinePayment_RequestID';
END
ELSE
BEGIN
    PRINT 'Index IX_OnlinePayment_RequestID already exists';
END
GO

-- Create index on OfflinePayment.RequestID for better query performance
IF NOT EXISTS (
    SELECT * FROM sys.indexes 
    WHERE name = 'IX_OfflinePayment_RequestID' 
    AND object_id = OBJECT_ID('OfflinePayment')
)
BEGIN
    CREATE INDEX [IX_OfflinePayment_RequestID] 
    ON [dbo].[OfflinePayment]([RequestID]);
    
    PRINT 'Created index IX_OfflinePayment_RequestID';
END
ELSE
BEGIN
    PRINT 'Index IX_OfflinePayment_RequestID already exists';
END
GO

-- Optional: Update existing records to link them to requests based on TrackingNo
-- This will populate RequestID for existing payment records

-- Update OnlinePayment records
UPDATE op
SET op.RequestID = vr.RequestID
FROM [dbo].[OnlinePayment] op
INNER JOIN [dbo].[VehicleRequests] vr ON vr.TrackingNo = op.TrackingNo
WHERE op.RequestID IS NULL;

PRINT 'Updated existing OnlinePayment records with RequestID';
GO

-- Update OfflinePayment records
UPDATE ofp
SET ofp.RequestID = vr.RequestID
FROM [dbo].[OfflinePayment] ofp
INNER JOIN [dbo].[VehicleRequests] vr ON vr.TrackingNo = ofp.TrackingNo
WHERE ofp.RequestID IS NULL;

PRINT 'Updated existing OfflinePayment records with RequestID';
GO

PRINT 'Migration completed successfully!';
GO
