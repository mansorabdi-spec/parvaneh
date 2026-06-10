-- Users table for authentication and authorization
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
BEGIN
  CREATE TABLE Users (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Username NVARCHAR(50) NOT NULL UNIQUE,
    PasswordHash NVARCHAR(255) NOT NULL,
    FullName NVARCHAR(150) NOT NULL,
    Email NVARCHAR(255) NULL,
    Role NVARCHAR(20) NOT NULL DEFAULT 'User', -- Admin | Officer | User
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END;

-- Roles table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Roles')
BEGIN
  CREATE TABLE Roles (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(50) NOT NULL UNIQUE
  );
END;

-- UserRoles mapping table (many-to-many)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'UserRoles')
BEGIN
  CREATE TABLE UserRoles (
    UserId INT NOT NULL,
    RoleId INT NOT NULL,
    PRIMARY KEY (UserId, RoleId),
    FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
    FOREIGN KEY (RoleId) REFERENCES Roles(Id) ON DELETE CASCADE
  );
END;

-- Seed default roles if not present
IF NOT EXISTS (SELECT 1 FROM Roles WHERE Name = 'Admin') INSERT INTO Roles (Name) VALUES ('Admin');
IF NOT EXISTS (SELECT 1 FROM Roles WHERE Name = 'Officer') INSERT INTO Roles (Name) VALUES ('Officer');
IF NOT EXISTS (SELECT 1 FROM Roles WHERE Name = 'User') INSERT INTO Roles (Name) VALUES ('User');

-- Optional seed admin user (DISABLED by default). To enable, remove the IF 1=0 guard and set a bcrypt hash.
-- Note: PasswordHash must be a bcrypt hash created by the app. You can register via API instead of seeding.
IF 1=0
BEGIN
  INSERT INTO Users (Username, PasswordHash, FullName, Email, Role, IsActive)
  VALUES ('admin', '$2a$10$REPLACE_WITH_BCRYPT_HASH', N'مدیر سیستم', NULL, 'Admin', 1);
END;
