-- Repair requests that have payment but financial step was never activated (Status = NotStarted)
-- Run after deploying inbox/payment fixes. Review results before committing in production.

PRINT '=== Activating stuck financial workflow steps after payment ===';

UPDATE rws
SET Status = 'Pending'
FROM RequestWorkflowSteps rws
INNER JOIN VehicleRequests vr ON vr.RequestID = rws.RequestID
WHERE LTRIM(RTRIM(rws.RoleName)) = N'کارشناس مالی'
  AND rws.Status = 'NotStarted'
  AND rws.StepOrder = (
    SELECT MIN(x.StepOrder)
    FROM RequestWorkflowSteps x
    WHERE x.RequestID = rws.RequestID AND x.Status = 'NotStarted'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM RequestWorkflowSteps x2
    WHERE x2.RequestID = rws.RequestID AND x2.Status = 'Pending'
  )
  AND (
    EXISTS (SELECT 1 FROM OfflinePayment op WHERE op.RequestID = vr.RequestID)
    OR EXISTS (
      SELECT 1 FROM OnlinePayment op
      WHERE op.RequestID = vr.RequestID AND op.PayedBit = 1
    )
  );

PRINT CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' financial step(s) set to Pending';

-- Show what would appear in financial inbox (sample)
WITH PendingSteps AS (
  SELECT RequestID, MIN(StepOrder) AS MinPendingStep
  FROM RequestWorkflowSteps
  WHERE Status = 'Pending'
  GROUP BY RequestID
)
SELECT TOP 50
  vr.TrackingNo,
  rws.StepOrder,
  rws.RoleName,
  rws.Status,
  vr.Status AS RequestStatus
FROM RequestWorkflowSteps rws
INNER JOIN VehicleRequests vr ON vr.RequestID = rws.RequestID
INNER JOIN PendingSteps ps ON rws.RequestID = ps.RequestID AND rws.StepOrder = ps.MinPendingStep
WHERE rws.Status = 'Pending'
  AND LTRIM(RTRIM(rws.RoleName)) = N'کارشناس مالی'
ORDER BY vr.CreatedAt DESC;
