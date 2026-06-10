-- Diagnostic query to check workflow state for Activity License requests
-- Run this to see what's happening with workflow steps

-- 1. Check if LicenseType column exists
SELECT 
  'LicenseType column exists' AS CheckType,
  CASE WHEN EXISTS (
    SELECT * FROM sys.columns 
    WHERE Name = N'LicenseType' AND Object_ID = Object_ID(N'GlobalApprovalFlowSteps')
  ) THEN 'YES' ELSE 'NO - RUN MIGRATION!' END AS Result;

-- 2. Check Activity approval flow steps
SELECT 
  'Activity Approval Flow' AS CheckType,
  COUNT(*) AS StepCount
FROM GlobalApprovalFlowSteps
WHERE LicenseType = 'Activity';

-- 3. Check Employment approval flow steps
SELECT 
  'Employment Approval Flow' AS CheckType,
  COUNT(*) AS StepCount
FROM GlobalApprovalFlowSteps
WHERE LicenseType = 'Employment';

-- 4. Get the most recent Activity License request
SELECT TOP 1
  'Most Recent Activity Request' AS CheckType,
  RequestID,
  TrackingNo,
  Status,
  CurrentStepOrder,
  CreatedAt
FROM VehicleRequests
WHERE TrackingNo LIKE '3%' -- Activity licenses start with 3
ORDER BY CreatedAt DESC;

-- 5. Get workflow steps for the most recent Activity request
SELECT 
  'Workflow Steps for Latest Activity Request' AS CheckType,
  rws.StepOrder,
  rws.RoleName,
  rws.Status,
  rws.CreatedAt
FROM RequestWorkflowSteps rws
WHERE rws.RequestID = (
  SELECT TOP 1 RequestID 
  FROM VehicleRequests 
  WHERE TrackingNo LIKE '3%' 
  ORDER BY CreatedAt DESC
)
ORDER BY rws.StepOrder;

-- 6. Check if there are any payments for the latest request
SELECT 
  'Payments for Latest Activity Request' AS CheckType,
  'Offline' AS PaymentType,
  Amount,
  PayDate,
  CreatedAt
FROM OfflinePayment
WHERE RequestID = (
  SELECT TOP 1 RequestID 
  FROM VehicleRequests 
  WHERE TrackingNo LIKE '3%' 
  ORDER BY CreatedAt DESC
)
UNION ALL
SELECT 
  'Payments for Latest Activity Request' AS CheckType,
  'Online' AS PaymentType,
  Amount,
  CreatedAt,
  CreatedAt
FROM OnlinePayment
WHERE RequestID = (
  SELECT TOP 1 RequestID 
  FROM VehicleRequests 
  WHERE TrackingNo LIKE '3%' 
  ORDER BY CreatedAt DESC
);

-- 7. Check what would appear in Financial Officer's inbox
-- This mimics the inbox query for Financial Officer role
WITH PendingSteps AS (
  SELECT 
    RequestID,
    MIN(StepOrder) AS MinPendingStep
  FROM RequestWorkflowSteps
  WHERE Status = 'Pending'
  GROUP BY RequestID
)
SELECT 
  'Financial Officer Inbox (کارشناس مالی)' AS CheckType,
  rws.RequestID,
  vr.TrackingNo,
  rws.StepOrder,
  rws.RoleName,
  rws.Status AS StepStatus,
  vr.Status AS RequestStatus,
  vr.CurrentStepOrder
FROM RequestWorkflowSteps rws
INNER JOIN VehicleRequests vr ON rws.RequestID = vr.RequestID
INNER JOIN PendingSteps ps ON rws.RequestID = ps.RequestID AND rws.StepOrder = ps.MinPendingStep
WHERE rws.Status = 'Pending'
  AND rws.RoleName = N'کارشناس مالی'
  AND vr.TrackingNo LIKE '3%' -- Activity licenses
ORDER BY vr.CreatedAt DESC;

-- 8. Show all GlobalApprovalFlowSteps
SELECT 
  'All Approval Flow Steps' AS CheckType,
  LicenseType,
  StepOrder,
  RoleName,
  CreatedAt
FROM GlobalApprovalFlowSteps
ORDER BY LicenseType, StepOrder;
