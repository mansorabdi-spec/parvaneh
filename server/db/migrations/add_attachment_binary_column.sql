-- Add AttachmentBinary column to OfflinePayment table to store image data
-- This allows storing the actual image file in the database instead of just a URL

USE parvaneh;
GO

-- Check if column exists before adding
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'dbo.OfflinePayment') 
    AND name = 'AttachmentBinary'
)
BEGIN
    ALTER TABLE OfflinePayment
    ADD AttachmentBinary VARBINARY(MAX) NULL;
    
    PRINT 'AttachmentBinary column added successfully';
END
ELSE
BEGIN
    PRINT 'AttachmentBinary column already exists';
END
GO

-- Add AttachmentFileName column to store the original filename
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'dbo.OfflinePayment') 
    AND name = 'AttachmentFileName'
)
BEGIN
    ALTER TABLE OfflinePayment
    ADD AttachmentFileName NVARCHAR(255) NULL;
    
    PRINT 'AttachmentFileName column added successfully';
END
ELSE
BEGIN
    PRINT 'AttachmentFileName column already exists';
END
GO

-- Add AttachmentContentType column to store the MIME type
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'dbo.OfflinePayment') 
    AND name = 'AttachmentContentType'
)
BEGIN
    ALTER TABLE OfflinePayment
    ADD AttachmentContentType NVARCHAR(100) NULL;
    
    PRINT 'AttachmentContentType column added successfully';
END
ELSE
BEGIN
    PRINT 'AttachmentContentType column already exists';
END
GO

PRINT 'Migration completed successfully';
