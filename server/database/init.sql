-- Create database objects for License Issuance
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Applicants')
BEGIN
  CREATE TABLE Applicants (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    NationalId NVARCHAR(20) NOT NULL UNIQUE,
    FirstName NVARCHAR(100) NOT NULL,
    LastName NVARCHAR(100) NOT NULL,
    Phone NVARCHAR(20) NULL,
    Email NVARCHAR(255) NULL,
    Address NVARCHAR(MAX) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Licenses')
BEGIN
  CREATE TABLE Licenses (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    ApplicantId INT NOT NULL,
    ActivityType NVARCHAR(100) NOT NULL,
    ValidFrom DATE NOT NULL,
    ValidTo DATE NOT NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'Pending', 
    Notes NVARCHAR(MAX) NULL,
    CreatedByUserId INT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    FOREIGN KEY (ApplicantId) REFERENCES Applicants(Id)
  );
END;

-- Add CreatedByUserId to Licenses if it doesn't exist (for ownership filtering)
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Licenses')
AND NOT EXISTS (
  SELECT * FROM sys.columns WHERE Name = N'CreatedByUserId' AND Object_ID = Object_ID(N'Licenses')
)
BEGIN
  ALTER TABLE Licenses ADD CreatedByUserId INT NULL;
END;

-- Add FK to Users if column exists and FK not present
IF EXISTS (SELECT * FROM sys.columns WHERE Name = N'CreatedByUserId' AND Object_ID = Object_ID(N'Licenses'))
AND NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Licenses_CreatedByUserId_Users'
)
BEGIN
  ALTER TABLE Licenses ADD CONSTRAINT FK_Licenses_CreatedByUserId_Users FOREIGN KEY (CreatedByUserId) REFERENCES Users(Id);
END;
