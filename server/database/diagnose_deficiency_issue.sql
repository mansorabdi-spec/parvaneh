-- Diagnose Deficiency Reassignment Issue
-- This script helps identify why the case is being reassigned to the wrong reviewer

-- Replace @RequestID with the actual RequestID you're testing with
DECLARE @RequestID BIGINT = 123; -- CHANGE THIS TO YOUR REQUEST ID

PRINT '========================================';
PRINT 'DEFICIENCY DIAGNOSIS FOR REQUEST: ' + CAST(@RequestID AS VARCHAR);
PRINT '========================================';
PRINT '';

-- 1. Check VehicleRequests deficiency info
PRINT '1. VehicleRequests Deficiency Info:';
SELECT 
    RequestID,
    TrackingNo,
    CurrentStepOrder,
    HasDeficiency,
    DeficiencySenderStepOrder,
    DeficiencySenderUserId,
    Status
FROM VehicleRequests
WHERE RequestID = @RequestID;
PRINT '';

-- 2. Check all workflow steps for this request
PRINT '2. All Workflow Steps:';
SELECT 
    Id,
    StepOrder,
    RoleName,
    Status,
    AssignedUserId,
    DecidedByUserId,
    DecidedAt,
    Notes
FROM RequestWorkflowSteps
WHERE RequestID = @RequestID
ORDER BY StepOrder;
PRINT '';

-- 3. Check which step has Status = 'FixDeficiency'
PRINT '3. Step with FixDeficiency Status:';
SELECT 
    Id,
    StepOrder,
    RoleName,
    Status,
    DecidedByUserId,
    DecidedAt,
    Notes
FROM RequestWorkflowSteps
WHERE RequestID = @RequestID 
    AND Status = 'FixDeficiency';
PRINT '';

-- 4. Check the user who requested the deficiency fix
PRINT '4. User Who Requested Deficiency Fix:';
SELECT 
    u.Id AS UserId,
    u.FullName,
    u.Role
FROM VehicleRequests vr
LEFT JOIN Users u ON vr.DeficiencySenderUserId = u.Id
WHERE vr.RequestID = @RequestID;
PRINT '';

-- 5. Check process history
PRINT '5. Recent Process History:';
SELECT TOP 10
    ActionType,
    ActionByUserName,
    ActionByRole,
    FromStatus,
    ToStatus,
    StepOrder,
    Notes,
    CreatedAt
FROM RequestProcessHistory
WHERE RequestID = @RequestID
ORDER BY CreatedAt DESC;
PRINT '';

-- 6. Find the step that should be reassigned (based on DeficiencySenderStepOrder)
PRINT '6. Step That Should Be Reassigned (based on DeficiencySenderStepOrder):';
SELECT 
    rws.Id,
    rws.StepOrder,
    rws.RoleName,
    rws.Status,
    rws.AssignedUserId,
    u.FullName AS AssignedUserName,
    u.Role AS AssignedUserRole
FROM VehicleRequests vr
INNER JOIN RequestWorkflowSteps rws ON vr.RequestID = rws.RequestID 
    AND vr.DeficiencySenderStepOrder = rws.StepOrder
LEFT JOIN Users u ON rws.AssignedUserId = u.Id
WHERE vr.RequestID = @RequestID;
PRINT '';

PRINT '========================================';
PRINT 'DIAGNOSIS COMPLETE';
PRINT '========================================';
