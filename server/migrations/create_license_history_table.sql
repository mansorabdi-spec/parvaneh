-- Migration: Create LicenseHistory table
-- Purpose: Track license lifecycle events (issuance, renewal, revocation)
-- Date: 2025-12-19

USE [parvaneh2]
GO

-- Create LicenseHistory table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[LicenseHistory]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[LicenseHistory](
        [HistoryID] [bigint] IDENTITY(1,1) NOT NULL,
        [RequestID] [bigint] NOT NULL,
        [TrackingNo] [nvarchar](30) NOT NULL,
        [LicenseTypeId] [int] NOT NULL,
        [LicenseTypeName] [nvarchar](200) NULL,
        [OperationTypeId] [int] NOT NULL,
        [OperationTypeName] [nvarchar](200) NULL,
        [EventType] [nvarchar](50) NOT NULL, -- 'Issued', 'Renewed', 'Revoked', 'Cancelled'
        [VehicleID] [bigint] NULL,
        [NationalCode] [nvarchar](20) NULL,
        [CompanyNationalId] [nvarchar](100) NULL,
        [IssueDate] [nvarchar](10) NOT NULL, -- Shamsi date (e.g., '1403/09/29')
        [ExpiryDate] [nvarchar](10) NOT NULL, -- Shamsi date (e.g., '1404/09/29')
        [IssueDateGregorian] [datetime2](7) NULL, -- For easier querying
        [ExpiryDateGregorian] [datetime2](7) NULL, -- For easier querying
        [ValidityDurationMonths] [int] NULL, -- Duration in months (e.g., 12)
        [Status] [nvarchar](20) NOT NULL, -- 'Active', 'Expired', 'Revoked', 'Cancelled'
        [IssuedByUserId] [int] NULL,
        [IssuedByUsername] [nvarchar](150) NULL,
        [IssuedByRole] [nvarchar](50) NULL,
        [RevokedByUserId] [int] NULL,
        [RevokedByUsername] [nvarchar](150) NULL,
        [RevokedAt] [datetime2](7) NULL,
        [RevocationReason] [nvarchar](2000) NULL,
        [Notes] [nvarchar](max) NULL,
        [Metadata] [nvarchar](max) NULL, -- JSON for additional data
        [CreatedAt] [datetime2](7) NOT NULL DEFAULT (sysutcdatetime()),
        [UpdatedAt] [datetime2](7) NULL,
        
        CONSTRAINT [PK_LicenseHistory] PRIMARY KEY CLUSTERED ([HistoryID] ASC)
            WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, 
                  ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) 
            ON [PRIMARY]
    ) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
    
    PRINT 'LicenseHistory table created successfully'
END
ELSE
BEGIN
    PRINT 'LicenseHistory table already exists'
END
GO

-- Create indexes for better query performance
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_LicenseHistory_RequestID' AND object_id = OBJECT_ID('LicenseHistory'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_LicenseHistory_RequestID] ON [dbo].[LicenseHistory]
    (
        [RequestID] ASC
    ) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, 
            DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
    
    PRINT 'Index IX_LicenseHistory_RequestID created'
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_LicenseHistory_TrackingNo' AND object_id = OBJECT_ID('LicenseHistory'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_LicenseHistory_TrackingNo] ON [dbo].[LicenseHistory]
    (
        [TrackingNo] ASC
    ) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, 
            DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
    
    PRINT 'Index IX_LicenseHistory_TrackingNo created'
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_LicenseHistory_EventType' AND object_id = OBJECT_ID('LicenseHistory'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_LicenseHistory_EventType] ON [dbo].[LicenseHistory]
    (
        [EventType] ASC
    ) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, 
            DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
    
    PRINT 'Index IX_LicenseHistory_EventType created'
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_LicenseHistory_Status' AND object_id = OBJECT_ID('LicenseHistory'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_LicenseHistory_Status] ON [dbo].[LicenseHistory]
    (
        [Status] ASC
    ) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, 
            DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
    
    PRINT 'Index IX_LicenseHistory_Status created'
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_LicenseHistory_VehicleID' AND object_id = OBJECT_ID('LicenseHistory'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_LicenseHistory_VehicleID] ON [dbo].[LicenseHistory]
    (
        [VehicleID] ASC
    ) WHERE [VehicleID] IS NOT NULL
    WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, 
          DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
    
    PRINT 'Index IX_LicenseHistory_VehicleID created'
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_LicenseHistory_NationalCode' AND object_id = OBJECT_ID('LicenseHistory'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_LicenseHistory_NationalCode] ON [dbo].[LicenseHistory]
    (
        [NationalCode] ASC
    ) WHERE [NationalCode] IS NOT NULL
    WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, 
          DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
    
    PRINT 'Index IX_LicenseHistory_NationalCode created'
