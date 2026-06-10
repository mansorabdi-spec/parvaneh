-- Migration: Create LicensePrintLog table to track license printing
-- This table stores information about when licenses are printed and by whom

USE [parvaneh2]
GO

-- Create LicensePrintLog table
CREATE TABLE [dbo].[LicensePrintLog](
	[PrintLogId] [bigint] IDENTITY(1,1) NOT NULL,
	[RequestID] [bigint] NOT NULL,
	[TrackingNo] [nvarchar](30) NOT NULL,
	[LicenseType] [nvarchar](50) NOT NULL, -- 'Activity', 'Exploitation', 'Employment', 'LegalEntity'
	[PrintedByUserId] [int] NULL, -- User who printed the license
	[PrintedByUsername] [nvarchar](100) NULL,
	[PrintedAt] [datetime2](7) NOT NULL DEFAULT GETDATE(),
	[IpAddress] [nvarchar](50) NULL,
	[UserAgent] [nvarchar](500) NULL,
	[Notes] [nvarchar](max) NULL,
PRIMARY KEY CLUSTERED 
(
	[PrintLogId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

-- Add foreign key constraint to VehicleRequests
ALTER TABLE [dbo].[LicensePrintLog]  WITH CHECK ADD CONSTRAINT [FK_LicensePrintLog_Request] FOREIGN KEY([RequestID])
REFERENCES [dbo].[VehicleRequests] ([RequestID])
GO

ALTER TABLE [dbo].[LicensePrintLog] CHECK CONSTRAINT [FK_LicensePrintLog_Request]
GO

-- Add foreign key constraint to Users (optional, can be NULL for anonymous prints)
ALTER TABLE [dbo].[LicensePrintLog]  WITH CHECK ADD CONSTRAINT [FK_LicensePrintLog_User] FOREIGN KEY([PrintedByUserId])
REFERENCES [dbo].[Users] ([Id])
GO

ALTER TABLE [dbo].[LicensePrintLog] CHECK CONSTRAINT [FK_LicensePrintLog_User]
GO

-- Create index on RequestID for faster lookups
CREATE NONCLUSTERED INDEX [IX_LicensePrintLog_RequestID] ON [dbo].[LicensePrintLog]
(
	[RequestID] ASC
)
GO

-- Create index on PrintedAt for date-based queries
CREATE NONCLUSTERED INDEX [IX_LicensePrintLog_PrintedAt] ON [dbo].[LicensePrintLog]
(
	[PrintedAt] DESC
)
GO

-- Create index on LicenseType for statistics
CREATE NONCLUSTERED INDEX [IX_LicensePrintLog_LicenseType] ON [dbo].[LicensePrintLog]
(
	[LicenseType] ASC
)
GO

PRINT 'LicensePrintLog table created successfully'
GO
