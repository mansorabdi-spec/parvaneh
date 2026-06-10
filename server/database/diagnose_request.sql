-- Diagnostic script to check a specific request
-- Replace 10050 with your actual RequestID

DECLARE @RequestID BIGINT = 10050;

-- Check if request exists
SELECT 'Request Exists' AS [Check], COUNT(*) AS Result
FROM VehicleRequests
WHERE RequestID = @RequestID;

-- Check request details
SELECT 
    'Request Details' AS Info,
    RequestID,
    VehicleID,
    TrackingNo,
    FinalDescription,
    CreatedAt
FROM VehicleRequests
WHERE RequestID = @RequestID;

-- Check if Status column exists
SELECT 
    'Status Column Exists' AS [Check],
    CASE WHEN EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'VehicleRequests' AND COLUMN_NAME = 'Status'
    ) THEN 'YES' ELSE 'NO' END AS Result;

-- Check if workflow columns exist
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'VehicleRequests'
ORDER BY ORDINAL_POSITION;

-- Check if vehicle exists for this request
SELECT 
    'Vehicle Exists' AS [Check],
    COUNT(*) AS Result
FROM VehicleRequests vr
INNER JOIN Vehicles v ON vr.VehicleID = v.VehicleID
WHERE vr.RequestID = @RequestID;

-- Get full request with vehicle info (same query as the API)
SELECT 
    vr.*,
    v.VehicleID AS V_VehicleID,
    v.RegistrarNationalCode
FROM VehicleRequests vr
INNER JOIN Vehicles v ON vr.VehicleID = v.VehicleID
WHERE vr.RequestID = @RequestID;

-- Check if workflow tables exist
SELECT 
    TABLE_NAME,
    CASE WHEN EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = TABLE_SCHEMA.TABLE_NAME) 
        THEN 'EXISTS' 
        ELSE 'MISSING' 
    END AS Status
FROM (
    SELECT 'RequestWorkflowSteps' AS TABLE_NAME
    UNION ALL SELECT 'RequestProcessHistory'
    UNION ALL SELECT 'RolePermissions'
    UNION ALL SELECT 'GlobalApprovalFlowSteps'
) AS TABLE_SCHEMA;
