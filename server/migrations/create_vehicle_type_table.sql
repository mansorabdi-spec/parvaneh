-- Create VehicleType table (parent of Systemtype)
-- This table will store vehicle type categories (e.g., سواری، باری، مسافربری، etc.)

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[VehicleType]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[VehicleType](
        [ID] [int] IDENTITY(1,1) NOT NULL,
        [VehicleTypeName] [nvarchar](100) NOT NULL,
        [ID_User] [int] NULL,
        [CreatedAt] [datetime] NULL DEFAULT GETDATE(),
        [UpdatedAt] [datetime] NULL,
     CONSTRAINT [PK_VehicleType] PRIMARY KEY CLUSTERED 
    (
        [ID] ASC
    )WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
    ) ON [PRIMARY]
END
GO

-- Add VehicleTypeID column to Systemtype table if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Systemtype]') AND name = 'VehicleTypeID')
BEGIN
    ALTER TABLE [dbo].[Systemtype]
    ADD [VehicleTypeID] [int] NULL
END
GO

-- Add foreign key constraint from Systemtype to VehicleType
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE object_id = OBJECT_ID(N'[dbo].[FK_Systemtype_VehicleType]') AND parent_object_id = OBJECT_ID(N'[dbo].[Systemtype]'))
BEGIN
    ALTER TABLE [dbo].[Systemtype] WITH CHECK 
    ADD CONSTRAINT [FK_Systemtype_VehicleType] FOREIGN KEY([VehicleTypeID])
    REFERENCES [dbo].[VehicleType] ([ID])
    ON DELETE CASCADE
END
GO

ALTER TABLE [dbo].[Systemtype] CHECK CONSTRAINT [FK_Systemtype_VehicleType]
GO

-- Insert sample vehicle types (customize as needed)
IF NOT EXISTS (SELECT 1 FROM [dbo].[VehicleType])
BEGIN
    INSERT INTO [dbo].[VehicleType] ([VehicleTypeName], [ID_User])
    VALUES 
        (N'سواری', NULL),
        (N'باری', NULL),
        (N'مسافربری', NULL),
        (N'کشاورزی', NULL),
        (N'موتورسیکلت', NULL),
        (N'ویژه', NULL)
END
GO

-- Update existing Systemtype records to link to appropriate VehicleType
-- This is a placeholder - you should update this based on your actual data
-- Example: UPDATE Systemtype SET VehicleTypeID = 2 WHERE systemname LIKE '%کامیون%'
-- You need to manually categorize your existing system types

PRINT 'VehicleType table created successfully. Please update existing Systemtype records with appropriate VehicleTypeID values.'
GO
