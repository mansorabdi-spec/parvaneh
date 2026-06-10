-- Fix existing legal entity activity license requests
-- This updates VehicleRequests records where:
-- 1. They have a vehicle (activity licenses always have vehicles)
-- 2. CompanyNationalId is NULL but should have a company
-- 3. The vehicle's RegistrarNationalCode points to a company

-- First, let's see what data we have
SELECT 
    vr.RequestID,
    vr.TrackingNo,
    vr.NationalCode AS CurrentNationalCode,
    vr.CompanyNationalId AS CurrentCompanyNationalId,
    v.RegistrarNationalCode AS VehicleRegistrarCode,
    ci.NationalId AS CompanyNationalId_Correct,
    ci.CompanyName,
    ci.NationalCode AS CompanyManagerCode
FROM VehicleRequests vr
INNER JOIN Vehicles v ON vr.VehicleID = v.VehicleID
LEFT JOIN CompanyInfo ci ON v.RegistrarNationalCode = ci.NationalId
WHERE 
    vr.VehicleID IS NOT NULL -- Activity licenses have vehicles
    AND vr.CompanyNationalId IS NULL -- Should have been set but wasn't
    AND ci.NationalId IS NOT NULL -- Company exists
ORDER BY vr.RequestID;

-- Now update the records to fix them
-- Set CompanyNationalId = company's NationalId
-- Set NationalCode = NULL (since it's a company license, not individual)
/*
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

-- Show results
SELECT 
    vr.RequestID,
    vr.TrackingNo,
    vr.NationalCode,
    vr.CompanyNationalId,
    v.RegistrarNationalCode AS VehicleRegistrarCode,
    ci.NationalId AS CompanyNationalId,
    ci.CompanyName
FROM VehicleRequests vr
INNER JOIN Vehicles v ON vr.VehicleID = v.VehicleID
LEFT JOIN CompanyInfo ci ON vr.CompanyNationalId = ci.NationalId
WHERE 
    vr.VehicleID IS NOT NULL
    AND vr.CompanyNationalId IS NOT NULL
ORDER BY vr.RequestID;
*/
