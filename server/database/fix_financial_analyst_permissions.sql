-- Fix permissions for کارشناس مالی (Financial Analyst) role
-- This script adds the necessary permissions so financial analysts can view request information

-- Add role if it doesn't exist
IF NOT EXISTS (SELECT 1 FROM Roles WHERE Name = N'کارشناس مالی')
BEGIN
  INSERT INTO Roles (Name) VALUES (N'کارشناس مالی');
  PRINT 'Role کارشناس مالی created';
END
ELSE
BEGIN
  PRINT 'Role کارشناس مالی already exists';
END;
GO

-- Add permissions for کارشناس مالی (Financial Analyst)
-- Financial analysts should be able to view:
-- - Person info (to identify the applicant)
-- - Vehicle info (to see what vehicle the request is for)
-- - Residences and contacts (for verification)
-- - Payments (their primary responsibility)
-- - Payment documents
-- They should be able to approve/reject requests in their workflow step

IF NOT EXISTS (SELECT 1 FROM RolePermissions WHERE RoleName = N'کارشناس مالی' AND PermissionKey = 'view_person_info')
BEGIN
  INSERT INTO RolePermissions (RoleName, PermissionKey, CanView, CanEdit) VALUES
  -- Person information (view only)
  (N'کارشناس مالی', 'view_person_info', 1, 0),
  (N'کارشناس مالی', 'view_residences', 1, 0),
  (N'کارشناس مالی', 'view_contacts', 1, 0),
  
  -- Vehicle information (view only)
  (N'کارشناس مالی', 'view_vehicle_info', 1, 0),
  
  -- Payment information (view and edit for offline payments)
  (N'کارشناس مالی', 'view_payments', 1, 1),
  (N'کارشناس مالی', 'view_payment_documents', 1, 0),
  
  -- Discount information (view only to see final amounts)
  (N'کارشناس مالی', 'view_discounts', 1, 0),
  (N'کارشناس مالی', 'view_discount_documents', 1, 0),
  
  -- Approval permissions
  (N'کارشناس مالی', 'approve_request', 1, 0),
  (N'کارشناس مالی', 'reject_request', 1, 0);
  
  PRINT 'Permissions added for کارشناس مالی';
END
ELSE
BEGIN
  PRINT 'Permissions for کارشناس مالی already exist';
END;
GO

-- Verify the permissions were added
SELECT 
  RoleName,
  PermissionKey,
  CanView,
  CanEdit
FROM RolePermissions
WHERE RoleName = N'کارشناس مالی'
ORDER BY PermissionKey;
GO

PRINT 'Financial Analyst permissions setup complete!';
