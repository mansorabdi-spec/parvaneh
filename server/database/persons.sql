-- Persons and related tables for personal info
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Persons')
BEGIN
  CREATE TABLE Persons (
    NationalCode NVARCHAR(20) NOT NULL PRIMARY KEY,
    FirstName NVARCHAR(100) NOT NULL,
    LastName NVARCHAR(100) NOT NULL,
    FatherName NVARCHAR(100) NOT NULL,
    IdSerial NVARCHAR(50) NULL,
    BirthProvinceId INT NOT NULL,
    BirthCityId INT NULL,
    BirthDateJalali NVARCHAR(10) NOT NULL,
    Gender NVARCHAR(10) NOT NULL,
    MaritalStatus NVARCHAR(20) NOT NULL,
    OtherBloodGroup NVARCHAR(10) NULL,
    OtherEducationLevel NVARCHAR(50) NULL,
    OtherPhysicalStatus NVARCHAR(50) NULL,
    OtherMilitaryStatus NVARCHAR(50) NULL,
    OtherEnglishLevel NVARCHAR(50) NULL,
    OtherVeteranStatus NVARCHAR(50) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    ModifiedAt DATETIME2 NULL
  );
END;

-- PersonDocuments stores uploaded document images per person
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PersonDocuments')
BEGIN
  CREATE TABLE PersonDocuments (
    DocID BIGINT IDENTITY(1,1) PRIMARY KEY,
    NationalCode NVARCHAR(20) NOT NULL,
    LookupDocTypeId INT NOT NULL, -- FK to Lookups.Values for category 'PersonalDocuments'
    FileContent VARBINARY(MAX) NOT NULL,
    MimeType NVARCHAR(100) NOT NULL,
    SizeBytes INT NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    FOREIGN KEY (NationalCode) REFERENCES Persons(NationalCode)
  );
  CREATE INDEX IX_PersonDocuments_NationalCode ON PersonDocuments (NationalCode);
  CREATE INDEX IX_PersonDocuments_Type ON PersonDocuments (LookupDocTypeId);
END
ELSE
BEGIN
  -- Migrations: add FileContent, drop FilePath/FileName if present
  IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name = N'FileContent' AND Object_ID = Object_ID(N'PersonDocuments'))
    ALTER TABLE PersonDocuments ADD FileContent VARBINARY(MAX) NULL;
  IF EXISTS (SELECT * FROM sys.columns WHERE Name = N'FilePath' AND Object_ID = Object_ID(N'PersonDocuments'))
    ALTER TABLE PersonDocuments DROP COLUMN FilePath;
  IF EXISTS (SELECT * FROM sys.columns WHERE Name = N'FileName' AND Object_ID = Object_ID(N'PersonDocuments'))
    ALTER TABLE PersonDocuments DROP COLUMN FileName;
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PersonResidences')
BEGIN
  CREATE TABLE PersonResidences (
    ResidenceID BIGINT IDENTITY(1,1) PRIMARY KEY,
    NationalCode NVARCHAR(20) NOT NULL,
    ProvinceId INT NULL,
    CityId INT NULL,
    MainStreet NVARCHAR(200) NULL,
    SideStreet NVARCHAR(200) NULL,
    District NVARCHAR(100) NULL,
    PostalCode NVARCHAR(20) NULL,
    Plaque NVARCHAR(50) NULL,
    Unit NVARCHAR(50) NULL,
    Address NVARCHAR(500) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    FOREIGN KEY (NationalCode) REFERENCES Persons(NationalCode)
  );
  CREATE INDEX IX_PersonResidences_NationalCode ON PersonResidences (NationalCode);
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PersonContacts')
BEGIN
  CREATE TABLE PersonContacts (
    ContactID BIGINT IDENTITY(1,1) PRIMARY KEY,
    NationalCode NVARCHAR(20) NOT NULL,
    Type NVARCHAR(20) NOT NULL, -- mobile|phone|email
    Value NVARCHAR(255) NOT NULL,
    IsActive BIT NOT NULL DEFAULT(1),
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    FOREIGN KEY (NationalCode) REFERENCES Persons(NationalCode)
  );
  CREATE INDEX IX_PersonContacts_NationalCode ON PersonContacts (NationalCode);
END;
