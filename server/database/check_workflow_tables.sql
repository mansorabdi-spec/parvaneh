-- Script to check if workflow tables exist
-- Run this to verify the workflow migration was successful

SELECT 
    'RequestWorkflowSteps' AS TableName,
    CASE WHEN EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'RequestWorkflowSteps') 
        THEN 'EXISTS ✓' 
        ELSE 'MISSING ✗' 
    END AS Status
UNION ALL
SELECT 
    'RequestProcessHistory',
    CASE WHEN EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'RequestProcessHistory') 
        THEN 'EXISTS ✓' 
        ELSE 'MISSING ✗' 
    END
UNION ALL
SELECT 
    'RolePermissions',
    CASE WHEN EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'RolePermissions') 
        THEN 'EXISTS ✓' 
        ELSE 'MISSING ✗' 
    END
UNION ALL
SELECT 
    'GlobalApprovalFlowSteps',
    CASE WHEN EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'GlobalApprovalFlowSteps') 
        THEN 'EXISTS ✓' 
        ELSE 'MISSING ✗' 
    END;

-- Check if VehicleRequests has new columns
SELECT 
    'VehicleRequests.Status' AS ColumnName,
    CASE WHEN EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'VehicleRequests' AND COLUMN_NAME = 'Status') 
        THEN 'EXISTS ✓' 
        ELSE 'MISSING ✗' 
    END AS Status
UNION ALL
SELECT 
    'VehicleRequests.CurrentStepOrder',
    CASE WHEN EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'VehicleRequests' AND COLUMN_NAME = 'CurrentStepOrder') 
        THEN 'EXISTS ✓' 
        ELSE 'MISSING ✗' 
    END
UNION ALL
SELECT 
    'VehicleRequests.SubmittedByUserId',
    CASE WHEN EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'VehicleRequests' AND COLUMN_NAME = 'SubmittedByUserId') 
        THEN 'EXISTS ✓' 
        ELSE 'MISSING ✗' 
    END
UNION ALL
SELECT 
    'VehicleRequests.CompletedAt',
    CASE WHEN EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'VehicleRequests' AND COLUMN_NAME = 'CompletedAt') 
        THEN 'EXISTS ✓' 
        ELSE 'MISSING ✗' 
    END;

-- Check if Finance role exists
SELECT 
    'Finance Role' AS Item,
    CASE WHEN EXISTS (SELECT 1 FROM Roles WHERE Name = 'Finance') 
        THEN 'EXISTS ✓' 
        ELSE 'MISSING ✗' 
    END AS Status;

-- Check if approval flow is configured
SELECT 
    'Approval Flow Steps' AS Item,
    CAST(COUNT(*) AS NVARCHAR(10)) + ' steps configured' AS Status
FROM GlobalApprovalFlowSteps;

-- Check role permissions
SELECT 
    'Role Permissions' AS Item,
    CAST(COUNT(*) AS NVARCHAR(10)) + ' permissions configured' AS Status
FROM RolePermissions;
