-- Create EmploymentRequests table for Employment License (پروانه اشتغال)
-- This table is separate from VehicleRequests and handles employment license workflow

CREATE TABLE EmploymentRequests (
    RequestID BIGINT IDENTITY(1,1) PRIMARY KEY,
    NationalCode NVARCHAR(20) NOT NULL,
    VehicleID BIGINT NULL, -- Optional: link to vehicle if applicable
    TrackingNo NVARCHAR(30) NOT NULL UNIQUE,
    Status NVARCHAR(20) NOT NULL DEFAULT 'Pending', -- Pending, InProgress, Approved, Rejected, Completed
    SubmittedByUserId INT NULL,
    FinalDescription NVARCHAR(2000) NULL,
    
    -- Discount handling
    DiscountStatus NVARCHAR(20) DEFAULT 'None', -- None, Pending, Approved, Rejected
    OriginalAmount DECIMAL(18, 2) NULL,
    FinalAmount DECIMAL(18, 2) NULL,
    
    -- Timestamps
    CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
    CompletedAt DATETIME2 NULL,
    
    -- Foreign Keys
    CONSTRAINT FK_EmploymentRequests_Person FOREIGN KEY (NationalCode) REFERENCES Persons(NationalCode),
    CONSTRAINT FK_EmploymentRequests_Vehicle FOREIGN KEY (VehicleID) REFERENCES Vehicles(VehicleID),
    CONSTRAINT FK_EmploymentRequests_User FOREIGN KEY (SubmittedByUserId) REFERENCES Users(id)
);

-- Create indexes for better performance
CREATE INDEX IX_EmploymentRequests_NationalCode ON EmploymentRequests(NationalCode);
CREATE INDEX IX_EmploymentRequests_VehicleID ON EmploymentRequests(VehicleID);
CREATE INDEX IX_EmploymentRequests_TrackingNo ON EmploymentRequests(TrackingNo);
CREATE INDEX IX_EmploymentRequests_Status ON EmploymentRequests(Status);
CREATE INDEX IX_EmploymentRequests_CreatedAt ON EmploymentRequests(CreatedAt);

-- Create EmploymentRequestWorkflowSteps table for tracking approval workflow
CREATE TABLE EmploymentRequestWorkflowSteps (
    StepID BIGINT IDENTITY(1,1) PRIMARY KEY,
    RequestID BIGINT NOT NULL,
    StepOrder INT NOT NULL,
    RoleName NVARCHAR(50) NOT NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'Pending', -- Pending, Approved, Rejected
    ApprovedByUserId INT NULL,
    Notes NVARCHAR(2000) NULL,
    CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
    
    CONSTRAINT FK_EmploymentWorkflowSteps_Request FOREIGN KEY (RequestID) REFERENCES EmploymentRequests(RequestID) ON DELETE CASCADE,
    CONSTRAINT FK_EmploymentWorkflowSteps_User FOREIGN KEY (ApprovedByUserId) REFERENCES Users(id)
);

CREATE INDEX IX_EmploymentWorkflowSteps_RequestID ON EmploymentRequestWorkflowSteps(RequestID);
CREATE INDEX IX_EmploymentWorkflowSteps_Status ON EmploymentRequestWorkflowSteps(Status);

-- Create EmploymentRequestProcessHistory table for audit trail
CREATE TABLE EmploymentRequestProcessHistory (
    HistoryID BIGINT IDENTITY(1,1) PRIMARY KEY,
    RequestID BIGINT NOT NULL,
    UserId INT NULL,
    Action NVARCHAR(100) NOT NULL,
    Notes NVARCHAR(2000) NULL,
    CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
    
    CONSTRAINT FK_EmploymentProcessHistory_Request FOREIGN KEY (RequestID) REFERENCES EmploymentRequests(RequestID) ON DELETE CASCADE,
    CONSTRAINT FK_EmploymentProcessHistory_User FOREIGN KEY (UserId) REFERENCES Users(id)
);

CREATE INDEX IX_EmploymentProcessHistory_RequestID ON EmploymentRequestProcessHistory(RequestID);
CREATE INDEX IX_EmploymentProcessHistory_CreatedAt ON EmploymentRequestProcessHistory(CreatedAt);

-- Create EmploymentDiscountDocuments table (similar to VehicleDiscountDocuments)
CREATE TABLE EmploymentDiscountDocuments (
    DocID BIGINT IDENTITY(1,1) PRIMARY KEY,
    RequestID BIGINT NULL,
    NationalCode NVARCHAR(20) NOT NULL,
    DocTypeId INT NOT NULL,
    FilePath NVARCHAR(500) NOT NULL,
    FileName NVARCHAR(255) NOT NULL,
    UploadedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
    
    CONSTRAINT FK_EmploymentDiscountDocs_Request FOREIGN KEY (RequestID) REFERENCES EmploymentRequests(RequestID),
    CONSTRAINT FK_EmploymentDiscountDocs_Person FOREIGN KEY (NationalCode) REFERENCES Persons(NationalCode)
);

CREATE INDEX IX_EmploymentDiscountDocs_RequestID ON EmploymentDiscountDocuments(RequestID);
CREATE INDEX IX_EmploymentDiscountDocs_NationalCode ON EmploymentDiscountDocuments(NationalCode);

PRINT 'Employment License tables created successfully';
