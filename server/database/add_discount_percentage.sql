-- Add DiscountPercentage column to LookupValue table for discount calculations
-- This allows each discount type to have an associated percentage that will be applied
-- when a user's discount request is approved

-- Step 1: Add DiscountPercentage column if it doesn't exist
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('LookupValue') 
    AND name = 'DiscountPercentage'
)
BEGIN
    ALTER TABLE LookupValue
    ADD DiscountPercentage DECIMAL(5,2) NULL;
    
    PRINT 'DiscountPercentage column added to LookupValue table';
END
ELSE
BEGIN
    PRINT 'DiscountPercentage column already exists';
END
GO

-- Step 2: Add check constraint if it doesn't exist
IF NOT EXISTS (
    SELECT * FROM sys.check_constraints 
    WHERE name = 'CK_LookupValue_DiscountPercentage'
)
BEGIN
    ALTER TABLE LookupValue
    ADD CONSTRAINT CK_LookupValue_DiscountPercentage 
    CHECK (DiscountPercentage IS NULL OR (DiscountPercentage >= 0 AND DiscountPercentage <= 100));
    
    PRINT 'Check constraint added for DiscountPercentage (0-100)';
END
ELSE
BEGIN
    PRINT 'Check constraint already exists';
END
GO

-- Example: Update existing discount types with sample percentages
-- You can modify these values as needed

-- UPDATE Lookups 
-- SET DiscountPercentage = 10.0 
-- WHERE Category = 'DiscountDocuments' AND Value = 'جانباز';

-- UPDATE Lookups 
-- SET DiscountPercentage = 15.0 
-- WHERE Category = 'DiscountDocuments' AND Value = 'ایثارگر';

-- UPDATE Lookups 
-- SET DiscountPercentage = 5.0 
-- WHERE Category = 'DiscountDocuments' AND Value = 'خانواده شهید';

PRINT 'Discount percentage migration completed successfully';
GO
