-- License approvals workflow tables
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'LicenseApprovals')
BEGIN
  CREATE TABLE LicenseApprovals (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    LicenseId INT NOT NULL,
    ApproverRole NVARCHAR(50) NOT NULL,
    StepOrder INT NOT NULL,
    ApproverUserId INT NULL,
    Decision NVARCHAR(10) NULL, -- Approved | Rejected
    Notes NVARCHAR(MAX) NULL,
    DecidedAt DATETIME2 NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    FOREIGN KEY (LicenseId) REFERENCES Licenses(Id) ON DELETE CASCADE,
    FOREIGN KEY (ApproverUserId) REFERENCES Users(Id)
  );
END;

-- Add StepOrder column if table already existed without it
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'LicenseApprovals')
AND NOT EXISTS (
  SELECT * FROM sys.columns WHERE Name = N'StepOrder' AND Object_ID = Object_ID(N'LicenseApprovals')
)
BEGIN
  ALTER TABLE LicenseApprovals ADD StepOrder INT NOT NULL DEFAULT 1;
END;

-- Global approval flow defined by Admin (ordered roles)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'GlobalApprovalFlowSteps')
BEGIN
  CREATE TABLE GlobalApprovalFlowSteps (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    StepOrder INT NOT NULL,
    RoleName NVARCHAR(50) NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END;

-- Seed default approval flow if empty: Admin -> Officer
IF NOT EXISTS (SELECT 1 FROM GlobalApprovalFlowSteps)
BEGIN
  INSERT INTO GlobalApprovalFlowSteps (StepOrder, RoleName) VALUES (1, 'Admin');
  INSERT INTO GlobalApprovalFlowSteps (StepOrder, RoleName) VALUES (2, 'Officer');
END;
