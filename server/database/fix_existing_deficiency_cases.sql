-- Fix Existing Deficiency Cases
-- This script converts old DeficiencySenderStepOrder values (which stored StepOrder)
-- to new values (which should store Step ID)

-- IMPORTANT: Run this script ONCE after deploying the new code
-- This will fix all existing deficiency cases to use step IDs instead of step orders

PRINT '========================================';
PRINT 'FIXING EXISTING DEFICIENCY CASES';
PRINT '========================================';
PRINT '';

-- Find all requests with deficiency status
DECLARE @RequestID BIGINT;
DECLARE @OldStepOrder INT;
DECLARE @NewStepId BIGINT;
DECLARE @FixedCount INT = 0;

DECLARE deficiency_cursor CURSOR FOR
SELECT RequestID, DeficiencySenderStepOrder
FROM VehicleRequests
WHERE HasDeficiency = 1 
  AND DeficiencySenderStepOrder IS NOT NULL;

OPEN deficiency_cursor;
FETCH NEXT FROM deficiency_cursor INTO @RequestID, @OldStepOrder;

WHILE @@FETCH_STATUS = 0
BEGIN
    -- Find the step ID that corresponds to this StepOrder
    -- We look for the step with Status = 'FixDeficiency' first
    SELECT TOP 1 @NewStepId = Id
    FROM RequestWorkflowSteps
    WHERE RequestID = @RequestID 
      AND StepOrder = @OldStepOrder
      AND Status = 'FixDeficiency'
    ORDER BY DecidedAt DESC;
    
    -- If no FixDeficiency step found, try to find any step with that order
    IF @NewStepId IS NULL
    BEGIN
        SELECT TOP 1 @NewStepId = Id
        FROM RequestWorkflowSteps
        WHERE RequestID = @RequestID 
          AND StepOrder = @OldStepOrder
        ORDER BY Id DESC;
    END
    
    -- Update the request if we found a step ID
    IF @NewStepId IS NOT NULL
    BEGIN
        UPDATE VehicleRequests
        SET DeficiencySenderStepOrder = @NewStepId
        WHERE RequestID = @RequestID;
        
        PRINT 'Fixed RequestID ' + CAST(@RequestID AS VARCHAR) + ': StepOrder ' + CAST(@OldStepOrder AS VARCHAR) + ' -> StepId ' + CAST(@NewStepId AS VARCHAR);
        SET @FixedCount = @FixedCount + 1;
    END
    ELSE
    BEGIN
        PRINT 'WARNING: Could not find step for RequestID ' + CAST(@RequestID AS VARCHAR) + ' with StepOrder ' + CAST(@OldStepOrder AS VARCHAR);
    END
    
    SET @NewStepId = NULL;
    FETCH NEXT FROM deficiency_cursor INTO @RequestID, @OldStepOrder;
END

CLOSE deficiency_cursor;
DEALLOCATE deficiency_cursor;

PRINT '';
PRINT '========================================';
PRINT 'FIXED ' + CAST(@FixedCount AS VARCHAR) + ' DEFICIENCY CASES';
PRINT '========================================';
