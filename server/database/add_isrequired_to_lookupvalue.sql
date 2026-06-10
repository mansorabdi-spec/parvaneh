-- Add IsRequired column to LookupValue table for document types
-- This allows marking documents as required (ضروری) or optional (غیر ضروری)

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- Check if the column already exists before adding it
IF NOT EXISTS (
    SELECT 1 
    FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[LookupValue]') 
    AND name = 'IsRequired'
)
BEGIN
    ALTER TABLE [dbo].[LookupValue]
    ADD [IsRequired] BIT NULL DEFAULT(0);
    
    PRINT 'Column IsRequired added to LookupValue table successfully.';
END
ELSE
BEGIN
    PRINT 'Column IsRequired already exists in LookupValue table.';
END
GO

-- Update existing document types to be optional by default
UPDATE [dbo].[LookupValue]
SET [IsRequired] = 0
WHERE [IsRequired] IS NULL
AND [CategoryId] IN (
    SELECT [Id] 
    FROM [dbo].[LookupCategory] 
    WHERE [Key] IN ('VehicleDocuments', 'PersonalDocuments', 'CompanyDocuments')
);

PRINT 'Existing document types set to optional (IsRequired = 0) by default.';
GO
