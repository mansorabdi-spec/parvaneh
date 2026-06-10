-- Create SequenceCounters table to prevent duplicate tracking numbers
-- This table stores the last used sequence number for each license type/prefix

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SequenceCounters')
BEGIN
  CREATE TABLE [dbo].[SequenceCounters] (
    [Id] INT IDENTITY(1,1) PRIMARY KEY,
    [CounterType] NVARCHAR(50) NOT NULL, -- 'Activity', 'Employment', 'Exploitation', etc.
    [Prefix] NVARCHAR(20) NOT NULL,      -- e.g., '3203', '2103', '1118'
    [LastSequence] INT NOT NULL DEFAULT 0,
    [UpdatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT UQ_SequenceCounters_Type_Prefix UNIQUE (CounterType, Prefix)
  );

  PRINT 'Table SequenceCounters created successfully';
END
ELSE
BEGIN
  PRINT 'Table SequenceCounters already exists';
END

GO

-- Initialize default counters for each license type
-- Activity License: starts at 30010
IF NOT EXISTS (SELECT * FROM SequenceCounters WHERE CounterType = 'Activity')
BEGIN
  INSERT INTO SequenceCounters (CounterType, Prefix, LastSequence, UpdatedAt)
  VALUES ('Activity', 'DEFAULT', 30009, GETUTCDATE());
  PRINT 'Activity license counter initialized';
END

-- Employment License: starts at 10001
IF NOT EXISTS (SELECT * FROM SequenceCounters WHERE CounterType = 'Employment')
BEGIN
  INSERT INTO SequenceCounters (CounterType, Prefix, LastSequence, UpdatedAt)
  VALUES ('Employment', 'DEFAULT', 10000, GETUTCDATE());
  PRINT 'Employment license counter initialized';
END

-- Exploitation License: starts at 1201
IF NOT EXISTS (SELECT * FROM SequenceCounters WHERE CounterType = 'Exploitation')
BEGIN
  INSERT INTO SequenceCounters (CounterType, Prefix, LastSequence, UpdatedAt)
  VALUES ('Exploitation', 'DEFAULT', 1200, GETUTCDATE());
  PRINT 'Exploitation license counter initialized';
END

GO

-- Migrate existing tracking numbers to SequenceCounters
-- This ensures we don't reuse any existing numbers

PRINT 'Migrating existing tracking numbers...';

-- Activity licenses (3XXX-NNNNN format)
DECLARE @maxActivitySeq INT;
SELECT @maxActivitySeq = MAX(CAST(SUBSTRING(TrackingNo, CHARINDEX('-', TrackingNo) + 1, 10) AS INT))
FROM VehicleRequests
WHERE TrackingNo LIKE '3%-%' AND LicenseTypeId IN (66, 67);

IF @maxActivitySeq IS NOT NULL AND @maxActivitySeq > 30009
BEGIN
  UPDATE SequenceCounters
  SET LastSequence = @maxActivitySeq, UpdatedAt = GETUTCDATE()
  WHERE CounterType = 'Activity' AND Prefix = 'DEFAULT';
  PRINT 'Activity counter updated to: ' + CAST(@maxActivitySeq AS NVARCHAR(10));
END

-- Employment licenses (2XXX-NNNNN format)
DECLARE @maxEmploymentSeq INT;
SELECT @maxEmploymentSeq = MAX(CAST(SUBSTRING(TrackingNo, CHARINDEX('-', TrackingNo) + 1, 10) AS INT))
FROM VehicleRequests
WHERE TrackingNo LIKE '2%-%' AND LicenseTypeId = 67;

IF @maxEmploymentSeq IS NOT NULL AND @maxEmploymentSeq > 10000
BEGIN
  UPDATE SequenceCounters
  SET LastSequence = @maxEmploymentSeq, UpdatedAt = GETUTCDATE()
  WHERE CounterType = 'Employment' AND Prefix = 'DEFAULT';
  PRINT 'Employment counter updated to: ' + CAST(@maxEmploymentSeq AS NVARCHAR(10));
END

-- Exploitation licenses (11YY-NNNN format)
DECLARE @maxExploitationSeq INT;
SELECT @maxExploitationSeq = MAX(CAST(SUBSTRING(TrackingNo, CHARINDEX('-', TrackingNo) + 1, 10) AS INT))
FROM VehicleRequests
WHERE TrackingNo LIKE '11%-%' AND LicenseTypeId = 68;

IF @maxExploitationSeq IS NOT NULL AND @maxExploitationSeq > 1200
BEGIN
  UPDATE SequenceCounters
  SET LastSequence = @maxExploitationSeq, UpdatedAt = GETUTCDATE()
  WHERE CounterType = 'Exploitation' AND Prefix = 'DEFAULT';
  PRINT 'Exploitation counter updated to: ' + CAST(@maxExploitationSeq AS NVARCHAR(10));
END

PRINT 'Migration completed successfully';

GO

-- Verify the counters
SELECT * FROM SequenceCounters;
