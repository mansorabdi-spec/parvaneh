USE [parvaneh]
GO

-- Drop existing table if it exists
IF OBJECT_ID('dbo.EmploymentDiscountDocuments', 'U') IS NOT NULL
    DROP TABLE [dbo].[EmploymentDiscountDocuments];
GO

-- Create EmploymentDiscountDocuments table with structure similar to VehicleDiscountDocuments
CREATE TABLE [dbo].[EmploymentDiscountDocuments](
	[DocID] [bigint] IDENTITY(1,1) NOT NULL,
	[NationalCode] [nvarchar](20) NOT NULL,
	[LookupDocTypeId] [int] NOT NULL,
	[Description] [nvarchar](1000) NULL,
	[FileContent] [varbinary](max) NOT NULL,
	[MimeType] [nvarchar](100) NOT NULL,
	[SizeBytes] [int] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[RequestID] [bigint] NULL,
PRIMARY KEY CLUSTERED 
(
	[DocID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

-- Add default constraint for CreatedAt
ALTER TABLE [dbo].[EmploymentDiscountDocuments] ADD DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO

-- Add foreign key constraint to Persons table
ALTER TABLE [dbo].[EmploymentDiscountDocuments] WITH CHECK ADD CONSTRAINT [FK_EmploymentDiscountDocs_Person] FOREIGN KEY([NationalCode])
REFERENCES [dbo].[Persons] ([NationalCode])
GO

ALTER TABLE [dbo].[EmploymentDiscountDocuments] CHECK CONSTRAINT [FK_EmploymentDiscountDocs_Person]
GO

-- Add foreign key constraint to EmploymentRequests table (if it exists)
IF OBJECT_ID('dbo.EmploymentRequests', 'U') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[EmploymentDiscountDocuments] WITH CHECK ADD CONSTRAINT [FK_EmploymentDiscountDocs_Request] FOREIGN KEY([RequestID])
    REFERENCES [dbo].[EmploymentRequests] ([RequestID]);
    
    ALTER TABLE [dbo].[EmploymentDiscountDocuments] CHECK CONSTRAINT [FK_EmploymentDiscountDocs_Request];
END
GO

PRINT 'EmploymentDiscountDocuments table created successfully with structure similar to VehicleDiscountDocuments'
GO
