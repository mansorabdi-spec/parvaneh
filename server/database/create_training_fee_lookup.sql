-- Create lookup category and value for Operating License Training Fee
-- This is used to add training fee to exploitation license payments

-- First, check if the category exists, if not create it
IF NOT EXISTS (SELECT 1 FROM LookupCategory WHERE [Key] = 'OperatingLicenseTrainingFee')
BEGIN
    INSERT INTO LookupCategory ([Key], [Name], [Description], IsActive, SortOrder)
    VALUES ('OperatingLicenseTrainingFee', N'هزینه آموزش پروانه بهره برداری', N'مبلغ هزینه آموزش که به پروانه های بهره برداری اضافه می شود', 1, 100)
    
    PRINT 'Category OperatingLicenseTrainingFee created successfully'
END
ELSE
BEGIN
    PRINT 'Category OperatingLicenseTrainingFee already exists'
END

-- Get the category ID
DECLARE @CategoryId INT
SELECT @CategoryId = Id FROM LookupCategory WHERE [Key] = 'OperatingLicenseTrainingFee'

-- Check if a value already exists for this category
IF NOT EXISTS (SELECT 1 FROM LookupValue WHERE CategoryId = @CategoryId)
BEGIN
    -- Insert the training fee value
    -- The Code field contains the fee amount (e.g., 500000 for 500,000 Rials)
    -- You can change this amount as needed
    INSERT INTO LookupValue (CategoryId, Code, Name, NameEn, Description, IsActive, IsRequired, SortOrder)
    VALUES (@CategoryId, '500000', N'هزینه آموزش پروانه بهره برداری', 'Operating License Training Fee', N'مبلغ: 500,000 ریال', 1, 0, 1)
    
    PRINT 'Training fee value created successfully with amount: 500,000 Rials'
    PRINT 'You can update the Code field in LookupValue table to change the training fee amount'
END
ELSE
BEGIN
    PRINT 'Training fee value already exists'
    SELECT Code AS CurrentTrainingFee, Name, Description 
    FROM LookupValue 
    WHERE CategoryId = @CategoryId AND IsActive = 1
END

GO

-- Verify the lookup was created
SELECT 
    lc.[Key] AS CategoryKey,
    lc.Name AS CategoryName,
    lv.Code AS TrainingFeeAmount,
    lv.Name AS ValueName,
    lv.IsActive
FROM LookupCategory lc
LEFT JOIN LookupValue lv ON lc.Id = lv.CategoryId
WHERE lc.[Key] = 'OperatingLicenseTrainingFee'

GO
