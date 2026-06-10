-- =============================================
-- Create LicenseCancellationRequests Table
-- =============================================
-- This table stores license cancellation requests from users
-- =============================================

USE [parvaneh]
GO

-- Create the LicenseCancellationRequests table
CREATE TABLE [dbo].[LicenseCancellationRequests](
	[CancellationID] [bigint] IDENTITY(1,1) NOT NULL,
	[RequestID] [bigint] NOT NULL,
	[VehicleID] [bigint] NOT NULL,
	[SubmittedByUserId] [int] NOT NULL,
	[Reason] [nvarchar](2000) NULL,
	[AttachmentFile] [varbinary](max) NULL,
	[AttachmentFileName] [nvarchar](255) NULL,
	[AttachmentMimeType] [nvarchar](100) NULL,
	[AttachmentSize] [int] NULL,
	[Status] [nvarchar](50) NOT NULL DEFAULT 'Pending',
	[ReviewedBy] [int] NULL,
	[ReviewedAt] [datetime2](7) NULL,
	[ReviewNotes] [nvarchar](1000) NULL,
	[CreatedAt] [datetime2](7) NOT NULL DEFAULT GETDATE(),
	[CancelledAt] [datetime2](7) NULL,
 CONSTRAINT [PK_LicenseCancellationRequests] PRIMARY KEY CLUSTERED 
(
	[CancellationID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

-- Add foreign key constraints
ALTER TABLE [dbo].[LicenseCancellationRequests]  WITH CHECK ADD  CONSTRAINT [FK_LicenseCancellationRequests_VehicleRequests] FOREIGN KEY([RequestID])
REFERENCES [dbo].[VehicleRequests] ([RequestID])
GO

ALTER TABLE [dbo].[LicenseCancellationRequests] CHECK CONSTRAINT [FK_LicenseCancellationRequests_VehicleRequests]
GO

ALTER TABLE [dbo].[LicenseCancellationRequests]  WITH CHECK ADD  CONSTRAINT [FK_LicenseCancellationRequests_Vehicles] FOREIGN KEY([VehicleID])
REFERENCES [dbo].[Vehicles] ([VehicleID])
GO

ALTER TABLE [dbo].[LicenseCancellationRequests] CHECK CONSTRAINT [FK_LicenseCancellationRequests_Vehicles]
GO

ALTER TABLE [dbo].[LicenseCancellationRequests]  WITH CHECK ADD  CONSTRAINT [FK_LicenseCancellationRequests_Users] FOREIGN KEY([SubmittedByUserId])
REFERENCES [dbo].[Users] ([Id])
GO

ALTER TABLE [dbo].[LicenseCancellationRequests] CHECK CONSTRAINT [FK_LicenseCancellationRequests_Users]
GO

-- Create index on RequestID for faster lookups
CREATE NONCLUSTERED INDEX [IX_LicenseCancellationRequests_RequestID] ON [dbo].[LicenseCancellationRequests]
(
	[RequestID] ASC
)
GO

-- Create index on VehicleID for faster lookups
CREATE NONCLUSTERED INDEX [IX_LicenseCancellationRequests_VehicleID] ON [dbo].[LicenseCancellationRequests]
(
	[VehicleID] ASC
)
GO

-- Create index on SubmittedByUserId for faster lookups
CREATE NONCLUSTERED INDEX [IX_LicenseCancellationRequests_SubmittedByUserId] ON [dbo].[LicenseCancellationRequests]
(
	[SubmittedByUserId] ASC
)
GO

PRINT 'LicenseCancellationRequests table created successfully!'
GO
