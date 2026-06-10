USE [parvaneh]
GO

-- Add LicenseTypeId and OperationTypeId columns to VehicleRequests table

-- Step 1: Add the columns as nullable first
ALTER TABLE [dbo].[VehicleRequests]
ADD [LicenseTypeId] [int] NULL,
    [OperationTypeId] [int] NULL;
GO

-- Step 2: Update existing rows with default values
-- You may need to adjust these default values based on your LookupValue table
-- For Employment: LicenseTypeId = 67, OperationTypeId = 43
-- For Exploitation: LicenseTypeId = 68, OperationTypeId = 44

-- Update existing records with Employment license type (default)
UPDATE [dbo].[VehicleRequests]
SET [LicenseTypeId] = 67,
    [OperationTypeId] = 43
WHERE [LicenseTypeId] IS NULL;
GO

-- Step 3: Make the columns NOT NULL now that they have values
ALTER TABLE [dbo].[VehicleRequests]
ALTER COLUMN [LicenseTypeId] [int] NOT NULL;
GO

ALTER TABLE [dbo].[VehicleRequests]
ALTER COLUMN [OperationTypeId] [int] NOT NULL;
GO

-- Step 4: Add foreign key constraints
ALTER TABLE [dbo].[VehicleRequests]  
WITH CHECK ADD CONSTRAINT [FK_VehicleRequests_LicenseType] 
FOREIGN KEY([LicenseTypeId])
REFERENCES [dbo].[LookupValue] ([Id]);
GO

ALTER TABLE [dbo].[VehicleRequests] 
CHECK CONSTRAINT [FK_VehicleRequests_LicenseType];
GO

ALTER TABLE [dbo].[VehicleRequests]  
WITH CHECK ADD CONSTRAINT [FK_VehicleRequests_OperationType] 
FOREIGN KEY([OperationTypeId])
REFERENCES [dbo].[LookupValue] ([Id]);
GO

ALTER TABLE [dbo].[VehicleRequests] 
CHECK CONSTRAINT [FK_VehicleRequests_OperationType];
GO

PRINT 'Successfully added LicenseTypeId and OperationTypeId columns to VehicleRequests table';
