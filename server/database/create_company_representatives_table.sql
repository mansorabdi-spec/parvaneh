-- Create CompanyRepresentatives table to store company representative information for fuel collection
-- This table links to CompanyInfo via NationalId (company's national ID)

USE [parvaneh]
GO

-- Check if table exists and drop it if needed (for development)
IF OBJECT_ID('dbo.CompanyRepresentatives', 'U') IS NOT NULL
    DROP TABLE dbo.CompanyRepresentatives;
GO

CREATE TABLE [dbo].[CompanyRepresentatives](
    [Id] [bigint] IDENTITY(1,1) NOT NULL,
    [NationalId] [nvarchar](100) NOT NULL,  -- Foreign key to CompanyInfo.NationalId
    [RepresentativeNationalCode] [nvarchar](20) NOT NULL,  -- National code of the representative
    [BirthDate] [nvarchar](50) NULL,  -- Birth date of representative (Shamsi format)
    [PowerOfAttorneyNo] [nvarchar](100) NULL,  -- Power of attorney document number (شماره ثبت سند وکالت نامه محضری)
    [CreatedAt] [datetime2](7) NOT NULL DEFAULT GETDATE(),
    [CreatedBy] [nvarchar](100) NULL,
    [UpdatedAt] [datetime2](7) NULL,
    [UpdatedBy] [nvarchar](100) NULL,
    PRIMARY KEY CLUSTERED ([Id] ASC)
        WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, 
              ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) 
        ON [PRIMARY]
) ON [PRIMARY]
GO

-- Add foreign key constraint to CompanyInfo
ALTER TABLE [dbo].[CompanyRepresentatives]  
    WITH CHECK ADD CONSTRAINT [FK_CompanyRepresentatives_CompanyInfo] 
    FOREIGN KEY([NationalId])
    REFERENCES [dbo].[CompanyInfo] ([NationalId])
    ON DELETE CASCADE
GO

ALTER TABLE [dbo].[CompanyRepresentatives] 
    CHECK CONSTRAINT [FK_CompanyRepresentatives_CompanyInfo]
GO

-- Create index on NationalId for faster lookups
CREATE NONCLUSTERED INDEX [IX_CompanyRepresentatives_NationalId] 
    ON [dbo].[CompanyRepresentatives] ([NationalId])
GO

PRINT 'CompanyRepresentatives table created successfully'
GO
