-- ==============================================================================
-- STEP 1: Check which requests need to be fixed
-- ==============================================================================
-- This query shows legal entity activity licenses that have incorrect data
SELECT 
    vr.RequestID,
    vr.TrackingNo,
    vr.NationalCode AS 'Current_NationalCode (WRONG)',
    vr.CompanyNationalId AS 'Current_CompanyNationalId (NULL)',
    v.RegistrarNationalCode AS 'Vehicle_RegistrarCode',
    ci.NationalId AS 'Company_NationalId (CORRECT)',
    ci.CompanyName,
    ci.NationalCode AS 'Company_ManagerCode'
FROM VehicleRequests vr
INNER JOIN Vehicles v ON vr.VehicleID = v.VehicleID
LEFT JOIN CompanyInfo ci ON v.RegistrarNationalCode = ci.NationalId
WHERE 
    vr.VehicleID IS NOT NULL -- Activity licenses have vehicles
    AND vr.CompanyNationalId IS NULL -- Should have been set but wasn't
    AND ci.NationalId IS NOT NULL -- Company exists
ORDER BY vr.RequestID;

-- ==============================================================================
-- STEP 2: Fix the data
-- ==============================================================================
-- Uncomment and run this UPDATE statement after reviewing the results above
/*
BEGIN TRANSACTION;

UPDATE vr
SET 
    vr.CompanyNationalId = ci.NationalId,
    vr.NationalCode = NULL
FROM VehicleRequests vr
INNER JOIN Vehicles v ON vr.VehicleID = v.VehicleID
INNER JOIN CompanyInfo ci ON v.RegistrarNationalCode = ci.NationalId
WHERE 
    vr.VehicleID IS NOT NULL -- Activity licenses have vehicles
    AND vr.CompanyNationalId IS NULL -- Needs to be fixed
    AND ci.NationalId IS NOT NULL; -- Company exists

-- Check results
SELECT @@ROWCOUNT AS 'Rows Updated';

COMMIT TRANSACTION;
*/

-- ==============================================================================
-- STEP 3: Verify the fix
-- ==============================================================================
-- Run this after the UPDATE to verify everything is correct
/*
SELECT 
    vr.RequestID,
    vr.TrackingNo,
    vr.NationalCode AS 'NationalCode (should be NULL)',
    vr.CompanyNationalId AS 'CompanyNationalId (should have value)',
    v.RegistrarNationalCode AS 'Vehicle_RegistrarCode',
    ci.NationalId AS 'Company_NationalId',
    ci.CompanyName
FROM VehicleRequests vr
INNER JOIN Vehicles v ON vr.VehicleID = v.VehicleID
LEFT JOIN CompanyInfo ci ON vr.CompanyNationalId = ci.NationalId
WHERE 
    vr.VehicleID IS NOT NULL
    AND vr.CompanyNationalId IS NOT NULL
ORDER BY vr.RequestID;
*/
