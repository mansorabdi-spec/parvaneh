-- Vehicles and VehicleDrafts DDL

IF OBJECT_ID('dbo.Vehicles','U') IS NULL
BEGIN
  CREATE TABLE dbo.Vehicles (
      VehicleID            BIGINT IDENTITY(1,1) PRIMARY KEY,
      VIN                  NVARCHAR(50) NOT NULL,
      ChassisNo            NVARCHAR(50) NOT NULL,
      VehicleKindId        INT          NOT NULL,
      SystemId             INT          NOT NULL,
      SystemTipId          INT          NOT NULL,
      YearManufacture      INT          NOT NULL,
      Capacity             NVARCHAR(50) NOT NULL,
      FuelTypeId           INT          NOT NULL,
      TrackerTypeId        INT          NOT NULL,
      Cylinders            INT          NOT NULL,
      Axles                INT          NOT NULL,
      EngineNo             NVARCHAR(50) NOT NULL,
      BodyColor            NVARCHAR(50) NOT NULL,
      ActivityCategoryId   INT          NOT NULL,
      IsContainer          BIT          NOT NULL,
      PlateTypeId          INT          NOT NULL,
      PlateSerial2         CHAR(2)      NOT NULL,
      PlateThreeDigits     CHAR(3)      NOT NULL,
      PlateLetter          NCHAR(3)     NOT NULL,
      PlateRegion2         CHAR(2)      NOT NULL,
      -- Registrar info: which person (by national code) registered the vehicle info
      RegistrarNationalCode NVARCHAR(20) NULL,
      RegistrarNationality  NVARCHAR(10) NULL, -- ایران | سایر
      InspectionDateJalali   NVARCHAR(10) NOT NULL,
      GreenCardDateJalali    NVARCHAR(10) NOT NULL,
      InsuranceCompanyId     INT          NOT NULL,
      InsurancePolicyNo      NVARCHAR(50) NOT NULL,
      InsuranceIssueDateJalali NVARCHAR(10) NOT NULL,
      InsuranceValidDateJalali NVARCHAR(10) NOT NULL,
      TechInspectSerial       NVARCHAR(50) NOT NULL,
      TechInspectIssueDateJalali NVARCHAR(10) NOT NULL,
      TechInspectValidDateJalali NVARCHAR(10) NOT NULL,
      CreatedAt            DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME(),
      CreatedByUserId      BIGINT       NULL,
      ModifiedAt           DATETIME2    NULL,
      ModifiedByUserId     BIGINT       NULL,
      CONSTRAINT UQ_Vehicles_VIN UNIQUE (VIN),
      CONSTRAINT UQ_Vehicles_Chassis UNIQUE (ChassisNo)
  );
END
GO

-- Draft table removed as per new workflow (insert/update directly on Next)

-- Migrations for existing tables: add registrar columns if missing
IF OBJECT_ID('dbo.Vehicles','U') IS NOT NULL
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE Name = N'RegistrarNationalCode' AND Object_ID = Object_ID(N'dbo.Vehicles')
  )
  BEGIN
    ALTER TABLE dbo.Vehicles ADD RegistrarNationalCode NVARCHAR(20) NULL;
  END;

-- VehicleRequests stores final submissions with a tracking number
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'VehicleRequests')
BEGIN
  CREATE TABLE VehicleRequests (
    RequestID BIGINT IDENTITY(1,1) PRIMARY KEY,
    VehicleID BIGINT NOT NULL,
    FinalDescription NVARCHAR(2000) NULL,
    TrackingNo NVARCHAR(30) NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    FOREIGN KEY (VehicleID) REFERENCES Vehicles(VehicleID)
  );
  CREATE UNIQUE INDEX UQ_VehicleRequests_TrackingNo ON VehicleRequests (TrackingNo);
  CREATE INDEX IX_VehicleRequests_VehicleID ON VehicleRequests (VehicleID);
END;

-- VehicleDiscountDocuments stores discount-related attachments per vehicle with an optional description
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'VehicleDiscountDocuments')
BEGIN
  CREATE TABLE VehicleDiscountDocuments (
    DocID BIGINT IDENTITY(1,1) PRIMARY KEY,
    VehicleID BIGINT NOT NULL,
    LookupDocTypeId INT NOT NULL, -- FK to Lookups.Values for category 'DiscountDocuments'
    Description NVARCHAR(1000) NULL,
    FileContent VARBINARY(MAX) NOT NULL,
    MimeType NVARCHAR(100) NOT NULL,
    SizeBytes INT NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    FOREIGN KEY (VehicleID) REFERENCES Vehicles(VehicleID)
  );
  CREATE INDEX IX_VehDiscDocs_VehicleID ON VehicleDiscountDocuments (VehicleID);
  CREATE INDEX IX_VehDiscDocs_Type ON VehicleDiscountDocuments (LookupDocTypeId);
END;

-- VehicleDocuments stores uploaded document images per vehicle
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'VehicleDocuments')
BEGIN
  CREATE TABLE VehicleDocuments (
    DocID BIGINT IDENTITY(1,1) PRIMARY KEY,
    VehicleID BIGINT NOT NULL,
    LookupDocTypeId INT NOT NULL, -- FK to Lookups.Values for category 'VehicleDocuments'
    FileContent VARBINARY(MAX) NOT NULL,
    MimeType NVARCHAR(100) NOT NULL,
    SizeBytes INT NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    FOREIGN KEY (VehicleID) REFERENCES Vehicles(VehicleID)
  );
  CREATE INDEX IX_VehicleDocuments_VehicleID ON VehicleDocuments (VehicleID);
  CREATE INDEX IX_VehicleDocuments_Type ON VehicleDocuments (LookupDocTypeId);
END
ELSE
BEGIN
  IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name = N'FileContent' AND Object_ID = Object_ID(N'VehicleDocuments'))
    ALTER TABLE VehicleDocuments ADD FileContent VARBINARY(MAX) NULL;
END;
  IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE Name = N'RegistrarNationality' AND Object_ID = Object_ID(N'dbo.Vehicles')
  )
  BEGIN
    ALTER TABLE dbo.Vehicles ADD RegistrarNationality NVARCHAR(10) NULL;
  END;
END;
