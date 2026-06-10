-- Check Step 3 status for exploitation licenses in AwaitingPayment

SELECT 
    vr.RequestID,
    vr.TrackingNo,
    vr.Status AS RequestStatus,
    vr.CurrentStepOrder,
    rws.StepOrder,
    rws.RoleName,
    rws.Status AS StepStatus,
    rws.CreatedAt,
    rws.DecidedAt
FROM VehicleRequests vr
INNER JOIN RequestWorkflowSteps rws ON vr.RequestID = rws.RequestID
WHERE vr.Status = 'AwaitingPayment'
ORDER BY vr.RequestID, rws.StepOrder;
