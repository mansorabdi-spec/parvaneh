-- Check request 30341 details
SELECT 
    vr.RequestID,
    vr.TrackingNo,
    vr.NationalCode,
    vr.CompanyNationalId,
    vr.VehicleID,
    v.RegistrarNationalCode AS Vehicle_RegistrarNationalCode
FROM VehicleRequests vr
LEFT JOIN Vehicles v ON vr.VehicleID = v.VehicleID
WHERE vr.RequestID = 30341;

-- Check if company exists with NationalId = 98765432101
SELECT 
    NationalId,
    NationalCode,
    CompanyName,
    RegistrationNo
FROM CompanyInfo
WHERE NationalId = '98765432101';

-- Check the vehicle's registrar
SELECT 
    VehicleID,
    RegistrarNationalCode
FROM Vehicles
WHERE VehicleID = 84;

-- Check if there's a company with the vehicle's registrar code
SELECT 
    ci.NationalId,
    ci.NationalCode,
    ci.CompanyName,
    v.VehicleID,
    v.RegistrarNationalCode
FROM Vehicles v
LEFT JOIN CompanyInfo ci ON v.RegistrarNationalCode = ci.NationalId
WHERE v.VehicleID = 84;
