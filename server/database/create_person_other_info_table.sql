USE [parvaneh]
GO

-- Create PersonOtherInfo table to store additional person information
CREATE TABLE [dbo].[PersonOtherInfo](
	[OtherInfoID] [bigint] IDENTITY(1,1) NOT NULL,
	[NationalCode] [nvarchar](20) NOT NULL,
	[PhysicalStatus] [nvarchar](100) NULL,
	[JobStatus] [nvarchar](100) NULL,
	[MilitaryStatus] [nvarchar](100) NULL,
	[EducationLevel] [nvarchar](100) NULL,
	[SelfSacrificeStatus] [nvarchar](100) NULL,
	[FluencyEnglish] [nvarchar](100) NULL,
	[CertificateType] [nvarchar](100) NULL,
	[ValidityPeriod] [nvarchar](50) NULL,
	[HealthCardNo] [nvarchar](50) NULL,
	[HealthCardIssueDate] [nvarchar](10) NULL,
	[HealthCardExpiryDate] [nvarchar](10) NULL,
	[DrivingLicenseNo] [nvarchar](50) NULL,
	[DrivingLicenseIssueDate] [nvarchar](10) NULL,
	[DrivingLicenseExpiryDate] [nvarchar](10) NULL,
	[InsuranceType] [nvarchar](100) NULL,
	[InsuranceStartDate] [nvarchar](10) NULL,
	[InsuranceExpiryDate] [nvarchar](10) NULL,
	[NoCriminalRecordNo] [nvarchar](50) NULL,
	[CreatedAt] [datetime2](7) NOT NULL DEFAULT (sysutcdatetime()),
	[CreatedByUserId] [bigint] NULL,
	[ModifiedAt] [datetime2](7) NULL,
	[ModifiedByUserId] [bigint] NULL,
	PRIMARY KEY CLUSTERED ([OtherInfoID] ASC),
	CONSTRAINT [UQ_PersonOtherInfo_NationalCode] UNIQUE NONCLUSTERED ([NationalCode] ASC)
) ON [PRIMARY]
GO

-- Add foreign key to Persons table
ALTER TABLE [dbo].[PersonOtherInfo]
ADD CONSTRAINT [FK_PersonOtherInfo_Persons] 
FOREIGN KEY([NationalCode])
REFERENCES [dbo].[Persons] ([NationalCode])
ON UPDATE CASCADE
ON DELETE CASCADE
GO

PRINT 'PersonOtherInfo table created successfully!'
