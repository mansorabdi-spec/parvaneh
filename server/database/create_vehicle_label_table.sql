-- Create VehicleLabel table for storing vehicle label images uploaded by label attachment specialists
-- This table stores the label image as varbinary(max) along with metadata

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'VehicleLabel')
BEGIN
    CREATE TABLE VehicleLabel (
        Id BIGINT IDENTITY(1,1) PRIMARY KEY,
        VehicleID BIGINT NOT NULL,
        LabelImage VARBINARY(MAX) NOT NULL,
        ImageContentType NVARCHAR(100) NULL,
        ImageFileName NVARCHAR(255) NULL,
        ImageSize INT NULL,
        UserID INT NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        Notes NVARCHAR(1000) NULL,
        
        CONSTRAINT FK_VehicleLabel_Vehicle FOREIGN KEY (VehicleID) 
            REFERENCES Vehicles(VehicleID) ON DELETE CASCADE,
        CONSTRAINT FK_VehicleLabel_User FOREIGN KEY (UserID) 
            REFERENCES Users(Id)
    );
    
    CREATE INDEX IX_VehicleLabel_VehicleID ON VehicleLabel(VehicleID);
    CREATE INDEX IX_VehicleLabel_UserID ON VehicleLabel(UserID);
    CREATE INDEX IX_VehicleLabel_CreatedAt ON VehicleLabel(CreatedAt DESC);
    
    PRINT 'VehicleLabel table created successfully';
END
ELSE
BEGIN
    PRINT 'VehicleLabel table already exists';
END
GO
