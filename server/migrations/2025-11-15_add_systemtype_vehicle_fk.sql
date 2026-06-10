/*
Idempotent migration: Ensure Systemtype has VehicleTypeID column, index, and FK to VehicleType(ID)
Safe to run multiple times.
*/

-- 1) Add VehicleTypeID column if missing
IF COL_LENGTH('dbo.Systemtype', 'VehicleTypeID') IS NULL
BEGIN
  PRINT 'Adding column Systemtype.VehicleTypeID';
  ALTER TABLE dbo.Systemtype
    ADD VehicleTypeID INT NULL;
END
ELSE
BEGIN
  PRINT 'Column Systemtype.VehicleTypeID already exists';
END
GO

-- 2) Create nonclustered index on VehicleTypeID if missing
IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_Systemtype_VehicleTypeID'
    AND object_id = OBJECT_ID('dbo.Systemtype')
)
BEGIN
  PRINT 'Creating index IX_Systemtype_VehicleTypeID on Systemtype(VehicleTypeID)';
  CREATE INDEX IX_Systemtype_VehicleTypeID
    ON dbo.Systemtype(VehicleTypeID);
END
ELSE
BEGIN
  PRINT 'Index IX_Systemtype_VehicleTypeID already exists';
END
GO

-- 3) Create FK to VehicleType(ID) if missing
IF NOT EXISTS (
  SELECT 1
  FROM sys.foreign_keys
  WHERE name = 'FK_Systemtype_VehicleType'
    AND parent_object_id = OBJECT_ID('dbo.Systemtype')
)
BEGIN
  PRINT 'Adding FK FK_Systemtype_VehicleType on Systemtype(VehicleTypeID) -> VehicleType(ID)';
  ALTER TABLE dbo.Systemtype WITH CHECK
    ADD CONSTRAINT FK_Systemtype_VehicleType
      FOREIGN KEY (VehicleTypeID)
      REFERENCES dbo.VehicleType(ID);
END
ELSE
BEGIN
  PRINT 'Foreign key FK_Systemtype_VehicleType already exists';
END
GO

/*
Optional hardening (commented out):
Once all rows have a valid VehicleTypeID, you may enforce NOT NULL:

-- IF NOT EXISTS (
--   SELECT 1
--   FROM dbo.Systemtype
--   WHERE VehicleTypeID IS NULL
-- )
-- BEGIN
--   PRINT 'Altering Systemtype.VehicleTypeID to NOT NULL';
--   ALTER TABLE dbo.Systemtype
--     ALTER COLUMN VehicleTypeID INT NOT NULL;
-- END
-- ELSE
-- BEGIN
--   PRINT 'Systemtype has NULL VehicleTypeID values; NOT forcing NOT NULL yet';
-- END
*/
