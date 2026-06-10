-- Workflow system for VehicleRequests approval process
-- This manages the کارتابل (inbox/workflow) system

-- RequestWorkflowSteps: Tracks approval steps for each VehicleRequest
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RequestWorkflowSteps')
BEGIN
  CREATE TABLE RequestWorkflowSteps (
    Id BIGINT IDENTITY(1,1) PRIMARY KEY,
    RequestID BIGINT NOT NULL,
    StepOrder INT NOT NULL,
    RoleName NVARCHAR(50) NOT NULL,
    AssignedUserId INT NULL, -- Specific user assigned (optional, can be any user with the role)
    Status NVARCHAR(20) NOT NULL DEFAULT 'Pending', -- Pending | Approved | Rejected | Skipped
    Decision NVARCHAR(20) NULL, -- Approved | Rejected
    Notes NVARCHAR(MAX) NULL,
    DecidedByUserId INT NULL,
    DecidedAt DATETIME2 NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    FOREIGN KEY (RequestID) REFERENCES VehicleRequests(RequestID) ON DELETE CASCADE,
    FOREIGN KEY (AssignedUserId) REFERENCES Users(Id),
    FOREIGN KEY (DecidedByUserId) REFERENCES Users(Id)
  );
  CREATE INDEX IX_RequestWorkflowSteps_RequestID ON RequestWorkflowSteps(RequestID);
  CREATE INDEX IX_RequestWorkflowSteps_Status ON RequestWorkflowSteps(Status);
  CREATE INDEX IX_RequestWorkflowSteps_AssignedUserId ON RequestWorkflowSteps(AssignedUserId);
END;
GO

-- RequestProcessHistory: Complete audit trail of all actions on a request
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RequestProcessHistory')
BEGIN
  CREATE TABLE RequestProcessHistory (
    Id BIGINT IDENTITY(1,1) PRIMARY KEY,
    RequestID BIGINT NOT NULL,
    ActionType NVARCHAR(50) NOT NULL, -- Created | Assigned | Approved | Rejected | Commented | StatusChanged | Forwarded
    ActionByUserId INT NULL,
    ActionByUserName NVARCHAR(150) NULL,
    ActionByRole NVARCHAR(50) NULL,
    FromStatus NVARCHAR(50) NULL,
    ToStatus NVARCHAR(50) NULL,
    StepOrder INT NULL,
    Notes NVARCHAR(MAX) NULL,
    Metadata NVARCHAR(MAX) NULL, -- JSON for additional context
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    FOREIGN KEY (RequestID) REFERENCES VehicleRequests(RequestID) ON DELETE CASCADE,
    FOREIGN KEY (ActionByUserId) REFERENCES Users(Id)
  );
  CREATE INDEX IX_RequestProcessHistory_RequestID ON RequestProcessHistory(RequestID);
  CREATE INDEX IX_RequestProcessHistory_ActionType ON RequestProcessHistory(ActionType);
  CREATE INDEX IX_RequestProcessHistory_CreatedAt ON RequestProcessHistory(CreatedAt);
END;
GO

-- RolePermissions: Define what data each role can access
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RolePermissions')
BEGIN
  CREATE TABLE RolePermissions (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    RoleName NVARCHAR(50) NOT NULL,
    PermissionKey NVARCHAR(100) NOT NULL, -- e.g., 'view_person_info', 'view_vehicle_info', 'view_discounts', 'view_payments'
    CanView BIT NOT NULL DEFAULT 1,
    CanEdit BIT NOT NULL DEFAULT 0,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UNIQUE (RoleName, PermissionKey)
  );
  CREATE INDEX IX_RolePermissions_RoleName ON RolePermissions(RoleName);
END;
GO

-- Add Status and CurrentStepOrder to VehicleRequests if not exists
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'VehicleRequests')
BEGIN
  IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name = N'Status' AND Object_ID = Object_ID(N'VehicleRequests'))
  BEGIN
    ALTER TABLE VehicleRequests ADD Status NVARCHAR(50) NOT NULL DEFAULT 'Pending';
  END;
  
  IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name = N'CurrentStepOrder' AND Object_ID = Object_ID(N'VehicleRequests'))
  BEGIN
    ALTER TABLE VehicleRequests ADD CurrentStepOrder INT NULL;
  END;
  
  IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name = N'SubmittedByUserId' AND Object_ID = Object_ID(N'VehicleRequests'))
  BEGIN
    ALTER TABLE VehicleRequests ADD SubmittedByUserId INT NULL;
  END;
  
  IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name = N'CompletedAt' AND Object_ID = Object_ID(N'VehicleRequests'))
  BEGIN
    ALTER TABLE VehicleRequests ADD CompletedAt DATETIME2 NULL;
  END;
END;
GO

-- Seed default role permissions
-- Admin: Full access
IF NOT EXISTS (SELECT 1 FROM RolePermissions WHERE RoleName = 'Admin' AND PermissionKey = 'view_person_info')
BEGIN
  INSERT INTO RolePermissions (RoleName, PermissionKey, CanView, CanEdit) VALUES
  ('Admin', 'view_person_info', 1, 1),
  ('Admin', 'view_person_documents', 1, 1),
  ('Admin', 'view_vehicle_info', 1, 1),
  ('Admin', 'view_vehicle_documents', 1, 1),
  ('Admin', 'view_discounts', 1, 1),
  ('Admin', 'view_discount_documents', 1, 1),
  ('Admin', 'view_payments', 1, 1),
  ('Admin', 'view_payment_documents', 1, 1),
  ('Admin', 'approve_request', 1, 0),
  ('Admin', 'reject_request', 1, 0),
  ('Admin', 'forward_request', 1, 0);
END;
GO

-- Finance: Only discount and payment access
IF NOT EXISTS (SELECT 1 FROM RolePermissions WHERE RoleName = 'Finance' AND PermissionKey = 'view_discounts')
BEGIN
  INSERT INTO RolePermissions (RoleName, PermissionKey, CanView, CanEdit) VALUES
  ('Finance', 'view_discounts', 1, 0),
  ('Finance', 'view_discount_documents', 1, 0),
  ('Finance', 'view_payments', 1, 1),
  ('Finance', 'view_payment_documents', 1, 0),
  ('Finance', 'approve_request', 1, 0),
  ('Finance', 'reject_request', 1, 0);
END;
GO

-- Officer: Can view most info but limited edit
IF NOT EXISTS (SELECT 1 FROM RolePermissions WHERE RoleName = 'Officer' AND PermissionKey = 'view_person_info')
BEGIN
  INSERT INTO RolePermissions (RoleName, PermissionKey, CanView, CanEdit) VALUES
  ('Officer', 'view_person_info', 1, 0),
  ('Officer', 'view_person_documents', 1, 0),
  ('Officer', 'view_vehicle_info', 1, 0),
  ('Officer', 'view_vehicle_documents', 1, 0),
  ('Officer', 'view_discounts', 1, 0),
  ('Officer', 'view_discount_documents', 1, 0),
  ('Officer', 'view_payments', 1, 0),
  ('Officer', 'approve_request', 1, 0),
  ('Officer', 'reject_request', 1, 0);
END;
GO

-- Add Finance role if not exists
IF NOT EXISTS (SELECT 1 FROM Roles WHERE Name = 'Finance')
BEGIN
  INSERT INTO Roles (Name) VALUES ('Finance');
END;
GO
