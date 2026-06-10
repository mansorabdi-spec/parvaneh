-- Add discount approval workflow fields to VehicleRequests table
-- This enables the workflow where discount documents must be approved before payment

-- Step 1: Add DiscountStatus column
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('VehicleRequests') 
    AND name = 'DiscountStatus'
)
BEGIN
    ALTER TABLE VehicleRequests
    ADD DiscountStatus NVARCHAR(20) NULL;
    
    PRINT 'DiscountStatus column added to VehicleRequests table';
END
ELSE
BEGIN
    PRINT 'DiscountStatus column already exists';
END
GO

-- Step 1b: Set default value for existing records
UPDATE VehicleRequests SET DiscountStatus = 'None' WHERE DiscountStatus IS NULL;
PRINT 'Existing records updated with DiscountStatus = None';
GO

-- Step 2: Add OriginalAmount column (amount before discount)
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('VehicleRequests') 
    AND name = 'OriginalAmount'
)
BEGIN
    ALTER TABLE VehicleRequests
    ADD OriginalAmount DECIMAL(18,2) NULL;
    
    PRINT 'OriginalAmount column added to VehicleRequests table';
END
ELSE
BEGIN
    PRINT 'OriginalAmount column already exists';
END
GO

-- Step 3: Add DiscountAmount column (calculated discount amount)
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('VehicleRequests') 
    AND name = 'DiscountAmount'
)
BEGIN
    ALTER TABLE VehicleRequests
    ADD DiscountAmount DECIMAL(18,2) NULL DEFAULT 0;
    
    PRINT 'DiscountAmount column added to VehicleRequests table';
END
ELSE
BEGIN
    PRINT 'DiscountAmount column already exists';
END
GO

-- Step 4: Add FinalAmount column (amount after discount)
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('VehicleRequests') 
    AND name = 'FinalAmount'
)
BEGIN
    ALTER TABLE VehicleRequests
    ADD FinalAmount DECIMAL(18,2) NULL;
    
    PRINT 'FinalAmount column added to VehicleRequests table';
END
ELSE
BEGIN
    PRINT 'FinalAmount column already exists';
END
GO

-- Step 5: Add DiscountApprovedBy column (user who approved/rejected discount)
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('VehicleRequests') 
    AND name = 'DiscountApprovedBy'
)
BEGIN
    ALTER TABLE VehicleRequests
    ADD DiscountApprovedBy INT NULL;
    
    PRINT 'DiscountApprovedBy column added to VehicleRequests table';
    
    -- Add foreign key to Users table
    ALTER TABLE VehicleRequests
    ADD CONSTRAINT FK_VehicleRequests_DiscountApprovedBy 
    FOREIGN KEY (DiscountApprovedBy) REFERENCES Users(Id);
    
    PRINT 'Foreign key constraint added for DiscountApprovedBy';
END
ELSE
BEGIN
    PRINT 'DiscountApprovedBy column already exists';
END
GO

-- Step 6: Add DiscountApprovedAt column (timestamp of approval/rejection)
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('VehicleRequests') 
    AND name = 'DiscountApprovedAt'
)
BEGIN
    ALTER TABLE VehicleRequests
    ADD DiscountApprovedAt DATETIME2 NULL;
    
    PRINT 'DiscountApprovedAt column added to VehicleRequests table';
END
ELSE
BEGIN
    PRINT 'DiscountApprovedAt column already exists';
END
GO

-- Step 7: Add DiscountNotes column (notes from specialist about discount decision)
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('VehicleRequests') 
    AND name = 'DiscountNotes'
)
BEGIN
    ALTER TABLE VehicleRequests
    ADD DiscountNotes NVARCHAR(1000) NULL;
    
    PRINT 'DiscountNotes column added to VehicleRequests table';
END
ELSE
BEGIN
    PRINT 'DiscountNotes column already exists';
END
GO

-- Step 8: Add check constraint for DiscountStatus
IF NOT EXISTS (
    SELECT * FROM sys.check_constraints 
    WHERE name = 'CK_VehicleRequests_DiscountStatus'
)
BEGIN
    ALTER TABLE VehicleRequests
    ADD CONSTRAINT CK_VehicleRequests_DiscountStatus 
    CHECK (DiscountStatus IN ('None', 'Pending', 'Approved', 'Rejected'));
    
    PRINT 'Check constraint added for DiscountStatus';
END
ELSE
BEGIN
    PRINT 'Check constraint for DiscountStatus already exists';
END
GO

PRINT 'Discount approval workflow migration completed successfully';
GO
