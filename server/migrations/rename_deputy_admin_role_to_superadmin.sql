-- Rename the deputy-admin role to superadmin.
-- Optional columns are updated with dynamic SQL so a missing column does not stop the batch.

DECLARE @OldRole NVARCHAR(50) = N'نایب ادمین';
DECLARE @NewRole NVARCHAR(50) = N'superadmin';

IF OBJECT_ID(N'dbo.Roles', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM dbo.Roles WHERE Name = @OldRole)
   AND NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Name = @NewRole)
BEGIN
    UPDATE dbo.Roles SET Name = @NewRole WHERE Name = @OldRole;
END
GO

DECLARE @OldRole NVARCHAR(50) = N'نایب ادمین';
DECLARE @NewRole NVARCHAR(50) = N'superadmin';
DECLARE @sql NVARCHAR(MAX);

DECLARE @targets TABLE (TableName SYSNAME, ColumnName SYSNAME);
INSERT INTO @targets (TableName, ColumnName) VALUES
    (N'Users', N'Role'),
    (N'RolePermissions', N'RoleName'),
    (N'GlobalApprovalFlowSteps', N'RoleName'),
    (N'RequestWorkflowSteps', N'RoleName'),
    (N'RequestProcessHistory', N'ActionByRole'),
    (N'LicenseApprovals', N'ApproverRole'),
    (N'LicenseHistory', N'IssuedByRole'),
    (N'LicenseRenewalHistory', N'RenewedByRole'),
    (N'EmploymentRequestWorkflowSteps', N'RoleName');

DECLARE @table SYSNAME, @column SYSNAME;
DECLARE target_cursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT TableName, ColumnName FROM @targets;
OPEN target_cursor;
FETCH NEXT FROM target_cursor INTO @table, @column;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF OBJECT_ID(N'dbo.' + @table, N'U') IS NOT NULL
       AND COL_LENGTH(N'dbo.' + @table, @column) IS NOT NULL
    BEGIN
        SET @sql = N'UPDATE dbo.' + QUOTENAME(@table)
            + N' SET ' + QUOTENAME(@column) + N' = @NewRole WHERE ' + QUOTENAME(@column) + N' = @OldRole';
        EXEC sp_executesql @sql, N'@OldRole NVARCHAR(50), @NewRole NVARCHAR(50)', @OldRole, @NewRole;
    END
    FETCH NEXT FROM target_cursor INTO @table, @column;
END
CLOSE target_cursor;
DEALLOCATE target_cursor;
GO
