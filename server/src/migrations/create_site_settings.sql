-- Migration: Create SiteSettings table for storing site-wide settings like popup messages
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SiteSettings' AND xtype='U')
BEGIN
    CREATE TABLE SiteSettings (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        [Key] NVARCHAR(100) NOT NULL UNIQUE,
        [Value] NVARCHAR(MAX) NULL,
        UpdatedAt DATETIME DEFAULT GETDATE(),
        UpdatedBy NVARCHAR(200) NULL
    );

    -- Insert default popup settings
    INSERT INTO SiteSettings ([Key], [Value], UpdatedAt)
    VALUES 
        ('popup_enabled', '0', GETDATE()),
        ('popup_message', N'به سامانه صدور پروانه خوش آمدید.', GETDATE());
END
