USE [parvaneh2]
GO
/****** Object:  Table [dbo].[Applicants]    Script Date: 12/24/2025 5:02:02 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Applicants](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[NationalId] [nvarchar](20) NOT NULL,
	[FirstName] [nvarchar](100) NOT NULL,
	[LastName] [nvarchar](100) NOT NULL,
	[Phone] [nvarchar](20) NULL,
	[Email] [nvarchar](255) NULL,
	[Address] [nvarchar](max) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[NationalId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Cities]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Cities](
	[ID] [int] IDENTITY(1,1) NOT NULL,
	[name] [nvarchar](120) NOT NULL,
	[ProvinceID] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_Cities_Province_Name] UNIQUE NONCLUSTERED 
(
	[ProvinceID] ASC,
	[name] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[CompanyAddresses]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CompanyAddresses](
	[AddressID] [bigint] IDENTITY(1,1) NOT NULL,
	[NationalId] [nvarchar](100) NOT NULL,
	[ProvinceId] [int] NULL,
	[CityId] [int] NULL,
	[MainStreet] [nvarchar](200) NULL,
	[SideStreet] [nvarchar](200) NULL,
	[District] [nvarchar](100) NULL,
	[PostalCode] [nvarchar](20) NULL,
	[Plaque] [nvarchar](50) NULL,
	[Unit] [nvarchar](50) NULL,
	[Address] [nvarchar](500) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[CreatedBy] [nvarchar](100) NULL,
	[UpdatedAt] [datetime2](7) NULL,
	[UpdatedBy] [nvarchar](100) NULL,
PRIMARY KEY CLUSTERED 
(
	[AddressID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[CompanyContacts]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CompanyContacts](
	[ContactID] [bigint] IDENTITY(1,1) NOT NULL,
	[NationalId] [nvarchar](100) NOT NULL,
	[Type] [nvarchar](20) NOT NULL,
	[Value] [nvarchar](255) NOT NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[CreatedBy] [nvarchar](100) NULL,
	[UpdatedAt] [datetime2](7) NULL,
	[UpdatedBy] [nvarchar](100) NULL,
PRIMARY KEY CLUSTERED 
(
	[ContactID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[CompanyDocuments]    Script Date: 12/24/2025 5:02:03 PM ******/
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
/****** Object:  Table [dbo].[CompanyInfo]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CompanyInfo](
	[NationalId] [nvarchar](100) NOT NULL,
	[NationalCode] [nvarchar](50) NOT NULL,
	[RegistrationNo] [nvarchar](100) NOT NULL,
	[CompanyTypeId] [int] NULL,
	[CompanyName] [nvarchar](500) NOT NULL,
	[WorkshopName] [nvarchar](500) NULL,
	[BusinessLicenseNo] [nvarchar](100) NULL,
	[EconomicCode] [nvarchar](100) NULL,
	[MainActivity] [nvarchar](500) NULL,
	[ActivityFieldId] [int] NULL,
	[TonnageRateId] [int] NULL,
	[RegistrationDate] [nvarchar](50) NULL,
	[BusinessLicenseValidFrom] [nvarchar](50) NULL,
	[BusinessLicenseValidTo] [nvarchar](50) NULL,
	[ParentCompanyId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[CreatedBy] [nvarchar](100) NULL,
	[UpdatedAt] [datetime2](7) NULL,
	[UpdatedBy] [nvarchar](100) NULL,
	[ManagerNationalCode] [nvarchar](20) NULL,
	[RegistrationCityId] [int] NULL,
	[Fromold] [bit] NULL,
PRIMARY KEY CLUSTERED 
(
	[NationalId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[CompanyRepresentatives]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CompanyRepresentatives](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[NationalId] [nvarchar](100) NOT NULL,
	[RepresentativeNationalCode] [nvarchar](20) NOT NULL,
	[BirthDate] [nvarchar](50) NULL,
	[PowerOfAttorneyNo] [nvarchar](100) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[CreatedBy] [nvarchar](100) NULL,
	[UpdatedAt] [datetime2](7) NULL,
	[UpdatedBy] [nvarchar](100) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[EmploymentDiscountDocuments]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
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
/****** Object:  Table [dbo].[EmploymentRequestProcessHistory]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[EmploymentRequestProcessHistory](
	[HistoryID] [bigint] IDENTITY(1,1) NOT NULL,
	[RequestID] [bigint] NOT NULL,
	[UserId] [int] NULL,
	[Action] [nvarchar](100) NOT NULL,
	[Notes] [nvarchar](2000) NULL,
	[CreatedAt] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[HistoryID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[EmploymentRequests]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[EmploymentRequests](
	[RequestID] [bigint] IDENTITY(1,1) NOT NULL,
	[NationalCode] [nvarchar](20) NOT NULL,
	[VehicleID] [bigint] NULL,
	[TrackingNo] [nvarchar](30) NOT NULL,
	[Status] [nvarchar](20) NOT NULL,
	[SubmittedByUserId] [int] NULL,
	[FinalDescription] [nvarchar](2000) NULL,
	[DiscountStatus] [nvarchar](20) NULL,
	[OriginalAmount] [decimal](18, 2) NULL,
	[FinalAmount] [decimal](18, 2) NULL,
	[CreatedAt] [datetime2](7) NULL,
	[UpdatedAt] [datetime2](7) NULL,
	[CompletedAt] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[RequestID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[TrackingNo] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[EmploymentRequestWorkflowSteps]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[EmploymentRequestWorkflowSteps](
	[StepID] [bigint] IDENTITY(1,1) NOT NULL,
	[RequestID] [bigint] NOT NULL,
	[StepOrder] [int] NOT NULL,
	[RoleName] [nvarchar](50) NOT NULL,
	[Status] [nvarchar](20) NOT NULL,
	[ApprovedByUserId] [int] NULL,
	[Notes] [nvarchar](2000) NULL,
	[CreatedAt] [datetime2](7) NULL,
	[UpdatedAt] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[StepID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[GlobalApprovalFlowSteps]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[GlobalApprovalFlowSteps](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[StepOrder] [int] NOT NULL,
	[RoleName] [nvarchar](50) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[LicenseType] [nvarchar](20) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[LicenseApprovals]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LicenseApprovals](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[LicenseId] [int] NOT NULL,
	[ApproverRole] [nvarchar](50) NOT NULL,
	[ApproverUserId] [int] NULL,
	[Decision] [nvarchar](10) NULL,
	[Notes] [nvarchar](max) NULL,
	[DecidedAt] [datetime2](7) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[StepOrder] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[LicenseCancellationRequests]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
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
	[Status] [nvarchar](50) NOT NULL,
	[ReviewedBy] [int] NULL,
	[ReviewedAt] [datetime2](7) NULL,
	[ReviewNotes] [nvarchar](1000) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[CancelledAt] [datetime2](7) NULL,
 CONSTRAINT [PK_LicenseCancellationRequests] PRIMARY KEY CLUSTERED 
(
	[CancellationID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[LicenseHistory]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LicenseHistory](
	[HistoryID] [bigint] IDENTITY(1,1) NOT NULL,
	[RequestID] [bigint] NOT NULL,
	[TrackingNo] [nvarchar](30) NOT NULL,
	[LicenseTypeId] [int] NOT NULL,
	[LicenseTypeName] [nvarchar](200) NULL,
	[OperationTypeId] [int] NOT NULL,
	[OperationTypeName] [nvarchar](200) NULL,
	[EventType] [nvarchar](50) NOT NULL,
	[VehicleID] [bigint] NULL,
	[NationalCode] [nvarchar](20) NULL,
	[CompanyNationalId] [nvarchar](100) NULL,
	[IssueDate] [nvarchar](10) NOT NULL,
	[ExpiryDate] [nvarchar](10) NOT NULL,
	[IssueDateGregorian] [datetime2](7) NULL,
	[ExpiryDateGregorian] [datetime2](7) NULL,
	[ValidityDurationMonths] [int] NULL,
	[Status] [nvarchar](20) NOT NULL,
	[IssuedByUserId] [int] NULL,
	[IssuedByUsername] [nvarchar](150) NULL,
	[IssuedByRole] [nvarchar](50) NULL,
	[RevokedByUserId] [int] NULL,
	[RevokedByUsername] [nvarchar](150) NULL,
	[RevokedAt] [datetime2](7) NULL,
	[RevocationReason] [nvarchar](2000) NULL,
	[Notes] [nvarchar](max) NULL,
	[Metadata] [nvarchar](max) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NULL,
 CONSTRAINT [PK_LicenseHistory] PRIMARY KEY CLUSTERED 
(
	[HistoryID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[LicensePrintLog]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LicensePrintLog](
	[PrintLogId] [bigint] IDENTITY(1,1) NOT NULL,
	[RequestID] [bigint] NOT NULL,
	[TrackingNo] [nvarchar](30) NOT NULL,
	[LicenseType] [nvarchar](50) NOT NULL,
	[PrintedByUserId] [int] NULL,
	[PrintedByUsername] [nvarchar](100) NULL,
	[PrintedAt] [datetime2](7) NOT NULL,
	[IpAddress] [nvarchar](50) NULL,
	[UserAgent] [nvarchar](500) NULL,
	[Notes] [nvarchar](max) NULL,
PRIMARY KEY CLUSTERED 
(
	[PrintLogId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Licenses]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Licenses](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ApplicantId] [int] NOT NULL,
	[ActivityType] [nvarchar](100) NOT NULL,
	[ValidFrom] [date] NOT NULL,
	[ValidTo] [date] NOT NULL,
	[Status] [nvarchar](20) NOT NULL,
	[Notes] [nvarchar](max) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[CreatedByUserId] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[LookupCategory]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LookupCategory](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Key] [nvarchar](100) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[Description] [nvarchar](500) NULL,
	[IsActive] [bit] NOT NULL,
	[SortOrder] [int] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[CreatedBy] [nvarchar](100) NULL,
	[UpdatedAt] [datetime2](7) NULL,
	[UpdatedBy] [nvarchar](100) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[Key] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[LookupValue]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LookupValue](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[CategoryId] [int] NOT NULL,
	[Code] [nvarchar](100) NULL,
	[Name] [nvarchar](200) NOT NULL,
	[NameEn] [nvarchar](200) NULL,
	[Description] [nvarchar](500) NULL,
	[ParentId] [int] NULL,
	[IsActive] [bit] NOT NULL,
	[SortOrder] [int] NOT NULL,
	[ExtraJson] [nvarchar](max) NULL,
	[ValidFrom] [date] NULL,
	[ValidTo] [date] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[CreatedBy] [nvarchar](100) NULL,
	[UpdatedAt] [datetime2](7) NULL,
	[UpdatedBy] [nvarchar](100) NULL,
	[DiscountPercentage] [decimal](5, 2) NULL,
	[IsRequired] [bit] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[OfflinePayment]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[OfflinePayment](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[VehicleID] [bigint] NULL,
	[TrackingNo] [nvarchar](30) NOT NULL,
	[Amount] [int] NOT NULL,
	[PayDate] [nvarchar](10) NOT NULL,
	[ReceiptNo] [nvarchar](50) NOT NULL,
	[Description] [nvarchar](max) NULL,
	[BankName] [nvarchar](100) NULL,
	[BranchName] [nvarchar](100) NULL,
	[AttachmentUrl] [nvarchar](500) NULL,
	[UserId] [bigint] NULL,
	[CreatedAt] [datetime2](3) NOT NULL,
	[AttachmentBinary] [varbinary](max) NULL,
	[AttachmentFileName] [nvarchar](255) NULL,
	[AttachmentContentType] [nvarchar](100) NULL,
	[RequestID] [bigint] NULL,
 CONSTRAINT [PK__OfflineP__3214EC07E9AA4A7A] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[OnlinePayment]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[OnlinePayment](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[VehicleID] [bigint] NULL,
	[TrackingNo] [nvarchar](30) NOT NULL,
	[Amount] [int] NOT NULL,
	[UserId] [bigint] NULL,
	[PayedBit] [bit] NOT NULL,
	[Description] [nvarchar](max) NULL,
	[Status] [nvarchar](50) NOT NULL,
	[GatewayRef] [nvarchar](100) NULL,
	[GatewayAuthority] [nvarchar](100) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[PaidAt] [datetime2](7) NULL,
	[RequestID] [bigint] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Pages]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Pages](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[PageKey] [nvarchar](100) NOT NULL,
	[PagePath] [nvarchar](255) NOT NULL,
	[PageTitle] [nvarchar](150) NOT NULL,
	[Description] [nvarchar](500) NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[PageKey] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PersonContacts]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PersonContacts](
	[ContactID] [bigint] IDENTITY(1,1) NOT NULL,
	[NationalCode] [nvarchar](20) NOT NULL,
	[Type] [nvarchar](20) NOT NULL,
	[Value] [nvarchar](255) NOT NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[ContactID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PersonDocuments]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PersonDocuments](
	[DocID] [bigint] IDENTITY(1,1) NOT NULL,
	[NationalCode] [nvarchar](20) NOT NULL,
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
/****** Object:  Table [dbo].[PersonOtherInfo]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
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
	[CreatedAt] [datetime2](7) NOT NULL,
	[CreatedByUserId] [bigint] NULL,
	[ModifiedAt] [datetime2](7) NULL,
	[ModifiedByUserId] [bigint] NULL,
PRIMARY KEY CLUSTERED 
(
	[OtherInfoID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_PersonOtherInfo_NationalCode] UNIQUE NONCLUSTERED 
(
	[NationalCode] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PersonResidences]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PersonResidences](
	[ResidenceID] [bigint] IDENTITY(1,1) NOT NULL,
	[NationalCode] [nvarchar](20) NOT NULL,
	[ProvinceId] [int] NULL,
	[CityId] [int] NULL,
	[MainStreet] [nvarchar](200) NULL,
	[SideStreet] [nvarchar](200) NULL,
	[District] [nvarchar](100) NULL,
	[PostalCode] [nvarchar](20) NULL,
	[Plaque] [nvarchar](50) NULL,
	[Unit] [nvarchar](50) NULL,
	[Address] [nvarchar](500) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[ResidenceID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Persons]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Persons](
	[NationalCode] [nvarchar](20) NOT NULL,
	[FirstName] [nvarchar](100) NOT NULL,
	[LastName] [nvarchar](100) NOT NULL,
	[FatherName] [nvarchar](100) NOT NULL,
	[IdSerial] [nvarchar](50) NULL,
	[BirthProvinceId] [int] NOT NULL,
	[BirthCityId] [int] NULL,
	[BirthDateJalali] [nvarchar](10) NOT NULL,
	[Gender] [nvarchar](10) NOT NULL,
	[MaritalStatus] [nvarchar](20) NOT NULL,
	[OtherBloodGroup] [nvarchar](10) NULL,
	[OtherEducationLevel] [nvarchar](50) NULL,
	[OtherPhysicalStatus] [nvarchar](50) NULL,
	[OtherMilitaryStatus] [nvarchar](50) NULL,
	[OtherEnglishLevel] [nvarchar](50) NULL,
	[OtherVeteranStatus] [nvarchar](50) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[ModifiedAt] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[NationalCode] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Provinces]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Provinces](
	[ID] [int] IDENTITY(1,1) NOT NULL,
	[name] [nvarchar](100) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[name] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RequestProcessHistory]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RequestProcessHistory](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[RequestID] [bigint] NOT NULL,
	[ActionType] [nvarchar](50) NOT NULL,
	[ActionByUserId] [int] NULL,
	[ActionByUserName] [nvarchar](150) NULL,
	[ActionByRole] [nvarchar](50) NULL,
	[FromStatus] [nvarchar](50) NULL,
	[ToStatus] [nvarchar](50) NULL,
	[StepOrder] [int] NULL,
	[Notes] [nvarchar](max) NULL,
	[Metadata] [nvarchar](max) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RequestWorkflowSteps]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RequestWorkflowSteps](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[RequestID] [bigint] NOT NULL,
	[StepOrder] [int] NOT NULL,
	[RoleName] [nvarchar](50) NOT NULL,
	[AssignedUserId] [int] NULL,
	[Status] [nvarchar](20) NOT NULL,
	[Decision] [nvarchar](20) NULL,
	[Notes] [nvarchar](max) NULL,
	[DecidedByUserId] [int] NULL,
	[DecidedAt] [datetime2](7) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RolePagePermissions]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RolePagePermissions](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[RoleId] [int] NOT NULL,
	[PageId] [int] NOT NULL,
	[CanAccess] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[RoleId] ASC,
	[PageId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RolePermissions]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RolePermissions](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[RoleName] [nvarchar](50) NOT NULL,
	[PermissionKey] [nvarchar](100) NOT NULL,
	[CanView] [bit] NOT NULL,
	[CanEdit] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[RoleName] ASC,
	[PermissionKey] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Roles]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Roles](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](50) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[Name] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SequenceCounters]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SequenceCounters](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[CounterType] [nvarchar](50) NOT NULL,
	[Prefix] [nvarchar](20) NOT NULL,
	[LastSequence] [int] NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_SequenceCounters_Type_Prefix] UNIQUE NONCLUSTERED 
(
	[CounterType] ASC,
	[Prefix] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Systemtype]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Systemtype](
	[ID] [int] IDENTITY(1,1) NOT NULL,
	[systemname] [nvarchar](100) NOT NULL,
	[ID_User] [int] NULL,
	[VehicleTypeID] [int] NULL,
 CONSTRAINT [PK_tblSystemType] PRIMARY KEY CLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Tariffs]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Tariffs](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Code]  AS ([Id]) PERSISTED NOT NULL,
	[LicenseType] [nvarchar](200) NOT NULL,
	[DocTypeId] [int] NOT NULL,
	[FromDate] [nvarchar](20) NULL,
	[ToDate] [nvarchar](20) NULL,
	[FromTon] [nvarchar](50) NULL,
	[ToTon] [nvarchar](50) NULL,
	[Amount] [int] NOT NULL,
	[Year] [nvarchar](10) NOT NULL,
	[Description] [nvarchar](500) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Tiptype]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Tiptype](
	[ID] [int] IDENTITY(1,1) NOT NULL,
	[tipname] [nvarchar](100) NULL,
	[SystemtypeID] [int] NOT NULL,
	[ID_User] [int] NULL,
 CONSTRAINT [PK_tblBrigadeType] PRIMARY KEY CLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[UserRoles]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[UserRoles](
	[UserId] [int] NOT NULL,
	[RoleId] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[UserId] ASC,
	[RoleId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Users]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Users](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[PasswordHash] [nvarchar](255) NOT NULL,
	[FullName] [nvarchar](150) NOT NULL,
	[Email] [nvarchar](255) NULL,
	[Role] [nvarchar](50) NOT NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[NationalCode] [nvarchar](10) NOT NULL,
	[FirstName] [nvarchar](100) NOT NULL,
	[LastName] [nvarchar](100) NOT NULL,
	[Mobile] [nvarchar](11) NULL,
	[ProfilePicture] [varbinary](max) NULL,
	[Fromold] [bit] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Users1]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Users1](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[PasswordHash] [nvarchar](255) NOT NULL,
	[FullName] [nvarchar](150) NOT NULL,
	[Email] [nvarchar](255) NULL,
	[Role] [nvarchar](50) NOT NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[NationalCode] [nvarchar](10) NOT NULL,
	[FirstName] [nvarchar](100) NOT NULL,
	[LastName] [nvarchar](100) NOT NULL,
	[Mobile] [nvarchar](11) NULL,
	[ProfilePicture] [varbinary](max) NULL,
	[Fromold] [bit] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[VehicleDiscountDocuments]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[VehicleDiscountDocuments](
	[DocID] [bigint] IDENTITY(1,1) NOT NULL,
	[VehicleID] [bigint] NOT NULL,
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
/****** Object:  Table [dbo].[VehicleDocuments]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[VehicleDocuments](
	[DocID] [bigint] IDENTITY(1,1) NOT NULL,
	[VehicleID] [bigint] NOT NULL,
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
/****** Object:  Table [dbo].[VehicleLabel]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[VehicleLabel](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[VehicleID] [bigint] NOT NULL,
	[LabelImage] [varbinary](max) NOT NULL,
	[ImageContentType] [nvarchar](100) NULL,
	[ImageFileName] [nvarchar](255) NULL,
	[ImageSize] [int] NULL,
	[UserID] [int] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[Notes] [nvarchar](1000) NULL,
	[RequestID] [bigint] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[VehicleRequests]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[VehicleRequests](
	[RequestID] [bigint] IDENTITY(1,1) NOT NULL,
	[VehicleID] [bigint] NULL,
	[FinalDescription] [nvarchar](2000) NULL,
	[TrackingNo] [nvarchar](30) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[Status] [nvarchar](50) NOT NULL,
	[CurrentStepOrder] [int] NULL,
	[SubmittedByUserId] [int] NULL,
	[CompletedAt] [datetime2](7) NULL,
	[OriginalAmount] [decimal](18, 2) NULL,
	[DiscountAmount] [decimal](18, 2) NULL,
	[FinalAmount] [decimal](18, 2) NULL,
	[DiscountApprovedBy] [int] NULL,
	[DiscountApprovedAt] [datetime2](7) NULL,
	[DiscountNotes] [nvarchar](1000) NULL,
	[DiscountStatus] [nvarchar](20) NULL,
	[DeficiencySenderStepOrder] [int] NULL,
	[DeficiencySenderUserId] [int] NULL,
	[HasDeficiency] [bit] NOT NULL,
	[LicenseTypeId] [int] NOT NULL,
	[OperationTypeId] [int] NOT NULL,
	[NationalCode] [nvarchar](20) NULL,
	[CompanyNationalId] [nvarchar](100) NULL,
	[TonnageFromTon] [float] NULL,
	[TonnageToTon] [float] NULL,
PRIMARY KEY CLUSTERED 
(
	[RequestID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_VehicleRequests_TrackingNo] UNIQUE NONCLUSTERED 
(
	[TrackingNo] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Vehicles]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Vehicles](
	[VehicleID] [bigint] IDENTITY(1,1) NOT NULL,
	[VIN] [nvarchar](50) NOT NULL,
	[ChassisNo] [nvarchar](50) NOT NULL,
	[VehicleKindId] [int] NOT NULL,
	[SystemId] [int] NOT NULL,
	[SystemTipId] [int] NOT NULL,
	[YearManufacture] [int] NOT NULL,
	[Capacity] [nvarchar](50) NOT NULL,
	[FuelTypeId] [int] NOT NULL,
	[TrackerTypeId] [int] NOT NULL,
	[Cylinders] [int] NOT NULL,
	[Axles] [int] NOT NULL,
	[EngineNo] [nvarchar](50) NOT NULL,
	[BodyColor] [nvarchar](50) NOT NULL,
	[ActivityCategoryId] [int] NOT NULL,
	[IsContainer] [bit] NOT NULL,
	[PlateTypeId] [int] NOT NULL,
	[PlateSerial2] [char](2) NOT NULL,
	[PlateThreeDigits] [char](3) NOT NULL,
	[PlateLetter] [nchar](3) NOT NULL,
	[PlateRegion2] [char](2) NOT NULL,
	[RegistrarNationalCode] [nvarchar](20) NULL,
	[RegistrarNationality] [nvarchar](10) NULL,
	[InspectionDateJalali] [nvarchar](10) NOT NULL,
	[GreenCardDateJalali] [nvarchar](10) NOT NULL,
	[InsuranceCompanyId] [int] NOT NULL,
	[InsurancePolicyNo] [nvarchar](50) NOT NULL,
	[InsuranceIssueDateJalali] [nvarchar](10) NOT NULL,
	[InsuranceValidDateJalali] [nvarchar](10) NOT NULL,
	[TechInspectSerial] [nvarchar](50) NOT NULL,
	[TechInspectIssueDateJalali] [nvarchar](10) NOT NULL,
	[TechInspectValidDateJalali] [nvarchar](10) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[CreatedByUserId] [bigint] NULL,
	[ModifiedAt] [datetime2](7) NULL,
	[ModifiedByUserId] [bigint] NULL,
PRIMARY KEY CLUSTERED 
(
	[VehicleID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_Vehicles_Chassis] UNIQUE NONCLUSTERED 
(
	[ChassisNo] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_Vehicles_VIN] UNIQUE NONCLUSTERED 
(
	[VIN] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[VehicleType]    Script Date: 12/24/2025 5:02:03 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[VehicleType](
	[ID] [int] IDENTITY(1,1) NOT NULL,
	[VehicleTypeName] [nvarchar](100) NOT NULL,
	[ID_User] [int] NULL,
	[CreatedAt] [datetime] NULL,
	[UpdatedAt] [datetime] NULL,
 CONSTRAINT [PK_VehicleType] PRIMARY KEY CLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
ALTER TABLE [dbo].[Applicants] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[CompanyAddresses] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[CompanyContacts] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[CompanyContacts] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[CompanyDocuments] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[CompanyInfo] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[CompanyRepresentatives] ADD  DEFAULT (getdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[EmploymentDiscountDocuments] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[EmploymentRequestProcessHistory] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[EmploymentRequests] ADD  DEFAULT ('Pending') FOR [Status]
GO
ALTER TABLE [dbo].[EmploymentRequests] ADD  DEFAULT ('None') FOR [DiscountStatus]
GO
ALTER TABLE [dbo].[EmploymentRequests] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[EmploymentRequests] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[EmploymentRequestWorkflowSteps] ADD  DEFAULT ('Pending') FOR [Status]
GO
ALTER TABLE [dbo].[EmploymentRequestWorkflowSteps] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[EmploymentRequestWorkflowSteps] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[GlobalApprovalFlowSteps] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[GlobalApprovalFlowSteps] ADD  DEFAULT ('Activity') FOR [LicenseType]
GO
ALTER TABLE [dbo].[LicenseApprovals] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[LicenseApprovals] ADD  DEFAULT ((1)) FOR [StepOrder]
GO
ALTER TABLE [dbo].[LicenseCancellationRequests] ADD  DEFAULT ('Pending') FOR [Status]
GO
ALTER TABLE [dbo].[LicenseCancellationRequests] ADD  DEFAULT (getdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[LicenseHistory] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[LicensePrintLog] ADD  DEFAULT (getdate()) FOR [PrintedAt]
GO
ALTER TABLE [dbo].[Licenses] ADD  DEFAULT ('Active') FOR [Status]
GO
ALTER TABLE [dbo].[Licenses] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[LookupCategory] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[LookupCategory] ADD  DEFAULT ((0)) FOR [SortOrder]
GO
ALTER TABLE [dbo].[LookupCategory] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[LookupValue] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[LookupValue] ADD  DEFAULT ((0)) FOR [SortOrder]
GO
ALTER TABLE [dbo].[LookupValue] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[LookupValue] ADD  DEFAULT ((0)) FOR [IsRequired]
GO
ALTER TABLE [dbo].[OfflinePayment] ADD  CONSTRAINT [DF_OfflinePayment_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[OnlinePayment] ADD  DEFAULT ((0)) FOR [PayedBit]
GO
ALTER TABLE [dbo].[OnlinePayment] ADD  DEFAULT ('Initiated') FOR [Status]
GO
ALTER TABLE [dbo].[OnlinePayment] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Pages] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Pages] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[PersonContacts] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[PersonContacts] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[PersonDocuments] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[PersonOtherInfo] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[PersonResidences] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Persons] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[RequestProcessHistory] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[RequestWorkflowSteps] ADD  DEFAULT ('Pending') FOR [Status]
GO
ALTER TABLE [dbo].[RequestWorkflowSteps] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[RolePagePermissions] ADD  DEFAULT ((1)) FOR [CanAccess]
GO
ALTER TABLE [dbo].[RolePagePermissions] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[RolePermissions] ADD  DEFAULT ((1)) FOR [CanView]
GO
ALTER TABLE [dbo].[RolePermissions] ADD  DEFAULT ((0)) FOR [CanEdit]
GO
ALTER TABLE [dbo].[RolePermissions] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[SequenceCounters] ADD  DEFAULT ((0)) FOR [LastSequence]
GO
ALTER TABLE [dbo].[SequenceCounters] ADD  DEFAULT (getutcdate()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[Tariffs] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT ('User') FOR [Role]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Users] ADD  CONSTRAINT [DF_Users_Fromold]  DEFAULT ((0)) FOR [Fromold]
GO
ALTER TABLE [dbo].[Users1] ADD  DEFAULT ('User') FOR [Role]
GO
ALTER TABLE [dbo].[Users1] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Users1] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Users1] ADD  CONSTRAINT [DF_Users1_Fromold]  DEFAULT ((0)) FOR [Fromold]
GO
ALTER TABLE [dbo].[VehicleDiscountDocuments] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[VehicleDocuments] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[VehicleLabel] ADD  DEFAULT (getdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[VehicleRequests] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[VehicleRequests] ADD  DEFAULT ('Pending') FOR [Status]
GO
ALTER TABLE [dbo].[VehicleRequests] ADD  DEFAULT ((0)) FOR [DiscountAmount]
GO
ALTER TABLE [dbo].[VehicleRequests] ADD  DEFAULT ((0)) FOR [HasDeficiency]
GO
ALTER TABLE [dbo].[Vehicles] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[VehicleType] ADD  DEFAULT (getdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Cities]  WITH CHECK ADD  CONSTRAINT [FK_Cities_Province] FOREIGN KEY([ProvinceID])
REFERENCES [dbo].[Provinces] ([ID])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[Cities] CHECK CONSTRAINT [FK_Cities_Province]
GO
ALTER TABLE [dbo].[CompanyAddresses]  WITH CHECK ADD  CONSTRAINT [FK_CompanyAddresses_CompanyInfo] FOREIGN KEY([NationalId])
REFERENCES [dbo].[CompanyInfo] ([NationalId])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[CompanyAddresses] CHECK CONSTRAINT [FK_CompanyAddresses_CompanyInfo]
GO
ALTER TABLE [dbo].[CompanyContacts]  WITH CHECK ADD  CONSTRAINT [FK_CompanyContacts_CompanyInfo] FOREIGN KEY([NationalId])
REFERENCES [dbo].[CompanyInfo] ([NationalId])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[CompanyContacts] CHECK CONSTRAINT [FK_CompanyContacts_CompanyInfo]
GO
ALTER TABLE [dbo].[CompanyDocuments]  WITH CHECK ADD FOREIGN KEY([NationalId])
REFERENCES [dbo].[CompanyInfo] ([NationalId])
GO
ALTER TABLE [dbo].[CompanyInfo]  WITH CHECK ADD  CONSTRAINT [FK_CompanyInfo_ActivityField] FOREIGN KEY([ActivityFieldId])
REFERENCES [dbo].[LookupValue] ([Id])
GO
ALTER TABLE [dbo].[CompanyInfo] CHECK CONSTRAINT [FK_CompanyInfo_ActivityField]
GO
ALTER TABLE [dbo].[CompanyInfo]  WITH CHECK ADD  CONSTRAINT [FK_CompanyInfo_CompanyType] FOREIGN KEY([CompanyTypeId])
REFERENCES [dbo].[LookupValue] ([Id])
GO
ALTER TABLE [dbo].[CompanyInfo] CHECK CONSTRAINT [FK_CompanyInfo_CompanyType]
GO
ALTER TABLE [dbo].[CompanyInfo]  WITH CHECK ADD  CONSTRAINT [FK_CompanyInfo_RegistrationCity] FOREIGN KEY([RegistrationCityId])
REFERENCES [dbo].[Cities] ([ID])
GO
ALTER TABLE [dbo].[CompanyInfo] CHECK CONSTRAINT [FK_CompanyInfo_RegistrationCity]
GO
ALTER TABLE [dbo].[CompanyInfo]  WITH CHECK ADD  CONSTRAINT [FK_CompanyInfo_TonnageRate] FOREIGN KEY([TonnageRateId])
REFERENCES [dbo].[LookupValue] ([Id])
GO
ALTER TABLE [dbo].[CompanyInfo] CHECK CONSTRAINT [FK_CompanyInfo_TonnageRate]
GO
ALTER TABLE [dbo].[CompanyRepresentatives]  WITH CHECK ADD  CONSTRAINT [FK_CompanyRepresentatives_CompanyInfo] FOREIGN KEY([NationalId])
REFERENCES [dbo].[CompanyInfo] ([NationalId])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[CompanyRepresentatives] CHECK CONSTRAINT [FK_CompanyRepresentatives_CompanyInfo]
GO
ALTER TABLE [dbo].[EmploymentDiscountDocuments]  WITH CHECK ADD  CONSTRAINT [FK_EmploymentDiscountDocs_Person] FOREIGN KEY([NationalCode])
REFERENCES [dbo].[Persons] ([NationalCode])
GO
ALTER TABLE [dbo].[EmploymentDiscountDocuments] CHECK CONSTRAINT [FK_EmploymentDiscountDocs_Person]
GO
ALTER TABLE [dbo].[EmploymentDiscountDocuments]  WITH CHECK ADD  CONSTRAINT [FK_EmploymentDiscountDocs_VehicleRequests] FOREIGN KEY([RequestID])
REFERENCES [dbo].[VehicleRequests] ([RequestID])
GO
ALTER TABLE [dbo].[EmploymentDiscountDocuments] CHECK CONSTRAINT [FK_EmploymentDiscountDocs_VehicleRequests]
GO
ALTER TABLE [dbo].[EmploymentRequestProcessHistory]  WITH CHECK ADD  CONSTRAINT [FK_EmploymentProcessHistory_Request] FOREIGN KEY([RequestID])
REFERENCES [dbo].[EmploymentRequests] ([RequestID])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[EmploymentRequestProcessHistory] CHECK CONSTRAINT [FK_EmploymentProcessHistory_Request]
GO
ALTER TABLE [dbo].[EmploymentRequestProcessHistory]  WITH CHECK ADD  CONSTRAINT [FK_EmploymentProcessHistory_User] FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[EmploymentRequestProcessHistory] CHECK CONSTRAINT [FK_EmploymentProcessHistory_User]
GO
ALTER TABLE [dbo].[EmploymentRequests]  WITH CHECK ADD  CONSTRAINT [FK_EmploymentRequests_Person] FOREIGN KEY([NationalCode])
REFERENCES [dbo].[Persons] ([NationalCode])
GO
ALTER TABLE [dbo].[EmploymentRequests] CHECK CONSTRAINT [FK_EmploymentRequests_Person]
GO
ALTER TABLE [dbo].[EmploymentRequests]  WITH CHECK ADD  CONSTRAINT [FK_EmploymentRequests_User] FOREIGN KEY([SubmittedByUserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[EmploymentRequests] CHECK CONSTRAINT [FK_EmploymentRequests_User]
GO
ALTER TABLE [dbo].[EmploymentRequests]  WITH CHECK ADD  CONSTRAINT [FK_EmploymentRequests_Vehicle] FOREIGN KEY([VehicleID])
REFERENCES [dbo].[Vehicles] ([VehicleID])
GO
ALTER TABLE [dbo].[EmploymentRequests] CHECK CONSTRAINT [FK_EmploymentRequests_Vehicle]
GO
ALTER TABLE [dbo].[EmploymentRequestWorkflowSteps]  WITH CHECK ADD  CONSTRAINT [FK_EmploymentWorkflowSteps_Request] FOREIGN KEY([RequestID])
REFERENCES [dbo].[EmploymentRequests] ([RequestID])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[EmploymentRequestWorkflowSteps] CHECK CONSTRAINT [FK_EmploymentWorkflowSteps_Request]
GO
ALTER TABLE [dbo].[EmploymentRequestWorkflowSteps]  WITH CHECK ADD  CONSTRAINT [FK_EmploymentWorkflowSteps_User] FOREIGN KEY([ApprovedByUserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[EmploymentRequestWorkflowSteps] CHECK CONSTRAINT [FK_EmploymentWorkflowSteps_User]
GO
ALTER TABLE [dbo].[LicenseApprovals]  WITH NOCHECK ADD FOREIGN KEY([ApproverUserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[LicenseApprovals]  WITH NOCHECK ADD FOREIGN KEY([LicenseId])
REFERENCES [dbo].[Licenses] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[LicenseCancellationRequests]  WITH CHECK ADD  CONSTRAINT [FK_LicenseCancellationRequests_Users] FOREIGN KEY([SubmittedByUserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[LicenseCancellationRequests] CHECK CONSTRAINT [FK_LicenseCancellationRequests_Users]
GO
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
ALTER TABLE [dbo].[LicenseHistory]  WITH CHECK ADD  CONSTRAINT [FK_LicenseHistory_IssuedByUser] FOREIGN KEY([IssuedByUserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[LicenseHistory] CHECK CONSTRAINT [FK_LicenseHistory_IssuedByUser]
GO
ALTER TABLE [dbo].[LicenseHistory]  WITH CHECK ADD  CONSTRAINT [FK_LicenseHistory_RevokedByUser] FOREIGN KEY([RevokedByUserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[LicenseHistory] CHECK CONSTRAINT [FK_LicenseHistory_RevokedByUser]
GO
ALTER TABLE [dbo].[LicenseHistory]  WITH CHECK ADD  CONSTRAINT [FK_LicenseHistory_Vehicle] FOREIGN KEY([VehicleID])
REFERENCES [dbo].[Vehicles] ([VehicleID])
GO
ALTER TABLE [dbo].[LicenseHistory] CHECK CONSTRAINT [FK_LicenseHistory_Vehicle]
GO
ALTER TABLE [dbo].[LicenseHistory]  WITH CHECK ADD  CONSTRAINT [FK_LicenseHistory_VehicleRequests] FOREIGN KEY([RequestID])
REFERENCES [dbo].[VehicleRequests] ([RequestID])
GO
ALTER TABLE [dbo].[LicenseHistory] CHECK CONSTRAINT [FK_LicenseHistory_VehicleRequests]
GO
ALTER TABLE [dbo].[LicensePrintLog]  WITH CHECK ADD  CONSTRAINT [FK_LicensePrintLog_Request] FOREIGN KEY([RequestID])
REFERENCES [dbo].[VehicleRequests] ([RequestID])
GO
ALTER TABLE [dbo].[LicensePrintLog] CHECK CONSTRAINT [FK_LicensePrintLog_Request]
GO
ALTER TABLE [dbo].[LicensePrintLog]  WITH CHECK ADD  CONSTRAINT [FK_LicensePrintLog_User] FOREIGN KEY([PrintedByUserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[LicensePrintLog] CHECK CONSTRAINT [FK_LicensePrintLog_User]
GO
ALTER TABLE [dbo].[Licenses]  WITH CHECK ADD FOREIGN KEY([ApplicantId])
REFERENCES [dbo].[Applicants] ([Id])
GO
ALTER TABLE [dbo].[Licenses]  WITH CHECK ADD  CONSTRAINT [FK_Licenses_CreatedByUserId_Users] FOREIGN KEY([CreatedByUserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[Licenses] CHECK CONSTRAINT [FK_Licenses_CreatedByUserId_Users]
GO
ALTER TABLE [dbo].[LookupValue]  WITH CHECK ADD  CONSTRAINT [FK_LookupValue_Category] FOREIGN KEY([CategoryId])
REFERENCES [dbo].[LookupCategory] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[LookupValue] CHECK CONSTRAINT [FK_LookupValue_Category]
GO
ALTER TABLE [dbo].[LookupValue]  WITH CHECK ADD  CONSTRAINT [FK_LookupValue_Parent] FOREIGN KEY([ParentId])
REFERENCES [dbo].[LookupValue] ([Id])
GO
ALTER TABLE [dbo].[LookupValue] CHECK CONSTRAINT [FK_LookupValue_Parent]
GO
ALTER TABLE [dbo].[OfflinePayment]  WITH CHECK ADD  CONSTRAINT [FK_OfflinePayment_VehicleRequests] FOREIGN KEY([RequestID])
REFERENCES [dbo].[VehicleRequests] ([RequestID])
GO
ALTER TABLE [dbo].[OfflinePayment] CHECK CONSTRAINT [FK_OfflinePayment_VehicleRequests]
GO
ALTER TABLE [dbo].[OnlinePayment]  WITH CHECK ADD  CONSTRAINT [FK_OnlinePayment_VehicleRequests] FOREIGN KEY([RequestID])
REFERENCES [dbo].[VehicleRequests] ([RequestID])
GO
ALTER TABLE [dbo].[OnlinePayment] CHECK CONSTRAINT [FK_OnlinePayment_VehicleRequests]
GO
ALTER TABLE [dbo].[PersonContacts]  WITH CHECK ADD FOREIGN KEY([NationalCode])
REFERENCES [dbo].[Persons] ([NationalCode])
GO
ALTER TABLE [dbo].[PersonDocuments]  WITH CHECK ADD FOREIGN KEY([NationalCode])
REFERENCES [dbo].[Persons] ([NationalCode])
GO
ALTER TABLE [dbo].[PersonOtherInfo]  WITH CHECK ADD  CONSTRAINT [FK_PersonOtherInfo_Persons] FOREIGN KEY([NationalCode])
REFERENCES [dbo].[Persons] ([NationalCode])
ON UPDATE CASCADE
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[PersonOtherInfo] CHECK CONSTRAINT [FK_PersonOtherInfo_Persons]
GO
ALTER TABLE [dbo].[PersonResidences]  WITH CHECK ADD FOREIGN KEY([NationalCode])
REFERENCES [dbo].[Persons] ([NationalCode])
GO
ALTER TABLE [dbo].[RequestProcessHistory]  WITH CHECK ADD FOREIGN KEY([ActionByUserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[RequestProcessHistory]  WITH CHECK ADD FOREIGN KEY([RequestID])
REFERENCES [dbo].[VehicleRequests] ([RequestID])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[RequestWorkflowSteps]  WITH CHECK ADD FOREIGN KEY([AssignedUserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[RequestWorkflowSteps]  WITH CHECK ADD FOREIGN KEY([DecidedByUserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[RequestWorkflowSteps]  WITH CHECK ADD FOREIGN KEY([RequestID])
REFERENCES [dbo].[VehicleRequests] ([RequestID])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[RolePagePermissions]  WITH CHECK ADD FOREIGN KEY([PageId])
REFERENCES [dbo].[Pages] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[RolePagePermissions]  WITH CHECK ADD FOREIGN KEY([RoleId])
REFERENCES [dbo].[Roles] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[Systemtype]  WITH CHECK ADD  CONSTRAINT [FK_Systemtype_VehicleType] FOREIGN KEY([VehicleTypeID])
REFERENCES [dbo].[VehicleType] ([ID])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[Systemtype] CHECK CONSTRAINT [FK_Systemtype_VehicleType]
GO
ALTER TABLE [dbo].[Tariffs]  WITH CHECK ADD  CONSTRAINT [FK_Tariffs_DocType] FOREIGN KEY([DocTypeId])
REFERENCES [dbo].[LookupValue] ([Id])
GO
ALTER TABLE [dbo].[Tariffs] CHECK CONSTRAINT [FK_Tariffs_DocType]
GO
ALTER TABLE [dbo].[Tiptype]  WITH CHECK ADD  CONSTRAINT [FK_Tiptype_Systemtype] FOREIGN KEY([SystemtypeID])
REFERENCES [dbo].[Systemtype] ([ID])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[Tiptype] CHECK CONSTRAINT [FK_Tiptype_Systemtype]
GO
ALTER TABLE [dbo].[UserRoles]  WITH CHECK ADD FOREIGN KEY([RoleId])
REFERENCES [dbo].[Roles] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[UserRoles]  WITH CHECK ADD FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[VehicleDiscountDocuments]  WITH CHECK ADD FOREIGN KEY([VehicleID])
REFERENCES [dbo].[Vehicles] ([VehicleID])
GO
ALTER TABLE [dbo].[VehicleDiscountDocuments]  WITH CHECK ADD  CONSTRAINT [FK_VehicleDiscountDocuments_Request] FOREIGN KEY([RequestID])
REFERENCES [dbo].[VehicleRequests] ([RequestID])
GO
ALTER TABLE [dbo].[VehicleDiscountDocuments] CHECK CONSTRAINT [FK_VehicleDiscountDocuments_Request]
GO
ALTER TABLE [dbo].[VehicleDocuments]  WITH CHECK ADD FOREIGN KEY([VehicleID])
REFERENCES [dbo].[Vehicles] ([VehicleID])
GO
ALTER TABLE [dbo].[VehicleLabel]  WITH CHECK ADD  CONSTRAINT [FK_VehicleLabel_Request] FOREIGN KEY([RequestID])
REFERENCES [dbo].[VehicleRequests] ([RequestID])
GO
ALTER TABLE [dbo].[VehicleLabel] CHECK CONSTRAINT [FK_VehicleLabel_Request]
GO
ALTER TABLE [dbo].[VehicleLabel]  WITH CHECK ADD  CONSTRAINT [FK_VehicleLabel_User] FOREIGN KEY([UserID])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[VehicleLabel] CHECK CONSTRAINT [FK_VehicleLabel_User]
GO
ALTER TABLE [dbo].[VehicleLabel]  WITH CHECK ADD  CONSTRAINT [FK_VehicleLabel_Vehicle] FOREIGN KEY([VehicleID])
REFERENCES [dbo].[Vehicles] ([VehicleID])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[VehicleLabel] CHECK CONSTRAINT [FK_VehicleLabel_Vehicle]
GO
ALTER TABLE [dbo].[VehicleRequests]  WITH CHECK ADD FOREIGN KEY([VehicleID])
REFERENCES [dbo].[Vehicles] ([VehicleID])
GO
ALTER TABLE [dbo].[VehicleRequests]  WITH CHECK ADD  CONSTRAINT [FK_VehicleRequests_Company] FOREIGN KEY([CompanyNationalId])
REFERENCES [dbo].[CompanyInfo] ([NationalId])
GO
ALTER TABLE [dbo].[VehicleRequests] CHECK CONSTRAINT [FK_VehicleRequests_Company]
GO
ALTER TABLE [dbo].[VehicleRequests]  WITH CHECK ADD  CONSTRAINT [FK_VehicleRequests_DiscountApprovedBy] FOREIGN KEY([DiscountApprovedBy])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[VehicleRequests] CHECK CONSTRAINT [FK_VehicleRequests_DiscountApprovedBy]
GO
ALTER TABLE [dbo].[VehicleRequests]  WITH CHECK ADD  CONSTRAINT [FK_VehicleRequests_LicenseType] FOREIGN KEY([LicenseTypeId])
REFERENCES [dbo].[LookupValue] ([Id])
GO
ALTER TABLE [dbo].[VehicleRequests] CHECK CONSTRAINT [FK_VehicleRequests_LicenseType]
GO
ALTER TABLE [dbo].[VehicleRequests]  WITH CHECK ADD  CONSTRAINT [FK_VehicleRequests_OperationType] FOREIGN KEY([OperationTypeId])
REFERENCES [dbo].[LookupValue] ([Id])
GO
ALTER TABLE [dbo].[VehicleRequests] CHECK CONSTRAINT [FK_VehicleRequests_OperationType]
GO
ALTER TABLE [dbo].[VehicleRequests]  WITH CHECK ADD  CONSTRAINT [FK_VehicleRequests_Person] FOREIGN KEY([NationalCode])
REFERENCES [dbo].[Persons] ([NationalCode])
GO
ALTER TABLE [dbo].[VehicleRequests] CHECK CONSTRAINT [FK_VehicleRequests_Person]
GO
ALTER TABLE [dbo].[VehicleRequests]  WITH CHECK ADD  CONSTRAINT [FK_VehicleRequests_Vehicle] FOREIGN KEY([VehicleID])
REFERENCES [dbo].[Vehicles] ([VehicleID])
GO
ALTER TABLE [dbo].[VehicleRequests] CHECK CONSTRAINT [FK_VehicleRequests_Vehicle]
GO
ALTER TABLE [dbo].[GlobalApprovalFlowSteps]  WITH NOCHECK ADD  CONSTRAINT [CK_GlobalApprovalFlowSteps_LicenseType] CHECK  (([LicenseType]='Exploitation' OR [LicenseType]='Employment' OR [LicenseType]='Activity'))
GO
ALTER TABLE [dbo].[GlobalApprovalFlowSteps] CHECK CONSTRAINT [CK_GlobalApprovalFlowSteps_LicenseType]
GO
ALTER TABLE [dbo].[LicenseHistory]  WITH CHECK ADD  CONSTRAINT [CK_LicenseHistory_EventType] CHECK  (([EventType]='Cancelled' OR [EventType]='Revoked' OR [EventType]='Renewed' OR [EventType]='Issued'))
GO
ALTER TABLE [dbo].[LicenseHistory] CHECK CONSTRAINT [CK_LicenseHistory_EventType]
GO
ALTER TABLE [dbo].[LicenseHistory]  WITH CHECK ADD  CONSTRAINT [CK_LicenseHistory_Status] CHECK  (([Status]='Cancelled' OR [Status]='Revoked' OR [Status]='Expired' OR [Status]='Active'))
GO
ALTER TABLE [dbo].[LicenseHistory] CHECK CONSTRAINT [CK_LicenseHistory_Status]
GO
ALTER TABLE [dbo].[LookupValue]  WITH CHECK ADD  CONSTRAINT [CK_LookupValue_DiscountPercentage] CHECK  (([DiscountPercentage] IS NULL OR [DiscountPercentage]>=(0) AND [DiscountPercentage]<=(100)))
GO
ALTER TABLE [dbo].[LookupValue] CHECK CONSTRAINT [CK_LookupValue_DiscountPercentage]
GO
ALTER TABLE [dbo].[VehicleRequests]  WITH CHECK ADD  CONSTRAINT [CK_VehicleRequests_DiscountStatus] CHECK  (([DiscountStatus]='Rejected' OR [DiscountStatus]='Approved' OR [DiscountStatus]='Pending' OR [DiscountStatus]='None'))
GO
ALTER TABLE [dbo].[VehicleRequests] CHECK CONSTRAINT [CK_VehicleRequests_DiscountStatus]
GO
ALTER TABLE [dbo].[VehicleRequests]  WITH CHECK ADD  CONSTRAINT [CK_VehicleRequests_VehicleOrPerson] CHECK  (([VehicleID] IS NOT NULL OR [NationalCode] IS NOT NULL))
GO
ALTER TABLE [dbo].[VehicleRequests] CHECK CONSTRAINT [CK_VehicleRequests_VehicleOrPerson]
GO
