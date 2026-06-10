USE [parvaneh]
GO

/****** Object:  Table [dbo].[CompanyDocuments]    Script Date: 10/21/2025 1:30:00 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[CompanyDocuments](
	[DocID] [bigint] IDENTITY(1,1) NOT NULL,
	[NationalId] [nvarchar](100) NOT NULL,
	[LookupDocTypeId] [int] NOT NULL,
	[FileContent] [varbinary](max) NOT NULL,
	[MimeType] [nvarchar](100) NOT NULL,
	[SizeBytes] [int] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[DocID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

ALTER TABLE [dbo].[CompanyDocuments] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO

ALTER TABLE [dbo].[CompanyDocuments]  WITH CHECK ADD FOREIGN KEY([NationalId])
REFERENCES [dbo].[CompanyInfo] ([NationalId])
GO
