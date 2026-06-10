-- Create Systemtype and Tiptype tables with constraints
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Systemtype]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[Systemtype](
    [ID] INT IDENTITY(1,1) NOT NULL,
    [systemname] NVARCHAR(100) NOT NULL,
    [ID_User] INT NULL,
    CONSTRAINT [PK_tblSystemType] PRIMARY KEY CLUSTERED ([ID] ASC)
  );
  CREATE UNIQUE INDEX [unique_value_constraint] ON [dbo].[Systemtype]([systemname]);
END
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Tiptype]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[Tiptype](
    [ID] INT IDENTITY(1,1) NOT NULL,
    [tipname] NVARCHAR(100) NULL,
    [SystemtypeID] INT NOT NULL,
    [ID_User] INT NULL,
    CONSTRAINT [PK_tblBrigadeType] PRIMARY KEY CLUSTERED ([ID] ASC),
    CONSTRAINT [FK_Tiptype_Systemtype] FOREIGN KEY([SystemtypeID]) REFERENCES [dbo].[Systemtype] ([ID]) ON DELETE CASCADE
  );
  CREATE UNIQUE INDEX [unique_tipname_systemtypeid] ON [dbo].[Tiptype]([tipname],[SystemtypeID]);
END
GO

-- Optional seed
IF NOT EXISTS (SELECT 1 FROM dbo.Systemtype WHERE systemname = N'تویوتا')
  INSERT INTO dbo.Systemtype(systemname) VALUES (N'تویوتا');
IF NOT EXISTS (SELECT 1 FROM dbo.Systemtype WHERE systemname = N'بنز')
  INSERT INTO dbo.Systemtype(systemname) VALUES (N'بنز');
IF NOT EXISTS (SELECT 1 FROM dbo.Systemtype WHERE systemname = N'شورلت')
  INSERT INTO dbo.Systemtype(systemname) VALUES (N'شورلت');
IF NOT EXISTS (SELECT 1 FROM dbo.Systemtype WHERE systemname = N'فراری')
  INSERT INTO dbo.Systemtype(systemname) VALUES (N'فراری');
IF NOT EXISTS (SELECT 1 FROM dbo.Systemtype WHERE systemname = N'نیسان')
  INSERT INTO dbo.Systemtype(systemname) VALUES (N'نیسان');

DECLARE @ToyotaId INT = (SELECT TOP 1 ID FROM dbo.Systemtype WHERE systemname=N'تویوتا');
IF @ToyotaId IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM dbo.Tiptype WHERE SystemtypeID=@ToyotaId AND tipname=N'هایس')
    INSERT INTO dbo.Tiptype(tipname,SystemtypeID) VALUES (N'هایس', @ToyotaId);
  IF NOT EXISTS (SELECT 1 FROM dbo.Tiptype WHERE SystemtypeID=@ToyotaId AND tipname=N'1800')
    INSERT INTO dbo.Tiptype(tipname,SystemtypeID) VALUES (N'1800', @ToyotaId);
END
GO
