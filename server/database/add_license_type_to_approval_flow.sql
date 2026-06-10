-- Add LicenseType column to GlobalApprovalFlowSteps to support separate workflows
-- for Activity Licenses and Employment Licenses

-- Add LicenseType column if it doesn't exist
IF NOT EXISTS (
  SELECT * FROM sys.columns 
  WHERE Name = N'LicenseType' AND Object_ID = Object_ID(N'GlobalApprovalFlowSteps')
)
BEGIN
  -- Add column with default value 'Activity' for existing records
  ALTER TABLE GlobalApprovalFlowSteps 
  ADD LicenseType NVARCHAR(20) NOT NULL DEFAULT 'Activity';
  
  PRINT 'LicenseType column added to GlobalApprovalFlowSteps';
END
ELSE
BEGIN
  PRINT 'LicenseType column already exists in GlobalApprovalFlowSteps';
END;

GO

-- Add constraint to ensure only valid license types
IF NOT EXISTS (
  SELECT * FROM sys.check_constraints 
  WHERE name = 'CK_GlobalApprovalFlowSteps_LicenseType'
)
BEGIN
  ALTER TABLE GlobalApprovalFlowSteps
  ADD CONSTRAINT CK_GlobalApprovalFlowSteps_LicenseType 
  CHECK (LicenseType IN ('Activity', 'Employment'));
  
  PRINT 'Check constraint added for LicenseType';
END;

GO

-- Seed default Employment License approval flow if it doesn't exist
IF NOT EXISTS (SELECT 1 FROM GlobalApprovalFlowSteps WHERE LicenseType = 'Employment')
BEGIN
  -- Default Employment License workflow: کارشناس مالی -> کارشناس صدور پروانه -> رییس اداره
  INSERT INTO GlobalApprovalFlowSteps (StepOrder, RoleName, LicenseType, CreatedAt) 
  VALUES 
    (1, N'کارشناس مالی', 'Employment', SYSUTCDATETIME()),
    (2, N'کارشناس صدور پروانه', 'Employment', SYSUTCDATETIME()),
    (3, N'رییس اداره صدور پروانه', 'Employment', SYSUTCDATETIME());
  
  PRINT 'Default Employment License approval flow created';
END;

GO

-- Verify the changes
SELECT 
  LicenseType,
  StepOrder,
  RoleName,
  CreatedAt
FROM GlobalApprovalFlowSteps
ORDER BY LicenseType, StepOrder;

PRINT 'Migration completed successfully';
