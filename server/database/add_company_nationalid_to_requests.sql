USE [parvaneh]
GO

-- Add CompanyNationalId field to VehicleRequests table
-- This allows tracking which company the request is for, separate from the person who submitted it

ALTER TABLE [dbo].[VehicleRequests]
ADD [CompanyNationalId] [nvarchar](100) NULL;
GO

-- Add foreign key constraint to CompanyInfo
ALTER TABLE [dbo].[VehicleRequests]
WITH CHECK ADD CONSTRAINT [FK_VehicleRequests_Company] 
FOREIGN KEY([CompanyNationalId])
REFERENCES [dbo].[CompanyInfo] ([NationalId]);
GO

ALTER TABLE [dbo].[VehicleRequests] 
CHECK CONSTRAINT [FK_VehicleRequests_Company];
GO

-- Create index for performance
CREATE NONCLUSTERED INDEX [IX_VehicleRequests_CompanyNationalId]
ON [dbo].[VehicleRequests] ([CompanyNationalId]);
GO

PRINT 'Successfully added CompanyNationalId field to VehicleRequests table';
GO