END
GO

-- Add foreign key constraints
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_LicenseHistory_VehicleRequests')
BEGIN
    ALTER TABLE [dbo].[LicenseHistory] WITH CHECK ADD CONSTRAINT [FK_LicenseHistory_VehicleRequests] 
        FOREIGN KEY([RequestID])
        REFERENCES [dbo].[VehicleRequests] ([RequestID])
    
    ALTER TABLE [dbo].[LicenseHistory] CHECK CONSTRAINT [FK_LicenseHistory_VehicleRequests]
    
    PRINT 'Foreign key FK_LicenseHistory_VehicleRequests created'
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_LicenseHistory_IssuedByUser')
BEGIN
    ALTER TABLE [dbo].[LicenseHistory] WITH CHECK ADD CONSTRAINT [FK_LicenseHistory_IssuedByUser] 
        FOREIGN KEY([IssuedByUserId])
        REFERENCES [dbo].[Users] ([Id])
    
    ALTER TABLE [dbo].[LicenseHistory] CHECK CONSTRAINT [FK_LicenseHistory_IssuedByUser]
    
    PRINT 'Foreign key FK_LicenseHistory_IssuedByUser created'
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_LicenseHistory_RevokedByUser')
BEGIN
    ALTER TABLE [dbo].[LicenseHistory] WITH CHECK ADD CONSTRAINT [FK_LicenseHistory_RevokedByUser] 
        FOREIGN KEY([RevokedByUserId])
        REFERENCES [dbo].[Users] ([Id])
    
    ALTER TABLE [dbo].[LicenseHistory] CHECK CONSTRAINT [FK_LicenseHistory_RevokedByUser]
    
    PRINT 'Foreign key FK_LicenseHistory_RevokedByUser created'
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_LicenseHistory_Vehicle')
BEGIN
    ALTER TABLE [dbo].[LicenseHistory] WITH CHECK ADD CONSTRAINT [FK_LicenseHistory_Vehicle] 
        FOREIGN KEY([VehicleID])
        REFERENCES [dbo].[Vehicles] ([VehicleID])
    
    ALTER TABLE [dbo].[LicenseHistory] CHECK CONSTRAINT [FK_LicenseHistory_Vehicle]
    
    PRINT 'Foreign key FK_LicenseHistory_Vehicle created'
END
GO

-- Add check constraint for EventType
IF NOT EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_LicenseHistory_EventType')
BEGIN
    ALTER TABLE [dbo].[LicenseHistory] WITH CHECK ADD CONSTRAINT [CK_LicenseHistory_EventType] 
        CHECK ([EventType] IN ('Issued', 'Renewed', 'Revoked', 'Cancelled'))
    
    ALTER TABLE [dbo].[LicenseHistory] CHECK CONSTRAINT [CK_LicenseHistory_EventType]
    
    PRINT 'Check constraint CK_LicenseHistory_EventType created'
END
GO

-- Add check constraint for Status
IF NOT EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_LicenseHistory_Status')
BEGIN
    ALTER TABLE [dbo].[LicenseHistory] WITH CHECK ADD CONSTRAINT [CK_LicenseHistory_Status] 
        CHECK ([Status] IN ('Active', 'Expired', 'Revoked', 'Cancelled'))
    
    ALTER TABLE [dbo].[LicenseHistory] CHECK CONSTRAINT [CK_LicenseHistory_Status]
    
    PRINT 'Check constraint CK_LicenseHistory_Status created'
END
GO

PRINT 'LicenseHistory table migration completed successfully'
GO
