-- Add ManagerNationalCode field to CompanyInfo table
-- This field stores the national code of the company's CEO/Manager

-- Check if column exists before adding
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'CompanyInfo' 
    AND COLUMN_NAME = 'ManagerNationalCode'
)
BEGIN
    ALTER TABLE CompanyInfo
    ADD ManagerNationalCode NVARCHAR(20) NULL;
    
    PRINT 'ManagerNationalCode column added to CompanyInfo table successfully.';
END
ELSE
BEGIN
    PRINT 'ManagerNationalCode column already exists in CompanyInfo table.';
END
GO

-- Add foreign key constraint to Persons table (optional, for data integrity)
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
    WHERE CONSTRAINT_NAME = 'FK_CompanyInfo_Manager'
)
BEGIN
    ALTER TABLE CompanyInfo
    ADD CONSTRAINT FK_CompanyInfo_Manager
    FOREIGN KEY (ManagerNationalCode) REFERENCES Persons(NationalCode);
    
    PRINT 'Foreign key constraint FK_CompanyInfo_Manager added successfully.';
END
ELSE
BEGIN
    PRINT 'Foreign key constraint FK_CompanyInfo_Manager already exists.';
END
GO
